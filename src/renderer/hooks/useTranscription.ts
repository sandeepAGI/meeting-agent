/**
 * Custom hook for transcription functionality.
 * Manages transcription state and operations.
 */

import { useState, useEffect } from 'react'
import type { TranscriptionProgress } from '../../types/transcription'
import type { TranscriptionWithDiarizationResult } from '../../types/electron'

export interface TranscriptionState {
  isTranscribing: boolean
  transcriptionProgress: TranscriptionProgress | null
  transcript: TranscriptionWithDiarizationResult | null
  savedAudioPath: string | null
}

export interface TranscriptionActions {
  handleTranscribe: () => Promise<void>
  handleTranscribeOnly: () => Promise<void>
  setSavedAudioPath: (path: string | null) => void
  setError: (error: string | null) => void
}

export function useTranscription(setError: (error: string | null) => void) {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress | null>(null)
  const [transcript, setTranscript] = useState<TranscriptionWithDiarizationResult | null>(null)
  const [savedAudioPath, setSavedAudioPath] = useState<string | null>(null)

  // Set up transcription and diarization progress listeners
  useEffect(() => {
    const unsubscribeTranscription = window.electronAPI.onTranscriptionProgress((progress) => {
      setTranscriptionProgress(progress)
    })

    const unsubscribeDiarization = window.electronAPI.onDiarizationProgress((progress) => {
      // Update transcription progress with diarization stage
      setTranscriptionProgress({
        stage: 'diarizing',
        progress: progress.progress || 0,
        message: progress.message
      })
    })

    return () => {
      // Unsubscribe from IPC listeners
      unsubscribeTranscription()
      unsubscribeDiarization()
    }
  }, [])

  const handleTranscribe = async () => {
    if (!savedAudioPath) {
      setError('No audio file available. Record audio first.')
      return
    }

    setError(null)
    setTranscript(null) // Clear previous transcript

    try {
      console.log('[DEBUG] Starting transcription + diarization...')
      setIsTranscribing(true)
      setTranscriptionProgress({
        stage: 'loading',
        progress: 0,
        message: 'Starting transcription...',
      })

      // Use combined transcription + diarization API
      const result = await window.electronAPI.transcribeAndDiarize(savedAudioPath, {
        language: 'en',
        temperature: 0.0,
      })
      console.log('[DEBUG] Transcription + diarization result:', result)

      if (result.success && result.result) {
        setTranscript(result.result)
        setIsTranscribing(false)
        setTranscriptionProgress(null)
        console.log('[DEBUG] Transcription complete:', result.result.text)
        if (result.result.merged) {
          console.log('[DEBUG] Speaker-labeled transcript:', result.result.merged.fullText)
        }
      } else {
        throw new Error(result.error || 'Transcription failed')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed'
      setError(message)
      setIsTranscribing(false)
      setTranscriptionProgress(null)
      console.error('[DEBUG] Transcription error:', err)
    }
  }

  const handleTranscribeOnly = async () => {
    if (!savedAudioPath) {
      setError('No audio file available. Record audio first.')
      return
    }

    setError(null)
    setTranscript(null) // Clear previous transcript

    try {
      console.log('[DEBUG] Starting transcription only (no diarization)...')
      setIsTranscribing(true)
      setTranscriptionProgress({
        stage: 'loading',
        progress: 0,
        message: 'Starting transcription...',
      })

      // Use transcription-only API (faster)
      const result = await window.electronAPI.transcribeAudio(savedAudioPath, {
        language: 'en',
        temperature: 0.0,
      })
      console.log('[DEBUG] Transcription result:', result)

      if (result.success && result.result) {
        // Add merged: null to match TranscriptionWithDiarizationResult type
        setTranscript({
          ...result.result,
          merged: null
        })
        setIsTranscribing(false)
        setTranscriptionProgress(null)
        console.log('[DEBUG] Transcription complete:', result.result.text)
      } else {
        throw new Error(result.error || 'Transcription failed')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed'
      setError(message)
      setIsTranscribing(false)
      setTranscriptionProgress(null)
      console.error('[DEBUG] Transcription error:', err)
    }
  }

  const state: TranscriptionState = {
    isTranscribing,
    transcriptionProgress,
    transcript,
    savedAudioPath,
  }

  const actions: TranscriptionActions = {
    handleTranscribe,
    handleTranscribeOnly,
    setSavedAudioPath,
    setError,
  }

  return { state, actions }
}
