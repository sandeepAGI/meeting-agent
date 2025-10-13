/**
 * Initial setup section for audio capture.
 * Displayed before audio capture is initialized.
 */

interface InitSectionProps {
  captureMicrophone: boolean
  isInitializing: boolean
  onMicrophoneToggle: (enabled: boolean) => void
  onInitialize: () => void
}

export function InitSection({
  captureMicrophone,
  isInitializing,
  onMicrophoneToggle,
  onInitialize,
}: InitSectionProps) {
  return (
    <div className="init-section">
      <p className="info-text">
        <strong>Phase 1.1 - Audio Capture</strong>
      </p>
      <p className="info-text">
        This captures system audio natively on macOS (no BlackHole required) and
        optionally captures your microphone. Saves as WAV files (16kHz mono, compatible
        with Whisper).
      </p>

      <div className="checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={captureMicrophone}
            onChange={(e) => onMicrophoneToggle(e.target.checked)}
            disabled={isInitializing}
          />
          Include microphone (uses system default)
        </label>
      </div>

      <button
        onClick={onInitialize}
        className="btn btn-primary"
        disabled={isInitializing}
      >
        {isInitializing ? 'Initializing...' : 'Initialize Audio Capture'}
      </button>
    </div>
  )
}
