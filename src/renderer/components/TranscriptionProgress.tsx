/**
 * Transcription progress display component.
 * Shows progress bar and status message during transcription.
 */

import type { TranscriptionProgress as TranscriptionProgressType } from '../../types/transcription'

interface TranscriptionProgressProps {
  progress: TranscriptionProgressType
}

export function TranscriptionProgress({ progress }: TranscriptionProgressProps) {
  return (
    <div className="transcription-section">
      <h3>Transcribing...</h3>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress.progress}%` }}
        ></div>
      </div>
      <p className="progress-message">{progress.message}</p>
    </div>
  )
}
