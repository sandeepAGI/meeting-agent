/**
 * Transcription types for Whisper integration
 */

export interface TranscriptionOptions {
  language?: string // Language code (e.g., 'en', 'es', 'fr')
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large'
  temperature?: number // Sampling temperature (0.0 - 1.0)
  maxLen?: number // Maximum segment length
  speedUp?: boolean // Speed up processing
  threads?: number // Number of threads to use (default: CPU count - 3)
}

export interface TranscriptionSegment {
  start: number // Start time in seconds
  end: number // End time in seconds
  text: string // Transcribed text
}

export interface TranscriptionResult {
  text: string // Full transcript
  segments: TranscriptionSegment[] // Individual segments with timestamps
  language: string // Detected language
  duration: number // Audio duration in seconds
  processingTime: number // Time taken to transcribe
}

export interface TranscriptionProgress {
  stage: 'loading' | 'processing' | 'diarizing' | 'complete' | 'error'
  progress: number // 0-100
  message: string
}

export type TranscriptionCallback = (progress: TranscriptionProgress) => void
