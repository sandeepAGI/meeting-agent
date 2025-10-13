import type { TranscriptionOptions, TranscriptionProgress, TranscriptionResult } from './transcription'

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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
