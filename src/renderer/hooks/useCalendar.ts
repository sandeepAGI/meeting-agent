/**
 * React hook for Microsoft Calendar operations
 *
 * Provides calendar data and operations for fetching meetings.
 */

import { useState, useEffect } from 'react'
import type { MeetingInfo } from '../../types/electron'

export interface CalendarState {
  meetings: MeetingInfo[]
  isLoading: boolean
  error: string | null
}

export function useCalendar() {
  const [state, setState] = useState<CalendarState>({
    meetings: [],
    isLoading: false,
    error: null
  })

  // Fetch today's meetings
  const fetchTodaysMeetings = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await window.electronAPI.graphApi.getTodaysMeetings()

      if (result.success && result.meetings) {
        // Convert date strings back to Date objects
        const meetings = result.meetings.map(meeting => ({
          ...meeting,
          start: new Date(meeting.start),
          end: new Date(meeting.end)
        }))

        setState({
          meetings,
          isLoading: false,
          error: null
        })
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to fetch meetings',
          isLoading: false
        }))
      }
    } catch (error) {
      console.error('[useCalendar] Fetch failed:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch meetings',
        isLoading: false
      }))
    }
  }

  // Fetch upcoming meetings
  const fetchUpcomingMeetings = async (minutesAhead: number = 15) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await window.electronAPI.graphApi.getUpcomingMeetings(minutesAhead)

      if (result.success && result.meetings) {
        const meetings = result.meetings.map(meeting => ({
          ...meeting,
          start: new Date(meeting.start),
          end: new Date(meeting.end)
        }))

        setState({
          meetings,
          isLoading: false,
          error: null
        })
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to fetch upcoming meetings',
          isLoading: false
        }))
      }
    } catch (error) {
      console.error('[useCalendar] Fetch upcoming failed:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch upcoming meetings',
        isLoading: false
      }))
    }
  }

  return {
    state,
    actions: {
      fetchTodaysMeetings,
      fetchUpcomingMeetings
    }
  }
}
