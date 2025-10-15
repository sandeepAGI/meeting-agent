/**
 * Keyword Extraction Utility
 * Phase 2.3-3: Meeting Intelligence
 *
 * Shared utility for extracting meaningful keywords from meeting titles.
 * Used by EmailContextService for two-tier email search and by test scripts
 * for validation.
 *
 * Ensures tests validate actual production code (no duplication).
 */

/**
 * Common stop words to filter out from meeting titles
 * Includes:
 * - Articles (a, an, the)
 * - Prepositions (of, on, in, at, by, for, from, to, with)
 * - Common verbs (are, be, has, is, was, will)
 * - Meeting-related terms (meeting, call, sync, chat)
 * - Frequency terms (weekly, daily, monthly)
 * - 1:1 variants (1:1, 1-1)
 * - Catch-up variants (catch, up, catchup)
 */
export const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'that',
  'the',
  'to',
  'was',
  'will',
  'with',
  'meeting',
  'call',
  'sync',
  'chat',
  '1:1',
  '1-1',
  'weekly',
  'daily',
  'monthly',
  'catch',
  'up',
  'catchup'
])

/**
 * Extract meaningful keywords from meeting title
 *
 * Process:
 * 1. Convert to lowercase for case-insensitive matching
 * 2. Remove special characters and punctuation
 * 3. Split into words
 * 4. Filter out short words (< 3 characters)
 * 5. Filter out stop words
 * 6. Deduplicate
 *
 * Examples:
 * - "Matrix + Aileron - Introductions" → ["matrix", "aileron", "introductions"]
 * - "Weekly Sync with Trish" → ["trish"]
 * - "Q4 Budget Review" → ["budget", "review"] (Q4 filtered as < 3 chars)
 *
 * @param title Meeting title
 * @returns Array of keywords (lowercase, deduplicated)
 */
export function extractKeywords(title: string): string[] {
  if (!title) return []

  // Normalize: lowercase, remove special chars, split on whitespace
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter((word) => word.length > 2) // Filter short words
    .filter((word) => !STOP_WORDS.has(word)) // Filter stop words

  // Deduplicate
  return [...new Set(words)]
}
