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

  // Phase 1.5: Chunked recording
  saveAudioChunk: (blob: ArrayBuffer, sessionId: string, filename: string) =>
    ipcRenderer.invoke('save-audio-chunk', blob, sessionId, filename),
  mergeAudioChunks: (sessionId: string) =>
    ipcRenderer.invoke('merge-audio-chunks', sessionId),
  onTranscriptionProgress: (callback: (progress: TranscriptionProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: TranscriptionProgress) => callback(progress)
    ipcRenderer.on('transcription-progress', handler)
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('transcription-progress', handler)
    }
  },

  // Diarization
  diarizeAudio: (audioFilePath: string) =>
    ipcRenderer.invoke('diarize-audio', audioFilePath),
  onDiarizationProgress: (callback: (progress: DiarizationProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DiarizationProgress) => callback(progress)
    ipcRenderer.on('diarization-progress', handler)
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('diarization-progress', handler)
    }
  },

  // Combined transcription + diarization
  transcribeAndDiarize: (audioFilePath: string, options?: TranscriptionOptions) =>
    ipcRenderer.invoke('transcribe-and-diarize', audioFilePath, options),

  // Recording announcement
  playAnnouncement: (text: string) =>
    ipcRenderer.invoke('play-announcement', text),
})

export {}
