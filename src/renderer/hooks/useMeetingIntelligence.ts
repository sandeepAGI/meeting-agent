/**
 * Meeting Intelligence Hook
 *
 * Manages meeting summarization workflow state and actions.
 */

import { useState, useCallback, useEffect } from 'react'
import type { MeetingSummary, SummaryStatusDisplay, SpeakerMapping, ActionItem } from '../../types/meetingSummary'

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

  // Poll for status updates when summary is processing
  useEffect(() => {
    if (!state.summaryId || !state.status) return

    const isProcessing =
      state.status.status === 'pass1_submitted' ||
      state.status.status === 'pass1_processing' ||
      state.status.status === 'pass2_submitted' ||
      state.status.status === 'pass2_processing'

    if (!isProcessing) return

    const pollInterval = state.status.nextCheckInSeconds * 1000
    const timer = setInterval(async () => {
      if (state.summaryId) {
        await actions.fetchStatus(state.summaryId)
      }
    }, pollInterval)

    return () => clearInterval(timer)
  }, [state.summaryId, state.status])

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
          await actions.fetchStatus(summaryId)
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }, []),

    fetchStatus: useCallback(async (summaryId: string) => {
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
          await actions.fetchSummary(summaryId)
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }, []),

    fetchSummary: useCallback(async (summaryId: string) => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        const result = await window.electronAPI.meetingIntelligence.getSummary(summaryId)

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch summary')
        }

        setState(prev => ({
          ...prev,
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
          await actions.fetchStatus(newSummaryId)
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    }, []),

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
