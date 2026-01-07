import type { TranscriptionOptions, TranscriptionProgress, TranscriptionResult } from './transcription'
import type { DiarizationProgress, DiarizationResult } from './diarization'
import type { MergedTranscript } from '../utils/mergeDiarization'
import type { MeetingSummary, SummaryStatusDisplay, SpeakerMapping, ActionItem } from './meetingSummary'
import type { AppSettings, ApiKeyStatus } from './settings'

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
  onTranscriptionProgress: (callback: (progress: TranscriptionProgress) => void) => () => void

  // Phase 1.5: Chunked recording
  saveAudioChunk: (
    blob: ArrayBuffer,
    sessionId: string,
    filename: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  mergeAudioChunks: (
    sessionId: string
  ) => Promise<{ success: boolean; filePath?: string; sizeBytes?: number; error?: string }>

  // Diarization
  diarizeAudio: (
    audioFilePath: string
  ) => Promise<{ success: boolean; result?: DiarizationResult; error?: string }>
  onDiarizationProgress: (callback: (progress: DiarizationProgress) => void) => () => void

  // Combined transcription + diarization
  transcribeAndDiarize: (
    audioFilePath: string,
    options?: TranscriptionOptions
  ) => Promise<{ success: boolean; result?: TranscriptionWithDiarizationResult; error?: string }>

  // Recording announcement
  playAnnouncement: (text: string) => Promise<{ success: boolean }>

  // Phase 2.1: M365 Authentication
  m365Auth: {
    initialize: () => Promise<{ success: boolean; authState?: M365AuthState; error?: string }>
    login: () => Promise<{ success: boolean; authState?: M365AuthState; error?: string }>
    logout: () => Promise<{ success: boolean; authState?: M365AuthState; error?: string }>
    getState: () => Promise<{ success: boolean; authState?: M365AuthState; error?: string }>
    getToken: () => Promise<{ success: boolean; accessToken?: string; error?: string }>
    refreshToken: () => Promise<{ success: boolean; accessToken?: string; error?: string }>
  }

  // Phase 2.2: Graph API Calendar
  graphApi: {
    getTodaysMeetings: () => Promise<{ success: boolean; meetings?: MeetingInfo[]; error?: string }>
    getUpcomingMeetings: (minutesAhead?: number) => Promise<{ success: boolean; meetings?: MeetingInfo[]; error?: string }>
    getMeetingById: (eventId: string) => Promise<{ success: boolean; meeting?: MeetingInfo; error?: string }>
    // Phase 2.3-4: Date range sync for historical meetings
    getMeetingsInDateRange: (startDate: string, endDate: string) => Promise<{ success: boolean; meetings?: MeetingInfo[]; error?: string }>
    // Phase 5: Email Distribution
    sendEmail: (options: {
      to: { name: string; email: string }[]
      cc?: { name: string; email: string }[]
      subject: string
      bodyHtml: string
    }) => Promise<{ success: boolean; error?: string }>
  }

  // Phase 2.3-3: Meeting Intelligence
  meetingIntelligence: {
    start: (meetingId: string, transcriptId: string) => Promise<{ success: boolean; summaryId?: string; error?: string }>
    getStatus: (summaryId: string) => Promise<{ success: boolean; status?: SummaryStatusDisplay; error?: string }>
    getSummary: (summaryId: string) => Promise<{ success: boolean; summary?: MeetingSummary; error?: string }>
    updateSummary: (summaryId: string, updates: {
      summary?: string
      speakers?: SpeakerMapping[]
      actionItems?: ActionItem[]
      keyDecisions?: string[]
    }) => Promise<{ success: boolean; summary?: MeetingSummary; error?: string }>
    cancel: (summaryId: string) => Promise<{ success: boolean; error?: string }>
    regenerate: (summaryId: string) => Promise<{ success: boolean; summaryId?: string; error?: string }>
    listSummaries: (meetingId?: string) => Promise<{ success: boolean; summaries?: MeetingSummary[]; error?: string }>
  }

  // Database queries
  database: {
    getRecordingsWithTranscripts: (limit?: number) => Promise<{ success: boolean; recordings?: any[]; error?: string }>
    getUntranscribedRecordings: (limit?: number) => Promise<{ success: boolean; recordings?: any[]; error?: string }>
    // Phase 2.3-4: Meeting-Recording Association
    getMeetingById: (meetingId: string) => Promise<{ success: boolean; meeting?: any; error?: string }>
    getMeetingsInDateRange: (startDate: string, endDate: string) => Promise<{ success: boolean; meetings?: any[]; error?: string }>
    getMeetingsWithRecordingsAndSummaries: (startDate: string, endDate: string) => Promise<{ success: boolean; meetings?: any[]; error?: string }>
    searchMeetingsByTitle: (query: string, limit?: number) => Promise<{ success: boolean; meetings?: any[]; error?: string }>
    getRecordingsByMeetingId: (meetingId: string) => Promise<{ success: boolean; recordings?: any[]; error?: string }>
    updateSummaryMeetingId: (summaryId: string, meetingId: string | null) => Promise<{ success: boolean; error?: string }>
    updateRecordingMeetingId: (recordingId: string, meetingId: string | null) => Promise<{ success: boolean; error?: string }>
    // Phase 4: Browse mode
    getTranscriptByRecordingId: (recordingId: string) => Promise<{ success: boolean; transcript?: any; error?: string }>
    getSummaryByRecordingId: (recordingId: string) => Promise<{ success: boolean; summary?: any; error?: string }>
    getRecordingsWithSummaries: (limit?: number) => Promise<{ success: boolean; recordings?: any[]; error?: string }>
    // Phase 5: Email Distribution
    markSummarySent: (summaryId: string, recipients: { name: string; email: string }[]) => Promise<{ success: boolean; error?: string }>
  }

  // Meeting Metadata Editing
  updateMeetingSubject: (meetingId: string, subject: string) => Promise<{ success: boolean; result?: any; error?: string }>
  updateMeetingDateTime: (meetingId: string, startTime: string, endTime: string) => Promise<{ success: boolean; result?: any; error?: string }>

  // Phase 6: Settings
  settings: {
    getSettings: () => Promise<{ success: boolean; settings?: AppSettings; error?: string }>
    updateSettings: (updates: Partial<AppSettings>) => Promise<{ success: boolean; settings?: AppSettings; error?: string }>
    updateCategory: <K extends keyof AppSettings>(category: K, updates: Partial<AppSettings[K]>) => Promise<{ success: boolean; settings?: AppSettings; error?: string }>
    resetToDefaults: () => Promise<{ success: boolean; settings?: AppSettings; error?: string }>
    getApiKeyStatus: () => Promise<{ success: boolean; status?: ApiKeyStatus; error?: string }>
    getApiKey: (service: 'anthropic' | 'huggingface') => Promise<{ success: boolean; key?: string | null; error?: string }>
    setApiKey: (service: 'anthropic' | 'huggingface', key: string) => Promise<{ success: boolean; error?: string }>
    validateApiKey: (service: 'anthropic' | 'huggingface', key: string) => Promise<{ valid: boolean; error?: string }>
  }
}

export interface M365AuthState {
  isAuthenticated: boolean
  user: {
    name: string
    email: string
    id: string
  } | null
  error: string | null
}

export interface MeetingAttendee {
  name: string
  email: string
  type: 'required' | 'optional' | 'organizer'
}

export interface MeetingInfo {
  id: string
  subject: string
  start: Date
  end: Date
  organizer: {
    name: string
    email: string
  }
  attendees: MeetingAttendee[]
  isOnlineMeeting: boolean
  onlineMeetingUrl?: string
  location?: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
