import { useState, useEffect, useRef } from 'react'
import { AudioCaptureService } from '../services/audioCapture'
import type { AudioLevel } from '../types/audio'

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isCaptureActive, setIsCaptureActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState<AudioLevel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  const audioServiceRef = useRef<AudioCaptureService | null>(null)
  const durationIntervalRef = useRef<number | null>(null)

  // Initialize audio service on mount
  useEffect(() => {
    audioServiceRef.current = new AudioCaptureService()
    return () => {
      // Cleanup on unmount
      if (audioServiceRef.current) {
        audioServiceRef.current.stopCapture()
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

      // Initialize WAV encoder
      await audioServiceRef.current.initialize()

      // Start audio capture
      await audioServiceRef.current.startCapture()

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

    try {
      if (!audioServiceRef.current) {
        throw new Error('Audio service not available')
      }

      const session = await audioServiceRef.current.stopRecording()
      setIsRecording(false)

      // Get the recorded blob
      const blob = audioServiceRef.current.getRecordingBlob()

      if (blob) {
        // Create download link
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `recording_${session.id.replace(/[:.]/g, '-')}.wav`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        alert(
          `Recording saved!\n\nDuration: ${session.duration.toFixed(1)}s\nSize: ${(session.sizeBytes / 1024 / 1024).toFixed(2)} MB\nFormat: WAV (16kHz mono)`
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop recording'
      setError(message)
      console.error('Stop recording error:', err)
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
                This captures system audio natively on macOS (no BlackHole required) and saves
                it as WAV files (16kHz mono, compatible with Whisper).
              </p>
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
              </div>

              <div className="info">
                <p>
                  <strong>How it works:</strong>
                </p>
                <ul>
                  <li>✅ Native system audio capture (no virtual drivers)</li>
                  <li>✅ 16kHz mono WAV output (Whisper-ready)</li>
                  <li>✅ Real-time audio level monitoring</li>
                  <li>✅ No BlackHole installation required</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
