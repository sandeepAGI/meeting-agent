import { MediaRecorder, register, IMediaRecorder } from 'extendable-media-recorder'
import { connect } from 'extendable-media-recorder-wav-encoder'
import type { AudioLevel, RecordingSession, AudioConfig } from '../types/audio'

// Track if WAV encoder has been registered globally
let wavEncoderRegistered = false

export class AudioCaptureService {
  private systemAudioStream: MediaStream | null = null
  private microphoneStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private mediaRecorder: IMediaRecorder | null = null
  private analyser: AnalyserNode | null = null
  private systemSourceNode: MediaStreamAudioSourceNode | null = null
  private microphoneSourceNode: MediaStreamAudioSourceNode | null = null
  private destinationNode: MediaStreamAudioDestinationNode | null = null

  private recordedChunks: Blob[] = []
  private isRecording = false
  private startTime: Date | null = null
  private animationFrameId: number | null = null

  private onAudioLevelCallback: ((level: AudioLevel) => void) | null = null

  private captureMicrophone = true // Default: capture microphone

  private readonly config: AudioConfig = {
    sampleRate: 16000, // Whisper-compatible
    channels: 1, // Mono
  }

  /**
   * Initialize the WAV encoder (must be called before recording)
   * Safe to call multiple times - only registers once
   */
  async initialize(): Promise<void> {
    // Only register encoder once globally
    if (!wavEncoderRegistered) {
      try {
        await register(await connect())
        wavEncoderRegistered = true
        console.log('WAV encoder registered successfully')
      } catch (error) {
        console.error('Failed to register WAV encoder:', error)
        throw new Error('Failed to initialize audio capture service')
      }
    } else {
      console.log('WAV encoder already registered, skipping')
    }
  }

  /**
   * Set whether to capture microphone
   */
  setCaptureMicrophone(enabled: boolean): void {
    this.captureMicrophone = enabled
  }

  /**
   * Start capturing system audio and optionally microphone
   */
  async startCapture(): Promise<void> {
    try {
      // 1. Capture system audio using electron-audio-loopback
      await window.electronAPI.enableLoopbackAudio()

      const systemStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      // Remove video tracks (we only want audio)
      const videoTracks = systemStream.getVideoTracks()
      videoTracks.forEach((track) => {
        track.stop()
        systemStream.removeTrack(track)
      })

      await window.electronAPI.disableLoopbackAudio()

      this.systemAudioStream = systemStream

      // 2. Optionally capture microphone (system default)
      if (this.captureMicrophone) {
        try {
          this.microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: true, // Uses system default microphone
          })
          console.log('Microphone capture enabled')
        } catch (micError) {
          console.warn('Failed to capture microphone, continuing with system audio only:', micError)
          // Don't fail the entire capture if mic fails
        }
      }

      // 3. Create audio context with 16kHz sample rate for Whisper
      this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate })

      // 4. Create source nodes
      this.systemSourceNode = this.audioContext.createMediaStreamSource(this.systemAudioStream)

      if (this.microphoneStream) {
        this.microphoneSourceNode = this.audioContext.createMediaStreamSource(this.microphoneStream)
      }

      // 5. Create analyser for audio level monitoring
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.8

      // 6. Create channel merger to force MONO output (Whisper requirement)
      // ChannelMergerNode(context, {numberOfInputs: 2, channelCount: 1})
      // This will mix all inputs down to mono
      const channelMerger = this.audioContext.createChannelMerger(1)

      // 7. Create destination for merged audio (will be mono)
      this.destinationNode = this.audioContext.createMediaStreamDestination()

      // 8. Connect nodes: system audio → analyser → channelMerger
      this.systemSourceNode.connect(this.analyser)
      this.analyser.connect(channelMerger, 0, 0)

      // 9. Connect microphone to channelMerger (if enabled)
      if (this.microphoneSourceNode) {
        // Also connect mic to analyser for level monitoring
        this.microphoneSourceNode.connect(this.analyser)
        // Note: channelMerger only has 1 input, so both sources mix automatically
      }

      // 10. Connect channelMerger to destination (mono output)
      channelMerger.connect(this.destinationNode)

      // 11. Start audio level monitoring
      this.startAudioLevelMonitoring()

      console.log('Audio capture started successfully:', {
        systemAudio: true,
        microphone: !!this.microphoneStream,
      })
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
  async stopRecording(): Promise<RecordingSession & { blob: Blob }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.startTime) {
        reject(new Error('No active recording'))
        return
      }

      // ISSUE 3 FIX: Check if already stopped/stopping
      if (this.mediaRecorder.state === 'inactive') {
        reject(new Error('Recording already stopped'))
        return
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/wav' })
        const endTime = new Date()
        const duration = (endTime.getTime() - this.startTime!.getTime()) / 1000

        const session = {
          id: this.startTime!.toISOString(),
          filePath: '', // Will be set when saving to disk
          startTime: this.startTime!,
          endTime,
          duration,
          sizeBytes: blob.size,
          blob, // Return blob with session
        }

        this.isRecording = false
        this.startTime = null
        this.recordedChunks = []
        // ISSUE 2 FIX: Null out mediaRecorder
        this.mediaRecorder = null

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
    // ISSUE 4 FIX: Stop active recording first
    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.warn('Stopping active recording before cleanup')
      this.mediaRecorder.stop()
      this.isRecording = false
      this.startTime = null
      this.recordedChunks = []
      this.mediaRecorder = null
    }

    // Stop audio level monitoring
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    // Stop system audio stream
    if (this.systemAudioStream) {
      this.systemAudioStream.getTracks().forEach((track) => track.stop())
      this.systemAudioStream = null
    }

    // Stop microphone stream
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop())
      this.microphoneStream = null
    }

    // Disconnect audio nodes
    if (this.systemSourceNode) {
      this.systemSourceNode.disconnect()
      this.systemSourceNode = null
    }

    if (this.microphoneSourceNode) {
      this.microphoneSourceNode.disconnect()
      this.microphoneSourceNode = null
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
      isCaptureActive: this.systemAudioStream !== null,
      hasMicrophone: this.microphoneStream !== null,
      duration: this.startTime ? (Date.now() - this.startTime.getTime()) / 1000 : 0,
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
