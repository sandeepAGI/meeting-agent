import type { AudioDevice, AudioLevel, RecordingSession } from './audio'

export interface ElectronAPI {
  audio: {
    getDevices: () => Promise<AudioDevice[]>
    findBlackHole: () => Promise<AudioDevice | null>
    isBlackHoleAvailable: () => Promise<boolean>
    initialize: (deviceId?: number) => Promise<{ success: boolean; error?: string }>
    startRecording: () => Promise<{
      success: boolean
      session?: RecordingSession
      error?: string
    }>
    stopRecording: () => Promise<{
      success: boolean
      session?: RecordingSession
      error?: string
    }>
    getStatus: () => Promise<{
      isRecording: boolean
      currentSession: RecordingSession | null
      duration: number
    }>
    onAudioLevel: (callback: (level: AudioLevel) => void) => void
    removeAudioLevelListener: () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
