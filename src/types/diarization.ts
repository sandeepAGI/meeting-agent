/**
 * Speaker diarization types.
 *
 * Diarization is the process of partitioning an audio stream into homogeneous segments
 * according to the identity of the speaker.
 */

/**
 * A single speaker segment with start/end timestamps.
 */
export interface SpeakerSegment {
  /** Start time in seconds */
  start: number
  /** End time in seconds */
  end: number
  /** Speaker label (e.g., "SPEAKER_00", "SPEAKER_01") */
  speaker: string
}

/**
 * Result from diarization process.
 */
export interface DiarizationResult {
  /** List of speaker segments */
  segments: SpeakerSegment[]
}

/**
 * Progress callback for diarization process.
 */
export interface DiarizationProgress {
  /** Progress message */
  message: string
  /** Progress percentage (0-100), optional */
  progress?: number
}
