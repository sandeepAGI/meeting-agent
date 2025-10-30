/**
 * Meeting Intelligence Hook
 *
 * Manages meeting summarization workflow state and actions.
 */

import { useState, useCallback, useEffect } from 'react'
import type { MeetingSummary, SummaryStatusDisplay, SpeakerMapping, ActionItem, DetailedNotes, EmailRecipient, EmailSectionToggles } from '../../types/meetingSummary'

interface MeetingIntelligenceState {
  summaryId: string | null
  summary: MeetingSummary | null
  status: SummaryStatusDisplay | null
  isLoading: boolean
  error: string | null
}

interface MeetingIntelligenceActions {
  startSummary: (meetingId: string, transcriptId: string) => Promise<void>
  fetchStatus: (summaryId: string) => Promise<void>
  fetchSummary: (summaryId: string) => Promise<void>
  updateSummary: (summaryId: string, updates: {
    summary?: string
    speakers?: SpeakerMapping[]
    actionItems?: ActionItem[]
    keyDecisions?: string[]
    recipients?: EmailRecipient[]
    subjectLine?: string
    // Phase 5.5: Email customization
    detailedNotes?: DetailedNotes | null
    customIntroduction?: string
    enabledSections?: EmailSectionToggles
  }) => Promise<void>
  cancel: (summaryId: string) => Promise<void>
  regenerate: (summaryId: string) => Promise<void>
  clear: () => void
}

export function useMeetingIntelligence() {
  const [state, setState] = useState<MeetingIntelligenceState>({
    summaryId: null,
    summary: null,
    status: null,
    isLoading: false,
    error: null
  })

  // Create stable reference for fetchStatus
  const fetchStatusRef = useCallback(async (summaryId: string) => {
    try {
      const result = await window.electronAPI.meetingIntelligence.getStatus(summaryId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch status')
      }

      const status = result.status || null
      setState(prev => ({
        ...prev,
        status,
        error: null
      }))

      // If complete, fetch full summary
      if (status && status.status === 'complete') {
        // Fetch summary
        const summaryResult = await window.electronAPI.meetingIntelligence.getSummary(summaryId)
        if (summaryResult.success) {
          setState(prev => ({
            ...prev,
            summary: summaryResult.summary || null
          }))
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [])

  // Poll for status updates when summary is processing
  useEffect(() => {
    if (!state.summaryId || !state.status) return

    const isProcessing =
      state.status.status === 'pass1_submitted' ||
      state.status.status === 'pass1_processing' ||
      state.status.status === 'pass1_complete' ||
      state.status.status === 'pass2_submitted' ||
      state.status.status === 'pass2_processing'

    if (!isProcessing) return

    // UI polls local DB frequently for responsive updates
    // Default: 5 seconds, faster (2s) when near completion (55+ min)
    let pollIntervalMs = 5000
    if (state.status.elapsedMinutes >= 55) {
      pollIntervalMs = 2000  // Poll faster when near expected completion
    }

    const timer = setInterval(async () => {
      if (state.summaryId) {
        await fetchStatusRef(state.summaryId)
      }
    }, pollIntervalMs)

    return () => clearInterval(timer)
  }, [state.summaryId, state.status, fetchStatusRef])

  const actions: MeetingIntelligenceActions = {
    startSummary: useCallback(async (meetingId: string, transcriptId: string) => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        const result = await window.electronAPI.meetingIntelligence.start(meetingId, transcriptId)

        if (!result.success) {
          throw new Error(result.error || 'Failed to start summary generation')
        }

        const summaryId = result.summaryId || null
        setState(prev => ({
          ...prev,
          summaryId,
          isLoading: false
        }))

        // Start polling for status
        if (summaryId) {
          await fetchStatusRef(summaryId)
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }, [fetchStatusRef]),

    fetchStatus: fetchStatusRef,

    fetchSummary: useCallback(async (summaryId: string) => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        const result = await window.electronAPI.meetingIntelligence.getSummary(summaryId)

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch summary')
        }

        setState(prev => ({
          ...prev,
          summaryId: summaryId, // FIX: Store summaryId for edit operations
          summary: result.summary || null,
          isLoading: false
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }, []),

    updateSummary: useCallback(async (summaryId: string, updates) => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        const result = await window.electronAPI.meetingIntelligence.updateSummary(summaryId, updates)

        if (!result.success) {
          throw new Error(result.error || 'Failed to update summary')
        }

        setState(prev => ({
          ...prev,
          // FIX: Keep existing summary if server doesn't return updated one (safety fallback)
          summary: result.summary || prev.summary,
          isLoading: false
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }, []),

    cancel: useCallback(async (summaryId: string) => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        const result = await window.electronAPI.meetingIntelligence.cancel(summaryId)

        if (!result.success) {
          throw new Error(result.error || 'Failed to cancel summary')
        }

        setState(prev => ({
          ...prev,
          status: { ...prev.status!, status: 'cancelled' },
          isLoading: false
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }, []),

    regenerate: useCallback(async (summaryId: string) => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        const result = await window.electronAPI.meetingIntelligence.regenerate(summaryId)

        if (!result.success) {
          throw new Error(result.error || 'Failed to regenerate summary')
        }

        const newSummaryId = result.summaryId || null
        setState(prev => ({
          ...prev,
          summaryId: newSummaryId,
          summary: null,
          isLoading: false
        }))

        // Start polling for new status
        if (newSummaryId) {
          await fetchStatusRef(newSummaryId)
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }, [fetchStatusRef]),

    clear: useCallback(() => {
      setState({
        summaryId: null,
        summary: null,
        status: null,
        isLoading: false,
        error: null
      })
    }, [])
  }

  return { state, actions }
}
