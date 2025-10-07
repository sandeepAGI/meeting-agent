import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { FileWriter } from 'wav'
import type { AudioConfig, AudioLevel, RecordingSession } from '../types/audio'
import { findBlackHoleDevice, isPortAudioAvailable } from '../utils/audioDevice'

// Dynamically import naudiodon
let portAudio: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  portAudio = require('naudiodon')
} catch (error) {
  console.error('Failed to load naudiodon:', error)
}

export interface AudioServiceEvents {
  audioLevel: (level: AudioLevel) => void
  recordingStarted: (session: RecordingSession) => void
  recordingStopped: (session: RecordingSession) => void
  error: (error: Error) => void
}

export declare interface AudioService {
  on<U extends keyof AudioServiceEvents>(event: U, listener: AudioServiceEvents[U]): this
  emit<U extends keyof AudioServiceEvents>(
    event: U,
    ...args: Parameters<AudioServiceEvents[U]>
  ): boolean
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class AudioService extends EventEmitter {
  private audioInput: any = null
  private wavWriter: FileWriter | null = null
  private isRecording = false
  private currentSession: RecordingSession | null = null
  private recordingStartTime: Date | null = null
  private audioDataSize = 0

  private config: AudioConfig = {
    sampleRate: 16000, // Whisper-compatible sample rate
    channels: 1, // Mono for Whisper
    deviceId: null,
  }

  constructor(private outputDir: string = './recordings') {
    super()
    this.ensureOutputDir()
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  /**
   * Initialize audio capture with optional device ID
   */
  async initialize(deviceId?: number): Promise<void> {
    if (!isPortAudioAvailable()) {
      throw new Error('PortAudio is not available. Please install naudiodon.')
    }

    // Find BlackHole device if no device specified
    if (deviceId === undefined) {
      const blackHole = findBlackHoleDevice()
      if (!blackHole) {
        throw new Error(
          'BlackHole audio device not found. Please install BlackHole from https://existential.audio/blackhole/'
        )
      }
      this.config.deviceId = blackHole.id
    } else {
      this.config.deviceId = deviceId
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<RecordingSession> {
    if (this.isRecording) {
      throw new Error('Already recording')
    }

    if (this.config.deviceId === null) {
      throw new Error('Audio device not initialized. Call initialize() first.')
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
    const filename = `recording_${timestamp}.wav`
    const filePath = path.join(this.outputDir, filename)

    // Create WAV file writer
    this.wavWriter = new FileWriter(filePath, {
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
    })

    // Create audio input stream
    this.audioInput = new portAudio.AudioIO({
      inOptions: {
        channelCount: this.config.channels,
        sampleFormat: portAudio.SampleFormat16Bit,
        sampleRate: this.config.sampleRate,
        deviceId: this.config.deviceId,
        closeOnError: false,
      },
    })

    this.isRecording = true
    this.recordingStartTime = new Date()
    this.audioDataSize = 0

    // Create session
    this.currentSession = {
      id: timestamp,
      filePath,
      startTime: this.recordingStartTime,
      duration: 0,
      sizeBytes: 0,
    }

    // Pipe audio data to WAV writer and calculate levels
    this.audioInput.on('data', (data: Buffer) => {
      this.audioDataSize += data.length

      // Write to WAV file
      if (this.wavWriter) {
        this.wavWriter.write(data)
      }

      // Calculate audio level
      const level = this.calculateAudioLevel(data)
      this.emit('audioLevel', level)
    })

    this.audioInput.on('error', (err: Error) => {
      console.error('Audio input error:', err)
      this.emit('error', err)
    })

    // Start audio stream
    this.audioInput.start()

    this.emit('recordingStarted', this.currentSession)
    return this.currentSession
  }

  /**
   * Stop recording audio
   */
  async stopRecording(): Promise<RecordingSession> {
    if (!this.isRecording) {
      throw new Error('Not recording')
    }

    return new Promise((resolve, reject) => {
      try {
        // Stop audio input
        if (this.audioInput) {
          this.audioInput.quit()
          this.audioInput = null
        }

        // Close WAV writer
        if (this.wavWriter) {
          this.wavWriter.end()
          this.wavWriter = null
        }

        this.isRecording = false

        // Update session with final stats
        if (this.currentSession && this.recordingStartTime) {
          const duration = (Date.now() - this.recordingStartTime.getTime()) / 1000
          this.currentSession.duration = duration
          this.currentSession.sizeBytes = this.audioDataSize

          this.emit('recordingStopped', this.currentSession)
          resolve(this.currentSession)

          this.currentSession = null
          this.recordingStartTime = null
          this.audioDataSize = 0
        } else {
          reject(new Error('No active recording session'))
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Calculate audio level from buffer
   */
  private calculateAudioLevel(buffer: Buffer): AudioLevel {
    const samples = new Int16Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.length / 2
    )

    let sum = 0
    let peak = 0

    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i])
      sum += abs
      if (abs > peak) peak = abs
    }

    const average = sum / samples.length
    const maxAmplitude = 32768 // 16-bit audio max

    return {
      timestamp: Date.now(),
      level: Math.min(100, (average / maxAmplitude) * 100),
      peak: Math.min(100, (peak / maxAmplitude) * 100),
    }
  }

  /**
   * Get current recording status
   */
  getStatus(): {
    isRecording: boolean
    currentSession: RecordingSession | null
    duration: number
  } {
    const duration =
      this.isRecording && this.recordingStartTime
        ? (Date.now() - this.recordingStartTime.getTime()) / 1000
        : 0

    return {
      isRecording: this.isRecording,
      currentSession: this.currentSession,
      duration,
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording()
    }
  }
}
