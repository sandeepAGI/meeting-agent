/**
 * Utility to merge speaker diarization with transcription segments.
 *
 * This algorithm assigns speaker labels to transcript segments based on
 * temporal overlap between diarization and transcription timestamps.
 */

import type { TranscriptionSegment } from '../types/transcription'
import type { SpeakerSegment, DiarizationResult } from '../types/diarization'

/**
 * Transcript segment with speaker label.
 */
export interface TranscriptWithSpeaker {
  start: number
  end: number
  text: string
  speaker: string
}

/**
 * Result of merging diarization with transcription.
 */
export interface MergedTranscript {
  /** List of transcript segments with speaker labels */
  segments: TranscriptWithSpeaker[]
  /** Full transcript text with speaker labels */
  fullText: string
  /** Number of unique speakers */
  speakerCount: number
}

/**
 * Find the speaker for a given time point based on diarization segments.
 *
 * @param time - Time in seconds
 * @param diarization - Diarization result with speaker segments
 * @returns Speaker label or 'UNKNOWN' if no speaker found
 */
function findSpeakerAtTime(time: number, diarization: DiarizationResult): string {
  for (const segment of diarization.segments) {
    if (time >= segment.start && time <= segment.end) {
      return segment.speaker
    }
  }
  return 'UNKNOWN'
}

/**
 * Find the most overlapping speaker for a transcript segment.
 *
 * This is more robust than just checking start time, as it considers
 * the entire duration of the transcript segment.
 *
 * @param transcriptSegment - Transcript segment with start/end times
 * @param diarization - Diarization result with speaker segments
 * @returns Speaker label with most overlap, or 'UNKNOWN'
 */
function findMostOverlappingSpeaker(
  transcriptSegment: TranscriptionSegment,
  diarization: DiarizationResult
): string {
  const overlapDurations = new Map<string, number>()

  // Calculate overlap with each speaker segment
  for (const speakerSeg of diarization.segments) {
    // Calculate overlap between transcript segment and speaker segment
    const overlapStart = Math.max(transcriptSegment.start, speakerSeg.start)
    const overlapEnd = Math.min(transcriptSegment.end, speakerSeg.end)
    const overlap = Math.max(0, overlapEnd - overlapStart)

    if (overlap > 0) {
      const currentDuration = overlapDurations.get(speakerSeg.speaker) || 0
      overlapDurations.set(speakerSeg.speaker, currentDuration + overlap)
    }
  }

  // Find speaker with maximum overlap
  if (overlapDurations.size === 0) {
    return 'UNKNOWN'
  }

  let maxSpeaker = 'UNKNOWN'
  let maxDuration = 0

  for (const [speaker, duration] of overlapDurations.entries()) {
    if (duration > maxDuration) {
      maxSpeaker = speaker
      maxDuration = duration
    }
  }

  return maxSpeaker
}

/**
 * Convert Whisper transcription segment to normalized format with start/end in seconds.
 * Whisper.cpp outputs offsets in milliseconds, we need seconds for temporal alignment.
 */
function normalizeWhisperSegment(segment: any): { start: number; end: number; text: string } {
  // If segment already has start/end in seconds, use them
  if (typeof segment.start === 'number' && typeof segment.end === 'number') {
    return {
      start: segment.start,
      end: segment.end,
      text: segment.text
    }
  }

  // Convert Whisper.cpp format: offsets are in milliseconds
  if (segment.offsets && typeof segment.offsets.from === 'number' && typeof segment.offsets.to === 'number') {
    return {
      start: segment.offsets.from / 1000, // Convert milliseconds to seconds
      end: segment.offsets.to / 1000,
      text: segment.text
    }
  }

  // Fallback: log warning and return defaults
  console.warn('[mergeDiarization] Unknown Whisper segment format:', segment)
  return {
    start: 0,
    end: 0,
    text: segment.text || ''
  }
}

