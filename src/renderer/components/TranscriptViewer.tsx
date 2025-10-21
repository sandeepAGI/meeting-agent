/**
 * Transcript Viewer Component
 *
 * Displays past transcripts with speaker diarization.
 * Allows user to view transcript and optionally generate summary.
 * Phase 4: Browse Mode
 */

import { useState, useEffect } from 'react'

interface Transcript {
  id: string
  recording_id: string
  transcript_text: string
  created_at: string
}

interface DiarizationResult {
  id: string
  transcript_id: string
  num_speakers: number
  speaker_segments_json: string
  created_at: string
}

interface TranscriptViewerProps {
  recordingId: string
  recordingDate: string
  recordingDuration: number
  onGenerateSummary: () => void
  onBack: () => void
}

export function TranscriptViewer({
  recordingId,
  recordingDate,
  recordingDuration,
  onGenerateSummary,
  onBack
}: TranscriptViewerProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [diarization, setDiarization] = useState<DiarizationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTranscript()
  }, [recordingId])

  const loadTranscript = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.database.getTranscriptByRecordingId(recordingId)

      if (!result.success) {
        setError(result.error || 'Failed to load transcript')
        return
      }

      setTranscript(result.transcript)

      // Load diarization if available
      // Note: diarization is linked via transcript_id
      // We'll need to add this to the database query or load separately

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transcript')
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="transcript-viewer">
        <div className="viewer-header">
          <button onClick={onBack} className="btn btn-back">
            ← Back
          </button>
          <h3>📝 Transcript</h3>
        </div>
        <div className="loading-state">Loading transcript...</div>
      </div>
    )
  }

  if (error || !transcript) {
    return (
      <div className="transcript-viewer">
        <div className="viewer-header">
          <button onClick={onBack} className="btn btn-back">
            ← Back
          </button>
          <h3>📝 Transcript</h3>
        </div>
        <div className="error-message">{error || 'No transcript found'}</div>
      </div>
    )
  }

  return (
    <div className="transcript-viewer">
      <div className="viewer-header">
        <div className="header-left">
          <button onClick={onBack} className="btn btn-back btn-sm">
            ← Back
          </button>
          <h3>📝 Transcript</h3>
        </div>
        <button onClick={onGenerateSummary} className="btn btn-primary">
          ✨ Generate Summary
        </button>
      </div>

      {/* Recording Metadata */}
      <div className="transcript-metadata">
        <span className="metadata-item">
          📅 {new Date(recordingDate).toLocaleString()}
        </span>
        <span className="metadata-item">
          ⏱️ {formatDuration(recordingDuration)}
        </span>
        {diarization && (
          <span className="metadata-item">
            👥 {diarization.num_speakers} speaker{diarization.num_speakers !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Transcript Text */}
      <div className="transcript-content">
        <div className="transcript-text-box">
          {transcript.transcript_text.split('\n').map((line, index) => {
            // Check if line starts with [SPEAKER_XX]
            const speakerMatch = line.match(/^\[SPEAKER_(\d+)\]:(.*)/)

            if (speakerMatch) {
              const speakerNum = speakerMatch[1]
              const text = speakerMatch[2].trim()

              return (
                <div key={index} className="transcript-line">
                  <span className="speaker-label">Speaker {speakerNum}:</span>
                  <span className="speaker-text">{text}</span>
                </div>
              )
            } else {
              return (
                <div key={index} className="transcript-line">
                  <span className="speaker-text">{line}</span>
                </div>
              )
            }
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="transcript-footer">
        <p className="help-text">
          💡 Generate a summary to get speaker identification, action items, and key decisions.
        </p>
      </div>
    </div>
  )
}
