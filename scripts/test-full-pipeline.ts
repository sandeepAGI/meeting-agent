#!/usr/bin/env node
/**
 * End-to-End Pipeline Test
 *
 * Tests the complete meeting intelligence pipeline using production code:
 * 1. Load transcript and calendar metadata
 * 2. Fetch email context (two-tier search)
 * 3. Generate Pass 1 summary (speaker ID + initial summary)
 * 4. Generate Pass 2 summary (validation + refinement)
 * 5. Display results and evaluation
 *
 * Usage:
 *   npx tsx scripts/test-full-pipeline.ts <transcript.json> <calendar.json>
 *
 * Example:
 *   npx tsx scripts/test-full-pipeline.ts \
 *     tests/fixtures/manual-e2e/converted/2025-10-7-Sync-3.json \
 *     tests/fixtures/manual-e2e/converted/2025-10-7-Sync-3-calendar.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../src/services/database';
import { MeetingIntelligenceService } from '../src/services/meetingIntelligence';
import { EmailContextService } from '../src/services/emailContext';
import { GraphApiService } from '../src/services/graphApi';
import { M365AuthService } from '../src/services/m365Auth';
import { ClaudeBatchService } from '../src/services/claudeBatch';
import type { ConvertedTranscript } from './convert-teams-transcript';

// Load environment variables (suppress output)
dotenv.config({ override: false });

interface CalendarMetadata {
  meeting: any;
  searchDate: string;
  matchConfidence: string;
  matchReason: string;
}

interface TestResult {
  transcript: ConvertedTranscript;
  calendar: CalendarMetadata;
  meetingId: string;
  recordingId: string;
  transcriptId: string;
  diarizationId: string;
  summaryId: string;
  emailCount: number;
  pass1Result: any;
  pass2Result: any;
  finalSummary: any;
  duration: {
    emailFetch: number;
    pass1: number;
    pass2: number;
    total: number;
  };
}

/**
 * Format transcript as text with speaker labels
 */
function formatTranscript(transcript: ConvertedTranscript): string {
  return transcript.segments
    .map(seg => `[${seg.speaker}] ${seg.text}`)
    .join('\n');
}

/**
 * Poll for summary status with progress display
 */
