import { useState, useEffect } from 'react'
import type { AudioLevel } from '../types/audio'

function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState<AudioLevel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blackHoleAvailable, setBlackHoleAvailable] = useState(false)

  // Check for BlackHole on mount
  useEffect(() => {
    const checkBlackHole = async () => {
      const available = await window.electron.audio.isBlackHoleAvailable()
      setBlackHoleAvailable(available)

      if (!available) {
        setError(
          'BlackHole audio device not found. Please install from https://existential.audio/blackhole/'
        )
      }
    }
    checkBlackHole()
  }, [])

  // Listen to audio levels
  useEffect(() => {
    window.electron.audio.onAudioLevel(level => {
      setAudioLevel(level)
    })

    return () => {
      window.electron.audio.removeAudioLevelListener()
    }
  }, [])

  // Update duration while recording
  useEffect(() => {
    if (!isRecording) return

    const interval = setInterval(async () => {
      const status = await window.electron.audio.getStatus()
      setDuration(status.duration)
    }, 100)

    return () => clearInterval(interval)
  }, [isRecording])

  const handleInitialize = async () => {
    setError(null)
    const result = await window.electron.audio.initialize()

    if (result.success) {
      setIsInitialized(true)
    } else {
      setError(result.error || 'Failed to initialize audio')
    }
  }

  const handleDebugDevices = async () => {
    const allDevices = await window.electron.audio.getAllDevices()
    const filteredDevices = await window.electron.audio.getDevices()
    console.log('ALL DEVICES (unfiltered):', allDevices)
    console.log('FILTERED DEVICES (input only):', filteredDevices)
    alert(`Found ${allDevices.length} total devices, ${filteredDevices.length} input devices. Check console for details.`)
  }

  const handleStartRecording = async () => {
    setError(null)
    const result = await window.electron.audio.startRecording()

    if (result.success) {
      setIsRecording(true)
      setDuration(0)
    } else {
      setError(result.error || 'Failed to start recording')
    }
  }

  const handleStopRecording = async () => {
    setError(null)
    const result = await window.electron.audio.stopRecording()

    if (result.success) {
      setIsRecording(false)
      if (result.session) {
        alert(
          `Recording saved!\n\nDuration: ${result.session.duration.toFixed(1)}s\nSize: ${(result.session.sizeBytes / 1024).toFixed(1)} KB\nFile: ${result.session.filePath}`
        )
      }
    } else {
      setError(result.error || 'Failed to stop recording')
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

          {!blackHoleAvailable && (
            <div className="warning-message">
              ⚠️ BlackHole not detected. Please install it to continue.
            </div>
          )}

          <button
            onClick={handleDebugDevices}
            className="btn btn-secondary"
            style={{ marginBottom: '10px' }}
          >
            🔍 Debug: Show All Devices
          </button>

          {!isInitialized ? (
            <button
              onClick={handleInitialize}
              className="btn btn-primary"
              disabled={!blackHoleAvailable}
            >
              Initialize Audio
            </button>
          ) : (
            <div className="recording-section">
              <div className="timer">{formatDuration(duration)}</div>

              {audioLevel && (
                <div className="audio-level">
                  <div className="level-bar">
                    <div
                      className="level-fill"
                      style={{ width: `${audioLevel.level}%` }}
                    ></div>
                  </div>
                  <span className="level-text">{audioLevel.level.toFixed(1)}%</span>
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

              <div className="status">
                Status: {isRecording ? '🔴 Recording...' : '⏸️ Ready'}
              </div>
            </div>
          )}

          <div className="info">
            <p>
              <strong>Phase 1.1 - Audio Capture</strong>
            </p>
            <p>
              This demo captures system audio via BlackHole and saves it as WAV files
              (16kHz mono, compatible with Whisper).
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
