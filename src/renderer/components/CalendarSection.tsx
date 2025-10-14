/**
 * Calendar Section Component
 *
 * Displays today's Microsoft 365 calendar meetings with attendee information.
 */

import { useEffect } from 'react'
import { useM365Auth } from '../hooks/useM365Auth'
import { useCalendar } from '../hooks/useCalendar'
import type { MeetingInfo } from '../../types/electron'

export function CalendarSection() {
  const { state: authState } = useM365Auth()
  const { state: calendarState, actions: calendarActions } = useCalendar()

  // Fetch meetings when authenticated
  useEffect(() => {
    if (authState.isAuthenticated) {
      calendarActions.fetchTodaysMeetings()
    }
  }, [authState.isAuthenticated])

  // Don't show calendar if not authenticated
  if (!authState.isAuthenticated) {
    return null
  }

  return (
    <div className="calendar-section">
      <div className="calendar-header">
        <h3>Today's Meetings</h3>
        <button
          className="btn btn-refresh"
          onClick={calendarActions.fetchTodaysMeetings}
          disabled={calendarState.isLoading}
        >
          {calendarState.isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {calendarState.error && (
        <div className="error-message">{calendarState.error}</div>
      )}

      {calendarState.isLoading && (
        <p className="loading-message">Loading meetings...</p>
      )}

      {!calendarState.isLoading && calendarState.meetings.length === 0 && (
        <p className="no-meetings-message">No meetings scheduled for today.</p>
      )}

      {!calendarState.isLoading && calendarState.meetings.length > 0 && (
        <div className="meetings-list">
          {calendarState.meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  )
}

interface MeetingCardProps {
  meeting: MeetingInfo
}

function MeetingCard({ meeting }: MeetingCardProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDuration = () => {
    const durationMs = meeting.end.getTime() - meeting.start.getTime()
    const minutes = Math.floor(durationMs / 60000)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const isNow = () => {
    const now = new Date()
    return now >= meeting.start && now <= meeting.end
  }

  const isUpcoming = () => {
    const now = new Date()
    const fifteenMinutes = 15 * 60 * 1000
    return meeting.start.getTime() - now.getTime() <= fifteenMinutes && meeting.start > now
  }

  return (
    <div className={`meeting-card ${isNow() ? 'meeting-active' : ''} ${isUpcoming() ? 'meeting-upcoming' : ''}`}>
      <div className="meeting-header">
        <h4 className="meeting-title">{meeting.subject}</h4>
        {isNow() && <span className="meeting-badge badge-active">In Progress</span>}
        {isUpcoming() && <span className="meeting-badge badge-upcoming">Starting Soon</span>}
        {meeting.isOnlineMeeting && <span className="meeting-badge badge-online">Online</span>}
      </div>

      <div className="meeting-time">
        <span className="time-icon">🕐</span>
        <span>
          {formatTime(meeting.start)} - {formatTime(meeting.end)} ({formatDuration()})
        </span>
      </div>

      {meeting.location && (
        <div className="meeting-location">
          <span className="location-icon">📍</span>
          <span>{meeting.location}</span>
        </div>
      )}

      {meeting.onlineMeetingUrl && (
        <div className="meeting-link">
          <span className="link-icon">🔗</span>
          <a href={meeting.onlineMeetingUrl} target="_blank" rel="noopener noreferrer">
            Join Meeting
          </a>
        </div>
      )}

      <div className="meeting-organizer">
        <span className="organizer-icon">👤</span>
        <span>
          Organizer: {meeting.organizer.name}
        </span>
      </div>

      <div className="meeting-attendees">
        <span className="attendees-label">Attendees ({meeting.attendees.length}):</span>
        <div className="attendees-list">
          {meeting.attendees.slice(0, 5).map((attendee, index) => (
            <span key={index} className="attendee-badge" title={attendee.email}>
              {attendee.name}
            </span>
          ))}
          {meeting.attendees.length > 5 && (
            <span className="attendee-badge attendee-more">
              +{meeting.attendees.length - 5} more
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
