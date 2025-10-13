import { useState, useEffect, useRef } from 'react'
import { AudioCaptureService } from '../services/audioCapture'
import type { AudioLevel } from '../types/audio'
import type { TranscriptionProgress } from '../types/transcription'
import type { TranscriptionWithDiarizationResult } from '../types/electron'

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isCaptureActive, setIsCaptureActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState<AudioLevel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [captureMicrophone, setCaptureMicrophone] = useState(true)
  const [hasMicrophone, setHasMicrophone] = useState(false)

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress | null>(null)
  const [transcript, setTranscript] = useState<TranscriptionWithDiarizationResult | null>(null)
  const [savedAudioPath, setSavedAudioPath] = useState<string | null>(null)

  const audioServiceRef = useRef<AudioCaptureService | null>(null)
  const durationIntervalRef = useRef<number | null>(null)

  // Initialize audio service on mount
  useEffect(() => {
    audioServiceRef.current = new AudioCaptureService()

    // Set up transcription and diarization progress listeners
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
      // Cleanup on unmount
      if (audioServiceRef.current) {
        audioServiceRef.current.stopCapture().catch((err) => {
          console.error('Failed to stop capture on unmount:', err)
        })
      }
      // Unsubscribe from IPC listeners
      unsubscribeTranscription()
      unsubscribeDiarization()
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

      await audioServiceRef.current.startRecording()
      setIsRecording(true)
      setDuration(0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording'
      setError(message)
      console.error('Recording error:', err)
    }
  }

  const handleStopRecording = async () => {
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
          setSavedAudioPath(saveResult.filePath)
        } else {
          throw new Error(saveResult.error || 'Failed to save audio file')
        }
      } else {
        console.error('[DEBUG] No blob available')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop recording'
      setError(message)
      setIsTranscribing(false)
      setTranscriptionProgress(null)
      console.error('[DEBUG] Stop recording error:', err)
    }
  }

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

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Meeting Agent</h1>
        <p>AI-powered meeting transcription and summarization</p>
      </header>

      <main className="app-main">
        <div className="audio-controls">
          <h2>Audio Recording</h2>

          {error && <div className="error-message">{error}</div>}

          {!isInitialized ? (
            <div className="init-section">
              <p className="info-text">
                <strong>Phase 1.1 - Audio Capture</strong>
              </p>
              <p className="info-text">
                This captures system audio natively on macOS (no BlackHole required) and
                optionally captures your microphone. Saves as WAV files (16kHz mono, compatible
                with Whisper).
              </p>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={captureMicrophone}
                    onChange={(e) => handleMicrophoneToggle(e.target.checked)}
                    disabled={isInitializing}
                  />
                  Include microphone (uses system default)
                </label>
              </div>

              <button
                onClick={handleInitialize}
                className="btn btn-primary"
                disabled={isInitializing}
              >
                {isInitializing ? 'Initializing...' : 'Initialize Audio Capture'}
              </button>
            </div>
          ) : (
            <div className="recording-section">
              <div className="status-bar">
                <div className="timer">{formatDuration(duration)}</div>
                <div className="status">
                  {isRecording ? '🔴 Recording...' : '⏸️ Ready'}
                </div>
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={captureMicrophone}
                    onChange={(e) => handleMicrophoneToggle(e.target.checked)}
                    disabled={isRecording || isInitializing}
                  />
                  Include microphone
                </label>
              </div>

              {audioLevel && (
                <div className="audio-level">
                  <label>Audio Level:</label>
                  <div className="level-bar">
                    <div
                      className="level-fill"
                      style={{ width: `${audioLevel.level}%` }}
                    ></div>
                  </div>
                  <span className="level-text">{audioLevel.level}%</span>
                </div>
              )}

              <div className="button-group">
                {!isRecording ? (
                  <button onClick={handleStartRecording} className="btn btn-record">
                    🎤 Start Recording
                  </button>
                ) : (
                  <button onClick={handleStopRecording} className="btn btn-stop">
                    ⏹ Stop Recording
                  </button>
                )}
                {savedAudioPath && !isRecording && (
                  <>
                    <button
                      onClick={handleTranscribe}
                      className="btn btn-transcribe"
                      disabled={isTranscribing}
                    >
                      {isTranscribing ? '⏳ Processing...' : '📝 Transcribe + Diarize'}
                    </button>
                    <button
                      onClick={handleTranscribeOnly}
                      className="btn btn-transcribe-only"
                      disabled={isTranscribing}
                    >
                      ⚡ Transcribe Only (Fast)
                    </button>
                  </>
                )}
              </div>

              <div className="info">
                <p>
                  <strong>Active Sources:</strong>
                </p>
                <ul>
                  <li>✅ System audio (meeting participants, videos, etc.)</li>
                  {hasMicrophone && <li>✅ Microphone (your voice)</li>}
                  {!hasMicrophone && captureMicrophone && (
                    <li>⚠️ Microphone not available</li>
                  )}
                </ul>
                <p style={{ marginTop: '12px' }}>
                  <strong>How it works:</strong>
                </p>
                <ul>
                  <li>✅ Native system audio capture (no virtual drivers)</li>
                  <li>✅ 16kHz mono WAV output (Whisper-ready)</li>
                  <li>✅ Real-time audio level monitoring</li>
                  <li>✅ No BlackHole installation required</li>
                  <li>✅ Local Whisper transcription (Phase 1.2)</li>
                </ul>
              </div>

              {/* Transcription Progress */}
              {isTranscribing && transcriptionProgress && (
                <div className="transcription-section">
                  <h3>Transcribing...</h3>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${transcriptionProgress.progress}%` }}
                    ></div>
                  </div>
                  <p className="progress-message">{transcriptionProgress.message}</p>
                </div>
              )}

              {/* Transcript Display */}
              {transcript && !isTranscribing && (
                <div className="transcript-section">
                  <h3>Transcript</h3>
                  <div className="transcript-stats">
                    <span>Duration: {transcript.duration.toFixed(1)}s</span>
                    <span>
                      Processing: {transcript.processingTime.toFixed(1)}s
                    </span>
                    <span>Language: {transcript.language}</span>
                    {transcript.merged && (
                      <span>Speakers: {transcript.merged.speakerCount}</span>
                    )}
                  </div>
                  <div className="transcript-text">
                    {transcript.merged
                      ? transcript.merged.fullText
                      : transcript.text}
                  </div>
                  {transcript.merged && (
                    <div className="info" style={{ marginTop: '16px' }}>
                      <p><strong>Speaker Diarization:</strong></p>
                      <p>✅ {transcript.merged.speakerCount} speaker{transcript.merged.speakerCount > 1 ? 's' : ''} detected</p>
                      <p style={{ fontSize: '0.9em', color: '#666' }}>
                        Phase 2 will match speaker labels with calendar attendee names.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
