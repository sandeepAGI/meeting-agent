#!/usr/bin/env node
/**
 * Convert Microsoft Teams DOCX transcripts to our diarization format
 *
 * Usage:
 *   npx ts-node scripts/convert-teams-transcript.ts <input.docx> [output.json]
 *
 * Input format (Teams):
 *   Speaker Name   MM:SS Text of what they said
 *
 * Output format (Our diarization format):
 *   {
 *     "segments": [{ "start": seconds, "end": seconds, "speaker": "SPEAKER_XX", "text": "..." }],
 *     "speakers": { "SPEAKER_00": "Actual Name", ... },
 *     "metadata": { ... }
 *   }
 */

import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

interface TeamsSegment {
  speaker: string;
  timestamp: string; // "MM:SS"
  text: string;
}

interface DiarizationSegment {
  start: number;    // seconds
  end: number;      // seconds (estimated)
  speaker: string;  // "SPEAKER_00", "SPEAKER_01", etc.
  text: string;
}

interface ConvertedTranscript {
  segments: DiarizationSegment[];
  speakers: Record<string, string>; // { "SPEAKER_00": "John Smith", ... }
  metadata: {
    source: string;
    originalFormat: 'teams-docx';
    convertedAt: string;
    meetingDate?: string;
    totalDuration?: number;
    speakerCount: number;
  };
}

/**
 * Parse Teams timestamp (MM:SS) to seconds
 */
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  return minutes * 60 + seconds;
}

/**
 * Parse a single line from Teams transcript
 * Format: " Speaker Name   MM:SS Text of what they said"
 */
function parseTeamsLine(line: string): TeamsSegment | null {
  // Trim leading/trailing whitespace
  line = line.trim();

  if (!line) return null;

  // Skip header lines
  if (line.startsWith('Transcript') ||
      line.includes('started transcription') ||
      line.match(/^\w+ \d+, \d{4}, \d+:\d+[AP]M$/)) {
    return null;
  }

  // Regex to match: "Speaker Name   MM:SS Text" or "Speaker Name   MM:SSText" (mammoth may not preserve space)
  // Handles multi-word names and flexible whitespace
  const regex = /^([A-Za-z\s]+?)\s{2,}(\d{1,3}:\d{2})\s*(.+)$/;
  const match = line.match(regex);

  if (!match) {
    return null;
  }

  return {
    speaker: match[1].trim(),
    timestamp: match[2].trim(),
    text: match[3].trim()
  };
}

/**
 * Build speaker mapping (name -> SPEAKER_XX)
 */
function buildSpeakerMapping(segments: TeamsSegment[]): Record<string, string> {
  const uniqueSpeakers = new Set<string>();

  for (const segment of segments) {
    uniqueSpeakers.add(segment.speaker);
  }

  const speakerList = Array.from(uniqueSpeakers).sort();
  const mapping: Record<string, string> = {};

  speakerList.forEach((name, index) => {
    mapping[name] = `SPEAKER_${String(index).padStart(2, '0')}`;
  });

  return mapping;
}

/**
 * Estimate segment end time based on next segment start
 * If no next segment, estimate +5 seconds
 */
function estimateEndTimes(segments: DiarizationSegment[]): void {
  for (let i = 0; i < segments.length; i++) {
    const current = segments[i];
    const next = segments[i + 1];

    if (next) {
      // End at the start of next segment (or slightly before)
      current.end = Math.max(current.start + 1, next.start - 0.5);
    } else {
      // Last segment: estimate +5 seconds
      current.end = current.start + 5;
    }
  }
}

/**
 * Convert Teams segments to our diarization format
 */
function convertSegments(
  teamsSegments: TeamsSegment[],
  speakerMapping: Record<string, string>
): DiarizationSegment[] {
  const segments: DiarizationSegment[] = teamsSegments.map(ts => ({
    start: parseTimestamp(ts.timestamp),
    end: 0, // Will be calculated
    speaker: speakerMapping[ts.speaker],
    text: ts.text
  }));

  // Estimate end times
  estimateEndTimes(segments);

  return segments;
}

/**
 * Extract meeting date from transcript header
 * Format: "September 18, 2025, 6:59PM"
 */
function extractMeetingDate(text: string): string | undefined {
  const dateRegex = /(\w+ \d+, \d{4}), (\d+:\d+[AP]M)/;
  const match = text.match(dateRegex);

  if (match) {
    return match[1]; // "September 18, 2025"
  }

  return undefined;
}

/**
 * Main conversion function
 */
async function convertTeamsTranscript(
  inputPath: string,
  outputPath?: string
): Promise<ConvertedTranscript> {
  console.log(`Reading DOCX file: ${inputPath}`);

  // Read and extract text from DOCX
  const buffer = fs.readFileSync(inputPath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  // Extract meeting date from header
  const meetingDate = extractMeetingDate(text);

  // Parse lines into Teams segments
  const lines = text.split('\n');
  const teamsSegments: TeamsSegment[] = [];

  for (const line of lines) {
    const segment = parseTeamsLine(line);
    if (segment) {
      teamsSegments.push(segment);
    }
  }

  console.log(`Parsed ${teamsSegments.length} segments`);

  if (teamsSegments.length === 0) {
    throw new Error('No valid segments found in transcript');
  }

  // Build speaker mapping
  const speakerMapping = buildSpeakerMapping(teamsSegments);
  console.log(`Found ${Object.keys(speakerMapping).length} unique speakers:`);
  for (const [name, id] of Object.entries(speakerMapping)) {
    console.log(`  ${id} -> ${name}`);
  }

  // Convert to our format
  const segments = convertSegments(teamsSegments, speakerMapping);

  // Build reverse mapping (SPEAKER_XX -> name)
  const reverseSpeakerMapping: Record<string, string> = {};
  for (const [name, id] of Object.entries(speakerMapping)) {
    reverseSpeakerMapping[id] = name;
  }

  // Calculate total duration
  const lastSegment = segments[segments.length - 1];
  const totalDuration = lastSegment ? lastSegment.end : 0;

  // Build result
  const converted: ConvertedTranscript = {
    segments,
    speakers: reverseSpeakerMapping,
    metadata: {
      source: path.basename(inputPath),
      originalFormat: 'teams-docx',
      convertedAt: new Date().toISOString(),
      meetingDate,
      totalDuration,
      speakerCount: Object.keys(speakerMapping).length
    }
  };

  // Write output
  const output = outputPath || inputPath.replace('.docx', '.json');
  fs.writeFileSync(output, JSON.stringify(converted, null, 2));
  console.log(`\nConverted transcript saved to: ${output}`);
  console.log(`  Total duration: ${Math.floor(totalDuration / 60)}m ${Math.floor(totalDuration % 60)}s`);
  console.log(`  Segments: ${segments.length}`);
  console.log(`  Speakers: ${Object.keys(reverseSpeakerMapping).length}`);

  return converted;
}

// CLI entry point
const args = process.argv.slice(2);

if (args.length > 0) {
  const inputPath = args[0];
  const outputPath = args[1];

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  convertTeamsTranscript(inputPath, outputPath)
    .then(() => {
      console.log('\n✅ Conversion complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Conversion failed:', error.message);
      process.exit(1);
    });
}

export { convertTeamsTranscript };
export type { ConvertedTranscript, DiarizationSegment };
