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
