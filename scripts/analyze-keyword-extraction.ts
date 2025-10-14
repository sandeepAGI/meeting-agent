/**
 * Analyze Keyword Extraction
 *
 * Tests the keyword extraction logic against real meeting titles
 * from the fetched calendar data. Validates that our stop words,
 * short word filtering, and topic extraction work correctly.
 *
 * Usage:
 *   npx ts-node scripts/analyze-keyword-extraction.ts
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Stop words (same as EmailContextService)
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'meeting', 'call', 'sync', 'chat',
  '1:1', '1-1', 'weekly', 'daily', 'monthly', 'catch', 'up', 'catchup'
])

interface MeetingData {
  id: string
  subject: string
  startTime: string
  endTime: string
  organizer: {
    name: string
    email: string
  }
  attendees: Array<{
    name: string
    email: string
    type: string
  }>
  location?: string
  isOnlineMeeting: boolean
}

interface TestMeetingsData {
  fetchedAt: string
  totalMeetings: number
  categories: {
    technical: MeetingData[]
    business: MeetingData[]
    generic: MeetingData[]
    edgeCases: MeetingData[]
  }
}

interface KeywordAnalysis {
  subject: string
  attendeeCount: number
  keywords: string[]
  stopWordsRemoved: string[]
  expectedTopics: string[]
  evaluation: 'Good' | 'Needs Review' | 'Poor'
  notes: string
}

/**
 * Extract keywords from meeting title (matching EmailContextService logic)
 */
function extractKeywords(title: string): string[] {
  if (!title) return []

  // Normalize: lowercase, remove special chars, split on whitespace
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => word.length > 2) // Filter short words
    .filter(word => !STOP_WORDS.has(word)) // Filter stop words

  // Deduplicate
  return [...new Set(words)]
}

/**
 * Identify stop words that were removed
 */
function identifyStopWords(title: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0)

  return words.filter(word => STOP_WORDS.has(word))
}

/**
 * Evaluate keyword extraction quality
 */
function evaluateExtraction(subject: string, keywords: string[]): {
  evaluation: 'Good' | 'Needs Review' | 'Poor'
  notes: string
  expectedTopics: string[]
} {
  const lower = subject.toLowerCase()

  // Manual evaluation based on meeting type
  let expectedTopics: string[] = []
  let evaluation: 'Good' | 'Needs Review' | 'Poor' = 'Good'
  let notes = ''

  // Check for known business topics
  if (lower.includes('budget') || lower.includes('planning') || lower.includes('roadmap')) {
    expectedTopics = ['budget', 'planning', 'roadmap'].filter(t => lower.includes(t))
    if (keywords.some(k => expectedTopics.includes(k))) {
      evaluation = 'Good'
      notes = 'Business topic keywords extracted correctly'
    } else {
      evaluation = 'Poor'
      notes = `Expected keywords ${expectedTopics.join(', ')} but got ${keywords.join(', ')}`
    }
  }
  // Check for company/client names
  else if (lower.includes('aileron') || lower.includes('matrix') || lower.includes('nyl')) {
    expectedTopics = ['aileron', 'matrix', 'nyl'].filter(t => lower.includes(t))
    if (keywords.some(k => expectedTopics.includes(k))) {
      evaluation = 'Good'
      notes = 'Company/client keywords extracted'
    }
  }
  // Generic sync meetings
  else if (lower.match(/sync|catch|weekly|daily/)) {
    expectedTopics = []
    if (keywords.length === 0) {
      evaluation = 'Good'
      notes = 'Generic sync - correctly filtered all stop words'
    } else {
      evaluation = 'Needs Review'
      notes = `Generic sync but extracted: ${keywords.join(', ')}`
    }
  }
  // Person names only
  else if (lower.match(/\w+\s+\w+\s+(and|&)\s+\w+\s+\w+/)) {
    expectedTopics = []
    evaluation = 'Needs Review'
    notes = 'Meeting with person names only - may extract names as keywords'
  }
  // Edge cases
  else if (keywords.length === 0) {
    evaluation = 'Needs Review'
    notes = 'No keywords extracted - may be too generic'
  } else {
    evaluation = 'Good'
    notes = 'Keywords extracted successfully'
  }

  return { evaluation, notes, expectedTopics }
}

