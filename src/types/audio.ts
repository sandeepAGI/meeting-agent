/**
 * Audio types for Meeting Agent
 * Using electron-audio-loopback with Web Audio API
 */

export interface AudioLevel {
  timestamp: number
  level: number // 0-100
  peak: number // 0-100
}

export interface RecordingSession {
  id: string
  filePath: string
  startTime: Date
  endTime?: Date
  duration: number // seconds
  sizeBytes: number
}

export interface AudioConfig {
  sampleRate: number // 16000 for Whisper
  channels: number // 1 for mono
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  currentSession: RecordingSession | null
  duration: number
  audioLevel: AudioLevel | null
}
