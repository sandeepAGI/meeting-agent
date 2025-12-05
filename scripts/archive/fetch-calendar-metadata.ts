#!/usr/bin/env node
/**
 * Fetch calendar metadata for converted transcripts
 *
 * Usage:
 *   npx ts-node scripts/fetch-calendar-metadata.ts <converted-transcript.json>
 *
 * This script:
 * 1. Reads the converted transcript to get the meeting date
 * 2. Fetches calendar meetings for that date via Microsoft Graph API
 * 3. Attempts to match the meeting based on time/participants
 * 4. Saves calendar metadata to a JSON file
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { GraphApiService } from '../src/services/graphApi';
import { M365AuthService } from '../src/services/m365Auth';
import type { ConvertedTranscript } from './convert-teams-transcript';

// Load environment variables
dotenv.config();

interface CalendarMetadata {
  meeting: any | null;
  searchDate: string;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  matchReason?: string;
  allMeetingsOnDate: Array<{
    id: string;
    subject: string;
    start: string;
    end: string;
    attendees: string[];
  }>;
}

/**
 * Parse meeting date from transcript metadata
 */
function parseMeetingDate(dateString: string): Date {
  // Format: "September 18, 2025" or "October 7, 2025"
  return new Date(dateString);
}

/**
 * Check if a meeting matches the transcript speakers
 */
function calculateMatchScore(
  meeting: any,
  transcriptSpeakers: Record<string, string>
): { score: number; reason: string } {
  const speakerNames = Object.values(transcriptSpeakers);
  const attendees = meeting.attendees || [];

  let matchCount = 0;
  const matchedNames: string[] = [];

  for (const speaker of speakerNames) {
    for (const attendee of attendees) {
      const attendeeName = attendee.name || '';

      // Check if speaker name is in attendee name (handles "Sandeep Mangaraj" vs "Mangaraj, Sandeep")
      const speakerParts = speaker.toLowerCase().split(' ');
      const attendeeNameLower = attendeeName.toLowerCase();

      const matches = speakerParts.every(part => attendeeNameLower.includes(part));

      if (matches) {
        matchCount++;
        matchedNames.push(`${speaker} → ${attendeeName}`);
        break;
      }
    }
  }

  const totalSpeakers = speakerNames.length;
  const score = matchCount / totalSpeakers;

  let reason = `Matched ${matchCount}/${totalSpeakers} speakers`;
  if (matchedNames.length > 0) {
    reason += `: ${matchedNames.join(', ')}`;
  }

  return { score, reason };
}

/**
 * Fetch meetings for a specific date
 */