async function pollForCompletion(
  intelligenceService: MeetingIntelligenceService,
  summaryId: string,
  phase: string
): Promise<any> {
  const startTime = Date.now();
  let iteration = 0;

  console.log(`\n${phase}: Waiting for batch processing...`);

  while (true) {
    iteration++;
    const status = await intelligenceService.getSummaryStatus(summaryId);

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    if (status.status === 'completed' || status.status === 'complete') {
      console.log(`✅ ${phase} completed after ${minutes}m ${seconds}s`);
      return status;
    } else if (status.status === 'failed') {
      throw new Error(`${phase} failed: ${status.error || 'Unknown error'}`);
    } else if (status.status === 'cancelled') {
      throw new Error(`${phase} was cancelled`);
    }

    // Display progress
    const statusIcon = status.status === 'processing' ? '⏳' : '🔄';
    console.log(`${statusIcon} [${minutes}m ${seconds}s] ${status.status} (check ${iteration})`);

    // Wait before next check (adaptive polling)
    let waitTime = 5000; // Start with 5 seconds
    if (elapsed > 300) waitTime = 30000; // After 5 min, check every 30s
    else if (elapsed > 120) waitTime = 10000; // After 2 min, check every 10s

    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
}

/**
 * Save results to file
 */
function saveResults(result: TestResult, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
}

/**
 * Display evaluation report
 */
function displayEvaluation(result: TestResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('EVALUATION REPORT');
  console.log('='.repeat(80));

  console.log('\n📊 SUMMARY STATISTICS:');
  console.log(`  Transcript: ${result.transcript.segments.length} segments, ${Math.floor(result.transcript.metadata.totalDuration! / 60)}m duration`);
  console.log(`  Speakers: ${Object.keys(result.transcript.speakers).length} (${Object.values(result.transcript.speakers).join(', ')})`);
  console.log(`  Email Context: ${result.emailCount} emails fetched`);
  console.log(`  Calendar Match: ${result.calendar.matchConfidence} confidence (${result.calendar.matchReason})`);

  console.log('\n⏱️  PROCESSING TIME:');
  console.log(`  Email Fetch: ${result.duration.emailFetch}ms`);
  console.log(`  Pass 1 (Speaker ID + Summary): ${Math.floor(result.duration.pass1 / 1000)}s`);
  console.log(`  Pass 2 (Validation): ${Math.floor(result.duration.pass2 / 1000)}s`);
  console.log(`  Total: ${Math.floor(result.duration.total / 1000)}s`);

  if (result.finalSummary) {
    // Parse JSON fields from database (same logic as production UI)
    const speakers = JSON.parse(
      result.finalSummary.final_speakers_json ||
      result.finalSummary.pass2_validated_speakers_json ||
      result.finalSummary.pass1_speaker_mappings_json ||
      '[]'
    );
    const actionItems = JSON.parse(
      result.finalSummary.final_action_items_json ||
      result.finalSummary.pass2_validated_action_items_json ||
      result.finalSummary.pass1_action_items_json ||
      '[]'
    );
    const keyDecisions = JSON.parse(
      result.finalSummary.final_key_decisions_json ||
      result.finalSummary.pass2_validated_key_decisions_json ||
      result.finalSummary.pass1_key_decisions_json ||
      '[]'
    );
    const summary = result.finalSummary.final_summary ||
      result.finalSummary.pass2_refined_summary ||
      result.finalSummary.pass1_summary ||
      '';

    console.log('\n📝 FINAL SUMMARY:');
    console.log(`  Speaker Mappings: ${speakers.length}`);
    console.log(`  Action Items: ${actionItems.length}`);
    console.log(`  Key Decisions: ${keyDecisions.length}`);

    if (speakers.length > 0) {
      console.log('\n🗣️  SPEAKER IDENTIFICATION:');
      speakers.forEach((speaker: any) => {
        console.log(`  ${speaker.label} → ${speaker.name} <${speaker.email}> (${speaker.confidence} confidence)`);
      });
    }

    if (actionItems.length > 0) {
      console.log('\n✅ ACTION ITEMS:');
      actionItems.forEach((item: any, i: number) => {
        console.log(`  ${i + 1}. ${item.description}`);
        if (item.assignee) console.log(`     Assignee: ${item.assignee}`);
        if (item.priority) console.log(`     Priority: ${item.priority}`);
        if (item.dueDate) console.log(`     Due: ${item.dueDate}`);
      });
    }

    if (keyDecisions.length > 0) {
      console.log('\n🎯 KEY DECISIONS:');
      keyDecisions.forEach((decision: string, i: number) => {
        console.log(`  ${i + 1}. ${decision}`);
      });
    }

    if (summary) {
      console.log('\n📄 MEETING SUMMARY:');
      console.log(`  ${summary.substring(0, 500)}${summary.length > 500 ? '...' : ''}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * Main pipeline test function
 */
async function runPipelineTest(transcriptPath: string, calendarPath: string): Promise<void> {
  const startTime = Date.now();

  console.log('='.repeat(80));
  console.log('END-TO-END PIPELINE TEST');
  console.log('='.repeat(80));

  console.log('\n📂 Loading test data...');

  // Load transcript
  const transcriptContent = fs.readFileSync(transcriptPath, 'utf-8');
  const transcript: ConvertedTranscript = JSON.parse(transcriptContent);
  console.log(`  ✅ Transcript: ${transcript.segments.length} segments, ${Object.keys(transcript.speakers).length} speakers`);

  // Load calendar metadata
  const calendarContent = fs.readFileSync(calendarPath, 'utf-8');
  const calendar: CalendarMetadata = JSON.parse(calendarContent);
  console.log(`  ✅ Calendar: "${calendar.meeting?.subject}" (${calendar.matchConfidence} match)`);

  // Initialize services
  console.log('\n🔧 Initializing services...');

  // Database
  const dbPath = path.join(process.cwd(), 'data', 'test-meeting-agent.db');
  const dbService = new DatabaseService(dbPath);
  console.log('  ✅ Database initialized');

  // M365 Auth
  const clientId = process.env.AZURE_CLIENT_ID;
  if (!clientId) {
    throw new Error('AZURE_CLIENT_ID not found in environment');
  }

  const authService = new M365AuthService(clientId);
  await authService.initialize();

  const authState = authService.getAuthState();
  if (!authState.isAuthenticated) {
    throw new Error('Not authenticated. Please run the app and log in first.');
  }

  const token = await authService.getAccessToken();
  if (!token) {
    throw new Error('Failed to get access token');
  }

  console.log(`  ✅ Authenticated as: ${authState.user?.name}`);

  // Graph API
  const graphService = new GraphApiService();
  graphService.initialize(token);

  // Get Graph Client for EmailContextService
  const graphClient = graphService.getClient();
  if (!graphClient) {
    throw new Error('Failed to initialize Graph API client');
  }

  // Email Context Service
  const emailService = new EmailContextService(graphClient, dbService);

  // Claude Batch Service
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment');
  }

  const claudeService = new ClaudeBatchService(apiKey);

  // Meeting Intelligence Service
  const intelligenceService = new MeetingIntelligenceService(claudeService, emailService, dbService);
  console.log('  ✅ All services initialized');

  // Save meeting to database
  console.log('\n💾 Saving test data to database...');

  const meetingId = calendar.meeting.id;
  dbService.saveMeeting({
    id: meetingId,
    subject: calendar.meeting.subject,
    start_time: calendar.meeting.start, // Already an ISO string from GraphAPI
    end_time: calendar.meeting.end, // Already an ISO string from GraphAPI
    organizer_name: calendar.meeting.organizer.name,
    organizer_email: calendar.meeting.organizer.email,
    attendees_json: JSON.stringify(calendar.meeting.attendees),
    is_online_meeting: calendar.meeting.isOnlineMeeting,
    online_meeting_url: calendar.meeting.onlineMeetingUrl,
    location: calendar.meeting.location
  });
  console.log(`  ✅ Meeting saved (ID: ${meetingId})`);

  const recordingId = randomUUID();
  dbService.saveRecording({
    id: recordingId,
    meeting_id: meetingId,
    file_path: transcriptPath,
    file_size_bytes: fs.statSync(transcriptPath).size,
    duration_seconds: transcript.metadata.totalDuration!,
    sample_rate: 16000,
    channels: 1,
    format: 'json'
  });
  console.log(`  ✅ Recording saved (ID: ${recordingId})`);

  const formattedTranscript = formatTranscript(transcript);
  const transcriptId = randomUUID();
  dbService.saveTranscript({
    id: transcriptId,
    recording_id: recordingId,
    transcript_text: formattedTranscript,
    segments_json: JSON.stringify(transcript.segments),
    language: 'en',
    processing_time_seconds: 0,
    model_used: 'teams-export'
  });
  console.log(`  ✅ Transcript saved (ID: ${transcriptId})`);

  const diarizationId = randomUUID();
  dbService.saveDiarizationResult({
    id: diarizationId,
    transcript_id: transcriptId,
    segments_json: JSON.stringify(transcript.segments),
    num_speakers: Object.keys(transcript.speakers).length,
    processing_time_seconds: 0,
    device_used: 'teams-export'
  });
  console.log(`  ✅ Diarization saved (ID: ${diarizationId})`);

  // Fetch email context
  console.log('\n📧 Fetching email context...');
  const emailStart = Date.now();

  const participantEmails = calendar.meeting.attendees
    .map((a: any) => a.email)
    .filter((e: string) => e);

  const emails = await emailService.getEmailsForMeeting(
    meetingId,
    participantEmails,
    {
      maxEmails: 10,
      maxBodyLength: 2000,
      includeBody: true,
      daysBack: 30
    },
    calendar.meeting.subject
  );

  const emailDuration = Date.now() - emailStart;
  console.log(`  ✅ Fetched ${emails.length} emails in ${emailDuration}ms`);

  // Generate summary (two-pass workflow)
  console.log('\n🤖 Starting two-pass LLM workflow...');
  console.log('  This will use the Anthropic Batch API (may take 30-60 minutes)');

  const summaryStart = Date.now();
  const summaryId = await intelligenceService.generateSummary(meetingId, transcriptId);
  console.log(`  ✅ Summary generation started (ID: ${summaryId})`);

  // Poll for Pass 1 completion
  const pass1Start = Date.now();
  const pass1Status = await pollForCompletion(intelligenceService, summaryId, 'Pass 1');
  const pass1Duration = Date.now() - pass1Start;

  // Poll for Pass 2 completion
  const pass2Start = Date.now();
  const pass2Status = await pollForCompletion(intelligenceService, summaryId, 'Pass 2');
  const pass2Duration = Date.now() - pass2Start;

  // Get final summary
  const finalSummary = dbService.getSummary(summaryId);

  const totalDuration = Date.now() - startTime;

  // Build result object
  const result: TestResult = {
    transcript,
    calendar,
    meetingId,
    recordingId,
    transcriptId,
    diarizationId,
    summaryId,
    emailCount: emails.length,
    pass1Result: pass1Status,
    pass2Result: pass2Status,
    finalSummary,
    duration: {
      emailFetch: emailDuration,
      pass1: pass1Duration,
      pass2: pass2Duration,
      total: totalDuration
    }
  };

  // Save results
  const outputPath = transcriptPath.replace('.json', '-test-results.json');
  saveResults(result, outputPath);

  // Display evaluation
  displayEvaluation(result);
}

// CLI entry point
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: npx tsx scripts/test-full-pipeline.ts <transcript.json> <calendar.json>');
  console.error('\nExample:');
  console.error('  npx tsx scripts/test-full-pipeline.ts \\');
  console.error('    tests/fixtures/manual-e2e/converted/2025-10-7-Sync-3.json \\');
  console.error('    tests/fixtures/manual-e2e/converted/2025-10-7-Sync-3-calendar.json');
  process.exit(1);
}

const transcriptPath = args[0];
const calendarPath = args[1];

if (!fs.existsSync(transcriptPath)) {
  console.error(`Error: Transcript file not found: ${transcriptPath}`);
  process.exit(1);
}

if (!fs.existsSync(calendarPath)) {
  console.error(`Error: Calendar file not found: ${calendarPath}`);
  process.exit(1);
}

runPipelineTest(transcriptPath, calendarPath)
  .then(() => {
    console.log('\n✅ Pipeline test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Pipeline test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  });
