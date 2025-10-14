/**
 * Main application component.
 * Orchestrates audio capture, transcription, and UI display.
 */

import { useState } from 'react'
import { useAudioCapture } from './hooks/useAudioCapture'
import { useTranscription } from './hooks/useTranscription'
import { useMeetingIntelligence } from './hooks/useMeetingIntelligence'
import { InitSection } from './components/InitSection'
import { RecordingControls } from './components/RecordingControls'
import { TranscriptionProgress } from './components/TranscriptionProgress'
import { TranscriptDisplay } from './components/TranscriptDisplay'
import { M365AuthSection } from './components/M365AuthSection'
import { CalendarSection } from './components/CalendarSection'
import { MeetingSelector } from './components/MeetingSelector'
import { SummaryProcessing } from './components/SummaryProcessing'
import { SummaryDisplay } from './components/SummaryDisplay'

function App() {
  console.log('[App] Component rendering...')
  const [error, setError] = useState<string | null>(null)

  // Audio capture hook
  const { state: audioState, actions: audioActions } = useAudioCapture()

  // Transcription hook
  const { state: transcriptionState, actions: transcriptionActions } = useTranscription(setError)

  // Meeting intelligence hook (Phase 2.3-3)
  const { state: intelligenceState, actions: intelligenceActions } = useMeetingIntelligence()

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
                lastSaveTime={audioState.lastSaveTime}
                chunkIndex={audioState.chunkIndex}
                onMicrophoneToggle={handleMicrophoneToggle}
                onStartRecording={audioActions.handleStartRecording}
                onStopRecording={handleStopRecording}
                onDeinitialize={audioActions.handleDeinitialize}
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

          {/* Phase 2.1: M365 Authentication Section - Always visible */}
          <M365AuthSection />

          {/* Phase 2.2: Calendar Section - Always visible */}
          <CalendarSection />

          {/* Phase 2.3-3: Meeting Intelligence Section - Always visible */}
          <div className="meeting-intelligence-section">
            <h2>Meeting Intelligence</h2>

            {/* Step 1: Select Meeting */}
            {!intelligenceState.summaryId && (
              <MeetingSelector
                onStartSummary={intelligenceActions.startSummary}
                isLoading={intelligenceState.isLoading}
              />
            )}

            {/* Step 2: Show Processing Status */}
            {intelligenceState.summaryId && intelligenceState.status && !intelligenceState.summary && (
              <SummaryProcessing
                status={intelligenceState.status}
                onCancel={() => intelligenceActions.cancel(intelligenceState.summaryId!)}
              />
            )}

            {/* Step 3: Show Summary (when complete) */}
            {intelligenceState.summary && (
              <SummaryDisplay
                summary={intelligenceState.summary}
                onUpdate={(updates) => intelligenceActions.updateSummary(intelligenceState.summaryId!, updates)}
                onRegenerate={() => intelligenceActions.regenerate(intelligenceState.summaryId!)}
                isUpdating={intelligenceState.isLoading}
              />
            )}

            {/* Error Display */}
            {intelligenceState.error && (
              <div className="error-message intelligence-error">
                {intelligenceState.error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
