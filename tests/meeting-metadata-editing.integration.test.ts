/**
 * Integration Tests: Meeting Metadata Editing
 * TDD Plan: Meeting Metadata Editing & Participant Deletion
 *
 * Tests the integration between IPC handlers and database layer
 * These tests use a real in-memory database to verify full data flow
 */

import { DatabaseService } from '../src/services/database'
import path from 'path'
import fs from 'fs'
import os from 'os'

describe('Meeting Metadata Editing - Integration', () => {
  let dbService: DatabaseService
  let testDbPath: string
  let meetingId: string

  beforeEach(() => {
    // Create temporary test database
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meeting-agent-integration-'))
    testDbPath = path.join(tempDir, 'test.db')
    dbService = new DatabaseService(testDbPath)

    // Create a test meeting with attendees
    const startTime = new Date('2026-01-07T14:00:00Z')
    const endTime = new Date('2026-01-07T15:00:00Z')
    const attendees = [
      { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' as const },
      { name: 'Bob Johnson', email: 'bob@example.com', type: 'required' as const },
      { name: 'Carol White', email: 'carol@example.com', type: 'optional' as const }
    ]

    meetingId = 'meeting-123'
    dbService.saveMeeting({
      id: meetingId,
      subject: 'Weekly Team Standup',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      organizer_name: 'Alice Smith',
      organizer_email: 'alice@example.com',
      attendees_json: JSON.stringify(attendees),
      is_online_meeting: false
    })
  })

  afterEach(() => {
    // Clean up test database
    dbService.close()
    const tempDir = path.dirname(testDbPath)
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  // ===========================================================================
  // Title Editing Integration
  // ===========================================================================

  describe('Title Editing - Full Flow', () => {
    it('should update meeting title through database layer', () => {
      // GIVEN: Meeting exists in database
      const originalMeeting = dbService.getMeeting(meetingId)
      expect(originalMeeting?.subject).toBe('Weekly Team Standup')

      // WHEN: Update title via database service
      const updateResult = dbService.updateMeetingSubject(meetingId, 'Daily Standup')
      expect(updateResult).toBe(true)

      // THEN: Database should reflect new title
      const updatedMeeting = dbService.getMeeting(meetingId)
      expect(updatedMeeting?.subject).toBe('Daily Standup')
      expect(updatedMeeting?.updated_at).toBeDefined()
    })

    it('should enforce title validation rules', () => {
      // GIVEN: Attempt to set invalid title
      // WHEN: Update with empty title
      // THEN: Should throw validation error
      expect(() => {
        dbService.updateMeetingSubject(meetingId, '')
      }).toThrow('Subject cannot be empty')

      expect(() => {
        dbService.updateMeetingSubject(meetingId, '   ')
      }).toThrow('Subject cannot be empty')
    })

    it('should truncate overly long titles', () => {
      // GIVEN: Title longer than 200 characters
      const longTitle = 'A'.repeat(250)

      // WHEN: Update with long title
      const result = dbService.updateMeetingSubject(meetingId, longTitle)
      expect(result).toBe(true)

      // THEN: Title should be truncated to 200 chars
      const meeting = dbService.getMeeting(meetingId)
      expect(meeting?.subject.length).toBe(200)
    })

    it('should handle non-existent meeting ID gracefully', () => {
      // GIVEN: Invalid meeting ID
      // WHEN: Attempt to update
      const result = dbService.updateMeetingSubject('invalid-id', 'New Title')

      // THEN: Should return false (not throw)
      expect(result).toBe(false)
    })
  })

  // ===========================================================================
  // DateTime Editing Integration
  // ===========================================================================

  describe('DateTime Editing - Full Flow', () => {
    it('should update meeting datetime through database layer', () => {
      // GIVEN: Meeting with original times
      const newStart = new Date('2026-01-07T15:00:00Z')
      const newEnd = new Date('2026-01-07T16:00:00Z')

      // WHEN: Update datetime
      const result = dbService.updateMeetingDateTime(meetingId, newStart, newEnd)
      expect(result).toBe(true)

      // THEN: Database should reflect new times
      const meeting = dbService.getMeeting(meetingId)
      expect(new Date(meeting!.start_time).getTime()).toBe(newStart.getTime())
      expect(new Date(meeting!.end_time).getTime()).toBe(newEnd.getTime())
    })

    it('should enforce end time > start time validation', () => {
      // GIVEN: Invalid time range (end before start)
      const start = new Date('2026-01-07T15:00:00Z')
      const end = new Date('2026-01-07T14:00:00Z')

      // WHEN: Attempt to update
      // THEN: Should throw validation error
      expect(() => {
        dbService.updateMeetingDateTime(meetingId, start, end)
      }).toThrow('End time must be after start time')
    })

    it('should enforce end time > start time for same times', () => {
      // GIVEN: Same start and end time
      const sameTime = new Date('2026-01-07T15:00:00Z')

      // WHEN: Attempt to update
      // THEN: Should throw validation error
      expect(() => {
        dbService.updateMeetingDateTime(meetingId, sameTime, sameTime)
      }).toThrow('End time must be after start time')
    })
  })

  // ===========================================================================
  // Participant Deletion Integration
  // ===========================================================================

  describe('Participant Deletion - Full Flow', () => {
    it('should delete attendee and update attendees_json', () => {
      // GIVEN: Meeting with 3 attendees
      const originalMeeting = dbService.getMeeting(meetingId)
      const originalAttendees = JSON.parse(originalMeeting!.attendees_json!)
      expect(originalAttendees.length).toBe(3)

      // WHEN: Delete Bob
      const result = dbService.deleteMeetingAttendee(meetingId, 'bob@example.com')
      expect(result).toBe(true)

      // THEN: Bob should be removed from attendees_json
      const updatedMeeting = dbService.getMeeting(meetingId)
      const updatedAttendees = JSON.parse(updatedMeeting!.attendees_json!)
      expect(updatedAttendees.length).toBe(2)
      expect(updatedAttendees.find((a: any) => a.email === 'bob@example.com')).toBeUndefined()
      expect(updatedAttendees.find((a: any) => a.email === 'alice@example.com')).toBeDefined()
      expect(updatedAttendees.find((a: any) => a.email === 'carol@example.com')).toBeDefined()
    })

    it('should prevent deletion of meeting organizer', () => {
      // GIVEN: Attempt to delete organizer
      // WHEN: Delete Alice (organizer)
      // THEN: Should throw error
      expect(() => {
        dbService.deleteMeetingAttendee(meetingId, 'alice@example.com')
      }).toThrow('Cannot delete meeting organizer')
    })

    it('should handle case-insensitive email matching for organizer check', () => {
      // GIVEN: Organizer with uppercase in email
      // WHEN: Attempt to delete with different case
      // THEN: Should still prevent deletion
      expect(() => {
        dbService.deleteMeetingAttendee(meetingId, 'ALICE@EXAMPLE.COM')
      }).toThrow('Cannot delete meeting organizer')
    })

    it('should handle case-insensitive email matching for deletion', () => {
      // GIVEN: Attendee Bob
      // WHEN: Delete with uppercase email
      const result = dbService.deleteMeetingAttendee(meetingId, 'BOB@EXAMPLE.COM')
      expect(result).toBe(true)

      // THEN: Bob should be removed
      const meeting = dbService.getMeeting(meetingId)
      const attendees = JSON.parse(meeting!.attendees_json!)
      expect(attendees.find((a: any) => a.email.toLowerCase() === 'bob@example.com')).toBeUndefined()
    })

    it('should return false if attendee not found', () => {
      // GIVEN: Non-existent attendee email
      // WHEN: Attempt to delete
      const result = dbService.deleteMeetingAttendee(meetingId, 'nonexistent@example.com')

      // THEN: Should return false (attendee was not present)
      expect(result).toBe(false)
    })

    it('should handle deletion of all non-organizer attendees', () => {
      // GIVEN: Meeting with multiple attendees
      // WHEN: Delete all except organizer
      dbService.deleteMeetingAttendee(meetingId, 'bob@example.com')
      dbService.deleteMeetingAttendee(meetingId, 'carol@example.com')

      // THEN: Only organizer should remain
      const meeting = dbService.getMeeting(meetingId)
      const attendees = JSON.parse(meeting!.attendees_json!)
      expect(attendees.length).toBe(1)
      expect(attendees[0].email).toBe('alice@example.com')
    })
  })

  // ===========================================================================
  // Combined Operations Integration
  // ===========================================================================

  describe('Combined Operations - Full Flow', () => {
    it('should handle multiple updates in sequence', () => {
      // GIVEN: Meeting with original data
      // WHEN: Update title, datetime, and delete attendee
      dbService.updateMeetingSubject(meetingId, 'Daily Standup')

      const newStart = new Date('2026-01-07T10:00:00Z')
      const newEnd = new Date('2026-01-07T11:00:00Z')
      dbService.updateMeetingDateTime(meetingId, newStart, newEnd)

      dbService.deleteMeetingAttendee(meetingId, 'bob@example.com')

      // THEN: All changes should be persisted
      const meeting = dbService.getMeeting(meetingId)
      expect(meeting?.subject).toBe('Daily Standup')
      expect(new Date(meeting!.start_time).getTime()).toBe(newStart.getTime())
      expect(new Date(meeting!.end_time).getTime()).toBe(newEnd.getTime())

      const attendees = JSON.parse(meeting!.attendees_json!)
      expect(attendees.length).toBe(2)
      expect(attendees.find((a: any) => a.email === 'bob@example.com')).toBeUndefined()
    })

    it('should maintain data integrity after failed validation', () => {
      // GIVEN: Meeting with original data
      const originalMeeting = dbService.getMeeting(meetingId)

      // WHEN: Attempt invalid update (should fail)
      try {
        dbService.updateMeetingSubject(meetingId, '')
      } catch (e) {
        // Expected error
      }

      // THEN: Original data should be unchanged
      const meeting = dbService.getMeeting(meetingId)
      expect(meeting?.subject).toBe(originalMeeting?.subject)
      expect(meeting?.updated_at).toBe(originalMeeting?.updated_at)
    })
  })

  // ===========================================================================
  // Error Handling Integration
  // ===========================================================================

  describe('Error Handling - Full Flow', () => {
    it('should handle database errors gracefully', () => {
      // GIVEN: Closed database
      dbService.close()

      // WHEN: Attempt operations on closed database
      // THEN: Should throw appropriate errors
      expect(() => {
        dbService.getMeeting(meetingId)
      }).toThrow()
    })

    it('should validate meeting existence before updates', () => {
      // GIVEN: Non-existent meeting
      const fakeMeetingId = 'fake-meeting-id'

      // WHEN: Attempt to update
      const titleResult = dbService.updateMeetingSubject(fakeMeetingId, 'New Title')
      const dateResult = dbService.updateMeetingDateTime(
        fakeMeetingId,
        new Date('2026-01-07T10:00:00Z'),
        new Date('2026-01-07T11:00:00Z')
      )
      const deleteResult = dbService.deleteMeetingAttendee(fakeMeetingId, 'bob@example.com')

      // THEN: All operations should return false
      expect(titleResult).toBe(false)
      expect(dateResult).toBe(false)
      expect(deleteResult).toBe(false)
    })
  })

  // ===========================================================================
  // Performance Integration
  // ===========================================================================

  describe('Performance - Bulk Operations', () => {
    it('should handle multiple attendee deletions efficiently', () => {
      // GIVEN: Meeting with many attendees
      const manyAttendees = [
        { name: 'Alice Smith', email: 'alice@example.com', type: 'organizer' as const },
        ...Array.from({ length: 50 }, (_, i) => ({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          type: 'optional' as const
        }))
      ]

      const bigMeetingId = 'big-meeting'
      dbService.saveMeeting({
        id: bigMeetingId,
        subject: 'Large Meeting',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        organizer_name: 'Alice Smith',
        organizer_email: 'alice@example.com',
        attendees_json: JSON.stringify(manyAttendees),
        is_online_meeting: false
      })

      // WHEN: Delete many attendees
      const startTime = Date.now()
      for (let i = 0; i < 25; i++) {
        dbService.deleteMeetingAttendee(bigMeetingId, `user${i}@example.com`)
      }
      const duration = Date.now() - startTime

      // THEN: Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000)

      // AND: Correct number of attendees remain
      const meeting = dbService.getMeeting(bigMeetingId)
      const remainingAttendees = JSON.parse(meeting!.attendees_json!)
      expect(remainingAttendees.length).toBe(26) // 1 organizer + 25 remaining users
    })
  })
})
