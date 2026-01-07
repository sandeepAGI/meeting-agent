/**
 * UI Component Tests: MeetingMetadataEditor
 * TDD Plan: Meeting Metadata Editing & Participant Deletion
 *
 * Tests for the MeetingMetadataEditor component that allows editing:
 * - Meeting title/subject
 * - Meeting date and time
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MeetingMetadataEditor } from '../src/renderer/components/MeetingMetadataEditor'

// Mock electronAPI
const mockElectronAPI = {
  updateMeetingSubject: jest.fn(),
  updateMeetingDateTime: jest.fn(),
  getMeetingById: jest.fn()
}

;(global as any).window.electronAPI = mockElectronAPI

describe('MeetingMetadataEditor', () => {
  const mockMeeting = {
    id: 'meeting-1',
    subject: 'Weekly Team Standup',
    start_time: '2026-01-07T14:00:00.000Z',
    end_time: '2026-01-07T15:00:00.000Z',
    organizer_name: 'Alice Smith',
    organizer_email: 'alice@example.com',
    attendees_json: JSON.stringify([
      { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
      { name: 'Bob Johnson', email: 'bob@example.com', type: 'required' }
    ])
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ===========================================================================
  // Display Tests
  // ===========================================================================

  describe('Display Mode', () => {
    it('should render meeting title, date, and time', () => {
      // GIVEN: Component with meeting data
      render(<MeetingMetadataEditor meeting={mockMeeting} />)

      // THEN: Should display meeting metadata
      expect(screen.getByText('Weekly Team Standup')).toBeInTheDocument()
      expect(screen.getByText(/January 7, 2026/i)).toBeInTheDocument()
      // Check that times are displayed (timezone-agnostic)
      expect(screen.getByText(/\d{1,2}:\d{2}\s*(AM|PM)/i)).toBeInTheDocument()
    })

    it('should show "Untitled Recording" for meetings without subject', () => {
      // GIVEN: Meeting with no subject
      const meetingWithoutSubject = { ...mockMeeting, subject: null }
      render(<MeetingMetadataEditor meeting={meetingWithoutSubject} />)

      // THEN: Should show placeholder
      expect(screen.getByText(/Untitled Recording/i)).toBeInTheDocument()
    })

    it('should have an edit button', () => {
      // GIVEN: Component in view mode
      render(<MeetingMetadataEditor meeting={mockMeeting} />)

      // THEN: Should show edit button
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })
  })

  // ===========================================================================
  // Title Editing Tests
  // ===========================================================================

  describe('Title Editing', () => {
    it('should enable edit mode on edit button click', async () => {
      // GIVEN: Component in view mode
      render(<MeetingMetadataEditor meeting={mockMeeting} />)

      // WHEN: User clicks edit button
      const editButton = screen.getByRole('button', { name: /edit/i })
      await userEvent.click(editButton)

      // THEN: Should show input field with current value
      const input = screen.getByDisplayValue('Weekly Team Standup')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'text')
    })

    it('should save edited title on save button click', async () => {
      // GIVEN: Component in edit mode
      mockElectronAPI.updateMeetingSubject.mockResolvedValue({
        success: true,
        result: { ...mockMeeting, subject: 'Daily Standup' }
      })
      render(<MeetingMetadataEditor meeting={mockMeeting} />)

      await userEvent.click(screen.getByRole('button', { name: /edit/i }))

      // WHEN: User changes title and clicks save
      const input = screen.getByDisplayValue('Weekly Team Standup')
      await userEvent.clear(input)
      await userEvent.type(input, 'Daily Standup')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      // THEN: Should call API
      await waitFor(() => {
        expect(mockElectronAPI.updateMeetingSubject).toHaveBeenCalledWith(
          'meeting-1',
          'Daily Standup'
        )
      })
    })

    it('should show validation error for empty title', async () => {
      // GIVEN: Component in edit mode
      render(<MeetingMetadataEditor meeting={mockMeeting} />)
      await userEvent.click(screen.getByRole('button', { name: /edit/i }))

      // WHEN: User clears title and tries to save
      const input = screen.getByDisplayValue('Weekly Team Standup')
      await userEvent.clear(input)

      const saveButton = screen.getByRole('button', { name: /save/i })
      await userEvent.click(saveButton)

      // THEN: Should show error message and not call API
      expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument()
      expect(mockElectronAPI.updateMeetingSubject).not.toHaveBeenCalled()
    })

    it('should cancel edit on cancel button click', async () => {
      // GIVEN: Component in edit mode with changes
      render(<MeetingMetadataEditor meeting={mockMeeting} />)
      await userEvent.click(screen.getByRole('button', { name: /edit/i }))

      const input = screen.getByDisplayValue('Weekly Team Standup')
      await userEvent.clear(input)
      await userEvent.type(input, 'New Title')

      // WHEN: User clicks cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // THEN: Should revert to view mode with original value
      expect(screen.getByText('Weekly Team Standup')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('New Title')).not.toBeInTheDocument()
      expect(mockElectronAPI.updateMeetingSubject).not.toHaveBeenCalled()
    })

    it('should show error message when API call fails', async () => {
      // GIVEN: API will return error
      mockElectronAPI.updateMeetingSubject.mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      })
      render(<MeetingMetadataEditor meeting={mockMeeting} />)
      await userEvent.click(screen.getByRole('button', { name: /edit/i }))

      // WHEN: User saves changes
      const input = screen.getByDisplayValue('Weekly Team Standup')
      await userEvent.clear(input)
      await userEvent.type(input, 'New Title')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      // THEN: Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Database connection failed/i)).toBeInTheDocument()
      })
    })
  })

  // ===========================================================================
  // Date/Time Editing Tests
  // ===========================================================================

  describe('Date/Time Editing', () => {
    it('should show date and time pickers in edit mode', async () => {
      // GIVEN: Component in view mode
      render(<MeetingMetadataEditor meeting={mockMeeting} />)

      // WHEN: User enters edit mode
      await userEvent.click(screen.getByRole('button', { name: /edit/i }))

      // THEN: Should show date and time inputs
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/start time/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/end time/i)).toBeInTheDocument()
    })

    it('should save updated date/time on save', async () => {
      // GIVEN: Component in edit mode with new times
      mockElectronAPI.updateMeetingDateTime.mockResolvedValue({
        success: true,
        result: mockMeeting
      })
      render(<MeetingMetadataEditor meeting={mockMeeting} />)
      await userEvent.click(screen.getByRole('button', { name: /edit/i }))

      // WHEN: User changes time and saves
      const startTimeInput = screen.getByLabelText(/start time/i)
      await userEvent.clear(startTimeInput)
      await userEvent.type(startTimeInput, '15:00')

      const endTimeInput = screen.getByLabelText(/end time/i)
      await userEvent.clear(endTimeInput)
      await userEvent.type(endTimeInput, '16:00')

      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      // THEN: Should call API with ISO strings
      await waitFor(() => {
        expect(mockElectronAPI.updateMeetingDateTime).toHaveBeenCalled()
        const [meetingId, startTime, endTime] = mockElectronAPI.updateMeetingDateTime.mock.calls[0]
        expect(meetingId).toBe('meeting-1')
        // Verify times are valid ISO strings (timezone-agnostic)
        expect(new Date(startTime).toISOString()).toBe(startTime)
        expect(new Date(endTime).toISOString()).toBe(endTime)
        // Verify end is after start
        expect(new Date(endTime) > new Date(startTime)).toBe(true)
      })
    })

    it('should show validation error when end time before start time', async () => {
      // GIVEN: Component in edit mode
      render(<MeetingMetadataEditor meeting={mockMeeting} />)
      await userEvent.click(screen.getByRole('button', { name: /edit/i }))

      // WHEN: User sets end time before start time
      const startTimeInput = screen.getByLabelText(/start time/i)
      await userEvent.clear(startTimeInput)
      await userEvent.type(startTimeInput, '15:00')

      const endTimeInput = screen.getByLabelText(/end time/i)
      await userEvent.clear(endTimeInput)
      await userEvent.type(endTimeInput, '14:00')

      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      // THEN: Should show validation error
      expect(screen.getByText(/end time must be after start time/i)).toBeInTheDocument()
      expect(mockElectronAPI.updateMeetingDateTime).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // Integration Tests
  // ===========================================================================

  describe('Integration', () => {
    it('should update both title and datetime in single edit session', async () => {
      // GIVEN: Component in edit mode
      mockElectronAPI.updateMeetingSubject.mockResolvedValue({ success: true, result: mockMeeting })
      mockElectronAPI.updateMeetingDateTime.mockResolvedValue({ success: true, result: mockMeeting })

      render(<MeetingMetadataEditor meeting={mockMeeting} />)
      await userEvent.click(screen.getByRole('button', { name: /edit/i }))

      // WHEN: User changes both title and time
      const titleInput = screen.getByDisplayValue('Weekly Team Standup')
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Daily Standup')

      const startTimeInput = screen.getByLabelText(/start time/i)
      await userEvent.clear(startTimeInput)
      await userEvent.type(startTimeInput, '10:00')

      const endTimeInput = screen.getByLabelText(/end time/i)
      await userEvent.clear(endTimeInput)
      await userEvent.type(endTimeInput, '11:00')

      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      // THEN: Should call both APIs
      await waitFor(() => {
        expect(mockElectronAPI.updateMeetingSubject).toHaveBeenCalledWith(
          'meeting-1',
          'Daily Standup'
        )
        expect(mockElectronAPI.updateMeetingDateTime).toHaveBeenCalled()
      })
    })

    it('should show loading state during save', async () => {
      // GIVEN: API call takes time
      mockElectronAPI.updateMeetingSubject.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true, result: mockMeeting }), 100))
      )

      render(<MeetingMetadataEditor meeting={mockMeeting} />)
      await userEvent.click(screen.getByRole('button', { name: /edit/i }))

      const titleInput = screen.getByDisplayValue('Weekly Team Standup')
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'New Title')

      // WHEN: User clicks save
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      // THEN: Should show loading indicator (button changes to "Saving...")
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()

      // AND: Eventually finish and return to view mode
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /saving/i })).not.toBeInTheDocument()
        // Should be back in view mode with Edit button
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
      })
    })
  })
})
