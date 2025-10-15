/**
 * Integration Tests for EmailContextService
 * Phase 2.3-3: Meeting Intelligence
 *
 * IMPORTANT: Tests use actual production code from src/services/emailContext.ts
 * Dependencies (Graph API, DatabaseService) are mocked to avoid external calls.
 *
 * Test Coverage:
 * - TC-SEARCH-001: Two-tier priority (topic-relevant first)
 * - TC-SEARCH-002: Deduplication between tiers
 * - TC-SEARCH-003: Max emails limit enforcement
 * - TC-SEARCH-004: No keywords fallback (generic titles)
 * - TC-SEARCH-005: Cache hit (returns cached emails)
 */

import { EmailContextService } from '../../src/services/emailContext'
import type { EmailContext } from '../../src/types'
import type { Client } from '@microsoft/microsoft-graph-client'
import type { DatabaseService } from '../../src/services/database'

// Helper to create mock EmailContext
function createMockEmail(id: string, subject: string): EmailContext {
  return {
    id,
    subject,
    from: {
      name: 'Test Sender',
      email: 'sender@example.com'
    },
    to: [{
      name: 'Test Recipient',
      email: 'recipient@example.com'
    }],
    receivedDateTime: new Date().toISOString(),
    bodyPreview: `Preview of ${subject}`,
    body: `<html><body>Body of ${subject}</body></html>`,
    truncatedBody: `Body of ${subject}`,
    hasAttachments: false
  }
}

