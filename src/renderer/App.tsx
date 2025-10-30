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
import { TranscriptViewer } from './components/TranscriptViewer'
import aileronLogo from './assets/branding/aileron-logo.png'

function App() {
  console.log('[App] Component rendering...')
  const [error, setError] = useState<string | null>(null)
  const [viewingTranscript, setViewingTranscript] = useState<{
    recordingId: string
    recordingDate: string
    recordingDuration: number
  } | null>(null)

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

  // Phase 4: Handle viewing transcript
  const handleViewTranscript = (recordingId: string, recordingDate: string, recordingDuration: number) => {
    setViewingTranscript({ recordingId, recordingDate, recordingDuration })
    // Clear summary view if viewing transcript
    intelligenceActions.clear()
  }

  // Phase 4: Handle viewing summary
  const handleViewSummary = async (summaryId: string) => {
    // Clear transcript view if viewing summary
    setViewingTranscript(null)
    // Load the summary
    await intelligenceActions.fetchSummary(summaryId)
  }

  // Phase 4: Handle generating summary from transcript viewer
  const handleGenerateSummaryFromTranscript = () => {
    if (viewingTranscript) {
      setViewingTranscript(null)
      // The user will need to select the recording again in generate mode
      // This is intentional to keep the flow simple
    }
  }

  // Phase 5.5: Handle transcribing untranscribed recordings
  const handleTranscribeRecording = async (recordingId: string) => {
    try {
      console.log('[App] Starting transcription for recording:', recordingId)

      // Get the recording file path from database
      const result = await window.electronAPI.database.getRecordingsByMeetingId(recordingId)
      if (!result.success || !result.recordings || result.recordings.length === 0) {
        // Try to get it directly by querying untranscribed recordings
        const untranscribedResult = await window.electronAPI.database.getUntranscribedRecordings(100)
        if (untranscribedResult.success && untranscribedResult.recordings) {
          const recording = untranscribedResult.recordings.find((r: any) => r.recording_id === recordingId)
          if (recording && recording.file_path) {
            console.log('[App] Found recording file path:', recording.file_path)

            // Start transcription + diarization
            const transcribeResult = await window.electronAPI.transcribeAndDiarize(recording.file_path, {
              language: 'en',
              temperature: 0.0
            })

            if (transcribeResult.success) {
              console.log('[App] Transcription completed successfully')
            } else {
              setError(transcribeResult.error || 'Transcription failed')
            }
          } else {
            setError('Recording file not found')
          }
        } else {
          setError('Failed to fetch recording details')
        }
      }
    } catch (err) {
      console.error('[App] Transcription error:', err)
      setError(err instanceof Error ? err.message : 'Failed to transcribe recording')
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-brand">
          <img
            src={aileronLogo}
            alt="Aileron Logo"
            className="app-header-logo"
          />
          <div className="app-header-text">
            <h1>Meeting Agent</h1>
            <p>AI-powered meeting transcription and summarization</p>
          </div>
        </div>
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

            {/* Phase 4: Transcript Viewer */}
            {viewingTranscript && (
              <TranscriptViewer
                recordingId={viewingTranscript.recordingId}
                recordingDate={viewingTranscript.recordingDate}
                recordingDuration={viewingTranscript.recordingDuration}
                onGenerateSummary={handleGenerateSummaryFromTranscript}
                onBack={() => setViewingTranscript(null)}
              />
            )}

            {/* Step 1: Select Meeting (hide if viewing transcript or summary) */}
            {!intelligenceState.summaryId && !viewingTranscript && (
              <MeetingSelector
                onStartSummary={intelligenceActions.startSummary}
                onViewTranscript={handleViewTranscript}
                onViewSummary={handleViewSummary}
                onTranscribeRecording={handleTranscribeRecording}
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
                onBack={intelligenceActions.clear}
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