async function fetchMeetingsForDate(
  graphService: GraphApiService,
  date: Date
): Promise<Array<any>> {
  // Set time range for the entire day
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  console.log(`Fetching meetings for ${date.toDateString()}...`);
  console.log(`  Range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

  try {
    const meetings = await graphService.getMeetingsByDateRange(startOfDay, endOfDay);

    console.log(`  Found ${meetings.length} meetings on this date`);
    return meetings;
  } catch (error) {
    console.error(`  Error fetching meetings: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Find best matching meeting
 */
function findBestMatch(
  meetings: Array<any>,
  transcriptSpeakers: Record<string, string>
): { meeting: any | null; confidence: 'high' | 'medium' | 'low' | 'none'; reason: string } {
  if (meetings.length === 0) {
    return {
      meeting: null,
      confidence: 'none',
      reason: 'No meetings found on this date'
    };
  }

  let bestMatch: any | null = null;
  let bestScore = 0;
  let bestReason = '';

  for (const meeting of meetings) {
    const { score, reason } = calculateMatchScore(meeting, transcriptSpeakers);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = meeting;
      bestReason = reason;
    }
  }

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' | 'none';
  if (bestScore >= 0.8) {
    confidence = 'high';
  } else if (bestScore >= 0.5) {
    confidence = 'medium';
  } else if (bestScore > 0) {
    confidence = 'low';
  } else {
    confidence = 'none';
  }

  return {
    meeting: bestMatch,
    confidence,
    reason: bestReason
  };
}

/**
 * Simplify meeting data for storage
 */
function simplifyMeetings(meetings: Array<any>) {
  return meetings.map(m => ({
    id: m.id || '',
    subject: m.subject || 'No Subject',
    start: m.start?.toISOString() || '',
    end: m.end?.toISOString() || '',
    attendees: (m.attendees || []).map((a: any) => a.name || a.email || 'Unknown')
  }));
}

/**
 * Main function
 */
async function fetchCalendarMetadata(transcriptPath: string): Promise<void> {
  console.log(`\nFetching calendar metadata for: ${transcriptPath}\n`);

  // Read transcript
  const transcriptContent = fs.readFileSync(transcriptPath, 'utf-8');
  const transcript: ConvertedTranscript = JSON.parse(transcriptContent);

  if (!transcript.metadata.meetingDate) {
    throw new Error('Transcript does not contain meeting date');
  }

  // Parse meeting date
  const meetingDate = parseMeetingDate(transcript.metadata.meetingDate);
  console.log(`Meeting date: ${meetingDate.toDateString()}`);
  console.log(`Speakers: ${Object.values(transcript.speakers).join(', ')}\n`);

  // Initialize M365 auth
  console.log('Initializing M365 authentication...');
  const clientId = process.env.AZURE_CLIENT_ID;
  if (!clientId) {
    throw new Error('AZURE_CLIENT_ID not found in environment variables');
  }

  const authService = new M365AuthService(clientId);
  await authService.initialize();

  // Check if authenticated
  const authState = authService.getAuthState();
  if (!authState.isAuthenticated) {
    throw new Error('Not authenticated with M365. Please run the app and log in first.');
  }

  console.log(`Authenticated as: ${authState.user?.name} (${authState.user?.email})\n`);

  // Get access token
  const token = await authService.getAccessToken();
  if (!token) {
    throw new Error('Failed to get access token');
  }

  // Initialize Graph API service
  const graphService = new GraphApiService();
  graphService.initialize(token);

  // Fetch meetings for the date
  const meetings = await fetchMeetingsForDate(graphService, meetingDate);

  // Find best match
  const { meeting: bestMatch, confidence, reason } = findBestMatch(meetings, transcript.speakers);

  console.log(`\nMatch result:`);
  console.log(`  Confidence: ${confidence}`);
  console.log(`  Reason: ${reason}`);

  if (bestMatch) {
    console.log(`  Matched meeting: "${bestMatch.subject}"`);
    console.log(`  Time: ${bestMatch.start?.dateTime} - ${bestMatch.end?.dateTime}`);
    console.log(`  Attendees: ${(bestMatch.attendees || []).length}`);
  }

  // Build metadata
  const metadata: CalendarMetadata = {
    meeting: bestMatch,
    searchDate: transcript.metadata.meetingDate,
    matchConfidence: confidence,
    matchReason: reason,
    allMeetingsOnDate: simplifyMeetings(meetings)
  };

  // Save metadata
  const outputPath = transcriptPath.replace('.json', '-calendar.json');
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));

  console.log(`\n✅ Calendar metadata saved to: ${outputPath}`);

  if (meetings.length > 1) {
    console.log(`\nAll meetings on ${meetingDate.toDateString()}:`);
    metadata.allMeetingsOnDate.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.subject} (${m.attendees.length} attendees)`);
    });
  }
}

// CLI entry point
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: npx ts-node scripts/fetch-calendar-metadata.ts <converted-transcript.json>');
  process.exit(1);
}

const transcriptPath = args[0];

if (!fs.existsSync(transcriptPath)) {
  console.error(`Error: File not found: ${transcriptPath}`);
  process.exit(1);
}

fetchCalendarMetadata(transcriptPath)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
