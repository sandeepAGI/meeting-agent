# Email Context Feature - Implementation and Deprecation

**Status**: Deprecated (January 2025)
**Reason**: No measurable value for speaker identification or meeting summarization
**Archived From**: Phase 2.3-3 (Meeting Intelligence Backend)

---

## Executive Summary

The email context feature was designed to enhance meeting intelligence by fetching recent emails related to meeting topics and participants. After implementing and testing, **we found no measurable value** from email context:

- LLMs prioritize transcript content over emails when speakers discuss their work
- Generic meeting titles ("Sync", "Weekly") produce poor keyword extraction
- Participant-based email search fetches mostly unrelated correspondence
- Calendar attendee lists create anchoring bias that emails cannot overcome
- Email context failed to correct wrong calendar data in testing

**Decision**: Remove email context entirely, rely on calendar metadata + transcript only.

---

## Original Design Intent

### Goals
1. **Improve speaker identification**: Use email communication patterns to identify speakers when transcript is ambiguous
2. **Add meeting context**: Provide background on topics discussed during the meeting
3. **Enhance accuracy**: Supplement calendar attendee lists with actual communication evidence

### Implementation Overview

**Two-Tier Email Search**:
- **TIER 1**: Topic-relevant emails (search by meeting title keywords)
- **TIER 2**: Participant emails (recent correspondence from/to attendees)
- **Limit**: 10 emails total, 2000 chars per email body
- **Caching**: 7-day cache to avoid redundant Graph API calls

**Keyword Extraction**:
```typescript
// src/services/emailContext.ts:134-158
export function extractKeywords(meetingSubject: string): string[] {
  const stopWords = new Set([
    'meeting', 'call', 'sync', 'standup', 'weekly', 'monthly', 'quarterly',
    'team', 'group', 'discussion', 'chat', 'catchup', 'touch', 'base',
    'update', 'review', 'check', 'follow', 'followup', 'status'
  ])

  const words = meetingSubject
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word))

  return [...new Set(words)]
}
```

**Email Formatting for LLM**:
```typescript
From: ${email.from.name} <${email.from.email}>
To: ${recipients}
Date: ${formatDate(email.receivedDateTime)}
Subject: ${email.subject}

${stripHtml(email.body?.content || '', 2000)}
```

---

## Technical Implementation

### Files Implemented

1. **src/services/emailContext.ts** (371 lines)
   - `EmailContextService` class
   - Graph API integration for email search
   - Keyword extraction with stop words
   - HTML stripping with character limits
   - Two-tier search (topic + participant)
   - 7-day cache management

