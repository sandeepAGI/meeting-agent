/**
 * Transcript display component.
 * Shows the completed transcript with statistics and speaker labels.
 */

import type { TranscriptionWithDiarizationResult } from '../../types/electron'

interface TranscriptDisplayProps {
  transcript: TranscriptionWithDiarizationResult
}

export function TranscriptDisplay({ transcript }: TranscriptDisplayProps) {
  return (
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
  )
}
