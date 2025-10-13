/**
 * Main application component.
 * Orchestrates audio capture, transcription, and UI display.
 */

import { useState } from 'react'
import { useAudioCapture } from './hooks/useAudioCapture'
import { useTranscription } from './hooks/useTranscription'
import { InitSection } from './components/InitSection'
import { RecordingControls } from './components/RecordingControls'
import { TranscriptionProgress } from './components/TranscriptionProgress'
import { TranscriptDisplay } from './components/TranscriptDisplay'

function App() {
  const [error, setError] = useState<string | null>(null)

  // Audio capture hook
  const { state: audioState, actions: audioActions } = useAudioCapture()

  // Transcription hook
  const { state: transcriptionState, actions: transcriptionActions } = useTranscription(setError)

  // Handle stop recording and save audio path
  const handleStopRecording = async () => {
    const result = await audioActions.handleStopRecording()
    if (result.filePath) {
      transcriptionActions.setSavedAudioPath(result.filePath)
    }
  }

  // Forward error setter to audio actions
  const handleMicrophoneToggle = async (enabled: boolean) => {
    await audioActions.handleMicrophoneToggle(enabled)
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
          {audioState.error && <div className="error-message">{audioState.error}</div>}

          {!audioState.isInitialized ? (
            <InitSection
              captureMicrophone={audioState.captureMicrophone}
              isInitializing={audioState.isInitializing}
              onMicrophoneToggle={handleMicrophoneToggle}
              onInitialize={audioActions.handleInitialize}
            />
          ) : (
            <>
              <RecordingControls
                duration={audioState.duration}
                isRecording={audioState.isRecording}
                audioLevel={audioState.audioLevel}
                captureMicrophone={audioState.captureMicrophone}
                hasMicrophone={audioState.hasMicrophone}
                savedAudioPath={transcriptionState.savedAudioPath}
                isTranscribing={transcriptionState.isTranscribing}
                isInitializing={audioState.isInitializing}
                isPlayingAnnouncement={audioState.isPlayingAnnouncement}
                onMicrophoneToggle={handleMicrophoneToggle}
                onStartRecording={audioActions.handleStartRecording}
                onStopRecording={handleStopRecording}
                onTranscribe={transcriptionActions.handleTranscribe}
                onTranscribeOnly={transcriptionActions.handleTranscribeOnly}
              />

              {/* Transcription Progress */}
              {transcriptionState.isTranscribing && transcriptionState.transcriptionProgress && (
                <TranscriptionProgress progress={transcriptionState.transcriptionProgress} />
              )}

              {/* Transcript Display */}
              {transcriptionState.transcript && !transcriptionState.isTranscribing && (
                <TranscriptDisplay transcript={transcriptionState.transcript} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
