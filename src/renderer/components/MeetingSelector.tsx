/**
 * Meeting Selector Component
 *
 * Allows user to select a meeting with transcript to generate summary.
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 */

import { useState } from 'react'

interface MeetingSelectorProps {
  onStartSummary: (meetingId: string, transcriptId: string) => void
  isLoading: boolean
}

export function MeetingSelector({ onStartSummary, isLoading }: MeetingSelectorProps) {
  const [meetingId, setMeetingId] = useState('')
  const [transcriptId, setTranscriptId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (meetingId.trim() && transcriptId.trim()) {
      onStartSummary(meetingId.trim(), transcriptId.trim())
    }
  }

  return (
    <div className="meeting-selector">
      <div className="selector-header">
        <h3>Generate Meeting Summary</h3>
        <p className="selector-description">
          Create an intelligent summary with speaker identification and action items.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="selector-form">
        <div className="form-group">
          <label htmlFor="meeting-id">Meeting ID</label>
          <input
            id="meeting-id"
            type="text"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
            placeholder="Enter meeting ID"
            disabled={isLoading}
            className="form-input"
          />
          <span className="form-hint">
            From your calendar or meeting list
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="transcript-id">Transcript ID</label>
          <input
            id="transcript-id"
            type="text"
            value={transcriptId}
            onChange={(e) => setTranscriptId(e.target.value)}
            placeholder="Enter transcript ID"
            disabled={isLoading}
            className="form-input"
          />
          <span className="form-hint">
            From a completed transcription + diarization
          </span>
        </div>

        <button
          type="submit"
          disabled={isLoading || !meetingId.trim() || !transcriptId.trim()}
          className="btn btn-primary"
        >
          {isLoading ? 'Starting...' : '🤖 Generate Summary'}
        </button>
      </form>

      <div className="cost-notice">
        <span className="cost-icon">💰</span>
        <span>
          Estimated cost: ~$0.09 per 60-min meeting • Processing time: 30-60 minutes
        </span>
      </div>
    </div>
  )
}