2. **src/database/schema.sql** (email_context_cache table)
   ```sql
   CREATE TABLE IF NOT EXISTS email_context_cache (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     meeting_id TEXT NOT NULL UNIQUE,
     emails_json TEXT NOT NULL,
     fetched_at DATETIME NOT NULL,
     expires_at DATETIME NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **src/services/database.ts** (cache methods)
   - `getEmailContextFromCache(meetingId)`
   - `saveEmailContextToCache(meetingId, emails)`
   - `cleanupExpiredEmailCache()`

4. **src/services/meetingIntelligence.ts** (email integration)
   - Email fetching in `processMeetingSummary()`
   - Email context passed to both Pass 1 and Pass 2 prompts

5. **src/prompts/pass1-summary.txt** (lines 11-17)
   ```
   RECENT EMAIL CONTEXT (to understand participant dynamics):
   {{emailContext}}

   INSTRUCTIONS:
   1. **Identify Speakers**: Match SPEAKER_00, SPEAKER_01, etc. to actual attendees
      - Use conversation content, topics discussed, roles mentioned, language patterns
      - Use email context for communication patterns and relationships
   ```

6. **src/prompts/pass2-validation.txt** (similar email context section)

### Dependencies Added

- Microsoft Graph API SDK: `@microsoft/microsoft-graph-client@3.0.7`
- Already had authentication: `@azure/msal-node@3.8.0`

### Test Infrastructure

**Test Scripts**:
- `scripts/fetch-calendar-metadata.ts` - Manual email fetch testing
- `scripts/test-full-pipeline.ts` - E2E test with email metrics
- `tests/fixtures/manual-e2e/` - Test data with calendar + transcript

**Test Results**:
- `test-c200-report.txt` - C200 presentation meeting
- `test-sync3-report.txt` - NYL Treasury sync meeting

---

## Test Results and Findings

### Test 1: C200 Meeting ("Sync on C200")

**Setup**:
- Meeting title: "Sync on C200"
- Actual participants: Brigid McDermott + Sandeep Mangaraj
- **Calendar data provided**: Clare Gorman + Sandeep (WRONG meeting, intentional test)

**Email Search Results**:
- Keywords extracted: `["c200"]`
- 10 emails fetched (all TIER 2 - participant emails)
- No emails from/to Brigid McDermott
- Emails about: Melissa meetings, NDAs, SharePoint tasks, HARO spam

**Speaker Identification Result**:
- ❌ SPEAKER_00 identified as "Clare Gorman" (WRONG - should be Brigid McDermott)
- ✅ SPEAKER_01 identified as "Sandeep Mangaraj" (correct)

**LLM Reasoning**:
```
SPEAKER_00 → Clare Gorman
Reasoning: Referenced leading financial services at Bolt, being a senior advisor
with Aileron Group, and selling the first Watson deal in financial services.
Also mentioned having a board-level background and programming in Lisp, indicating
extensive technical and business experience consistent with a HubSpot role.
```

**Analysis**:
- LLM anchored on wrong calendar attendee (Clare Gorman)
- Email context provided NO correction (no Brigid emails)
- Reasoning 100% based on transcript content (Bolt, Watson, Lisp mentioned in conversation)
- **Email context failed to prevent false positive**

### Test 2: Sync #3 Meeting

**Setup**:
- Meeting title: "Sync #3"
- Actual participants: Gil Brodnitz, Ojas Patel, Sandeep Mangaraj
- Calendar data: Correct attendees provided

**Email Search Results**:
- Keywords extracted: `[]` (empty - "sync" is stop word, "#3" filtered)
- 10 emails fetched (all TIER 2 - participant emails only)
- Emails about: Melissa meetings, NDAs, SharePoint, HARO spam (same as C200!)

**Speaker Identification Result**:
- ✅ All 3 speakers identified correctly (Gil, Ojas, Sandeep)

**LLM Reasoning**:
- Zero references to email context in any reasoning
- 100% based on transcript (travel logistics, speaking roles, meeting prep discussion)

**Analysis**:
- Generic meeting title → No keywords → Only participant emails
- Transcript was self-sufficient (speakers discussed their roles and expertise)
- Email context ignored by LLM when transcript is rich
- **Email context provided zero value**

### Test 3: Email Relevance Assessment

**C200 Emails** (meeting about C200 presentation):
1. SharePoint task notification (noise)
2. HARO spam (noise)
3. "Fw: NDA" (unrelated)
4. "Fw: Follow up" (unrelated)
5. "Re: Follow up" (unrelated)
6. "Melissa - 25 minutes meeting" (unrelated)
7. "New booking: Melissa..." (unrelated)
8. "Re: Melissa - 25 minutes meeting" (unrelated)
9. "Re: Providing Example for AI Webinar?" (unrelated)
10. "Re: Melissa - 25 minutes meeting" (unrelated)

**Relevance**: 0/10 emails related to C200 presentation

**Sync #3 Emails** (meeting about NYL Treasury presentation):
- Identical email list (same participants, same date range)
- Relevance: 0/10 emails related to NYL Treasury

**Conclusion**: Poor topic alignment due to generic meeting titles + recent correspondence bias.

---

## Lessons Learned

### What Worked

1. **Technical Implementation**:
   - Graph API integration reliable
   - Caching reduced redundant calls effectively
   - Keyword extraction reasonable for well-named meetings
   - HTML stripping and truncation prevented prompt bloat

2. **Architecture**:
   - Clean separation (EmailContextService)
   - Database caching pattern reusable
   - Two-tier search concept sound in theory

### What Didn't Work

1. **LLM Behavior**:
   - **Transcript prioritization**: When speakers discuss their work, LLMs ignore emails
   - **Anchoring bias**: Calendar attendees create strong prior that emails can't override
   - **Prompt compliance**: Instruction to "use email context" weakly followed

2. **Email Search Quality**:
   - **Generic titles**: "Sync", "Weekly", "Standup" produce no keywords
   - **Participant bias**: TIER 2 emails dominate, often unrelated to meeting topic
   - **Recency bias**: Recent emails ≠ relevant emails
   - **Topic drift**: Same participants discuss many topics, emails fetch random subset

3. **Value Proposition**:
   - **No correction ability**: Emails couldn't fix wrong calendar data (C200 test)
   - **No enhancement**: Perfect results achieved without emails (Sync #3 test)
   - **Noise > Signal**: 0-10% relevant emails in test cases

### Cost-Benefit Analysis

**Costs**:
- ~800ms latency per meeting (Graph API call)
- ~2KB prompt size (10 emails × 200 chars average)
- Code complexity (371 lines + database table + IPC handlers)
- Cache management overhead

**Benefits**:
- ❌ Did not improve speaker identification
- ❌ Did not add useful meeting context
- ❌ Did not correct calendar errors
- ❌ Did not enhance summary quality

**ROI**: Negative. Pure cost, zero benefit.

---

## When Email Context MIGHT Work

Based on this analysis, email context could theoretically help in these scenarios:

1. **Low-quality transcripts**:
   - Poor audio quality → Sparse conversation
   - Speakers don't discuss their roles or expertise
   - Need external signals to identify speakers

2. **Well-named meetings with specific topics**:
   - "Q4 Budget Review" → Keywords: budget, Q4, quarterly, financial
   - "Product Launch Planning" → Keywords: product, launch, planning
   - Strong keywords → Better TIER 1 email search

3. **Email-heavy work cultures**:
   - Teams that extensively document decisions via email
   - Email threads reference meeting outcomes
   - Strong correlation between emails and meeting topics

4. **Weaker prompt compliance**:
   - Different LLM models might use email context more aggressively
   - Prompt engineering could force email citation
   - Current Claude behavior: de-prioritizes emails when transcript is rich

**Reality**: None of these apply to target use case (internal business meetings with generic titles).

---

## Alternative Approaches (Not Pursued)

1. **Improve Keyword Extraction**:
   - Use LLM to extract topics from meeting titles
   - Expand stop word list more aggressively
   - Weight TIER 1 emails higher in prompt

2. **Stronger Prompt Engineering**:
   - Require LLM to cite email evidence
   - Penalize answers without email references
   - Format emails more prominently in prompt

3. **Pre-meeting Email Summary**:
   - Use LLM to summarize email context separately
   - Feed summary instead of raw emails to main prompt
   - Reduce prompt size, increase signal

4. **Selective Email Fetching**:
   - Only fetch emails for ambiguous speakers
   - Skip email search if calendar confidence is high
   - Adaptive strategy based on transcript quality

**Why not pursued**: Fundamental issue is **transcript sufficiency**. Adding complexity doesn't solve root problem.

---

## Deprecation Plan

### Phase 1: Documentation (✅ Completed)
- Create this archive document
- Capture implementation details
- Document test results and findings
- Preserve lessons learned

### Phase 2: Code Removal
1. Remove email context from prompts:
   - `src/prompts/pass1-summary.txt`
   - `src/prompts/pass2-validation.txt`

2. Remove email fetching from MeetingIntelligenceService:
   - `src/services/meetingIntelligence.ts:99-122`

3. Archive EmailContextService:
   - Move to `docs/archive/code/emailContext.ts`

4. Remove database table (optional - leave for now):
   - `email_context_cache` can remain for potential future use
   - Clean up with migration if needed

5. Remove IPC handlers (if any):
   - Search for `email-context` handlers in main process

6. Remove from test scripts:
   - Update `test-full-pipeline.ts` to skip email metrics
   - Keep test infrastructure for potential future use

### Phase 3: Testing
1. Run E2E tests without email context
2. Verify speaker identification still works
3. Compare summary quality before/after
4. Ensure no regressions

### Phase 4: Documentation Updates
1. Update CHANGELOG.md (deprecation notice)
2. Update CLAUDE.md (remove email context from current status)
3. Update README.md (remove email context from features)
4. Update docs/developer/architecture.md (remove EmailContextService)

---

## Code Archive

### EmailContextService (src/services/emailContext.ts)

```typescript
/**
 * Email Context Service - DEPRECATED
 *
 * This service fetched recent emails to provide context for meeting intelligence.
 * After testing, we found no measurable value from email context.
 *
 * Deprecated: January 2025
 * Reason: LLMs prioritize transcript content, emails add noise without benefit
 *
 * See: docs/archive/email-context-deprecation.md
 */

