import type { TranscriptionOptions, TranscriptionProgress, TranscriptionResult } from './transcription'
import type { DiarizationProgress, DiarizationResult } from './diarization'
import type { MergedTranscript } from '../utils/mergeDiarization'

export interface TranscriptionWithDiarizationResult extends TranscriptionResult {
  merged: MergedTranscript | null
}

export interface ElectronAPI {
  // Audio loopback
  enableLoopbackAudio: () => Promise<void>
  disableLoopbackAudio: () => Promise<void>

  // Transcription
  transcribeAudio: (
    audioFilePath: string,
    options?: TranscriptionOptions
  ) => Promise<{ success: boolean; result?: TranscriptionResult; error?: string }>
  saveAudioFile: (
    blob: ArrayBuffer,
    filename: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  getTranscriptionStatus: () => Promise<{ isInitialized: boolean; modelPath: string }>
  onTranscriptionProgress: (callback: (progress: TranscriptionProgress) => void) => void

  // Diarization
  diarizeAudio: (
    audioFilePath: string
  ) => Promise<{ success: boolean; result?: DiarizationResult; error?: string }>
  onDiarizationProgress: (callback: (progress: DiarizationProgress) => void) => void

  // Combined transcription + diarization
  transcribeAndDiarize: (
    audioFilePath: string,
    options?: TranscriptionOptions
  ) => Promise<{ success: boolean; result?: TranscriptionWithDiarizationResult; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
