import { MediaRecorder, register, IMediaRecorder } from 'extendable-media-recorder'
import { connect } from 'extendable-media-recorder-wav-encoder'
import type { AudioLevel, RecordingSession, AudioConfig } from '../types/audio'

export class AudioCaptureService {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private mediaRecorder: IMediaRecorder | null = null
  private analyser: AnalyserNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private destinationNode: MediaStreamAudioDestinationNode | null = null

  private recordedChunks: Blob[] = []
  private isRecording = false
  private startTime: Date | null = null
  private animationFrameId: number | null = null

  private onAudioLevelCallback: ((level: AudioLevel) => void) | null = null

  private readonly config: AudioConfig = {
    sampleRate: 16000, // Whisper-compatible
    channels: 1, // Mono
  }

  /**
   * Initialize the WAV encoder (must be called before recording)
   */
  async initialize(): Promise<void> {
    try {
      await register(await connect())
      console.log('WAV encoder registered successfully')
    } catch (error) {
      console.error('Failed to register WAV encoder:', error)
      throw new Error('Failed to initialize audio capture service')
    }
  }

  /**
   * Start capturing system audio using manual mode
   */
  async startCapture(): Promise<void> {
    try {
      // Enable loopback audio via IPC (handled by initMain() in audioSetup.ts)
      await window.electronAPI.enableLoopbackAudio()

      // Get MediaStream with system audio loopback
      // getDisplayMedia requires video: true, but we'll remove video tracks
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      // Remove video tracks (we only want audio)
      const videoTracks = stream.getVideoTracks()
      videoTracks.forEach((track) => {
        track.stop()
        stream.removeTrack(track)
      })

      // Disable loopback audio (restore normal getDisplayMedia behavior)
      await window.electronAPI.disableLoopbackAudio()

      this.mediaStream = stream

      if (!this.mediaStream) {
        throw new Error('Failed to get audio loopback stream')
      }

      // Create audio context with 16kHz sample rate for Whisper
      this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate })

      // Create source from the media stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Create analyser for audio level monitoring
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.8

      // Create destination for resampled audio
      this.destinationNode = this.audioContext.createMediaStreamDestination()

      // Connect nodes: source → analyser → destination
      this.sourceNode.connect(this.analyser)
      this.analyser.connect(this.destinationNode)

      // Start audio level monitoring
      this.startAudioLevelMonitoring()

      console.log('Audio capture started successfully')
    } catch (error) {
      console.error('Failed to start audio capture:', error)
      throw error
    }
  }

  /**
   * Start recording audio to WAV file
   */
  async startRecording(): Promise<void> {
    if (!this.destinationNode) {
      throw new Error('Audio capture not started. Call startCapture() first.')
    }

    try {
      this.recordedChunks = []

      // Create MediaRecorder with WAV encoding
      this.mediaRecorder = new MediaRecorder(this.destinationNode.stream, {
        mimeType: 'audio/wav',
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.start(1000) // Collect data every second
      this.isRecording = true
      this.startTime = new Date()

      console.log('Recording started')
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw error
    }
  }

  /**
   * Stop recording and return the recorded audio as a Blob
   */
  async stopRecording(): Promise<RecordingSession> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.startTime) {
        reject(new Error('No active recording'))
        return
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/wav' })
        const endTime = new Date()
        const duration = (endTime.getTime() - this.startTime!.getTime()) / 1000

        const session: RecordingSession = {
          id: this.startTime!.toISOString(),
          filePath: '', // Will be set when saving to disk
          startTime: this.startTime!,
          endTime,
          duration,
          sizeBytes: blob.size,
        }

        this.isRecording = false
        this.startTime = null
        this.recordedChunks = []

        resolve(session)
      }

      this.mediaRecorder.stop()
      console.log('Recording stopped')
    })
  }

  /**
   * Stop audio capture and cleanup resources
   */
  stopCapture(): void {
    // Stop audio level monitoring
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    // Stop all media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    // Disconnect audio nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.destinationNode) {
      this.destinationNode.disconnect()
      this.destinationNode = null
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    console.log('Audio capture stopped')
  }

  /**
   * Monitor audio levels and emit callbacks
   */
  private startAudioLevelMonitoring(): void {
    if (!this.analyser) return

    const bufferLength = this.analyser.fftSize
    const dataArray = new Uint8Array(bufferLength)

    const checkLevel = () => {
      if (!this.analyser) return

      this.analyser.getByteTimeDomainData(dataArray)

      // Calculate RMS (root mean square) level
      let sum = 0
      let peak = 0

      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128 // Normalize to -1 to 1
        const abs = Math.abs(normalized)
        sum += normalized * normalized
        if (abs > peak) peak = abs
      }

      const rms = Math.sqrt(sum / bufferLength)
      const level = Math.min(100, rms * 100 * 5) // Scale and cap at 100
      const peakLevel = Math.min(100, peak * 100)

      const audioLevel: AudioLevel = {
        timestamp: Date.now(),
        level: Math.round(level),
        peak: Math.round(peakLevel),
      }

      if (this.onAudioLevelCallback) {
        this.onAudioLevelCallback(audioLevel)
      }

      this.animationFrameId = requestAnimationFrame(checkLevel)
    }

    checkLevel()
  }

  /**
   * Set callback for audio level updates
   */
  onAudioLevel(callback: (level: AudioLevel) => void): void {
    this.onAudioLevelCallback = callback
  }

  /**
   * Get current recording state
   */
  getState() {
    return {
      isRecording: this.isRecording,
      isCaptureActive: this.mediaStream !== null,
      duration: this.startTime
        ? (Date.now() - this.startTime.getTime()) / 1000
        : 0,
    }
  }

  /**
   * Get the recorded audio blob (call after stopRecording)
   */
  getRecordingBlob(): Blob | null {
    if (this.recordedChunks.length === 0) return null
    return new Blob(this.recordedChunks, { type: 'audio/wav' })
  }
}
