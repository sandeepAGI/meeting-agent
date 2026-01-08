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
      ipcRenderer.invoke('graph-get-meetings-in-date-range', startDate, endDate),
    // Phase 5: Email Distribution - Send email via Graph API
    sendEmail: (options: {
      to: { name: string; email: string }[]
      cc?: { name: string; email: string }[]
      subject: string
      bodyHtml: string
    }) => ipcRenderer.invoke('graph-send-email', options)
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
    getUntranscribedRecordings: (limit?: number) =>
      ipcRenderer.invoke('db-get-untranscribed-recordings', limit),
    // Phase 2.3-4: Meeting-Recording Association
    getMeetingById: (meetingId: string) =>
      ipcRenderer.invoke('db-get-meeting-by-id', meetingId),
    getMeetingsInDateRange: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('db-get-meetings-in-date-range', startDate, endDate),
    getMeetingsWithRecordingsAndSummaries: (startDate: string, endDate: string) =>
      ipcRenderer.invoke('db-get-meetings-with-recordings-and-summaries', startDate, endDate),
    searchMeetingsByTitle: (query: string, limit?: number) =>
      ipcRenderer.invoke('db-search-meetings-by-title', query, limit),
    getRecordingsByMeetingId: (meetingId: string) =>
      ipcRenderer.invoke('db-get-recordings-by-meeting-id', meetingId),
    updateSummaryMeetingId: (summaryId: string, meetingId: string | null) =>
      ipcRenderer.invoke('db-update-summary-meeting-id', summaryId, meetingId),
    updateRecordingMeetingId: (recordingId: string, meetingId: string | null) =>
      ipcRenderer.invoke('db-update-recording-meeting-id', recordingId, meetingId),
    // Meeting Metadata Editing
    updateMeetingSubject: (meetingId: string, subject: string) =>
      ipcRenderer.invoke('update-meeting-subject', meetingId, subject),
    updateMeetingDateTime: (meetingId: string, startTime: string, endTime: string) =>
      ipcRenderer.invoke('update-meeting-datetime', meetingId, startTime, endTime),
    // Phase 4: Browse mode
    getTranscriptByRecordingId: (recordingId: string) =>
      ipcRenderer.invoke('db-get-transcript-by-recording-id', recordingId),
    getSummaryByRecordingId: (recordingId: string) =>
      ipcRenderer.invoke('db-get-summary-by-recording-id', recordingId),
    getRecordingsWithSummaries: (limit?: number) =>
      ipcRenderer.invoke('db-get-recordings-with-summaries', limit),
    // Phase 5: Email Distribution
    markSummarySent: (summaryId: string, recipients: { name: string; email: string }[]) =>
      ipcRenderer.invoke('db-mark-summary-sent', summaryId, recipients),
    // Phase 1.5: Recording Database Insertion Bug Fix
    saveRecording: (recordingData: {
      id: string
      filePath: string
      duration: number
      sizeBytes?: number
    }) => ipcRenderer.invoke('save-recording-to-database', recordingData)
  },

  // Phase 6: Settings
  settings: {
    getSettings: () => ipcRenderer.invoke('settings-get'),
    updateSettings: (updates: any) => ipcRenderer.invoke('settings-update', updates),
    updateCategory: (category: string, updates: any) =>
      ipcRenderer.invoke('settings-update-category', category, updates),
    resetToDefaults: () => ipcRenderer.invoke('settings-reset'),
    getApiKeyStatus: () => ipcRenderer.invoke('settings-get-api-key-status'),
    getApiKey: (service: 'anthropic' | 'huggingface') =>
      ipcRenderer.invoke('settings-get-api-key', service),
    setApiKey: (service: 'anthropic' | 'huggingface', key: string) =>
      ipcRenderer.invoke('settings-set-api-key', service, key),
    validateApiKey: (service: 'anthropic' | 'huggingface', key: string) =>
      ipcRenderer.invoke('settings-validate-api-key', service, key)
  },

  // Phase 7: Storage Management
  storage: {
    getUsage: () => ipcRenderer.invoke('storage-get-usage'),
    runCleanupNow: () => ipcRenderer.invoke('storage-run-cleanup-now')
  },

  // Model Management (Packaging Phase 2)
  modelManager: {
    isAvailable: (modelName: string) => ipcRenderer.invoke('model-is-available', modelName),
    download: (modelName: string) => ipcRenderer.invoke('model-download', modelName),
    listAvailable: () => ipcRenderer.invoke('model-list-available'),
    getInfo: (modelName: string) => ipcRenderer.invoke('model-get-info', modelName),
    deleteModel: (modelName: string) => ipcRenderer.invoke('model-delete', modelName),
    onDownloadProgress: (callback: (progress: {
      modelName: string
      bytesDownloaded: number
      totalBytes: number
      percentage: number
      speed: number
    }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: any) => callback(progress)
      ipcRenderer.on('model-download-progress', handler)
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('model-download-progress', handler)
      }
    }
  }
})

export {}
