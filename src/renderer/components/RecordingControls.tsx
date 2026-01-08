/**
 * Recording controls section.
 * Displays recording status, audio levels, and control buttons.
 */

import { useState, useEffect } from 'react'
import type { AudioLevel } from '../../types/audio'
import { AudioLevelMeter } from './AudioLevelMeter'
import { RecordingButtons } from './RecordingButtons'
import { formatDuration } from '../utils/formatDuration'

interface RecordingControlsProps {
  duration: number
  isRecording: boolean
  audioLevel: AudioLevel | null
  captureMicrophone: boolean
  hasMicrophone: boolean
  savedAudioPath: string | null
  isTranscribing: boolean
  isInitializing: boolean
  isPlayingAnnouncement: boolean
  lastSaveTime: Date | null
  chunkIndex: number
  onMicrophoneToggle: (enabled: boolean) => void
  onStartRecording: () => void
  onStopRecording: () => void
  onDeinitialize: () => void
  onTranscribe: () => void
  onTranscribeOnly: () => void
}

export function RecordingControls({
  duration,
  isRecording,
  audioLevel,
  captureMicrophone,
  hasMicrophone,
  savedAudioPath,
  isTranscribing,
  isInitializing,
  isPlayingAnnouncement,
  lastSaveTime,
  chunkIndex,
  onMicrophoneToggle,
  onStartRecording,
  onStopRecording,
  onDeinitialize,
  onTranscribe,
  onTranscribeOnly,
}: RecordingControlsProps) {
  // Phase 6 Batch 5: Load showRecordingAnnouncement setting
  const [showAnnouncement, setShowAnnouncement] = useState(true) // Default to true

  useEffect(() => {
    window.electronAPI.settings.getSettings().then((result) => {
      if (result.success && result.settings) {
        const showRecordingAnnouncement = result.settings.ui?.showRecordingAnnouncement ?? true
        setShowAnnouncement(showRecordingAnnouncement)
      }
    }).catch((err) => {
      console.error('[RecordingControls] Failed to load showRecordingAnnouncement setting:', err)
    })
  }, [])

  // Calculate time since last save
  const getTimeSinceLastSave = (): string => {
    if (!lastSaveTime) return 'Not saved yet'
    const now = new Date()
    const diffSeconds = Math.floor((now.getTime() - lastSaveTime.getTime()) / 1000)
    if (diffSeconds < 60) return `${diffSeconds}s ago`
    const diffMinutes = Math.floor(diffSeconds / 60)
    return `${diffMinutes}m ${diffSeconds % 60}s ago`
  }

  return (
    <div className="recording-section">
      <div className="status-bar">
        <div className="timer">{formatDuration(duration)}</div>
        <div className="status">
          {(isPlayingAnnouncement && showAnnouncement) ? '📢 Playing announcement...' : isRecording ? '🔴 Recording...' : '⏸️ Ready'}
        </div>
      </div>

      {/* Phase 1.5: Chunked recording status */}
      {isRecording && lastSaveTime && (
        <div className="chunk-status" style={{
          marginTop: '8px',
          padding: '8px',
          background: '#f0f8ff',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#666'
        }}>
          💾 Auto-save: Chunk {chunkIndex} | Last saved: {getTimeSinceLastSave()}
        </div>
      )}

      <div className="checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={captureMicrophone}
            onChange={(e) => onMicrophoneToggle(e.target.checked)}
            disabled={isRecording || isInitializing}
          />
          Include microphone
        </label>
      </div>

      {audioLevel && <AudioLevelMeter audioLevel={audioLevel} />}

      <RecordingButtons
        isRecording={isRecording}
        savedAudioPath={savedAudioPath}
        isTranscribing={isTranscribing}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        onTranscribe={onTranscribe}
        onTranscribeOnly={onTranscribeOnly}
      />

      {/* Stop Audio Capture button - only show when not recording */}
      {!isRecording && (
        <div style={{ marginTop: '16px' }}>
          <button
            onClick={onDeinitialize}
            disabled={isInitializing}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            ⏹️ Stop Audio Capture
          </button>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', textAlign: 'center' }}>
            Stop capturing audio to free system resources
          </p>
        </div>
      )}

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
    </div>
  )
}
