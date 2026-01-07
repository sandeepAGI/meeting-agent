/**
 * Recipient Selector Component
 *
 * Allows selection of email recipients from meeting attendees
 * Phase 4b: Summary Editor & Email
 */

import { useState, useEffect } from 'react'
import type { EmailRecipient } from '../../types/meetingSummary'

interface RecipientSelectorProps {
  meetingId: string | null
  selectedRecipients: EmailRecipient[]
  onRecipientsChange: (recipients: EmailRecipient[]) => void
}

interface Attendee {
  name: string
  email: string
  type: 'required' | 'optional'
}

export function RecipientSelector({
  meetingId,
  selectedRecipients,
  onRecipientsChange
}: RecipientSelectorProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load meeting attendees
  useEffect(() => {
    if (!meetingId) return

    const loadAttendees = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await window.electronAPI.database.getMeetingById(meetingId)

        if (result.success && result.meeting) {
          const meeting = result.meeting
          let allAttendees: Attendee[] = []

          // Add organizer first (always required)
          if (meeting.organizer_name && meeting.organizer_email) {
            allAttendees.push({
              name: meeting.organizer_name,
              email: meeting.organizer_email,
              type: 'required'
            })
          }

          // Parse and add other attendees from JSON
          const attendeesJson = meeting.attendees_json
          if (attendeesJson) {
            const parsedAttendees = JSON.parse(attendeesJson) as Attendee[]
            // Filter out organizer if they appear in attendees list (avoid duplicates)
            const filteredAttendees = parsedAttendees.filter(a =>
              a.email !== meeting.organizer_email
            )
            allAttendees = [...allAttendees, ...filteredAttendees]
          }

          setAttendees(allAttendees)
        } else {
          setError('Failed to load meeting attendees')
        }
      } catch (err) {
        console.error('Error loading attendees:', err)
        setError('Error loading attendees')
      } finally {
        setLoading(false)
      }
    }

    loadAttendees()
  }, [meetingId])

  const isSelected = (email: string) => {
    return selectedRecipients.some(r => r.email === email)
  }

  const toggleRecipient = (attendee: Attendee) => {
    const isCurrentlySelected = isSelected(attendee.email)

    if (isCurrentlySelected) {
      // Remove from selection
      onRecipientsChange(selectedRecipients.filter(r => r.email !== attendee.email))
    } else {
      // Add to selection
      onRecipientsChange([...selectedRecipients, {
        name: attendee.name,
        email: attendee.email
      }])
    }
  }

  const selectAll = () => {
    const allRecipients = attendees.map(a => ({
      name: a.name,
      email: a.email
    }))
    onRecipientsChange(allRecipients)
  }

  const deselectAll = () => {
    // Keep only custom recipients (those not in attendees list)
    const customRecipients = selectedRecipients.filter(r =>
      !attendees.some(a => a.email === r.email)
    )
    onRecipientsChange(customRecipients)
  }

  const addCustomRecipient = () => {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customEmail)) {
      setError('Please enter a valid email address')
      return
    }

    // Check if already added
    if (isSelected(customEmail)) {
      setError('This recipient is already added')
      return
    }

    // Add custom recipient
    onRecipientsChange([...selectedRecipients, {
      name: customName || customEmail.split('@')[0],
      email: customEmail
    }])

    // Clear form
    setCustomEmail('')
    setCustomName('')
    setError(null)
  }

  const removeRecipient = (email: string) => {
    onRecipientsChange(selectedRecipients.filter(r => r.email !== email))
  }

  if (!meetingId) {
    return (
      <div className="recipient-selector">
        <h4>📧 Email Recipients</h4>
        <p className="info-message">
          This is a standalone recording without a linked meeting. Add recipients manually below.
        </p>
        <div className="custom-recipient-form">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Name"
            className="form-input"
          />
          <input
            type="email"
            value={customEmail}
            onChange={(e) => setCustomEmail(e.target.value)}
            placeholder="Email address"
            className="form-input"
          />
          <button
            onClick={addCustomRecipient}
            className="btn btn-small btn-primary"
          >
            ➕ Add
          </button>
        </div>
        {error && <p className="error-message">{error}</p>}
        {selectedRecipients.length > 0 && (
          <div className="selected-recipients">
            <h5>Selected Recipients ({selectedRecipients.length})</h5>
            <div className="recipients-list">
              {selectedRecipients.map((recipient, index) => (
                <div key={index} className="recipient-tag">
                  <span>{recipient.name} ({recipient.email})</span>
                  <button
                    onClick={() => removeRecipient(recipient.email)}
                    className="btn-remove"
                    title="Remove recipient"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="recipient-selector">
      <h4>📧 Email Recipients</h4>

      {loading && <p className="loading-message">Loading attendees...</p>}
      {error && <p className="error-message">{error}</p>}

      {attendees.length > 0 && (
        <>
          <div className="recipient-actions">
            <button
              onClick={selectAll}
              className="btn btn-small btn-secondary"
            >
              ✓ Select All
            </button>
            <button
              onClick={deselectAll}
              className="btn btn-small btn-secondary"
            >
              Deselect All
            </button>
          </div>

          <div className="attendees-list">
            {attendees.map((attendee, index) => (
              <label key={index} className="attendee-checkbox">
                <input
                  type="checkbox"
                  checked={isSelected(attendee.email)}
                  onChange={() => toggleRecipient(attendee)}
                />
                <span className="attendee-info">
                  <span className="attendee-name">{attendee.name}</span>
                  <span className="attendee-email">({attendee.email})</span>
                  {attendee.type === 'required' && (
                    <span className="badge badge-required">Required</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="custom-recipient-section">
        <h5>Add Custom Recipient</h5>
        <div className="custom-recipient-form">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Name"
            className="form-input"
          />
          <input
            type="email"
            value={customEmail}
            onChange={(e) => setCustomEmail(e.target.value)}
            placeholder="Email address"
            className="form-input"
          />
          <button
            onClick={addCustomRecipient}
            className="btn btn-small btn-primary"
          >
            ➕ Add
          </button>
        </div>
      </div>

      {selectedRecipients.length > 0 && (
        <div className="selected-recipients">
          <h5>Selected Recipients ({selectedRecipients.length})</h5>
          <div className="recipients-list">
            {selectedRecipients.map((recipient, index) => (
              <div key={index} className="recipient-tag">
                <span>{recipient.name} ({recipient.email})</span>
                <button
                  onClick={() => removeRecipient(recipient.email)}
                  className="btn-remove"
                  title="Remove recipient"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
