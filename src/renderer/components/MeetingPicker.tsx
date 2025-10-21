/**
 * Meeting Picker Component
 *
 * Dialog for selecting which calendar meeting a recording belongs to.
 * Shown when generating summary for recording without meeting_id.
 * Phase 2.3-4: Meeting-Recording Association
 */

import { useState, useEffect } from 'react'

interface Meeting {
  id: string
  subject: string
  start_time: string
  end_time: string
  organizer_name?: string
  attendees_json?: string
  location?: string
}

interface MeetingPickerProps {
  onSelect: (meetingId: string | null) => void  // null = standalone recording
  onCancel: () => void
}

export function MeetingPicker({ onSelect, onCancel }: MeetingPickerProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Note: undefined = no selection yet, null = standalone recording selected, string = meeting ID selected
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch meetings from last 7 days on mount
  useEffect(() => {
    fetchMeetings()
  }, [])

  const fetchMeetings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Get meetings from last 7 days
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)

      const result = await window.electronAPI.database.getMeetingsInDateRange(
        startDate.toISOString(),
        endDate.toISOString()
      )

      if (result.success && result.meetings) {
        setMeetings(result.meetings)
      } else {
        setError(result.error || 'Failed to load meetings')
      }
    } catch (err) {
      setError('Failed to fetch meetings')
      console.error('[MeetingPicker] Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter meetings by search query
  const filteredMeetings = searchQuery
    ? meetings.filter(m =>
        m.subject.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : meetings

  const handleConfirm = () => {
    // Safety check: shouldn't happen due to disabled button, but defensive programming
    if (selectedMeetingId === undefined) {
      console.warn('[MeetingPicker] Confirm called with no selection')
      return
    }
    onSelect(selectedMeetingId)
  }

  const formatDateTime = (dateString: string): string => {
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

  return (
    <div className="meeting-picker-overlay">
      <div className="meeting-picker-dialog">
        <div className="meeting-picker-header">
          <h3>Which meeting is this recording for?</h3>
          <p className="meeting-picker-subtitle">
            Select a calendar meeting to improve speaker identification
          </p>
        </div>

        <div className="meeting-picker-content">
          {/* Search bar */}
          <input
            type="text"
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="meeting-picker-search"
          />

          {/* Standalone option (always at top) */}
          <div
            className={`meeting-picker-option standalone ${selectedMeetingId === null ? 'selected' : ''}`}
            onClick={() => setSelectedMeetingId(null)}
          >
            <div className="meeting-option-radio">
              {selectedMeetingId === null && '●'}
            </div>
            <div className="meeting-option-content">
              <div className="meeting-option-title">📝 Standalone Recording</div>
              <div className="meeting-option-meta">
                No calendar meeting (anonymous speakers)
              </div>
            </div>
          </div>

          {/* Meeting list */}
          <div className="meeting-picker-list">
            {isLoading ? (
              <div className="meeting-picker-loading">Loading meetings...</div>
            ) : error ? (
              <div className="meeting-picker-error">{error}</div>
            ) : filteredMeetings.length === 0 ? (
              <div className="meeting-picker-empty">
                {searchQuery
                  ? `No meetings found for "${searchQuery}"`
                  : 'No meetings found in the last 7 days'
                }
              </div>
            ) : (
              filteredMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className={`meeting-picker-option ${selectedMeetingId === meeting.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMeetingId(meeting.id)}
                >
                  <div className="meeting-option-radio">
                    {selectedMeetingId === meeting.id && '●'}
                  </div>
                  <div className="meeting-option-content">
                    <div className="meeting-option-title">{meeting.subject}</div>
                    <div className="meeting-option-meta">
                      <span>{formatDateTime(meeting.start_time)}</span>
                      {meeting.organizer_name && (
                        <span> • {meeting.organizer_name}</span>
                      )}
                      {getAttendeeCount(meeting.attendees_json) > 0 && (
                        <span> • {getAttendeeCount(meeting.attendees_json)} attendees</span>
                      )}
                      {meeting.location && (
                        <span> • {meeting.location}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="meeting-picker-actions">
          <button
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedMeetingId === undefined}
            className="btn btn-primary"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