function main() {
  console.log('=== Keyword Extraction Analysis ===\n')

  // 1. Load meetings data
  const fixturesPath = join(__dirname, '..', 'tests', 'fixtures', 'real-meetings.json')
  const data: TestMeetingsData = JSON.parse(readFileSync(fixturesPath, 'utf-8'))

  console.log(`Loaded ${data.totalMeetings} meetings`)
  console.log(`Fetched at: ${new Date(data.fetchedAt).toLocaleString()}\n`)

  // 2. Filter to meetings with >2 participants
  const allMeetings = [
    ...data.categories.technical,
    ...data.categories.business,
    ...data.categories.generic,
    ...data.categories.edgeCases
  ]

  const multiParticipantMeetings = allMeetings.filter(m => m.attendees.length > 2)

  console.log(`Filtered to ${multiParticipantMeetings.length} meetings with >2 participants\n`)
  console.log('---\n')

  // 3. Analyze keyword extraction for each
  const analyses: KeywordAnalysis[] = []

  for (const meeting of multiParticipantMeetings) {
    const keywords = extractKeywords(meeting.subject)
    const stopWordsRemoved = identifyStopWords(meeting.subject)
    const { evaluation, notes, expectedTopics } = evaluateExtraction(meeting.subject, keywords)

    analyses.push({
      subject: meeting.subject,
      attendeeCount: meeting.attendees.length,
      keywords,
      stopWordsRemoved,
      expectedTopics,
      evaluation,
      notes
    })
  }

  // 4. Print analysis results
  console.log('## Keyword Extraction Analysis Results\n')

  // Group by evaluation
  const good = analyses.filter(a => a.evaluation === 'Good')
  const needsReview = analyses.filter(a => a.evaluation === 'Needs Review')
  const poor = analyses.filter(a => a.evaluation === 'Poor')

  console.log(`✅ Good: ${good.length}`)
  console.log(`⚠️  Needs Review: ${needsReview.length}`)
  console.log(`❌ Poor: ${poor.length}\n`)

  // Show examples from each category
  console.log('### ✅ Good Examples (showing first 10)\n')
  good.slice(0, 10).forEach(a => {
    console.log(`**"${a.subject}"** (${a.attendeeCount} attendees)`)
    console.log(`  Keywords: [${a.keywords.join(', ')}]`)
    console.log(`  Stop words removed: [${a.stopWordsRemoved.join(', ')}]`)
    console.log(`  ${a.notes}\n`)
  })

  console.log('### ⚠️  Needs Review (all)\n')
  needsReview.forEach(a => {
    console.log(`**"${a.subject}"** (${a.attendeeCount} attendees)`)
    console.log(`  Keywords: [${a.keywords.join(', ')}]`)
    console.log(`  Stop words removed: [${a.stopWordsRemoved.join(', ')}]`)
    console.log(`  ${a.notes}\n`)
  })

  console.log('### ❌ Poor (all)\n')
  poor.forEach(a => {
    console.log(`**"${a.subject}"** (${a.attendeeCount} attendees)`)
    console.log(`  Keywords extracted: [${a.keywords.join(', ')}]`)
    console.log(`  Expected: [${a.expectedTopics.join(', ')}]`)
    console.log(`  ${a.notes}\n`)
  })

  // 5. Summary statistics
  console.log('---\n')
  console.log('## Summary Statistics\n')
  console.log(`Total meetings analyzed: ${analyses.length}`)
  console.log(`Average keywords per meeting: ${(analyses.reduce((sum, a) => sum + a.keywords.length, 0) / analyses.length).toFixed(1)}`)
  console.log(`Meetings with 0 keywords: ${analyses.filter(a => a.keywords.length === 0).length}`)
  console.log(`Meetings with 1-2 keywords: ${analyses.filter(a => a.keywords.length >= 1 && a.keywords.length <= 2).length}`)
  console.log(`Meetings with 3+ keywords: ${analyses.filter(a => a.keywords.length >= 3).length}`)

  console.log('\n---\n')
  console.log('✅ Analysis complete!')
  console.log('\nNext steps:')
  console.log('1. Review "Needs Review" and "Poor" examples')
  console.log('2. Adjust stop words list if needed')
  console.log('3. Create unit tests based on "Good" examples')
}

// Run
main()
