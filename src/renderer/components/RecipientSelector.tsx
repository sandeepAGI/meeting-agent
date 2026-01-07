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
  const [organizerEmail, setOrganizerEmail] = useState<string | null>(null)
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Delete confirmation dialog state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean
    attendee: Attendee | null
  }>({ isOpen: false, attendee: null })

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

          // Track organizer email
          setOrganizerEmail(meeting.organizer_email || null)

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

  const handleDeleteClick = (attendee: Attendee) => {
    setDeleteConfirmation({
      isOpen: true,
      attendee
    })
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmation({
      isOpen: false,
      attendee: null
    })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.attendee || !meetingId) return

    const deletedEmail = deleteConfirmation.attendee.email

    try {
      const result = await window.electronAPI.deleteMeetingAttendee(
        meetingId,
        deletedEmail
      )

      if (result.success) {
        // Reload meeting data to refresh attendees list
        const meetingResult = await window.electronAPI.database.getMeetingById(meetingId)
        if (meetingResult.success && meetingResult.meeting) {
          const meeting = meetingResult.meeting
          let allAttendees: Attendee[] = []

          // Add organizer first
          if (meeting.organizer_name && meeting.organizer_email) {
            allAttendees.push({
              name: meeting.organizer_name,
              email: meeting.organizer_email,
              type: 'required'
            })
          }

          // Parse and add other attendees
          const attendeesJson = meeting.attendees_json
          if (attendeesJson) {
            const parsedAttendees = JSON.parse(attendeesJson) as Attendee[]
            const filteredAttendees = parsedAttendees.filter(a =>
              a.email !== meeting.organizer_email
            )
            allAttendees = [...allAttendees, ...filteredAttendees]
          }

          // Ensure deleted attendee is removed (in case database returned stale data)
          allAttendees = allAttendees.filter(a => a.email !== deletedEmail)

          setAttendees(allAttendees)
        }

        // Remove from selected recipients if present
        onRecipientsChange(selectedRecipients.filter(r =>
          r.email !== deletedEmail
        ))

        // Close dialog
        setDeleteConfirmation({
          isOpen: false,
          attendee: null
        })
        setError(null)
      } else {
        setError(result.error || 'Failed to delete attendee')
      }
    } catch (err) {
      console.error('Error deleting attendee:', err)
      setError('Error deleting attendee')
    }
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
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label className="attendee-checkbox" style={{ flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={isSelected(attendee.email)}
                    onChange={() => toggleRecipient(attendee)}
                  />
                  <span className="attendee-info">
                    <span className="attendee-name">{attendee.name}</span>
                    <span className="attendee-email">({attendee.email})</span>
                    {attendee.email === organizerEmail && (
                      <span className="badge badge-organizer" style={{ marginLeft: '0.5rem' }}>Organizer</span>
                    )}
                    {attendee.type === 'required' && attendee.email !== organizerEmail && (
                      <span className="badge badge-required">Required</span>
                    )}
                  </span>
                </label>
                <button
                  onClick={() => handleDeleteClick(attendee)}
                  className="btn-remove"
                  disabled={attendee.email === organizerEmail}
                  title={attendee.email === organizerEmail ? "Cannot delete organizer" : "Delete attendee"}
                  aria-label="remove"
                  style={{
                    opacity: attendee.email === organizerEmail ? 0.3 : 1,
                    cursor: attendee.email === organizerEmail ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
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

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation.isOpen && deleteConfirmation.attendee && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ marginTop: 0 }}>Confirm Removal</h3>
            <p>
              Are you sure you want to remove {deleteConfirmation.attendee.name} ({deleteConfirmation.attendee.email}) from this meeting?
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Note: This will not affect speaker mappings in existing transcripts.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={handleDeleteCancel}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
                style={{
                  backgroundColor: '#d33',
                  color: 'white'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
