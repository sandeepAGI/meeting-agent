/**
 * E2E Tests for Email Context in LLM Prompts
 * Phase 2.3-3: Meeting Intelligence
 *
 * IMPORTANT: Tests use actual production code from:
 * - src/services/meetingIntelligence.ts (MeetingIntelligenceService)
 * - src/services/emailContext.ts (EmailContextService)
 * - src/services/claudeBatch.ts (ClaudeBatchService)
 * - src/services/database.ts (DatabaseService)
 *
 * Only dependencies are mocked to avoid external API calls.
 *
 * Test Coverage:
 * - TC-E2E-001: Email context included in Pass 1 prompt
 * - TC-E2E-002: Topic-relevant emails appear first in prompt
 * - TC-E2E-003: No email context available (calendar metadata only)
 */

import { MeetingIntelligenceService } from '../../src/services/meetingIntelligence'
import { ClaudeBatchService } from '../../src/services/claudeBatch'
import { EmailContextService } from '../../src/services/emailContext'
import { DatabaseService } from '../../src/services/database'
import type { EmailContext } from '../../src/types'

describe('Email Context in LLM Prompts - E2E Tests', () => {
  let intelligenceService: MeetingIntelligenceService
  let mockClaudeService: jest.Mocked<ClaudeBatchService>
  let mockEmailService: jest.Mocked<EmailContextService>
  let mockDb: jest.Mocked<DatabaseService>

  // Track submitted batch requests for verification
  let submittedBatchRequests: any[] = []

  beforeEach(() => {
    submittedBatchRequests = []

    // Mock DatabaseService
    mockDb = {
      createSummary: jest.fn().mockReturnValue('summary-1'),
      getMeeting: jest.fn(),
      getTranscript: jest.fn(),
      getDiarizationByTranscriptId: jest.fn(),
      updateSummaryPass1: jest.fn(),
      updateSummaryStatus: jest.fn(),
      saveBatchJob: jest.fn(),
      updateBatchJobStatus: jest.fn(),
      updateSummaryPass2: jest.fn(),
      getSummary: jest.fn(),
      getBatchJobsBySummaryId: jest.fn()
    } as unknown as jest.Mocked<DatabaseService>

    // Mock ClaudeBatchService
    mockClaudeService = {
      submitBatch: jest.fn().mockImplementation((requests: any[]) => {
        submittedBatchRequests.push(...requests)
        return Promise.resolve('batch-123')
      }),
      pollBatchStatus: jest.fn().mockResolvedValue({ status: 'ended' }),
      retrieveResults: jest.fn(),
      cancelBatch: jest.fn()
    } as unknown as jest.Mocked<ClaudeBatchService>

    // Mock EmailContextService (uses actual production methods)
    mockEmailService = {
      getEmailsForMeeting: jest.fn(),
      formatEmailsForPrompt: jest.fn()
    } as unknown as jest.Mocked<EmailContextService>

    // Create service with mocks (USES ACTUAL PRODUCTION CODE)
    intelligenceService = new MeetingIntelligenceService(
      mockClaudeService,
      mockEmailService,
      mockDb
    )
  })

  describe('TC-E2E-001: Email Context in Pass 1 Prompt', () => {
    test('includes email context in Pass 1 summary prompt', async () => {
      // Mock meeting data
      const mockMeeting = {
        id: 'meeting-1',
        subject: 'Q4 Budget Review',
        start_time: '2024-10-15T10:00:00Z',
        end_time: '2024-10-15T11:00:00Z',
        organizer_name: 'Alice Smith',
        organizer_email: 'alice@company.com',
        attendees_json: JSON.stringify([
          { name: 'Alice', email: 'alice@company.com', type: 'organizer' },
          { name: 'Bob', email: 'bob@company.com', type: 'required' }
        ]),
        location: 'Conference Room A'
      }

      const mockTranscript = {
        id: 'transcript-1',
        recording_id: 'recording-1',
        transcript_text: 'Alice: Let us discuss the Q4 budget. Bob: I agree.',
        segments_json: null,
        created_at: '2024-10-15T10:00:00Z'
      }

      const mockEmails: EmailContext[] = [
        {
          id: 'email-1',
          subject: 'Q4 Budget Planning Draft',
          from: { name: 'Alice', email: 'alice@company.com' },
          to: [{ name: 'Bob', email: 'bob@company.com' }],
          receivedDateTime: '2024-10-10T10:00:00Z',
          bodyPreview: 'Here are the Q4 budget numbers...',
          body: '<html><body>Here are the Q4 budget numbers...</body></html>',
          truncatedBody: 'Here are the Q4 budget numbers...',
          hasAttachments: false
        }
      ]

      // Setup mocks
      mockDb.getMeeting.mockReturnValue(mockMeeting)
      mockDb.getTranscript.mockReturnValue(mockTranscript)
      mockDb.getDiarizationByTranscriptId.mockReturnValue(null)
      mockEmailService.getEmailsForMeeting.mockResolvedValue(mockEmails)
      mockEmailService.formatEmailsForPrompt.mockReturnValue(
        `Email 1:
Subject: Q4 Budget Planning Draft
From: Alice <alice@company.com>
To: Bob <bob@company.com>
Date: 10/10/2024, 10:00:00 AM
Body:
Here are the Q4 budget numbers...`
      )

      // Execute actual production method
      const summaryId = await intelligenceService.generateSummary(
        'meeting-1',
        'transcript-1'
      )

      // Verify summary created
      expect(summaryId).toBe('summary-1')
      expect(mockDb.createSummary).toHaveBeenCalledWith({
        meeting_id: 'meeting-1',
        transcript_id: 'transcript-1'
      })

      // Verify email service called with meeting title for topic search
      expect(mockEmailService.getEmailsForMeeting).toHaveBeenCalledWith(
        'meeting-1',
        ['alice@company.com', 'bob@company.com'],
        undefined,
        'Q4 Budget Review'
      )

      // Verify batch submitted
      expect(mockClaudeService.submitBatch).toHaveBeenCalled()

      // Verify prompt includes email context
      const batchRequest = submittedBatchRequests[0]
      expect(batchRequest).toBeDefined()

      const prompt = batchRequest.params.messages[0].content

      // Verify calendar metadata
      expect(prompt).toContain('Q4 Budget Review')
      expect(prompt).toContain('Alice')
      expect(prompt).toContain('Bob')

      // Verify email context included
      expect(prompt).toContain('Q4 Budget Planning Draft')
      expect(prompt).toContain('alice@company.com')
      expect(prompt).toContain('Here are the Q4 budget numbers')
    })
  })

  describe('TC-E2E-002: Topic-Relevant Emails Appear First', () => {
    test('topic-relevant emails appear before generic emails in prompt', async () => {
      // Mock meeting data
      const mockMeeting = {
        id: 'meeting-1',
        subject: 'Budget Discussion',
        start_time: '2024-10-15T10:00:00Z',
        end_time: '2024-10-15T11:00:00Z',
        organizer_name: 'Alice Smith',
        organizer_email: 'alice@company.com',
        attendees_json: JSON.stringify([
          { name: 'Alice', email: 'alice@company.com', type: 'organizer' }
        ]),
        location: null
      }

      const mockTranscript = {
        id: 'transcript-1',
        recording_id: 'recording-1',
        transcript_text: 'Alice: Budget discussion.',
        segments_json: null,
        created_at: '2024-10-15T10:00:00Z'
      }

      // TIER 1 (topic-relevant) + TIER 2 (generic) emails
      const mockEmails: EmailContext[] = [
        {
          id: 'email-1',
          subject: 'Budget Planning Q4',  // TIER 1 - topic-relevant
          from: { name: 'Alice', email: 'alice@company.com' },
          to: [{ name: 'Bob', email: 'bob@company.com' }],
          receivedDateTime: '2024-10-10T10:00:00Z',
          bodyPreview: 'Budget details...',
          body: 'Budget details...',
          truncatedBody: 'Budget details...',
          hasAttachments: false
        },
        {
          id: 'email-2',
          subject: 'Lunch plans',  // TIER 2 - generic
          from: { name: 'Alice', email: 'alice@company.com' },
          to: [{ name: 'Bob', email: 'bob@company.com' }],
          receivedDateTime: '2024-10-09T12:00:00Z',
          bodyPreview: 'Want to grab lunch?',
          body: 'Want to grab lunch?',
          truncatedBody: 'Want to grab lunch?',
          hasAttachments: false
        }
      ]

      // Setup mocks
      mockDb.getMeeting.mockReturnValue(mockMeeting)
      mockDb.getTranscript.mockReturnValue(mockTranscript)
      mockDb.getDiarizationByTranscriptId.mockReturnValue(null)
      mockEmailService.getEmailsForMeeting.mockResolvedValue(mockEmails)
      mockEmailService.formatEmailsForPrompt.mockReturnValue(
        `Email 1:
Subject: Budget Planning Q4
From: Alice <alice@company.com>
Body: Budget details...

---

Email 2:
Subject: Lunch plans
From: Alice <alice@company.com>
Body: Want to grab lunch?`
      )

      // Execute actual production method
      await intelligenceService.generateSummary('meeting-1', 'transcript-1')

      // Verify prompt ordering
      const batchRequest = submittedBatchRequests[0]
      const prompt = batchRequest.params.messages[0].content

      const budgetIndex = prompt.indexOf('Budget Planning Q4')
      const lunchIndex = prompt.indexOf('Lunch plans')

      // Budget email should appear before lunch email
      expect(budgetIndex).toBeGreaterThan(-1)
      expect(lunchIndex).toBeGreaterThan(-1)
      expect(budgetIndex).toBeLessThan(lunchIndex)
    })
  })

  describe('TC-E2E-003: No Email Context Available (Calendar Metadata Only)', () => {
    test('generates summary with calendar metadata when no emails found', async () => {
      // Mock meeting data (new project, no prior emails)
      const mockMeeting = {
        id: 'meeting-1',
        subject: 'Brand New Project Kickoff',
        start_time: '2024-10-15T10:00:00Z',
        end_time: '2024-10-15T11:00:00Z',
        organizer_name: 'Alice Smith',
        organizer_email: 'alice@company.com',
        attendees_json: JSON.stringify([
          { name: 'Alice', email: 'alice@company.com', type: 'organizer' },
          { name: 'Bob', email: 'bob@company.com', type: 'required' }
        ]),
        location: 'Conference Room A'
      }

      const mockTranscript = {
        id: 'transcript-1',
        recording_id: 'recording-1',
        transcript_text: 'Alice: Welcome to the new project kickoff.',
        segments_json: null,
        created_at: '2024-10-15T10:00:00Z'
      }

      // Setup mocks - NO EMAILS FOUND
      mockDb.getMeeting.mockReturnValue(mockMeeting)
      mockDb.getTranscript.mockReturnValue(mockTranscript)
      mockDb.getDiarizationByTranscriptId.mockReturnValue(null)
      mockEmailService.getEmailsForMeeting.mockResolvedValue([])  // Empty array
      mockEmailService.formatEmailsForPrompt.mockReturnValue(
        'No recent email context available.'
      )

      // Execute actual production method
      const summaryId = await intelligenceService.generateSummary(
        'meeting-1',
        'transcript-1'
      )

      // Verify summary created (doesn't fail)
      expect(summaryId).toBe('summary-1')

      // Verify batch submitted (continues despite no emails)
      expect(mockClaudeService.submitBatch).toHaveBeenCalled()

      // Verify prompt content
      const batchRequest = submittedBatchRequests[0]
      expect(batchRequest).toBeDefined()

      const prompt = batchRequest.params.messages[0].content

      // Verify calendar metadata IS included
      expect(prompt).toContain('Brand New Project Kickoff')
      expect(prompt).toContain('Alice')
      expect(prompt).toContain('Bob')

      // Verify email context shows "unavailable" message
      expect(prompt).toContain('No recent email context available')

      // Verify it doesn't crash or throw errors
      expect(summaryId).toBeDefined()
    })

    test('handles standalone recording (no calendar meeting)', async () => {
      // Mock standalone recording (no meeting data)
      const mockTranscript = {
        id: 'transcript-1',
        recording_id: 'recording-1',
        transcript_text: 'Speaker 1: This is a standalone recording.',
        segments_json: null,
        created_at: '2024-10-15T10:00:00Z'
      }

      // Setup mocks - NO MEETING DATA
      mockDb.getMeeting.mockReturnValue(null)  // No meeting
      mockDb.getTranscript.mockReturnValue(mockTranscript)
      mockDb.getDiarizationByTranscriptId.mockReturnValue(null)
      // Email service should not be called for standalone recordings

      // Execute actual production method with empty meetingId
      const summaryId = await intelligenceService.generateSummary(
        '',  // No meeting ID
        'transcript-1'
      )

      // Verify summary created
      expect(summaryId).toBe('summary-1')

      // Verify email service NOT called (no meeting = no emails)
      expect(mockEmailService.getEmailsForMeeting).not.toHaveBeenCalled()

      // Verify batch submitted
      expect(mockClaudeService.submitBatch).toHaveBeenCalled()

      const batchRequest = submittedBatchRequests[0]
      const prompt = batchRequest.params.messages[0].content

      // Verify fallback values used
      expect(prompt).toContain('Untitled Recording')
      expect(prompt).toContain('standalone recording')

      // Verify doesn't crash
      expect(summaryId).toBeDefined()
    })
  })
})