import { Client } from '@microsoft/microsoft-graph-client'
import type { Message } from '@microsoft/microsoft-graph-types'

export interface EmailSearchResult {
  id: string
  subject: string
  from: {
    name: string
    email: string
  }
  toRecipients: Array<{ name: string; email: string }>
  receivedDateTime: string
  body: {
    content: string
    contentType: string
  }
}

export class EmailContextService {
  constructor(private graphClient: Client) {}

  /**
   * Fetch emails relevant to a meeting
   * Two-tier approach:
   *   TIER 1: Topic-relevant emails (search by keywords)
   *   TIER 2: Participant emails (recent correspondence)
   */
  async fetchEmailContext(
    meetingSubject: string,
    attendeeEmails: string[],
    meetingDate: Date,
    maxEmails: number = 10
  ): Promise<EmailSearchResult[]> {
    const keywords = extractKeywords(meetingSubject)
    const dateRange = getEmailDateRange(meetingDate)

    let emails: EmailSearchResult[] = []

    // TIER 1: Topic-relevant emails
    if (keywords.length > 0) {
      const topicQuery = buildTopicSearchQuery(keywords, dateRange)
      const topicEmails = await this.searchEmails(topicQuery, maxEmails)
      emails.push(...topicEmails)
    }

    // TIER 2: Participant emails (fill remainder)
    if (emails.length < maxEmails && attendeeEmails.length > 0) {
      const remaining = maxEmails - emails.length
      const participantQuery = buildParticipantSearchQuery(attendeeEmails, dateRange)
      const participantEmails = await this.searchEmails(participantQuery, remaining)

      // Deduplicate by ID
      const existingIds = new Set(emails.map(e => e.id))
      const newEmails = participantEmails.filter(e => !existingIds.has(e.id))
      emails.push(...newEmails)
    }

    return emails.slice(0, maxEmails)
  }

