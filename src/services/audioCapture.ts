import { MediaRecorder, register, IMediaRecorder } from 'extendable-media-recorder'
import { connect } from 'extendable-media-recorder-wav-encoder'
import type { AudioLevel, RecordingSessionWithBlob, AudioConfig } from '../types/audio'

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

  // Phase 1.5: Chunked recording
  private sessionId: string | null = null
  private chunkIndex = 0
  private lastSaveTime: Date | null = null
  private chunkSaveInterval: number | null = null
  private isSavingChunk = false  // Prevent concurrent saves
  private chunkSaveErrors = 0  // Track save failures

  private readonly config: AudioConfig = {
    sampleRate: 16000, // Whisper-compatible
    channels: 1, // Mono
  }

  private readonly CHUNK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

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
   * Play announcement using macOS 'say' command via IPC.
   * The announcement informs participants that the meeting is being recorded.
   * Non-blocking - fires and forgets the announcement.
   */
  playAnnouncementNonBlocking(): void {
    const announcementText =
      "This meeting, with your permission, is being recorded to generate meeting notes. " +
      "These recordings will be deleted after notes are generated."

    console.log('[AudioCapture] Starting announcement playback...')
    // Fire and forget - don't await
    window.electronAPI.playAnnouncement(announcementText)
      .then(() => {
        console.log('[AudioCapture] Announcement completed')
      })
      .catch((error) => {
        console.error('[AudioCapture] Announcement failed:', error)
      })
  }

  /**
   * Play announcement and wait for completion.
   * Blocking version for when you need to wait.
   */
  async playAnnouncement(): Promise<void> {
    const announcementText =
      "This meeting, with your permission, is being recorded to generate meeting notes. " +
      "These recordings will be deleted after notes are generated."

    try {
      console.log('[AudioCapture] Playing announcement...')
      await window.electronAPI.playAnnouncement(announcementText)
      console.log('[AudioCapture] Announcement completed')
    } catch (error) {
      console.error('[AudioCapture] Announcement failed:', error)
      // Don't throw - announcement failure shouldn't prevent recording
      // Just log the error and continue
    }
  }

  /**
   * Start recording audio to WAV file.
   * If playAnnouncementFirst is true, starts recording first, then plays announcement.
   * This ensures the announcement is captured in the recording.
   *
   * Phase 1.5: Implements chunked recording with auto-save every 5 minutes.
   *
   * @param playAnnouncementFirst - Whether to play announcement after starting recording (default: true)
   */
  async startRecording(playAnnouncementFirst: boolean = true): Promise<void> {
    if (!this.destinationNode) {
      throw new Error('Audio capture not started. Call startCapture() first.')
    }

    try {
      this.recordedChunks = []
      this.sessionId = new Date().toISOString()
      this.chunkIndex = 0
      this.lastSaveTime = new Date()

      // Create MediaRecorder with WAV encoding
      this.mediaRecorder = new MediaRecorder(this.destinationNode.stream, {
        mimeType: 'audio/wav',
      })

      // Phase 1.5: Save chunks automatically
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          console.log(`[AudioCapture] ondataavailable fired, chunk size: ${event.data.size} bytes`)
          this.recordedChunks.push(event.data)

          // Auto-save chunk every 5 minutes
          // Note: If save is in progress, this will be skipped but saveCurrentChunk
          // will be called again in onstop handler
          await this.saveCurrentChunk()
        }
      }

      // Start MediaRecorder with 5-minute chunks
      this.mediaRecorder.start(this.CHUNK_INTERVAL_MS)
      this.isRecording = true
      this.startTime = new Date()

      console.log('[AudioCapture] Recording started with chunking, session:', this.sessionId)

      // Play announcement AFTER recording starts (so it gets captured)
      // Use non-blocking version to avoid UI delay
      if (playAnnouncementFirst) {
        this.playAnnouncementNonBlocking()
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw error
    }
  }

  /**
   * Save current chunk to disk via IPC.
   * Phase 1.5: Auto-save chunks every 5 minutes.
   * ISSUE 2 FIX: Add error handling and retry logic
   * ISSUE 4 FIX: Prevent concurrent saves with flag
   */
  private async saveCurrentChunk(): Promise<void> {
    if (this.recordedChunks.length === 0 || !this.sessionId) {
      return
    }

    // ISSUE 4 FIX: Prevent concurrent saves
    if (this.isSavingChunk) {
      console.warn('[AudioCapture] Chunk save already in progress, skipping')
      return
    }

    this.isSavingChunk = true

    try {
      const chunkBlob = new Blob(this.recordedChunks, { type: 'audio/wav' })
      const arrayBuffer = await chunkBlob.arrayBuffer()
      const filename = `chunk_${String(this.chunkIndex).padStart(3, '0')}.wav`

      console.log(`[AudioCapture] Saving chunk ${this.chunkIndex}, size: ${chunkBlob.size} bytes`)

      const result = await window.electronAPI.saveAudioChunk(
        arrayBuffer,
        this.sessionId,
        filename
      )

      if (result.success) {
        console.log(`[AudioCapture] Chunk ${this.chunkIndex} saved successfully`)
        this.recordedChunks = [] // Clear buffer after successful save
        this.chunkIndex++
        this.lastSaveTime = new Date()
        this.chunkSaveErrors = 0  // Reset error count on success
      } else {
        // ISSUE 2 FIX: Track failures and throw error
        this.chunkSaveErrors++
        console.error(`[AudioCapture] Failed to save chunk ${this.chunkIndex}:`, result.error)
        console.error(`[AudioCapture] Chunk save failures: ${this.chunkSaveErrors}`)

        if (this.chunkSaveErrors >= 3) {
          throw new Error(`Failed to save chunks (${this.chunkSaveErrors} failures). Recording may be incomplete.`)
        }
      }
    } catch (error) {
      console.error('[AudioCapture] Error saving chunk:', error)
      this.chunkSaveErrors++

      // If we have multiple failures, throw to stop recording
      if (this.chunkSaveErrors >= 3) {
        throw error
      }
    } finally {
      this.isSavingChunk = false
    }
  }

  /**
   * Stop recording and merge all chunks.
   * Phase 1.5: Returns merged audio file path instead of blob.
   */
  async stopRecording(): Promise<RecordingSessionWithBlob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.startTime || !this.sessionId) {
        reject(new Error('No active recording'))
        return
      }

      // ISSUE 3 FIX: Check if already stopped/stopping
      if (this.mediaRecorder.state === 'inactive') {
        reject(new Error('Recording already stopped'))
        return
      }

      this.mediaRecorder.onstop = async () => {
        try {
          // Wait for any in-progress chunk save to complete
          let waitCount = 0
          while (this.isSavingChunk && waitCount < 50) {
            console.log('[AudioCapture] Waiting for chunk save to complete...')
            await new Promise(resolve => setTimeout(resolve, 100))
            waitCount++
          }

          // Save final chunk if any data remains
          if (this.recordedChunks.length > 0) {
            await this.saveCurrentChunk()
          }

          // Merge all chunks via IPC
          console.log('[AudioCapture] Merging chunks for session:', this.sessionId)
          const mergeResult = await window.electronAPI.mergeAudioChunks(this.sessionId!)

          if (!mergeResult.success) {
            throw new Error(mergeResult.error || 'Failed to merge chunks')
          }

          const endTime = new Date()
          const duration = (endTime.getTime() - this.startTime!.getTime()) / 1000

          // Create a placeholder blob (actual audio is on disk)
          const blob = new Blob([], { type: 'audio/wav' })

          const session: RecordingSessionWithBlob = {
            id: this.startTime!.toISOString(),
            filePath: mergeResult.filePath || '', // Path to merged file
            startTime: this.startTime!,
            endTime,
            duration,
            sizeBytes: mergeResult.sizeBytes || 0,
            blob, // Empty blob since audio is on disk
          }

          this.isRecording = false
          this.startTime = null
          this.recordedChunks = []
          this.sessionId = null
          this.chunkIndex = 0
          this.lastSaveTime = null
          this.mediaRecorder = null
          this.isSavingChunk = false
          this.chunkSaveErrors = 0

          console.log('[AudioCapture] Recording stopped, merged file:', session.filePath)
          resolve(session)
        } catch (error) {
          reject(error)
        }
      }

      this.mediaRecorder.stop()
      console.log('[AudioCapture] Stopping recording...')
    })
  }

  /**
   * Stop audio capture and cleanup resources
   */
  async stopCapture(): Promise<void> {
    // ISSUE 3 FIX: Stop active recording first and cleanup all state
    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.warn('Stopping active recording before cleanup')
      this.mediaRecorder.stop()
      this.isRecording = false
      this.startTime = null
      this.recordedChunks = []
      this.mediaRecorder = null

      // ISSUE 3 FIX: Clean up chunk-related state
      this.sessionId = null
      this.chunkIndex = 0
      this.lastSaveTime = null
      this.isSavingChunk = false
      this.chunkSaveErrors = 0
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

    // Disable loopback audio tap
    if (window.electronAPI && window.electronAPI.disableLoopbackAudio) {
      try {
        await window.electronAPI.disableLoopbackAudio()
        console.log('Loopback audio disabled')
      } catch (error) {
        console.error('Failed to disable loopback audio:', error)
      }
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
      lastSaveTime: this.lastSaveTime,
      chunkIndex: this.chunkIndex,
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
