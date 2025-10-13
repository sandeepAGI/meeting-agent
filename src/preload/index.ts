import { contextBridge, ipcRenderer } from 'electron'
import type { TranscriptionOptions, TranscriptionProgress } from '../types/transcription'

// Expose API for electron-audio-loopback manual mode and transcription
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
})

export {}
