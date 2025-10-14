/**
 * Meeting Selector Component
 *
 * Allows user to select a meeting with transcript to generate summary.
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 */

import { useState, useEffect } from 'react'

interface Recording {
  recording_id: string
  file_path: string
  duration_seconds: number
  recording_created_at: string
  transcript_id: string
  transcript_text: string
  diarization_id: string | null
  num_speakers: number | null
  meeting_id: string | null
  meeting_subject: string | null
  meeting_start_time: string | null
}

interface MeetingSelectorProps {
  onStartSummary: (meetingId: string, transcriptId: string) => void
  isLoading: boolean
}

export function MeetingSelector({ onStartSummary, isLoading }: MeetingSelectorProps) {
  console.log('[MeetingSelector] Component mounting...')

  const [recordings, setRecordings] = useState<Recording[]>([])
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch recordings on mount
  useEffect(() => {
    console.log('[MeetingSelector] useEffect running, fetching recordings...')
    fetchRecordings()
  }, [])

  const fetchRecordings = async () => {
    console.log('[MeetingSelector] Fetching recordings...')
    setIsLoadingRecordings(true)
    setError(null)
    try {
      console.log('[MeetingSelector] Calling window.electronAPI.database.getRecordingsWithTranscripts')
      const result = await window.electronAPI.database.getRecordingsWithTranscripts(20)
      console.log('[MeetingSelector] Result:', result)
      if (result.success && result.recordings) {
        console.log('[MeetingSelector] Got recordings:', result.recordings.length)
        setRecordings(result.recordings)
      } else {
        console.error('[MeetingSelector] Failed:', result.error)
        setError(result.error || 'Failed to load recordings')
      }
    } catch (err) {
      console.error('[MeetingSelector] Exception:', err)
      setError('Failed to fetch recordings')
    } finally {
      setIsLoadingRecordings(false)
    }
  }

  const handleStartSummary = () => {
    if (selectedRecording) {
      // Use meeting_id if available, otherwise pass empty string (will be converted to NULL by backend)
      // Note: meeting_id can be null in the database if recording not linked to a calendar meeting
      const meetingId = selectedRecording.meeting_id || ''
      onStartSummary(meetingId, selectedRecording.transcript_id)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="meeting-selector">
      <div className="selector-header">
        <h3>Generate Meeting Summary</h3>
        <p className="selector-description">
          Select a recording to create an intelligent summary with speaker identification and action items.
        </p>
      </div>

      {isLoadingRecordings ? (
        <div className="loading-state">Loading recordings...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : recordings.length === 0 ? (
        <div className="empty-state">
          <p>No recordings with transcripts found.</p>
          <p className="form-hint">
            Record and transcribe a meeting first, then come back here to generate a summary.
          </p>
        </div>
      ) : (
        <>
          <div className="recordings-list">
            {recordings.map((recording) => (
              <div
                key={recording.recording_id}
                className={`recording-card ${selectedRecording?.recording_id === recording.recording_id ? 'selected' : ''}`}
                onClick={() => setSelectedRecording(recording)}
              >
                <div className="recording-header">
                  <span className="recording-title">
                    {recording.meeting_subject || 'Untitled Recording'}
                  </span>
                  <span className="recording-duration">
                    {formatDuration(recording.duration_seconds)}
                  </span>
                </div>
                <div className="recording-meta">
                  <span className="recording-date">
                    {formatDate(recording.recording_created_at)}
                  </span>
                  {recording.num_speakers && (
                    <span className="recording-speakers">
                      {recording.num_speakers} {recording.num_speakers === 1 ? 'speaker' : 'speakers'}
                    </span>
                  )}
                </div>
                <div className="recording-preview">
                  {recording.transcript_text.substring(0, 120)}...
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleStartSummary}
            disabled={isLoading || !selectedRecording}
            className="btn btn-primary"
          >
            {isLoading ? 'Starting...' : '🤖 Generate Summary'}
          </button>
        </>
      )}

      <div className="cost-notice">
        <span className="cost-icon">💰</span>
        <span>
          Estimated cost: ~$0.09 per 60-min meeting • Processing time: 30-60 minutes
        </span>
      </div>
    </div>
  )
}