/**
 * Merge speaker diarization with transcription segments.
 *
 * Assigns speaker labels to each transcript segment based on temporal overlap.
 * Uses temporal intersection matching (best practice for Whisper + pyannote.audio).
 *
 * @param transcription - Array of transcription segments with timestamps
 * @param diarization - Diarization result with speaker segments
 * @returns Merged transcript with speaker labels
 */
export function mergeDiarizationWithTranscript(
  transcription: TranscriptionSegment[],
  diarization: DiarizationResult
): MergedTranscript {
  // Normalize Whisper segments to have start/end in seconds (not milliseconds)
  const normalizedSegments = transcription.map(normalizeWhisperSegment)

  // Assign speakers to each transcript segment using temporal intersection
  const segmentsWithSpeakers: TranscriptWithSpeaker[] = normalizedSegments.map((segment) => {
    // Use most overlapping speaker for better accuracy (temporal intersection method)
    const speaker = findMostOverlappingSpeaker(segment as any, diarization)

    return {
      start: segment.start,
      end: segment.end,
      text: segment.text,
      speaker
    }
  })

  // Count unique speakers
  const speakers = new Set(segmentsWithSpeakers.map((seg) => seg.speaker))
  const speakerCount = speakers.size

  // Generate full text with speaker labels
  let fullText = ''
  let lastSpeaker = ''

  for (const segment of segmentsWithSpeakers) {
    // Add speaker label when speaker changes
    if (segment.speaker !== lastSpeaker) {
      if (fullText.length > 0) {
        fullText += '\n\n'
      }
      fullText += `${segment.speaker}: `
      lastSpeaker = segment.speaker
    }

    fullText += segment.text.trim() + ' '
  }

  return {
    segments: segmentsWithSpeakers,
    fullText: fullText.trim(),
    speakerCount
  }
}

/**
 * Rename speakers from generic labels (SPEAKER_00) to friendly names.
 *
 * @param merged - Merged transcript with generic speaker labels
 * @param speakerMap - Map from generic label to friendly name (e.g., "SPEAKER_00" -> "John Smith")
 * @returns Merged transcript with renamed speakers
 */
export function renameSpeakers(
  merged: MergedTranscript,
  speakerMap: Map<string, string>
): MergedTranscript {
  const renamedSegments = merged.segments.map((segment) => ({
    ...segment,
    speaker: speakerMap.get(segment.speaker) || segment.speaker
  }))

  // Regenerate full text with new names
  let fullText = ''
  let lastSpeaker = ''

  for (const segment of renamedSegments) {
    if (segment.speaker !== lastSpeaker) {
      if (fullText.length > 0) {
        fullText += '\n\n'
      }
      fullText += `${segment.speaker}: `
      lastSpeaker = segment.speaker
    }

    fullText += segment.text.trim() + ' '
  }

  return {
    segments: renamedSegments,
    fullText: fullText.trim(),
    speakerCount: merged.speakerCount
  }
}

/**
 * Format merged transcript for display in UI.
 *
 * @param merged - Merged transcript with speaker labels
 * @returns Formatted text ready for display
 */
export function formatMergedTranscript(merged: MergedTranscript): string {
  return merged.fullText
}

/**
 * Get speaking statistics for each speaker.
 *
 * @param merged - Merged transcript with speaker labels
 * @returns Array of speaker statistics
 */
export function getSpeakerStatistics(merged: MergedTranscript): {
  speaker: string
  totalDuration: number
  segmentCount: number
  wordCount: number
}[] {
  const stats = new Map<
    string,
    { totalDuration: number; segmentCount: number; wordCount: number }
  >()

  for (const segment of merged.segments) {
    if (!stats.has(segment.speaker)) {
      stats.set(segment.speaker, { totalDuration: 0, segmentCount: 0, wordCount: 0 })
    }

    const speakerStats = stats.get(segment.speaker)!
    speakerStats.totalDuration += segment.end - segment.start
    speakerStats.segmentCount += 1
    speakerStats.wordCount += segment.text.trim().split(/\s+/).length
  }

  return Array.from(stats.entries()).map(([speaker, data]) => ({
    speaker,
    ...data
  }))
}
