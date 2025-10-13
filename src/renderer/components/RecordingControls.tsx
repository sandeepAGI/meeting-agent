/**
 * Recording controls section.
 * Displays recording status, audio levels, and control buttons.
 */

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
  onMicrophoneToggle: (enabled: boolean) => void
  onStartRecording: () => void
  onStopRecording: () => void
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
  onMicrophoneToggle,
  onStartRecording,
  onStopRecording,
  onTranscribe,
  onTranscribeOnly,
}: RecordingControlsProps) {
  return (
    <div className="recording-section">
      <div className="status-bar">
        <div className="timer">{formatDuration(duration)}</div>
        <div className="status">
          {isPlayingAnnouncement ? '📢 Playing announcement...' : isRecording ? '🔴 Recording...' : '⏸️ Ready'}
        </div>
      </div>

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
