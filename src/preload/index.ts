import { contextBridge, ipcRenderer } from 'electron'
import type { TranscriptionOptions, TranscriptionProgress } from '../types/transcription'
import type { DiarizationProgress } from '../types/diarization'

// Expose API for electron-audio-loopback manual mode, transcription, and diarization
// IPC handlers are automatically registered by initMain() in audioSetup.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // Audio loopback
  enableLoopbackAudio: () => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: () => ipcRenderer.invoke('disable-loopback-audio'),

  // Transcription
  transcribeAudio: (audioFilePath: string, options?: TranscriptionOptions) =>
    ipcRenderer.invoke('transcribe-audio', audioFilePath, options),
  saveAudioFile: (blob: ArrayBuffer, filename: string) =>
    ipcRenderer.invoke('save-audio-file', blob, filename),
  getTranscriptionStatus: () => ipcRenderer.invoke('get-transcription-status'),
  onTranscriptionProgress: (callback: (progress: TranscriptionProgress) => void) => {
    ipcRenderer.on('transcription-progress', (_event, progress) => callback(progress))
  },

  // Diarization
  diarizeAudio: (audioFilePath: string) =>
    ipcRenderer.invoke('diarize-audio', audioFilePath),
  onDiarizationProgress: (callback: (progress: DiarizationProgress) => void) => {
    ipcRenderer.on('diarization-progress', (_event, progress) => callback(progress))
  },

  // Combined transcription + diarization
  transcribeAndDiarize: (audioFilePath: string, options?: TranscriptionOptions) =>
    ipcRenderer.invoke('transcribe-and-diarize', audioFilePath, options),
})

export {}
