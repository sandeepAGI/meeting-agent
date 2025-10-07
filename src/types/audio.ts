export interface AudioDevice {
  id: number
  name: string
  maxInputChannels: number
  maxOutputChannels: number
  defaultSampleRate: number
  defaultLowInputLatency: number
  defaultLowOutputLatency: number
  defaultHighInputLatency: number
  defaultHighOutputLatency: number
  hostAPIName: string
}

export interface AudioConfig {
  sampleRate: number
  channels: number
  deviceId: number | null
}

export interface AudioLevel {
  timestamp: number
  level: number // 0-100
  peak: number // 0-100
}

export interface RecordingSession {
  id: string
  filePath: string
  startTime: Date
  duration: number // seconds
  sizeBytes: number
}
