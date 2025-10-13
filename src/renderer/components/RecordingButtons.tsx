/**
 * Recording action buttons component.
 * Start/stop recording and transcription buttons.
 */

interface RecordingButtonsProps {
  isRecording: boolean
  savedAudioPath: string | null
  isTranscribing: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onTranscribe: () => void
  onTranscribeOnly: () => void
}

export function RecordingButtons({
  isRecording,
  savedAudioPath,
  isTranscribing,
  onStartRecording,
  onStopRecording,
  onTranscribe,
  onTranscribeOnly,
}: RecordingButtonsProps) {
  return (
    <div className="button-group">
      {!isRecording ? (
        <button onClick={onStartRecording} className="btn btn-record">
          🎤 Start Recording
        </button>
      ) : (
        <button onClick={onStopRecording} className="btn btn-stop">
          ⏹ Stop Recording
        </button>
      )}
      {savedAudioPath && !isRecording && (
        <>
          <button
            onClick={onTranscribe}
            className="btn btn-transcribe"
            disabled={isTranscribing}
          >
            {isTranscribing ? '⏳ Processing...' : '📝 Transcribe + Diarize'}
          </button>
          <button
            onClick={onTranscribeOnly}
            className="btn btn-transcribe-only"
            disabled={isTranscribing}
          >
            ⚡ Transcribe Only (Fast)
          </button>
        </>
      )}
    </div>
  )
}
