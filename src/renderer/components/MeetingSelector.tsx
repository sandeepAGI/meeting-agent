/**
 * Meeting Selector Component
 *
 * Enhanced with tabs for Calendar Meetings vs Standalone Recordings.
 * Includes date range filters and search functionality.
 * Phase 2.3-4: Meeting-Recording Association
 */

import { useState, useEffect } from 'react'
import { MeetingPicker } from './MeetingPicker'

interface Recording {
  recording_id: string
  file_path: string
  duration_seconds: number
  recording_created_at: string
  transcript_id: string
  transcript_text: string
  diarization_id: string | null
  num_speakers: number | null
  meeting_id: string | null
  meeting_subject: string | null
  meeting_start_time: string | null
}

interface CalendarMeeting {
  id: string
  subject: string
  start_time: string
  end_time: string
  organizer_name?: string
  attendees_json?: string
  location?: string
}

type DateRange = 'today' | 'week' | 'month' | 'all'
type Tab = 'recordings' | 'calendar'

interface MeetingSelectorProps {
  onStartSummary: (meetingId: string, transcriptId: string) => void
  isLoading: boolean
}

export function MeetingSelector({ onStartSummary, isLoading }: MeetingSelectorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('recordings')
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [calendarMeetings, setCalendarMeetings] = useState<CalendarMeeting[]>([])
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<CalendarMeeting | null>(null)
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true)
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [searchQuery, setSearchQuery] = useState('')
  const [showMeetingPicker, setShowMeetingPicker] = useState(false)
  const [pendingTranscriptId, setPendingTranscriptId] = useState<string | null>(null)

  // Fetch recordings on mount
  useEffect(() => {
    fetchRecordings()
  }, [])

  // Fetch calendar meetings when tab changes
  useEffect(() => {
    if (activeTab === 'calendar') {
      syncAndFetchCalendarMeetings()
    }
  }, [activeTab, dateRange])

  const fetchRecordings = async () => {
    setIsLoadingRecordings(true)
    setError(null)
    try {
      const result = await window.electronAPI.database.getRecordingsWithTranscripts(100)
      if (result.success && result.recordings) {
        setRecordings(result.recordings)
      } else {
        setError(result.error || 'Failed to load recordings')
      }
    } catch (err) {
      setError('Failed to fetch recordings')
      console.error('[MeetingSelector] Fetch recordings error:', err)
    } finally {
      setIsLoadingRecordings(false)
    }
  }

  const syncAndFetchCalendarMeetings = async () => {
    setIsLoadingMeetings(true)
    setError(null)
    try {
      const { startDate, endDate } = getDateRangeValues(dateRange)

      // Phase 2.3-4: First sync meetings from M365 to database
      // This ensures we have the latest data for the selected date range
      try {
        console.log('[MeetingSelector] Syncing meetings from M365...')
        await window.electronAPI.graphApi.getMeetingsInDateRange(
          startDate.toISOString(),
          endDate.toISOString()
        )
        console.log('[MeetingSelector] Sync complete')
      } catch (syncErr) {
        console.warn('[MeetingSelector] M365 sync failed (will use cached data):', syncErr)
        // Continue to fetch from database even if sync fails
      }

      // Then fetch from database (which now includes synced meetings)
      const result = await window.electronAPI.database.getMeetingsInDateRange(
        startDate.toISOString(),
        endDate.toISOString()
      )
      if (result.success && result.meetings) {
        setCalendarMeetings(result.meetings)
      } else {
        setError(result.error || 'Failed to load meetings')
      }
    } catch (err) {
      setError('Failed to fetch calendar meetings')
      console.error('[MeetingSelector] Fetch meetings error:', err)
    } finally {
      setIsLoadingMeetings(false)
    }
  }

  const fetchCalendarMeetings = async () => {
    setIsLoadingMeetings(true)
    setError(null)
    try {
      const { startDate, endDate } = getDateRangeValues(dateRange)
      const result = await window.electronAPI.database.getMeetingsInDateRange(
        startDate.toISOString(),
        endDate.toISOString()
      )
      if (result.success && result.meetings) {
        setCalendarMeetings(result.meetings)
      } else {
        setError(result.error || 'Failed to load meetings')
      }
    } catch (err) {
      setError('Failed to fetch calendar meetings')
      console.error('[MeetingSelector] Fetch meetings error:', err)
    } finally {
      setIsLoadingMeetings(false)
    }
  }

  const getDateRangeValues = (range: DateRange): { startDate: Date; endDate: Date } => {
    const endDate = new Date()
    const startDate = new Date()

    switch (range) {
      case 'today':
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate.setDate(startDate.getDate() - 30)
        break
      case 'all':
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
    }

    return { startDate, endDate }
  }

  // Filter recordings by search query and show only standalone (meeting_id = null)
  const filteredRecordings = recordings.filter(r => {
    const matchesSearch = searchQuery
      ? (r.meeting_subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         r.transcript_text.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
    // Only show standalone recordings (not linked to meetings)
    const isStandalone = !r.meeting_id
    return matchesSearch && isStandalone
  })

  // Filter calendar meetings by search query
  const filteredMeetings = calendarMeetings.filter(m => {
    if (!searchQuery) return true
    const subject = m.subject?.toLowerCase() || ''
    return subject.includes(searchQuery.toLowerCase())
  })

  const handleStartSummary = () => {
    if (activeTab === 'recordings' && selectedRecording) {
      // Standalone recording - show picker to link to meeting or keep standalone
      setPendingTranscriptId(selectedRecording.transcript_id)
      setShowMeetingPicker(true)
    } else if (activeTab === 'calendar' && selectedMeeting) {
      // Calendar meeting - need to find recording or show "no recording" message
      const recording = recordings.find(r => r.meeting_id === selectedMeeting.id)
      if (recording) {
        onStartSummary(selectedMeeting.id, recording.transcript_id)
      } else {
        setError('This meeting does not have a recording yet. Record it first!')
      }
    }
  }

  const handleMeetingSelected = async (meetingId: string | null) => {
    setShowMeetingPicker(false)

    if (!pendingTranscriptId) {
      console.error('[MeetingSelector] No pending transcript ID')
      return
    }

    // Find the recording by transcript_id
    const recording = recordings.find(r => r.transcript_id === pendingTranscriptId)
    if (!recording) {
      setError('Recording not found')
      return
    }

    // Update the recording's meeting_id in the database
    // This creates the link between the recording and the calendar meeting
    try {
      const result = await window.electronAPI.database.updateRecordingMeetingId(
        recording.recording_id,
        meetingId
      )
      if (!result.success) {
        setError(result.error || 'Failed to link recording to meeting')
        return
      }

      // Refresh recordings list to reflect the change
      // Recording will disappear from standalone tab if linked to meeting
      await fetchRecordings()
    } catch (err) {
      setError('Failed to link recording to meeting')
      console.error('[MeetingSelector] Update recording meeting ID error:', err)
      return
    }

    // Start summary with the selected meeting ID (or empty string for standalone)
    onStartSummary(meetingId || '', pendingTranscriptId)
    setPendingTranscriptId(null)
  }

  const handleMeetingPickerCancel = () => {
    setShowMeetingPicker(false)
    setPendingTranscriptId(null)
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getAttendeeCount = (attendeesJson?: string): number => {
    if (!attendeesJson) return 0
    try {
      const attendees = JSON.parse(attendeesJson)
      return Array.isArray(attendees) ? attendees.length : 0
    } catch {
      return 0
    }
  }

  const hasRecording = (meetingId: string): boolean => {
    return recordings.some(r => r.meeting_id === meetingId)
  }

  const isLoadingData = activeTab === 'recordings' ? isLoadingRecordings : isLoadingMeetings
  const hasSelection = activeTab === 'recordings' ? selectedRecording !== null : selectedMeeting !== null

  return (
    <div className="meeting-selector">
      <div className="selector-header">
        <h3>Generate Meeting Summary</h3>
        <p className="selector-description">
          Select a recording to create an intelligent summary with speaker identification and action items.
        </p>
      </div>

      {/* Tabs */}
      <div className="selector-tabs">
        <button
          className={`selector-tab ${activeTab === 'recordings' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('recordings')
            setSelectedMeeting(null)
            setSearchQuery('')
          }}
        >
          📝 Standalone Recordings ({filteredRecordings.length})
        </button>
        <button
          className={`selector-tab ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('calendar')
            setSelectedRecording(null)
            setSearchQuery('')
          }}
        >
          📅 Calendar Meetings ({filteredMeetings.length})
        </button>
      </div>

      {/* Filters */}
      <div className="selector-filters">
        <input
          type="text"
          placeholder={activeTab === 'recordings' ? 'Search recordings...' : 'Search meetings...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="selector-search"
        />
        {activeTab === 'calendar' && (
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="selector-date-range"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="all">All</option>
          </select>
        )}
      </div>

      {/* Content */}
      {isLoadingData ? (
        <div className="loading-state">Loading {activeTab === 'recordings' ? 'recordings' : 'meetings'}...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : activeTab === 'recordings' ? (
        filteredRecordings.length === 0 ? (
          <div className="empty-state">
            <p>No standalone recordings found.</p>
            <p className="form-hint">
              {searchQuery
                ? 'Try a different search term or clear the search.'
                : 'Recordings linked to calendar meetings appear in the Calendar Meetings tab.'}
            </p>
          </div>
        ) : (
          <>
            <div className="recordings-list">
              {filteredRecordings.map((recording) => (
                <div
                  key={recording.recording_id}
                  className={`recording-card ${selectedRecording?.recording_id === recording.recording_id ? 'selected' : ''}`}
                  onClick={() => setSelectedRecording(recording)}
                >
                  <div className="recording-header">
                    <span className="recording-title">
                      {recording.meeting_subject || 'Untitled Recording'}
                    </span>
                    <span className="recording-duration">
                      {formatDuration(recording.duration_seconds)}
                    </span>
                  </div>
                  <div className="recording-meta">
                    <span className="recording-date">
                      {formatDate(recording.recording_created_at)}
                    </span>
                    {recording.num_speakers && (
                      <span className="recording-speakers">
                        {recording.num_speakers} {recording.num_speakers === 1 ? 'speaker' : 'speakers'}
                      </span>
                    )}
                  </div>
                  <div className="recording-preview">
                    {recording.transcript_text.substring(0, 120)}...
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleStartSummary}
              disabled={isLoading || !selectedRecording}
              className="btn btn-primary"
            >
              {isLoading ? 'Starting...' : '🤖 Generate Summary'}
            </button>
          </>
        )
      ) : (
        /* Calendar Meetings Tab */
        filteredMeetings.length === 0 ? (
          <div className="empty-state">
            <p>No calendar meetings found.</p>
            <p className="form-hint">
              {searchQuery
                ? 'Try a different search term or clear the search.'
                : 'Make sure you are logged in to Microsoft 365 and have meetings in the selected date range.'}
            </p>
          </div>
        ) : (
          <>
            <div className="recordings-list">
              {filteredMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className={`recording-card ${selectedMeeting?.id === meeting.id ? 'selected' : ''} ${!hasRecording(meeting.id) ? 'no-recording' : ''}`}
                  onClick={() => setSelectedMeeting(meeting)}
                >
                  <div className="recording-header">
                    <span className="recording-title">{meeting.subject}</span>
                    {hasRecording(meeting.id) ? (
                      <span className="recording-badge recording-available">🎙️ Recorded</span>
                    ) : (
                      <span className="recording-badge recording-missing">❌ No Recording</span>
                    )}
                  </div>
                  <div className="recording-meta">
                    <span className="recording-date">
                      {formatDate(meeting.start_time)}
                    </span>
                    {meeting.organizer_name && (
                      <span className="recording-organizer">
                        {meeting.organizer_name}
                      </span>
                    )}
                    {getAttendeeCount(meeting.attendees_json) > 0 && (
                      <span className="recording-attendees">
                        {getAttendeeCount(meeting.attendees_json)} attendees
                      </span>
                    )}
                  </div>
                  {meeting.location && (
                    <div className="recording-location">
                      📍 {meeting.location}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleStartSummary}
              disabled={isLoading || !selectedMeeting || (selectedMeeting && !hasRecording(selectedMeeting.id))}
              className="btn btn-primary"
            >
              {isLoading ? 'Starting...' : '🤖 Generate Summary'}
            </button>
          </>
        )
      )}

      <div className="cost-notice">
        <span className="cost-icon">💰</span>
        <span>
          Estimated cost: ~$0.09 per 60-min meeting • Processing time: 30-60 minutes
        </span>
      </div>

      {/* Meeting Picker Dialog */}
      {showMeetingPicker && (
        <MeetingPicker
          onSelect={handleMeetingSelected}
          onCancel={handleMeetingPickerCancel}
        />
      )}
    </div>
  )
}
