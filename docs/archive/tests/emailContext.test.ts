/**
 * Unit Tests for Keyword Extraction
 *
 * Tests based on real meeting data from tests/fixtures/real-meetings.json
 * Validated with scripts/analyze-keyword-extraction.ts
 *
 * IMPORTANT: Tests use actual production code from src/utils/keywordExtraction.ts
 * to ensure validation of real implementation (no duplication).
 *
 * Test Coverage:
 * - TC-KW-001: Extract meaningful keywords from business meeting titles
 * - TC-KW-002: Filter out common stop words
 * - TC-KW-003: Remove short words (< 3 chars)
 * - TC-KW-004: Deduplicate keywords
 * - TC-KW-005: Handle empty/null titles
 * - TC-KW-006: Extract from technical meeting titles
 * - TC-KW-007: Handle special characters and punctuation
 */

import { extractKeywords } from '../../src/utils/keywordExtraction'

describe('Keyword Extraction Utility', () => {
  describe('TC-KW-001: Extract meaningful keywords from business meeting titles', () => {
    test('extracts company names and meeting topics', () => {
      const title = 'Matrix (Lior, CEO, Ronen Sales) + Aileron Group (Sandeep, Gil) - Introductions (Immediate and future opps)'
      const keywords = extractKeywords(title)

      // Should extract key company names and topics
      expect(keywords).toContain('matrix')
      expect(keywords).toContain('aileron')
      expect(keywords).toContain('group')
      expect(keywords).toContain('introductions')
      expect(keywords).toContain('immediate')
      expect(keywords).toContain('future')
      expect(keywords).toContain('opps')

      // Should filter out stop words
      expect(keywords).not.toContain('and')
      expect(keywords).not.toContain('the')
    })

    test('extracts from executive briefing title', () => {
      const title = 'HOLD: Aileron Executive Briefing - A smarter path to Generative AI in your business'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('hold')
      expect(keywords).toContain('aileron')
      expect(keywords).toContain('executive')
      expect(keywords).toContain('briefing')
      expect(keywords).toContain('generative')
      expect(keywords).toContain('business')

      // Stop words should be removed
      expect(keywords).not.toContain('a')
      expect(keywords).not.toContain('to')
      expect(keywords).not.toContain('in')
      expect(keywords).not.toContain('your')
    })

    test('extracts from meeting with multiple companies', () => {
      const title = 'Meeting with Aileron Group/NYL'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('aileron')
      expect(keywords).toContain('group')
      expect(keywords).toContain('nyl')

      // Stop words filtered
      expect(keywords).not.toContain('meeting')
      expect(keywords).not.toContain('with')
    })

    test('extracts from interview meeting', () => {
      const title = 'AI interview call with Aileron Group and Dev.Pro'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('interview')
      expect(keywords).toContain('aileron')
      expect(keywords).toContain('group')
      expect(keywords).toContain('dev')
      expect(keywords).toContain('pro')

      // Stop words filtered
      expect(keywords).not.toContain('call')
      expect(keywords).not.toContain('with')
      expect(keywords).not.toContain('and')
    })
  })

  describe('TC-KW-002: Filter out common stop words', () => {
    test('removes meeting-related stop words', () => {
      const title = 'Weekly Sync Meeting with Team Call'
      const keywords = extractKeywords(title)

      expect(keywords).not.toContain('meeting')
      expect(keywords).not.toContain('sync')
      expect(keywords).not.toContain('call')
      expect(keywords).not.toContain('weekly')
      expect(keywords).not.toContain('with')
    })

    test('removes common articles and prepositions', () => {
      const title = 'A review of the roadmap for Q4'
      const keywords = extractKeywords(title)

      expect(keywords).not.toContain('a')
      expect(keywords).not.toContain('the')
      expect(keywords).not.toContain('of')
      expect(keywords).not.toContain('for')

      // Should keep meaningful words
      expect(keywords).toContain('review')
      expect(keywords).toContain('roadmap')
    })

    test('removes catch up related terms', () => {
      const title = 'Catch up with team for weekly chat'
      const keywords = extractKeywords(title)

      expect(keywords).not.toContain('catch')
      expect(keywords).not.toContain('up')
      expect(keywords).not.toContain('catchup')
      expect(keywords).not.toContain('weekly')
      expect(keywords).not.toContain('chat')
      expect(keywords).not.toContain('with')
      expect(keywords).not.toContain('for')
    })

    test('removes 1:1 meeting terms', () => {
      const title = '1:1 meeting with manager'
      const keywords = extractKeywords(title)

      expect(keywords).not.toContain('1:1')
      expect(keywords).not.toContain('1-1')
      expect(keywords).not.toContain('meeting')
      expect(keywords).not.toContain('with')

      // Should extract meaningful word
      expect(keywords).toContain('manager')
    })
  })

  describe('TC-KW-003: Remove short words (< 3 chars)', () => {
    test('filters out words shorter than 3 characters', () => {
      const title = 'Q4 AI ML API review by IT at HQ'
      const keywords = extractKeywords(title)

      // 2-char words should be removed
      expect(keywords).not.toContain('q4')
      expect(keywords).not.toContain('ai')
      expect(keywords).not.toContain('ml')
      expect(keywords).not.toContain('by')
      expect(keywords).not.toContain('at')
      expect(keywords).not.toContain('it')
      expect(keywords).not.toContain('hq')

      // 3+ char words should be kept
      expect(keywords).toContain('api')
      expect(keywords).toContain('review')
    })

    test('keeps meaningful 3-character words', () => {
      const title = 'API for Dev Pro and ECA'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('api')
      expect(keywords).toContain('dev')
      expect(keywords).toContain('pro')
      expect(keywords).toContain('eca')

      // Stop words still filtered
      expect(keywords).not.toContain('for')
      expect(keywords).not.toContain('and')
    })
  })

  describe('TC-KW-004: Deduplicate keywords', () => {
    test('removes duplicate keywords', () => {
      const title = 'Aileron Aileron Group Meeting - Aileron Briefing'
      const keywords = extractKeywords(title)

      // Should only appear once
      const aileronCount = keywords.filter((k: string) => k === 'aileron').length
      expect(aileronCount).toBe(1)

      const groupCount = keywords.filter((k: string) => k === 'group').length
      expect(groupCount).toBe(1)
    })

    test('deduplication is case-insensitive', () => {
      const title = 'AILERON Aileron aileron Group'
      const keywords = extractKeywords(title)

      const aileronCount = keywords.filter((k: string) => k === 'aileron').length
      expect(aileronCount).toBe(1)
    })
  })

  describe('TC-KW-005: Handle empty/null titles', () => {
    test('returns empty array for null title', () => {
      const keywords = extractKeywords(null as any)
      expect(keywords).toEqual([])
    })

    test('returns empty array for undefined title', () => {
      const keywords = extractKeywords(undefined as any)
      expect(keywords).toEqual([])
    })

    test('returns empty array for empty string', () => {
      const keywords = extractKeywords('')
      expect(keywords).toEqual([])
    })

    test('returns empty array for whitespace-only string', () => {
      const keywords = extractKeywords('   ')
      expect(keywords).toEqual([])
    })

    test('handles title with only stop words', () => {
      const title = 'a meeting with the team for a chat'
      const keywords = extractKeywords(title)

      // All words are stop words, should return empty or very few
      expect(keywords.length).toBeLessThanOrEqual(1)
      expect(keywords).not.toContain('a')
      expect(keywords).not.toContain('meeting')
      expect(keywords).not.toContain('with')
      expect(keywords).not.toContain('the')
      expect(keywords).not.toContain('for')
      expect(keywords).not.toContain('chat')
    })
  })

  describe('TC-KW-006: Extract from technical meeting titles', () => {
    test('extracts location-based keywords', () => {
      const title = 'Union Square - Coffee Sandeep & Alejandro'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('union')
      expect(keywords).toContain('square')
      expect(keywords).toContain('coffee')
      expect(keywords).toContain('sandeep')
      expect(keywords).toContain('alejandro')
    })

    test('extracts from brainstorming meeting', () => {
      const title = 'Aileron and ECA direct brainstorming'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('aileron')
      expect(keywords).toContain('eca')
      expect(keywords).toContain('direct')
      expect(keywords).toContain('brainstorming')

      expect(keywords).not.toContain('and')
    })

    test('extracts from event title', () => {
      const title = 'Finovate/Happy Hour Regroup'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('finovate')
      expect(keywords).toContain('happy')
      expect(keywords).toContain('hour')
      expect(keywords).toContain('regroup')
    })
  })

  describe('TC-KW-007: Handle special characters and punctuation', () => {
    test('handles punctuation in titles', () => {
      const title = 'Matrix (Lior, CEO) + Aileron - Introductions!'
      const keywords = extractKeywords(title)

      // Punctuation should be removed
      expect(keywords).toContain('matrix')
      expect(keywords).toContain('lior')
      expect(keywords).toContain('ceo')
      expect(keywords).toContain('aileron')
      expect(keywords).toContain('introductions')

      // No punctuation in keywords
      keywords.forEach((keyword: string) => {
        expect(keyword).not.toMatch(/[(),.!?;:+\-]/)
      })
    })

    test('handles slash-separated terms', () => {
      const title = 'Meeting with Aileron Group/NYL'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('aileron')
      expect(keywords).toContain('group')
      expect(keywords).toContain('nyl')
    })

    test('handles ampersands', () => {
      const title = 'Sandeep & Alejandro coffee'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('sandeep')
      expect(keywords).toContain('alejandro')
      expect(keywords).toContain('coffee')
    })

    test('handles colons and dashes', () => {
      const title = 'HOLD: Executive Briefing - Generative AI'
      const keywords = extractKeywords(title)

      expect(keywords).toContain('hold')
      expect(keywords).toContain('executive')
      expect(keywords).toContain('briefing')
      expect(keywords).toContain('generative')
    })

    test('normalizes to lowercase', () => {
      const title = 'AILERON Executive BRIEFING'
      const keywords = extractKeywords(title)

      // All should be lowercase
      keywords.forEach((keyword: string) => {
        expect(keyword).toBe(keyword.toLowerCase())
      })

      expect(keywords).toContain('aileron')
      expect(keywords).toContain('executive')
      expect(keywords).toContain('briefing')
    })
  })

  describe('Real-World Examples from Analysis', () => {
    test('real meeting 1: Matrix + Aileron introductions', () => {
      const title = 'Matrix (Lior, CEO, Ronen Sales) + Aileron Group (Sandeep, Gil) - Introductions (Immediate and future opps)'
      const keywords = extractKeywords(title)

      // At least 10 meaningful keywords should be extracted
      expect(keywords.length).toBeGreaterThanOrEqual(10)

      // Key companies and topics present
      expect(keywords).toContain('matrix')
      expect(keywords).toContain('aileron')
      expect(keywords).toContain('introductions')
    })

    test('real meeting 2: Executive briefing on AI', () => {
      const title = 'HOLD: Aileron Executive Briefing - A smarter path to Generative AI in your business'
      const keywords = extractKeywords(title)

      // At least 5 meaningful keywords
      expect(keywords.length).toBeGreaterThanOrEqual(5)

      expect(keywords).toContain('aileron')
      expect(keywords).toContain('executive')
      expect(keywords).toContain('briefing')
      expect(keywords).toContain('generative')
    })

    test('real meeting 3: Simple company meeting', () => {
      const title = 'Meeting with Aileron Group/NYL'
      const keywords = extractKeywords(title)

      // Should extract all 3 company/group names
      expect(keywords.length).toBeGreaterThanOrEqual(3)

      expect(keywords).toContain('aileron')
      expect(keywords).toContain('group')
      expect(keywords).toContain('nyl')
    })

    test('real meeting 4: Person-only meeting', () => {
      const title = 'Weekly Sync with Trish'
      const keywords = extractKeywords(title)

      // Should extract person name even if generic meeting
      expect(keywords).toContain('trish')

      // Stop words removed
      expect(keywords).not.toContain('weekly')
      expect(keywords).not.toContain('sync')
      expect(keywords).not.toContain('with')
    })

    test('real meeting 5: Names-only meeting', () => {
      const title = 'Sandeep Mangaraj and Karan Bhalla'
      const keywords = extractKeywords(title)

      // Should extract all person names
      expect(keywords).toContain('sandeep')
      expect(keywords).toContain('mangaraj')
      expect(keywords).toContain('karan')
      expect(keywords).toContain('bhalla')

      // Stop word removed
      expect(keywords).not.toContain('and')
    })
  })

  describe('Performance and Edge Cases', () => {
    test('handles very long titles efficiently', () => {
      const title = 'A'.repeat(500) + ' Matrix Aileron ' + 'B'.repeat(500)
      const startTime = Date.now()
      const keywords = extractKeywords(title)
      const duration = Date.now() - startTime

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100)

      // Should still extract meaningful words
      expect(keywords).toContain('matrix')
      expect(keywords).toContain('aileron')
    })

    test('handles titles with many repeated words', () => {
      const title = 'meeting meeting meeting Aileron Aileron Group'
      const keywords = extractKeywords(title)

      // Should deduplicate
      expect(keywords.filter((k: string) => k === 'aileron').length).toBe(1)
      expect(keywords.filter((k: string) => k === 'group').length).toBe(1)

      // Stop words filtered
      expect(keywords).not.toContain('meeting')
    })

    test('handles unicode characters', () => {
      const title = 'Café meeting with José about München project'
      const keywords = extractKeywords(title)

      // Should handle unicode correctly
      expect(keywords).toContain('café')
      expect(keywords).toContain('josé')
      expect(keywords).toContain('münchen')
      expect(keywords).toContain('project')
    })

    test('handles numbers in titles', () => {
      const title = 'Q4 2024 Budget Review'
      const keywords = extractKeywords(title)

      // Numbers should be preserved if >= 3 chars
      expect(keywords).toContain('2024')
      expect(keywords).toContain('budget')
      expect(keywords).toContain('review')
    })
  })
})
