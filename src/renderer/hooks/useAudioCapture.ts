/**
 * Custom hook for audio capture functionality.
 * Manages audio recording state and operations.
 */

import { useState, useRef, useEffect } from 'react'
import { AudioCaptureService } from '../../services/audioCapture'
import type { AudioLevel } from '../../types/audio'

export interface AudioCaptureState {
  isInitialized: boolean
  isCaptureActive: boolean
  isRecording: boolean
  duration: number
  audioLevel: AudioLevel | null
  error: string | null
  isInitializing: boolean
  captureMicrophone: boolean
  hasMicrophone: boolean
  isPlayingAnnouncement: boolean
}

export interface AudioCaptureActions {
  handleInitialize: () => Promise<void>
  handleMicrophoneToggle: (enabled: boolean) => Promise<void>
  handleStartRecording: () => Promise<void>
  handleStopRecording: () => Promise<{ filePath: string | null }>
  setError: (error: string | null) => void
}

export function useAudioCapture() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isCaptureActive, setIsCaptureActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState<AudioLevel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [captureMicrophone, setCaptureMicrophone] = useState(true)
  const [hasMicrophone, setHasMicrophone] = useState(false)
  const [isPlayingAnnouncement, setIsPlayingAnnouncement] = useState(false)

  const audioServiceRef = useRef<AudioCaptureService | null>(null)
  const durationIntervalRef = useRef<number | null>(null)

  // Initialize audio service on mount
  useEffect(() => {
    audioServiceRef.current = new AudioCaptureService()

    return () => {
      // Cleanup on unmount
      if (audioServiceRef.current) {
        audioServiceRef.current.stopCapture().catch((err) => {
          console.error('Failed to stop capture on unmount:', err)
        })
      }
    }
  }, [])

  // Update duration while recording
  useEffect(() => {
    if (isRecording) {
      durationIntervalRef.current = window.setInterval(() => {
        if (audioServiceRef.current) {
          const state = audioServiceRef.current.getState()
          setDuration(state.duration)
        }
      }, 100)
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [isRecording])

  const handleInitialize = async () => {
    setError(null)
    setIsInitializing(true)

    try {
      if (!audioServiceRef.current) {
        throw new Error('Audio service not available')
      }

      // Set microphone capture preference
      audioServiceRef.current.setCaptureMicrophone(captureMicrophone)

      // Initialize WAV encoder
      await audioServiceRef.current.initialize()

      // Start audio capture
      await audioServiceRef.current.startCapture()

      // Check if microphone was successfully captured
      const state = audioServiceRef.current.getState()
      setHasMicrophone(state.hasMicrophone)

      // Set up audio level callback
      audioServiceRef.current.onAudioLevel((level) => {
        setAudioLevel(level)
      })

      setIsInitialized(true)
      setIsCaptureActive(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize audio'
      setError(message)
      console.error('Initialization error:', err)
    } finally {
      setIsInitializing(false)
    }
  }

  const handleMicrophoneToggle = async (enabled: boolean) => {
    setCaptureMicrophone(enabled)

    // If already initialized, re-initialize with new setting
    if (isInitialized && !isRecording) {
      try {
        if (!audioServiceRef.current) {
          throw new Error('Audio service not available')
        }

        setError(null)
        setIsInitializing(true)

        // Stop current capture
        await audioServiceRef.current.stopCapture()

        // Update microphone preference
        audioServiceRef.current.setCaptureMicrophone(enabled)

        // Restart capture with new settings
        await audioServiceRef.current.startCapture()

        // Update microphone status
        const state = audioServiceRef.current.getState()
        setHasMicrophone(state.hasMicrophone)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update microphone setting'
        setError(message)
        console.error('Microphone toggle error:', err)
      } finally {
        setIsInitializing(false)
      }
    }
  }

  const handleStartRecording = async () => {
    setError(null)

    try {
      if (!audioServiceRef.current) {
        throw new Error('Audio service not available')
      }

      // Set announcement state immediately for instant UI feedback
      setIsPlayingAnnouncement(true)

      // Start recording (non-blocking announcement plays inside)
      await audioServiceRef.current.startRecording()

      // Recording started, now showing announcement for ~7 seconds
      setIsRecording(true)
      setDuration(0)

      // Clear announcement status after 7 seconds (announcement duration)
      setTimeout(() => {
        setIsPlayingAnnouncement(false)
      }, 7000)
    } catch (err) {
      setIsPlayingAnnouncement(false)
      const message = err instanceof Error ? err.message : 'Failed to start recording'
      setError(message)
      console.error('Recording error:', err)
    }
  }

  const handleStopRecording = async (): Promise<{ filePath: string | null }> => {
    setError(null)
    console.log('[DEBUG] Stop recording clicked')

    try {
      if (!audioServiceRef.current) {
        throw new Error('Audio service not available')
      }

      console.log('[DEBUG] Stopping recording...')
      const session = await audioServiceRef.current.stopRecording()
      setIsRecording(false)
      console.log('[DEBUG] Recording stopped, session:', session)

      // Get the recorded blob from session
      const blob = session.blob
      console.log('[DEBUG] Got blob, size:', blob?.size)

      if (blob) {
        const filename = `recording_${session.id.replace(/[:.]/g, '-')}.wav`
        console.log('[DEBUG] Saving audio file:', filename)

        // Convert blob to ArrayBuffer and save to disk via IPC
        const arrayBuffer = await blob.arrayBuffer()
        console.log('[DEBUG] ArrayBuffer size:', arrayBuffer.byteLength)

        const saveResult = await window.electronAPI.saveAudioFile(arrayBuffer, filename)
        console.log('[DEBUG] Save result:', saveResult)

        if (saveResult.success && saveResult.filePath) {
          console.log('[DEBUG] Audio saved to:', saveResult.filePath)
          return { filePath: saveResult.filePath }
        } else {
          throw new Error(saveResult.error || 'Failed to save audio file')
        }
      } else {
        console.error('[DEBUG] No blob available')
        return { filePath: null }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop recording'
      setError(message)
      console.error('[DEBUG] Stop recording error:', err)
      return { filePath: null }
    }
  }

  const state: AudioCaptureState = {
    isInitialized,
    isCaptureActive,
    isRecording,
    duration,
    audioLevel,
    error,
    isInitializing,
    captureMicrophone,
    hasMicrophone,
    isPlayingAnnouncement,
  }

  const actions: AudioCaptureActions = {
    handleInitialize,
    handleMicrophoneToggle,
    handleStartRecording,
    handleStopRecording,
    setError,
  }

  return { state, actions }
}