describe('EmailContextService - Integration Tests', () => {
  let service: EmailContextService
  let mockGraphClient: jest.Mocked<Client>
  let mockDb: jest.Mocked<DatabaseService>
  let topLimit: number  // Track .top() limit

  beforeEach(() => {
    topLimit = 999  // Default (no limit)

    // Mock Graph API client with stateful .top() tracking
    mockGraphClient = {
      api: jest.fn().mockReturnThis(),
      filter: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderby: jest.fn().mockReturnThis(),
      top: jest.fn((limit: number) => {
        topLimit = limit  // Track the limit
        return mockGraphClient
      }),
      get: jest.fn()
    } as unknown as jest.Mocked<Client>

    // Mock DatabaseService
    mockDb = {
      getCachedEmails: jest.fn().mockResolvedValue(null),
      cacheEmails: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<DatabaseService>

    // Create service with mocks (USES ACTUAL PRODUCTION CODE)
    service = new EmailContextService(mockGraphClient, mockDb)
  })

  describe('TC-SEARCH-001: Two-tier priority', () => {
    test('prioritizes topic-relevant emails (TIER 1) before participant emails (TIER 2)', async () => {
      // Mock TIER 1 response (topic-relevant: has "budget" keyword)
      const tier1Emails = [
        createMockEmail('topic-1', 'Q4 Budget Planning'),
        createMockEmail('topic-2', 'Budget Review Notes')
      ]

      // Mock TIER 2 response (participant-only: no topic keywords)
      const tier2Emails = [
        createMockEmail('participant-1', 'Lunch plans'),
        createMockEmail('participant-2', 'Team outing')
      ]

      // First call (TIER 1): topic-relevant search
      // Second call (TIER 2): participant-only search
      mockGraphClient.get
        .mockResolvedValueOnce({ value: tier1Emails })
        .mockResolvedValueOnce({ value: tier2Emails })

      // Execute actual production method
      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com', 'bob@company.com'],
        { maxEmails: 4 },
        'Q4 Budget Review' // Meeting title with keywords: "budget", "review"
      )

      // Validate: TIER 1 emails should appear first
      expect(result).toHaveLength(4)
      expect(result[0].id).toBe('topic-1')
      expect(result[1].id).toBe('topic-2')
      expect(result[2].id).toBe('participant-1')
      expect(result[3].id).toBe('participant-2')

      // Validate: Topic-relevant emails appear before participant emails
      expect(result[0].subject).toContain('Budget')
      expect(result[1].subject).toContain('Budget')
      expect(result[2].subject).not.toContain('Budget')

      // Validate: Results cached
      expect(mockDb.cacheEmails).toHaveBeenCalledWith('meeting-1', result)
    })

    test('fills remainder with TIER 2 when TIER 1 has fewer than maxEmails', async () => {
      // TIER 1: Only 1 topic-relevant email
      const tier1Emails = [
        createMockEmail('topic-1', 'Budget Discussion')
      ]

      // TIER 2: Several participant emails
      const tier2Emails = [
        createMockEmail('participant-1', 'Hello'),
        createMockEmail('participant-2', 'Meeting notes'),
        createMockEmail('participant-3', 'Follow up')
      ]

      mockGraphClient.get
        .mockResolvedValueOnce({ value: tier1Emails })
        .mockResolvedValueOnce({ value: tier2Emails })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 4 },
        'Budget Discussion'
      )

      // Should have 1 from TIER 1 + 3 from TIER 2 = 4 total
      expect(result).toHaveLength(4)
      expect(result[0].id).toBe('topic-1') // TIER 1 first
      expect(result[1].id).toBe('participant-1') // Then TIER 2
      expect(result[2].id).toBe('participant-2')
      expect(result[3].id).toBe('participant-3')
    })
  })

  describe('TC-SEARCH-002: Deduplication between tiers', () => {
    test('deduplicates emails that appear in both TIER 1 and TIER 2', async () => {
      // TIER 1: Topic-relevant emails
      const tier1Emails = [
        createMockEmail('email-1', 'Q4 Budget Planning'),
        createMockEmail('email-2', 'Budget Review')
      ]

      // TIER 2: Participant emails (includes duplicate from TIER 1)
      const tier2Emails = [
        createMockEmail('email-2', 'Budget Review'), // DUPLICATE!
        createMockEmail('email-3', 'Lunch plans'),
        createMockEmail('email-4', 'Team outing')
      ]

      mockGraphClient.get
        .mockResolvedValueOnce({ value: tier1Emails })
        .mockResolvedValueOnce({ value: tier2Emails })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 },
        'Q4 Budget Review'
      )

      // Extract IDs
      const ids = result.map(e => e.id)
      const uniqueIds = new Set(ids)

      // Validate: No duplicates
      expect(ids.length).toBe(uniqueIds.size)

      // Validate: Only 4 unique emails (not 5)
      expect(result).toHaveLength(4)

      // Validate: Correct emails present
      expect(ids).toContain('email-1')
      expect(ids).toContain('email-2')
      expect(ids).toContain('email-3')
      expect(ids).toContain('email-4')

      // Validate: email-2 appears only once
      const email2Count = ids.filter(id => id === 'email-2').length
      expect(email2Count).toBe(1)
    })

    test('handles all emails being duplicates gracefully', async () => {
      // TIER 1 and TIER 2 return the same emails
      const sharedEmails = [
        createMockEmail('email-1', 'Budget Planning'),
        createMockEmail('email-2', 'Budget Review')
      ]

      mockGraphClient.get
        .mockResolvedValueOnce({ value: sharedEmails })
        .mockResolvedValueOnce({ value: sharedEmails }) // Same emails

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 },
        'Budget Review'
      )

      // Should only return 2 emails (deduplicated)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('email-1')
      expect(result[1].id).toBe('email-2')
    })
  })

  describe('TC-SEARCH-003: Max emails limit enforcement', () => {
    test('respects maxEmails limit when TIER 1 has enough emails', async () => {
      // TIER 1: More than maxEmails (8 total, but API should return only 5)
      const allTier1Emails = Array.from({ length: 8 }, (_, i) =>
        createMockEmail(`topic-${i}`, `Budget email ${i}`)
      )

      // Mock .get() to respect the .top() limit (simulates Graph API behavior)
      mockGraphClient.get.mockImplementationOnce(async () => {
        return { value: allTier1Emails.slice(0, topLimit) }
      })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 5 },
        'Budget Review'
      )

      // Should be limited to 5
      expect(result).toHaveLength(5)

      // Should only fetch TIER 1 (no TIER 2 call needed)
      expect(mockGraphClient.get).toHaveBeenCalledTimes(1)
    })

    test('respects maxEmails limit across both tiers', async () => {
      // TIER 1: 3 emails
      const tier1Emails = [
        createMockEmail('topic-1', 'Budget Planning'),
        createMockEmail('topic-2', 'Budget Review'),
        createMockEmail('topic-3', 'Budget Analysis')
      ]

      // TIER 2: 5 emails available, but API should return only 2 (respecting .top(2))
      const allTier2Emails = Array.from({ length: 5 }, (_, i) =>
        createMockEmail(`participant-${i}`, `Email ${i}`)
      )

      // First call (TIER 1): return all 3 emails
      // Second call (TIER 2): respect .top() limit (should be 2)
      mockGraphClient.get
        .mockImplementationOnce(async () => {
          return { value: tier1Emails.slice(0, topLimit) }
        })
        .mockImplementationOnce(async () => {
          return { value: allTier2Emails.slice(0, topLimit) }
        })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 5 },
        'Budget Review'
      )

      // Should be exactly 5 (3 from TIER 1 + 2 from TIER 2)
      expect(result).toHaveLength(5)
      expect(result[0].id).toBe('topic-1')
      expect(result[1].id).toBe('topic-2')
      expect(result[2].id).toBe('topic-3')
      expect(result[3].id).toBe('participant-0')
      expect(result[4].id).toBe('participant-1')
    })

    test('handles maxEmails = 0 gracefully', async () => {
      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 0 },
        'Budget Review'
      )

      // Should return empty array
      expect(result).toHaveLength(0)

      // Should not call Graph API (production code should skip API calls when maxEmails = 0)
      expect(mockGraphClient.get).not.toHaveBeenCalled()
    })
  })

  describe('TC-SEARCH-004: No keywords fallback', () => {
    test('skips TIER 1 when meeting title has only stop words', async () => {
      // TIER 2: Participant emails (TIER 1 should be skipped)
      const tier2Emails = [
        createMockEmail('participant-1', 'Email 1'),
        createMockEmail('participant-2', 'Email 2')
      ]

      mockGraphClient.get.mockResolvedValueOnce({ value: tier2Emails })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 },
        'Weekly Sync' // All stop words - no keywords extracted
      )

      // Should return participant emails
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('participant-1')
      expect(result[1].id).toBe('participant-2')

      // Should only make 1 API call (TIER 2 only, TIER 1 skipped)
      expect(mockGraphClient.get).toHaveBeenCalledTimes(1)
    })

    test('skips TIER 1 when meeting title is empty', async () => {
      const tier2Emails = [
        createMockEmail('participant-1', 'Email 1')
      ]

      mockGraphClient.get.mockResolvedValueOnce({ value: tier2Emails })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 },
        '' // Empty title
      )

      expect(result).toHaveLength(1)
      expect(mockGraphClient.get).toHaveBeenCalledTimes(1)
    })

    test('skips TIER 1 when no meeting title provided', async () => {
      const tier2Emails = [
        createMockEmail('participant-1', 'Email 1')
      ]

      mockGraphClient.get.mockResolvedValueOnce({ value: tier2Emails })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 }
        // No meeting title provided
      )

      expect(result).toHaveLength(1)
      expect(mockGraphClient.get).toHaveBeenCalledTimes(1)
    })
  })

  describe('TC-SEARCH-005: Cache hit', () => {
    test('returns cached emails when available', async () => {
      const cachedEmails = [
        createMockEmail('cached-1', 'Cached Email 1'),
        createMockEmail('cached-2', 'Cached Email 2')
      ]

      // Mock cache hit
      mockDb.getCachedEmails.mockResolvedValueOnce(cachedEmails)

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 },
        'Budget Review'
      )

      // Should return cached emails
      expect(result).toEqual(cachedEmails)

      // Should NOT call Graph API
      expect(mockGraphClient.get).not.toHaveBeenCalled()

      // Should NOT cache again (already cached)
      expect(mockDb.cacheEmails).not.toHaveBeenCalled()
    })

    test('fetches and caches emails when cache miss', async () => {
      // Mock cache miss
      mockDb.getCachedEmails.mockResolvedValueOnce(null)

      const tier1Emails = [
        createMockEmail('topic-1', 'Budget Planning')
      ]

      mockGraphClient.get.mockResolvedValueOnce({ value: tier1Emails })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 },
        'Budget Planning'
      )

      // Should return fetched emails
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('topic-1')

      // Should call Graph API
      expect(mockGraphClient.get).toHaveBeenCalled()

      // Should cache the result
      expect(mockDb.cacheEmails).toHaveBeenCalledWith('meeting-1', result)
    })

    test('does not cache empty results', async () => {
      // Mock cache miss
      mockDb.getCachedEmails.mockResolvedValueOnce(null)

      // Mock empty responses
      mockGraphClient.get.mockResolvedValue({ value: [] })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 },
        'Budget Review'
      )

      // Should return empty array
      expect(result).toHaveLength(0)

      // Should NOT cache empty results
      expect(mockDb.cacheEmails).not.toHaveBeenCalled()
    })
  })

  describe('Additional edge cases', () => {
    test('handles Graph API errors gracefully (TIER 1)', async () => {
      // Mock TIER 1 error
      mockGraphClient.get.mockRejectedValueOnce(new Error('API Error'))

      // Mock TIER 2 success
      const tier2Emails = [
        createMockEmail('participant-1', 'Email 1')
      ]
      mockGraphClient.get.mockResolvedValueOnce({ value: tier2Emails })

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 },
        'Budget Review'
      )

      // Should continue with TIER 2 despite TIER 1 failure
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('participant-1')
    })

    test('handles Graph API errors gracefully (TIER 2)', async () => {
      // Mock TIER 1 success
      const tier1Emails = [
        createMockEmail('topic-1', 'Budget Planning')
      ]
      mockGraphClient.get.mockResolvedValueOnce({ value: tier1Emails })

      // Mock TIER 2 error
      mockGraphClient.get.mockRejectedValueOnce(new Error('API Error'))

      const result = await service.getEmailsForMeeting(
        'meeting-1',
        ['alice@company.com'],
        { maxEmails: 10 },
        'Budget Review'
      )

      // Should return TIER 1 results despite TIER 2 failure
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('topic-1')
    })

    test('handles empty participant list', async () => {
      const result = await service.getEmailsForMeeting(
        'meeting-1',
        [], // No participants
        { maxEmails: 10 },
        'Budget Review'
      )

      // Should return empty (can't search without participants)
      expect(result).toHaveLength(0)
    })
  })
})
