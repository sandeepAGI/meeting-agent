/**
 * UI Component Tests: RecipientSelector Delete Functionality
 * TDD Plan: Meeting Metadata Editing & Participant Deletion
 *
 * Tests for delete functionality in RecipientSelector component
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipientSelector } from '../src/renderer/components/RecipientSelector'

// Mock electronAPI
const mockElectronAPI = {
  deleteMeetingAttendee: jest.fn(),
  database: {
    getMeetingById: jest.fn()
  }
}

;(global as any).window.electronAPI = mockElectronAPI

describe('RecipientSelector - Delete Functionality', () => {
  const mockMeeting = {
    id: 'meeting-1',
    subject: 'Team Meeting',
    organizer_name: 'Alice Smith',
    organizer_email: 'alice@example.com',
    attendees_json: JSON.stringify([
      { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
      { name: 'Bob Johnson', email: 'bob@example.com', type: 'required' },
      { name: 'Carol White', email: 'carol@example.com', type: 'optional' }
    ])
  }

  const mockOnRecipientsChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockElectronAPI.database.getMeetingById.mockResolvedValue({
      success: true,
      meeting: mockMeeting
    })
  })

  // ===========================================================================
  // Display Tests
  // ===========================================================================

  describe('Delete Button Display', () => {
    it('should show delete button for each attendee', async () => {
      // GIVEN: Meeting with 3 attendees
      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={[]}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      // Wait for attendees to load
      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })

      // THEN: Each attendee row should have delete button
      const deleteButtons = screen.getAllByRole('button', { name: /delete|remove|×/i })
      expect(deleteButtons.length).toBeGreaterThanOrEqual(2) // Bob and Carol (not organizer)
    })

    it('should disable delete button for organizer', async () => {
      // GIVEN: Organizer in attendee list
      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={[]}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      })

      // THEN: Organizer's delete button should be disabled or not shown
      const aliceRow = screen.getByText('Alice Smith').closest('div')
      const deleteButton = aliceRow?.querySelector('button[aria-label*="delete"], button[aria-label*="remove"]')

      if (deleteButton) {
        expect(deleteButton).toBeDisabled()
      }
      // OR button shouldn't exist for organizer at all
    })

    it('should show organizer indicator', async () => {
      // GIVEN: Meeting with organizer
      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={[]}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      })

      // THEN: Should indicate who is the organizer
      expect(screen.getByText(/organizer/i)).toBeInTheDocument()
    })
  })

  // ===========================================================================
  // Delete Interaction Tests
  // ===========================================================================

  describe('Delete Interaction', () => {
    it('should show confirmation dialog on delete click', async () => {
      // GIVEN: Rendered component with attendees
      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={[]}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })

      // WHEN: User clicks delete on Bob
      const bobRow = screen.getByText('Bob Johnson').closest('div')
      const deleteButton = bobRow?.querySelector('button[aria-label*="delete"], button[aria-label*="remove"]') as HTMLElement
      await userEvent.click(deleteButton)

      // THEN: Confirmation dialog should appear with Bob's name
      expect(screen.getByText(/remove.*Bob Johnson/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm|yes|delete/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel|no/i })).toBeInTheDocument()
    })

    it('should call delete API on confirmation', async () => {
      // GIVEN: Confirmation dialog is open
      mockElectronAPI.deleteMeetingAttendee.mockResolvedValue({ success: true })

      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={[]}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })

      // Open confirmation dialog
      const bobRow = screen.getByText('Bob Johnson').closest('div')
      const deleteButton = bobRow?.querySelector('button[aria-label*="delete"], button[aria-label*="remove"]') as HTMLElement
      await userEvent.click(deleteButton)

      // WHEN: User clicks confirm
      const confirmButton = screen.getByRole('button', { name: /confirm|yes|delete/i })
      await userEvent.click(confirmButton)

      // THEN: Should call API
      await waitFor(() => {
        expect(mockElectronAPI.deleteMeetingAttendee).toHaveBeenCalledWith(
          'meeting-1',
          'bob@example.com'
        )
      })

      // AND: Bob should be removed from UI
      await waitFor(() => {
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument()
      })
    })

    it('should close dialog and keep attendee on cancel', async () => {
      // GIVEN: Confirmation dialog is open
      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={[]}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })

      const bobRow = screen.getByText('Bob Johnson').closest('div')
      const deleteButton = bobRow?.querySelector('button[aria-label*="delete"], button[aria-label*="remove"]') as HTMLElement
      await userEvent.click(deleteButton)

      // WHEN: User clicks cancel
      const cancelButton = screen.getByRole('button', { name: /cancel|no/i })
      await userEvent.click(cancelButton)

      // THEN: Dialog closes, attendee remains
      expect(screen.queryByText(/remove.*Bob Johnson/i)).not.toBeInTheDocument()
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      expect(mockElectronAPI.deleteMeetingAttendee).not.toHaveBeenCalled()
    })

    it('should show error message when delete fails', async () => {
      // GIVEN: API will return error
      mockElectronAPI.deleteMeetingAttendee.mockResolvedValue({
        success: false,
        error: 'Cannot delete meeting organizer'
      })

      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={[]}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })

      // Open and confirm deletion
      const bobRow = screen.getByText('Bob Johnson').closest('div')
      const deleteButton = bobRow?.querySelector('button[aria-label*="delete"], button[aria-label*="remove"]') as HTMLElement
      await userEvent.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm|yes|delete/i })
      await userEvent.click(confirmButton)

      // THEN: Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Cannot delete meeting organizer/i)).toBeInTheDocument()
      })

      // AND: Bob should still be in the list
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
    })
  })

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe('Integration with Selection', () => {
    it('should remove deleted attendee from selected recipients', async () => {
      // GIVEN: Bob is selected
      const initialRecipients = [
        { name: 'Bob Johnson', email: 'bob@example.com' }
      ]

      mockElectronAPI.deleteMeetingAttendee.mockResolvedValue({ success: true })

      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={initialRecipients}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })

      // WHEN: Delete Bob
      const bobRow = screen.getByText('Bob Johnson').closest('div')
      const deleteButton = bobRow?.querySelector('button[aria-label*="delete"], button[aria-label*="remove"]') as HTMLElement
      await userEvent.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm|yes|delete/i })
      await userEvent.click(confirmButton)

      // THEN: Should update selected recipients (remove Bob)
      await waitFor(() => {
        expect(mockOnRecipientsChange).toHaveBeenCalled()
        const updatedRecipients = mockOnRecipientsChange.mock.calls[mockOnRecipientsChange.mock.calls.length - 1][0]
        expect(updatedRecipients.find((r: any) => r.email === 'bob@example.com')).toBeUndefined()
      })
    })

    it('should refresh attendee list after successful deletion', async () => {
      // GIVEN: Delete succeeds
      mockElectronAPI.deleteMeetingAttendee.mockResolvedValue({ success: true })

      // Mock updated meeting data without Bob
      const updatedMeeting = {
        ...mockMeeting,
        attendees_json: JSON.stringify([
          { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
          { name: 'Carol White', email: 'carol@example.com', type: 'optional' }
        ])
      }

      mockElectronAPI.database.getMeetingById
        .mockResolvedValueOnce({ success: true, meeting: mockMeeting })
        .mockResolvedValueOnce({ success: true, meeting: updatedMeeting })

      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={[]}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })

      // WHEN: Delete Bob
      const bobRow = screen.getByText('Bob Johnson').closest('div')
      const deleteButton = bobRow?.querySelector('button[aria-label*="delete"], button[aria-label*="remove"]') as HTMLElement
      await userEvent.click(deleteButton)
      await userEvent.click(screen.getByRole('button', { name: /confirm|yes|delete/i }))

      // THEN: Should reload meeting data
      await waitFor(() => {
        expect(mockElectronAPI.database.getMeetingById).toHaveBeenCalledTimes(2)
      })
    })

    it('should handle deletion of multiple attendees', async () => {
      // GIVEN: Multiple delete operations
      mockElectronAPI.deleteMeetingAttendee.mockResolvedValue({ success: true })

      render(
        <RecipientSelector
          meetingId="meeting-1"
          selectedRecipients={[]}
          onRecipientsChange={mockOnRecipientsChange}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument()
      })

      // WHEN: Delete Bob first
      let bobRow = screen.getByText('Bob Johnson').closest('div')
      let deleteButton = bobRow?.querySelector('button[aria-label*="delete"], button[aria-label*="remove"]') as HTMLElement
      await userEvent.click(deleteButton)
      await userEvent.click(screen.getByRole('button', { name: /confirm|yes|delete/i }))

      await waitFor(() => {
        expect(mockElectronAPI.deleteMeetingAttendee).toHaveBeenCalledWith('meeting-1', 'bob@example.com')
      })

      // Reload without Bob for next deletion
      const meetingWithoutBob = {
        ...mockMeeting,
        attendees_json: JSON.stringify([
          { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
          { name: 'Carol White', email: 'carol@example.com', type: 'optional' }
        ])
      }
      mockElectronAPI.database.getMeetingById.mockResolvedValue({ success: true, meeting: meetingWithoutBob })

      // Force re-render to show Carol
      await waitFor(() => {
        expect(screen.getByText('Carol White')).toBeInTheDocument()
      })

      // THEN: Delete Carol
      const carolRow = screen.getByText('Carol White').closest('div')
      deleteButton = carolRow?.querySelector('button[aria-label*="delete"], button[aria-label*="remove"]') as HTMLElement
      await userEvent.click(deleteButton)
      await userEvent.click(screen.getByRole('button', { name: /confirm|yes|delete/i }))

      await waitFor(() => {
        expect(mockElectronAPI.deleteMeetingAttendee).toHaveBeenCalledWith('meeting-1', 'carol@example.com')
      })
    })
  })
})
