/**
 * Database Layer Tests: Meeting Metadata Editing
 * TDD Plan: Meeting Metadata Editing & Participant Deletion
 *
 * Tests for:
 * - updateMeetingSubject()
 * - updateMeetingDateTime()
 * - deleteMeetingAttendee()
 */

import { DatabaseService } from '../src/services/database'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('DatabaseService - Meeting Metadata Editing', () => {
  let dbService: DatabaseService
  let testDbPath: string

  beforeEach(() => {
    // Create a unique temp database for each test
    testDbPath = path.join(os.tmpdir(), `test-db-${Date.now()}-${Math.random()}.db`)
    dbService = new DatabaseService(testDbPath)
  })

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  // ===========================================================================
  // Test Suite 1: updateMeetingSubject()
  // ===========================================================================

  describe('updateMeetingSubject', () => {
    it('should update meeting subject successfully', () => {
      // GIVEN: A meeting exists with subject "Weekly Standup"
      const meetingId = 'test-meeting-1'
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Weekly Standup',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z',
        organizer_name: 'Alice Smith',
        organizer_email: 'alice@example.com',
        attendees_json: JSON.stringify([
          { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
          { name: 'Bob Johnson', email: 'bob@example.com', type: 'required' }
        ])
      })

      // WHEN: updateMeetingSubject(meetingId, "Daily Standup")
      const result = dbService.updateMeetingSubject(meetingId, 'Daily Standup')

      // THEN: Database should have new subject
      expect(result).toBe(true)
      const updatedMeeting = dbService.getMeeting(meetingId)
      expect(updatedMeeting.subject).toBe('Daily Standup')

      // AND: updated_at timestamp should be updated (within last second)
      const updatedAt = new Date(updatedMeeting.updated_at).getTime()
      const now = Date.now()
      expect(now - updatedAt).toBeLessThan(1000)
    })

    it('should reject empty subject', () => {
      // GIVEN: A meeting exists
      const meetingId = 'test-meeting-2'
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Original Subject',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z'
      })

      // WHEN: updateMeetingSubject(meetingId, "")
      // THEN: Should throw validation error
      expect(() => {
        dbService.updateMeetingSubject(meetingId, '')
      }).toThrow('Subject cannot be empty')
    })

    it('should reject whitespace-only subject', () => {
      // GIVEN: A meeting exists
      const meetingId = 'test-meeting-3'
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Original Subject',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z'
      })

      // WHEN: updateMeetingSubject(meetingId, "   ")
      // THEN: Should throw validation error
      expect(() => {
        dbService.updateMeetingSubject(meetingId, '   ')
      }).toThrow('Subject cannot be empty')
    })

    it('should truncate subject at 200 characters', () => {
      // GIVEN: A meeting exists
      const meetingId = 'test-meeting-4'
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Original Subject',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z'
      })

      // WHEN: updateMeetingSubject(meetingId, "A".repeat(300))
      const longSubject = 'A'.repeat(300)
      const result = dbService.updateMeetingSubject(meetingId, longSubject)

      // THEN: Subject should be truncated to 200 chars
      expect(result).toBe(true)
      const updatedMeeting = dbService.getMeeting(meetingId)
      expect(updatedMeeting.subject).toHaveLength(200)
      expect(updatedMeeting.subject).toBe('A'.repeat(200))
    })

    it('should return false for non-existent meeting', () => {
      // GIVEN: Meeting does not exist
      // WHEN: updateMeetingSubject("fake-id", "New Title")
      const result = dbService.updateMeetingSubject('non-existent-id', 'New Title')

      // THEN: Should return false
      expect(result).toBe(false)
    })

    it('should preserve other meeting fields when updating subject', () => {
      // GIVEN: A meeting with full metadata
      const meetingId = 'test-meeting-5'
      const originalMeeting = {
        id: meetingId,
        subject: 'Original Subject',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z',
        organizer_name: 'Alice Smith',
        organizer_email: 'alice@example.com',
        attendees_json: JSON.stringify([
          { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' }
        ]),
        location: 'Conference Room A',
        is_online_meeting: true,
        online_meeting_url: 'https://teams.microsoft.com/meet/123'
      }
      dbService.saveMeeting(originalMeeting)

      // WHEN: Update subject
      dbService.updateMeetingSubject(meetingId, 'New Subject')

      // THEN: Only subject should change, other fields intact
      const updatedMeeting = dbService.getMeeting(meetingId)
      expect(updatedMeeting.subject).toBe('New Subject')
      expect(updatedMeeting.start_time).toBe(originalMeeting.start_time)
      expect(updatedMeeting.end_time).toBe(originalMeeting.end_time)
      expect(updatedMeeting.organizer_name).toBe(originalMeeting.organizer_name)
      expect(updatedMeeting.location).toBe(originalMeeting.location)
    })
  })

  // ===========================================================================
  // Test Suite 2: updateMeetingDateTime()
  // ===========================================================================

  describe('updateMeetingDateTime', () => {
    it('should update start and end times successfully', () => {
      // GIVEN: Meeting with start=2PM, end=3PM
      const meetingId = 'test-meeting-6'
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Team Meeting',
        start_time: '2026-01-07T14:00:00Z', // 2PM
        end_time: '2026-01-07T15:00:00Z'    // 3PM
      })

      // WHEN: updateMeetingDateTime(meetingId, 3PM, 4PM)
      const newStart = new Date('2026-01-07T15:00:00Z')
      const newEnd = new Date('2026-01-07T16:00:00Z')
      const result = dbService.updateMeetingDateTime(meetingId, newStart, newEnd)

      // THEN: Database should have new times
      expect(result).toBe(true)
      const updatedMeeting = dbService.getMeeting(meetingId)
      expect(updatedMeeting.start_time).toBe('2026-01-07T15:00:00.000Z')
      expect(updatedMeeting.end_time).toBe('2026-01-07T16:00:00.000Z')
    })

    it('should reject end time before start time', () => {
      // GIVEN: Meeting exists
      const meetingId = 'test-meeting-7'
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Team Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z'
      })

      // WHEN: updateMeetingDateTime(meetingId, 3PM, 2PM)
      const newStart = new Date('2026-01-07T15:00:00Z')
      const newEnd = new Date('2026-01-07T14:00:00Z')

      // THEN: Should throw validation error
      expect(() => {
        dbService.updateMeetingDateTime(meetingId, newStart, newEnd)
      }).toThrow('End time must be after start time')
    })

    it('should reject equal start and end times', () => {
      // GIVEN: Meeting exists
      const meetingId = 'test-meeting-8'
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Team Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z'
      })

      // WHEN: Set same start and end time
      const sameTime = new Date('2026-01-07T15:00:00Z')

      // THEN: Should throw validation error
      expect(() => {
        dbService.updateMeetingDateTime(meetingId, sameTime, sameTime)
      }).toThrow('End time must be after start time')
    })

    it('should support cross-midnight meetings', () => {
      // GIVEN: Meeting exists
      const meetingId = 'test-meeting-9'
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Late Night Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z'
      })

      // WHEN: updateMeetingDateTime(meetingId, 11PM today, 1AM tomorrow)
      const newStart = new Date('2026-01-07T23:00:00Z')
      const newEnd = new Date('2026-01-08T01:00:00Z')
      const result = dbService.updateMeetingDateTime(meetingId, newStart, newEnd)

      // THEN: Should save correctly with end > start
      expect(result).toBe(true)
      const updatedMeeting = dbService.getMeeting(meetingId)
      expect(updatedMeeting.start_time).toBe('2026-01-07T23:00:00.000Z')
      expect(updatedMeeting.end_time).toBe('2026-01-08T01:00:00.000Z')
    })

    it('should return false for non-existent meeting', () => {
      // GIVEN: Meeting does not exist
      // WHEN: updateMeetingDateTime("fake-id", ...)
      const newStart = new Date('2026-01-07T15:00:00Z')
      const newEnd = new Date('2026-01-07T16:00:00Z')
      const result = dbService.updateMeetingDateTime('non-existent-id', newStart, newEnd)

      // THEN: Should return false
      expect(result).toBe(false)
    })

    it('should preserve other meeting fields when updating datetime', () => {
      // GIVEN: A meeting with full metadata
      const meetingId = 'test-meeting-10'
      const originalMeeting = {
        id: meetingId,
        subject: 'Important Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z',
        organizer_name: 'Alice Smith',
        organizer_email: 'alice@example.com',
        attendees_json: JSON.stringify([
          { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' }
        ]),
        location: 'Conference Room A'
      }
      dbService.saveMeeting(originalMeeting)

      // WHEN: Update datetime
      const newStart = new Date('2026-01-07T16:00:00Z')
      const newEnd = new Date('2026-01-07T17:00:00Z')
      dbService.updateMeetingDateTime(meetingId, newStart, newEnd)

      // THEN: Only times should change, other fields intact
      const updatedMeeting = dbService.getMeeting(meetingId)
      expect(updatedMeeting.subject).toBe(originalMeeting.subject)
      expect(updatedMeeting.organizer_name).toBe(originalMeeting.organizer_name)
      expect(updatedMeeting.location).toBe(originalMeeting.location)
      expect(updatedMeeting.attendees_json).toBe(originalMeeting.attendees_json)
    })
  })

  // ===========================================================================
  // Test Suite 3: deleteMeetingAttendee()
  // ===========================================================================

  describe('deleteMeetingAttendee', () => {
    it('should remove attendee from attendees_json', () => {
      // GIVEN: Meeting with 3 attendees
      const meetingId = 'test-meeting-11'
      const attendees = [
        { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
        { name: 'Bob Johnson', email: 'bob@example.com', type: 'required' },
        { name: 'Carol White', email: 'carol@example.com', type: 'optional' }
      ]
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Team Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z',
        organizer_email: 'alice@example.com',
        attendees_json: JSON.stringify(attendees)
      })

      // WHEN: deleteMeetingAttendee(meetingId, "bob@example.com")
      const result = dbService.deleteMeetingAttendee(meetingId, 'bob@example.com')

      // THEN: attendees_json should have 2 attendees
      expect(result).toBe(true)
      const updatedMeeting = dbService.getMeeting(meetingId)
      const updatedAttendees = JSON.parse(updatedMeeting.attendees_json)
      expect(updatedAttendees).toHaveLength(2)

      // AND: Bob should be removed
      expect(updatedAttendees.find((a: any) => a.email === 'bob@example.com')).toBeUndefined()
      expect(updatedAttendees.find((a: any) => a.email === 'alice@example.com')).toBeDefined()
      expect(updatedAttendees.find((a: any) => a.email === 'carol@example.com')).toBeDefined()
    })

    it('should prevent deletion of organizer', () => {
      // GIVEN: Meeting with organizer alice@example.com
      const meetingId = 'test-meeting-12'
      const attendees = [
        { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
        { name: 'Bob Johnson', email: 'bob@example.com', type: 'required' }
      ]
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Team Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z',
        organizer_email: 'alice@example.com',
        attendees_json: JSON.stringify(attendees)
      })

      // WHEN: deleteMeetingAttendee(meetingId, "alice@example.com")
      // THEN: Should throw error
      expect(() => {
        dbService.deleteMeetingAttendee(meetingId, 'alice@example.com')
      }).toThrow('Cannot delete meeting organizer')
    })

    it('should handle non-existent attendee gracefully', () => {
      // GIVEN: Meeting with 3 attendees
      const meetingId = 'test-meeting-13'
      const attendees = [
        { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
        { name: 'Bob Johnson', email: 'bob@example.com', type: 'required' },
        { name: 'Carol White', email: 'carol@example.com', type: 'optional' }
      ]
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Team Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z',
        organizer_email: 'alice@example.com',
        attendees_json: JSON.stringify(attendees)
      })

      // WHEN: deleteMeetingAttendee(meetingId, "nothere@example.com")
      const result = dbService.deleteMeetingAttendee(meetingId, 'nothere@example.com')

      // THEN: Should return false (no change)
      expect(result).toBe(false)
      const updatedMeeting = dbService.getMeeting(meetingId)
      const updatedAttendees = JSON.parse(updatedMeeting.attendees_json)
      expect(updatedAttendees).toHaveLength(3) // No change
    })

    it('should return false for non-existent meeting', () => {
      // GIVEN: Meeting does not exist
      // WHEN: deleteMeetingAttendee("fake-id", "bob@example.com")
      const result = dbService.deleteMeetingAttendee('non-existent-id', 'bob@example.com')

      // THEN: Should return false
      expect(result).toBe(false)
    })

    it('should handle null or undefined attendees_json', () => {
      // GIVEN: Meeting with null attendees_json
      const meetingId = 'test-meeting-14'
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Team Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z'
        // No attendees_json
      })

      // WHEN: deleteMeetingAttendee(meetingId, "bob@example.com")
      const result = dbService.deleteMeetingAttendee(meetingId, 'bob@example.com')

      // THEN: Should return false (nothing to delete)
      expect(result).toBe(false)
    })

    it('should handle case-insensitive email matching', () => {
      // GIVEN: Meeting with attendee bob@example.com
      const meetingId = 'test-meeting-15'
      const attendees = [
        { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
        { name: 'Bob Johnson', email: 'bob@example.com', type: 'required' }
      ]
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Team Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z',
        organizer_email: 'alice@example.com',
        attendees_json: JSON.stringify(attendees)
      })

      // WHEN: deleteMeetingAttendee(meetingId, "BOB@EXAMPLE.COM")
      const result = dbService.deleteMeetingAttendee(meetingId, 'BOB@EXAMPLE.COM')

      // THEN: Should delete Bob (case-insensitive match)
      expect(result).toBe(true)
      const updatedMeeting = dbService.getMeeting(meetingId)
      const updatedAttendees = JSON.parse(updatedMeeting.attendees_json)
      expect(updatedAttendees).toHaveLength(1)
      expect(updatedAttendees.find((a: any) => a.email.toLowerCase() === 'bob@example.com')).toBeUndefined()
    })

    it('should preserve attendee order after deletion', () => {
      // GIVEN: Meeting with 4 attendees in specific order
      const meetingId = 'test-meeting-16'
      const attendees = [
        { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' },
        { name: 'Bob Johnson', email: 'bob@example.com', type: 'required' },
        { name: 'Carol White', email: 'carol@example.com', type: 'optional' },
        { name: 'Dan Brown', email: 'dan@example.com', type: 'required' }
      ]
      dbService.saveMeeting({
        id: meetingId,
        subject: 'Team Meeting',
        start_time: '2026-01-07T14:00:00Z',
        end_time: '2026-01-07T15:00:00Z',
        organizer_email: 'alice@example.com',
        attendees_json: JSON.stringify(attendees)
      })

      // WHEN: Delete Bob (second in list)
      dbService.deleteMeetingAttendee(meetingId, 'bob@example.com')

      // THEN: Order should be preserved: Alice, Carol, Dan
      const updatedMeeting = dbService.getMeeting(meetingId)
      const updatedAttendees = JSON.parse(updatedMeeting.attendees_json)
      expect(updatedAttendees).toHaveLength(3)
      expect(updatedAttendees[0].email).toBe('alice@example.com')
      expect(updatedAttendees[1].email).toBe('carol@example.com')
      expect(updatedAttendees[2].email).toBe('dan@example.com')
    })
  })
})