  private async searchEmails(query: string, limit: number): Promise<EmailSearchResult[]> {
    try {
      const result = await this.graphClient
        .api('/me/messages')
        .filter(query)
        .select('id,subject,from,toRecipients,receivedDateTime,body')
        .top(limit)
        .orderby('receivedDateTime DESC')
        .get()

      return result.value.map(normalizeEmail)
    } catch (error) {
      console.error('Email search failed:', error)
      return []
    }
  }
}

/**
 * Extract meaningful keywords from meeting subject
 * Filters out stop words like "meeting", "sync", "weekly"
 */
export function extractKeywords(meetingSubject: string): string[] {
  const stopWords = new Set([
    'meeting', 'call', 'sync', 'standup', 'weekly', 'monthly', 'quarterly',
    'team', 'group', 'discussion', 'chat', 'catchup', 'touch', 'base',
    'update', 'review', 'check', 'follow', 'followup', 'status',
    'the', 'and', 'for', 'with', 'on', 'in', 'to', 'of', 'a', 'an'
  ])

  const words = meetingSubject
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word))

  return [...new Set(words)]
}

/**
 * Strip HTML tags and limit character length
 */
export function stripHtml(html: string, maxLength: number = 2000): string {
  const text = html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > maxLength
    ? text.substring(0, maxLength) + '...'
    : text
}

/**
 * Format emails for LLM prompt
 */
export function formatEmailsForPrompt(emails: EmailSearchResult[]): string {
  if (emails.length === 0) {
    return 'No relevant emails found.'
  }

  return emails.map(email => {
    const recipients = email.toRecipients
      .map(r => `${r.name} <${r.email}>`)
      .join(', ')

    const date = new Date(email.receivedDateTime).toLocaleDateString()
    const body = stripHtml(email.body?.content || '', 2000)

    return `
From: ${email.from.name} <${email.from.email}>
To: ${recipients}
Date: ${date}
Subject: ${email.subject}

${body}
---`.trim()
  }).join('\n\n')
}

// Helper functions (buildTopicSearchQuery, buildParticipantSearchQuery, etc.)
// ... (full implementation available in git history)
```

### Database Schema

```sql
-- Email context cache table (DEPRECATED)
CREATE TABLE IF NOT EXISTS email_context_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL UNIQUE,
  emails_json TEXT NOT NULL,       -- Array of EmailSearchResult
  fetched_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,    -- 7 days from fetched_at
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_cache_meeting ON email_context_cache(meeting_id);
CREATE INDEX IF NOT EXISTS idx_email_cache_expires ON email_context_cache(expires_at);
```

### Prompt Template (Pass 1)

```
CALENDAR MEETING METADATA:
- Subject: {{meetingSubject}}
- Date: {{meetingDate}}
- Attendees: {{attendeeList}}

RECENT EMAIL CONTEXT (to understand participant dynamics):
{{emailContext}}

TRANSCRIPT:
{{transcript}}

INSTRUCTIONS:
1. **Identify Speakers**: Match SPEAKER_00, SPEAKER_01, etc. to actual attendees
   - Use conversation content, topics discussed, roles mentioned, language patterns
   - Use email context for communication patterns and relationships
   - ...
```

**What changed after removal**: Removed `RECENT EMAIL CONTEXT` section entirely.

---

## Future Considerations

If email context is needed in the future, consider:

1. **Different use case**: Customer support meetings where emails are pre-meeting context
2. **Better search**: Use LLM to extract topics, then search emails
3. **Hybrid approach**: Only fetch emails for low-confidence speaker matches
4. **Email summarization**: Use LLM to summarize emails before adding to prompt
5. **Citation requirement**: Force LLM to cite email sources in reasoning

---

## References

- Original implementation: Phase 2.3-3 (December 2024 - January 2025)
- Test results: `test-c200-report.txt`, `test-sync3-report.txt`
- Git history: Search for "email context" commits
- Related docs: `docs/testing/email-search-test-plan.md`

---

**Last Updated**: January 2025
**Maintained By**: Sandeep Mangaraj
**Status**: Archived - Feature removed from production
