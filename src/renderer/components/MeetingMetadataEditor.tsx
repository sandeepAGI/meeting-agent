/**
 * Meeting Metadata Editor Component
 *
 * Allows editing of meeting title, date, and time
 * TDD Plan: Meeting Metadata Editing & Participant Deletion
 */

import { useState, useEffect } from 'react'

interface MeetingMetadataEditorProps {
  meeting: {
    id: string
    subject: string | null
    start_time: string
    end_time: string
    organizer_name?: string
    organizer_email?: string
  }
  onUpdate?: (updatedMeeting: any) => void
}

export function MeetingMetadataEditor({ meeting, onUpdate }: MeetingMetadataEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [editedSubject, setEditedSubject] = useState(meeting.subject || '')
  const [editedDate, setEditedDate] = useState('')
  const [editedStartTime, setEditedStartTime] = useState('')
  const [editedEndTime, setEditedEndTime] = useState('')

  // Initialize form values from meeting data
  useEffect(() => {
    setEditedSubject(meeting.subject || '')

    const startDate = new Date(meeting.start_time)
    const endDate = new Date(meeting.end_time)

    // Format date as YYYY-MM-DD for date input
    setEditedDate(startDate.toISOString().split('T')[0])

    // Format times as HH:MM for time input
    setEditedStartTime(startDate.toTimeString().slice(0, 5))
    setEditedEndTime(endDate.toTimeString().slice(0, 5))
  }, [meeting])

  const formatDisplayDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDisplayTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const handleEdit = () => {
    setIsEditing(true)
    setError(null)
  }

  const handleCancel = () => {
    // Reset form to original values
    setEditedSubject(meeting.subject || '')
    const startDate = new Date(meeting.start_time)
    const endDate = new Date(meeting.end_time)
    setEditedDate(startDate.toISOString().split('T')[0])
    setEditedStartTime(startDate.toTimeString().slice(0, 5))
    setEditedEndTime(endDate.toTimeString().slice(0, 5))

    setIsEditing(false)
    setError(null)
  }

  const handleSave = async () => {
    setError(null)

    // Validate title
    if (!editedSubject.trim()) {
      setError('Title cannot be empty')
      return
    }

    // Build ISO datetime strings
    const startDateTime = new Date(`${editedDate}T${editedStartTime}:00`)
    const endDateTime = new Date(`${editedDate}T${editedEndTime}:00`)

    // Validate times
    if (endDateTime <= startDateTime) {
      setError('End time must be after start time')
      return
    }

    setIsSaving(true)

    try {
      // Update subject if changed
      let subjectUpdateResult
      if (editedSubject.trim() !== meeting.subject) {
        subjectUpdateResult = await window.electronAPI.updateMeetingSubject(
          meeting.id,
          editedSubject.trim()
        )

        if (!subjectUpdateResult.success) {
          throw new Error(subjectUpdateResult.error || 'Failed to update meeting subject')
        }
      }

      // Update datetime if changed
      const originalStart = new Date(meeting.start_time)
      const originalEnd = new Date(meeting.end_time)

      if (startDateTime.getTime() !== originalStart.getTime() ||
          endDateTime.getTime() !== originalEnd.getTime()) {
        const datetimeUpdateResult = await window.electronAPI.updateMeetingDateTime(
          meeting.id,
          startDateTime.toISOString(),
          endDateTime.toISOString()
        )

        if (!datetimeUpdateResult.success) {
          throw new Error(datetimeUpdateResult.error || 'Failed to update meeting datetime')
        }
      }

      // Notify parent of update if callback provided
      if (onUpdate && subjectUpdateResult?.result) {
        onUpdate(subjectUpdateResult.result)
      }

      setIsEditing(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isEditing) {
    // View mode
    return (
      <div className="meeting-metadata-display" style={{
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>
              {meeting.subject || 'Untitled Recording'}
            </h3>
            <p style={{ margin: '0.25rem 0', color: '#666' }}>
              📅 {formatDisplayDate(meeting.start_time)}
            </p>
            <p style={{ margin: '0.25rem 0', color: '#666' }}>
              🕐 {formatDisplayTime(meeting.start_time)} - {formatDisplayTime(meeting.end_time)}
            </p>
          </div>
          <button
            onClick={handleEdit}
            className="btn btn-secondary"
            style={{ minWidth: '80px' }}
          >
            ✏️ Edit
          </button>
        </div>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="meeting-metadata-editor" style={{
      padding: '1rem',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <h3 style={{ margin: '0 0 1rem 0' }}>Edit Meeting Details</h3>

      {error && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {isSaving && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#eff',
          color: '#06c',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          Saving...
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
          Meeting Title:
        </label>
        <input
          type="text"
          value={editedSubject}
          onChange={(e) => setEditedSubject(e.target.value)}
          className="form-input"
          style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          placeholder="Enter meeting title"
          disabled={isSaving}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="start-date" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
          Start Date:
        </label>
        <input
          id="start-date"
          type="date"
          value={editedDate}
          onChange={(e) => setEditedDate(e.target.value)}
          className="form-input"
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          disabled={isSaving}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label htmlFor="start-time" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            Start Time:
          </label>
          <input
            id="start-time"
            type="time"
            value={editedStartTime}
            onChange={(e) => setEditedStartTime(e.target.value)}
            className="form-input"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            disabled={isSaving}
          />
        </div>

        <div>
          <label htmlFor="end-time" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
            End Time:
          </label>
          <input
            id="end-time"
            type="time"
            value={editedEndTime}
            onChange={(e) => setEditedEndTime(e.target.value)}
            className="form-input"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            disabled={isSaving}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button
          onClick={handleCancel}
          className="btn btn-secondary"
          disabled={isSaving}
          style={{ minWidth: '80px' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={isSaving}
          style={{ minWidth: '80px' }}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
