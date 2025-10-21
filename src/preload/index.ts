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

  // Phase 2.1: M365 Authentication
  m365Auth: {
    initialize: () => ipcRenderer.invoke('m365-auth-initialize'),
    login: () => ipcRenderer.invoke('m365-auth-login'),
    logout: () => ipcRenderer.invoke('m365-auth-logout'),
    getState: () => ipcRenderer.invoke('m365-auth-get-state'),
    getToken: () => ipcRenderer.invoke('m365-auth-get-token'),
    refreshToken: () => ipcRenderer.invoke('m365-auth-refresh-token')
  },

  // Phase 2.2: Graph API Calendar
  graphApi: {
    getTodaysMeetings: () => ipcRenderer.invoke('graph-get-todays-meetings'),
    getUpcomingMeetings: (minutesAhead?: number) => ipcRenderer.invoke('graph-get-upcoming-meetings', minutesAhead),
    getMeetingById: (eventId: string) => ipcRenderer.invoke('graph-get-meeting-by-id', eventId),
    // Phase 2.3-4: Date range sync for historical meetings
    getMeetingsInDateRange: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('graph-get-meetings-in-date-range', startDate, endDate)
  },

  // Phase 2.3-3: Meeting Intelligence
  meetingIntelligence: {
    start: (meetingId: string, transcriptId: string) =>
      ipcRenderer.invoke('meeting-intelligence-start', meetingId, transcriptId),
    getStatus: (summaryId: string) =>
      ipcRenderer.invoke('meeting-intelligence-get-status', summaryId),
    getSummary: (summaryId: string) =>
      ipcRenderer.invoke('meeting-intelligence-get-summary', summaryId),
    updateSummary: (summaryId: string, updates: any) =>
      ipcRenderer.invoke('meeting-intelligence-update-summary', summaryId, updates),
    cancel: (summaryId: string) =>
      ipcRenderer.invoke('meeting-intelligence-cancel', summaryId),
    regenerate: (summaryId: string) =>
      ipcRenderer.invoke('meeting-intelligence-regenerate', summaryId),
    listSummaries: (meetingId?: string) =>
      ipcRenderer.invoke('meeting-intelligence-list-summaries', meetingId)
  },

  // Database queries
  database: {
    getRecordingsWithTranscripts: (limit?: number) =>
      ipcRenderer.invoke('db-get-recordings-with-transcripts', limit),
    // Phase 2.3-4: Meeting-Recording Association
    getMeetingsInDateRange: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('db-get-meetings-in-date-range', startDate, endDate),
    searchMeetingsByTitle: (query: string, limit?: number) =>
      ipcRenderer.invoke('db-search-meetings-by-title', query, limit),
    getRecordingsByMeetingId: (meetingId: string) =>
      ipcRenderer.invoke('db-get-recordings-by-meeting-id', meetingId),
    updateSummaryMeetingId: (summaryId: string, meetingId: string | null) =>
      ipcRenderer.invoke('db-update-summary-meeting-id', summaryId, meetingId),
    updateRecordingMeetingId: (recordingId: string, meetingId: string | null) =>
      ipcRenderer.invoke('db-update-recording-meeting-id', recordingId, meetingId),
    // Phase 4: Browse mode
    getTranscriptByRecordingId: (recordingId: string) =>
      ipcRenderer.invoke('db-get-transcript-by-recording-id', recordingId),
    getSummaryByRecordingId: (recordingId: string) =>
      ipcRenderer.invoke('db-get-summary-by-recording-id', recordingId),
    getRecordingsWithSummaries: (limit?: number) =>
      ipcRenderer.invoke('db-get-recordings-with-summaries', limit)
  }
})

export {}
