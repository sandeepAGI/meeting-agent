# Email Search Testing Plan
## Two-Tier Topic Prioritization - Critical Functionality Test

**Purpose**: Validate that email search correctly extracts keywords, prioritizes topic-relevant emails, and includes proper context in LLM prompts.

**Scope**: Unit tests, integration tests, and end-to-end validation of email context functionality.

---

## 1. Test Data Collection

### 1.1 Fetch Real Meeting Invites
**Goal**: Collect diverse real-world meeting titles for testing

**Method**:
```bash
# Fetch last 30 days of meetings
# Look for variety in:
# - Technical meetings (e.g., "API Architecture Review")
# - Business meetings (e.g., "Q4 Budget Planning")
# - 1:1s (e.g., "Weekly 1:1 with John")
# - Recurring meetings (e.g., "Daily Standup")
# - Generic meetings (e.g., "Catch up")
```

**Expected Diversity**:
- [ ] Technical/Engineering topics
- [ ] Business/Planning topics
- [ ] Generic/Social topics
- [ ] Single-word titles
- [ ] Multi-word titles
- [ ] Titles with special characters
- [ ] Recurring meeting patterns

### 1.2 Create Test Dataset
Store sanitized meeting titles in `tests/fixtures/meeting-titles.json`:
```json
{
  "technical": [
    "API Architecture Review Q4 2024",
    "Database Migration Planning",
    "React Component Refactoring Discussion"
  ],
  "business": [
    "Q4 Budget Review with Finance",
    "Quarterly Planning Session",
    "Product Roadmap Sync"
  ],
  "generic": [
    "Weekly 1:1",
    "Team Lunch",
    "Catch up",
    "Sync"
  ],
  "edge_cases": [
    "Meeting",
    "Call",
    "1:1 🎯",
    "",
    "Re: Re: Fwd: Important"
  ]
}
```

---

## 2. Unit Tests

### 2.1 Keyword Extraction Tests
**File**: `tests/unit/emailContext.test.ts`

**Test Cases**:

#### TC-KW-001: Basic Keyword Extraction
```typescript
describe('extractKeywords', () => {
  test('extracts meaningful keywords from technical meeting', () => {
    const title = "API Architecture Review Q4 2024"
    const keywords = service.extractKeywords(title)

    expect(keywords).toContain('api')
    expect(keywords).toContain('architecture')
    expect(keywords).toContain('review')
    expect(keywords).toContain('2024')
    expect(keywords).not.toContain('the')  // stop word
    expect(keywords).not.toContain('and')  // stop word
  })
})
```

#### TC-KW-002: Stop Words Filtering
```typescript
test('filters common stop words', () => {
  const title = "Meeting with the team about and for the project"
  const keywords = service.extractKeywords(title)

  expect(keywords).not.toContain('meeting')  // stop word
  expect(keywords).not.toContain('with')     // stop word
  expect(keywords).not.toContain('the')      // stop word
  expect(keywords).not.toContain('and')      // stop word
  expect(keywords).not.toContain('for')      // stop word
  expect(keywords).toContain('team')
  expect(keywords).toContain('project')
})
```

#### TC-KW-003: Short Word Filtering
```typescript
test('filters words shorter than 3 characters', () => {
  const title = "Q4 API DB Review to do at 2pm"
  const keywords = service.extractKeywords(title)

  expect(keywords).not.toContain('to')   // 2 chars
  expect(keywords).not.toContain('do')   // 2 chars
  expect(keywords).not.toContain('at')   // 2 chars
  expect(keywords).toContain('api')      // 3 chars (OK)
  expect(keywords).toContain('review')   // > 3 chars
})
```

#### TC-KW-004: Special Characters
```typescript
test('handles special characters correctly', () => {
  const title = "Re: Q4 Budget Review [URGENT] (Finance Team)"
  const keywords = service.extractKeywords(title)

  expect(keywords).toContain('budget')
  expect(keywords).toContain('review')
  expect(keywords).toContain('urgent')
  expect(keywords).toContain('finance')
  expect(keywords).toContain('team')
})
```

#### TC-KW-005: Deduplication
```typescript
test('deduplicates repeated keywords', () => {
  const title = "Budget Review Meeting Budget Planning Review"
  const keywords = service.extractKeywords(title)

  const budgetCount = keywords.filter(k => k === 'budget').length
  const reviewCount = keywords.filter(k => k === 'review').length

  expect(budgetCount).toBe(1)
  expect(reviewCount).toBe(1)
})
```

#### TC-KW-006: Empty/Null Input
```typescript
test('handles empty input gracefully', () => {
  expect(service.extractKeywords('')).toEqual([])
  expect(service.extractKeywords(null as any)).toEqual([])
  expect(service.extractKeywords(undefined as any)).toEqual([])
})
```

#### TC-KW-007: Case Insensitivity
```typescript
test('converts to lowercase consistently', () => {
  const title = "API Architecture REVIEW Q4"
  const keywords = service.extractKeywords(title)

  expect(keywords).toContain('api')
  expect(keywords).toContain('architecture')
  expect(keywords).toContain('review')
  expect(keywords).not.toContain('API')  // uppercase
  expect(keywords).not.toContain('REVIEW')
})
```

---

### 2.2 Email Formatting Tests
**File**: `tests/unit/emailFormatting.test.ts`

#### TC-FMT-001: Single Email Formatting
```typescript
test('formats single email correctly for prompt', () => {
  const email: EmailContext = {
    id: '1',
    subject: 'Q4 Budget Discussion',
    from: { name: 'Alice', email: 'alice@company.com' },
    to: [{ name: 'Bob', email: 'bob@company.com' }],
    receivedDateTime: '2024-10-10T10:00:00Z',
    truncatedBody: 'Hi Bob, let\'s discuss the Q4 budget...',
    bodyPreview: 'Hi Bob...',
    hasAttachments: false
  }

  const formatted = service.formatEmailsForPrompt([email])

  expect(formatted).toContain('Q4 Budget Discussion')
  expect(formatted).toContain('Alice <alice@company.com>')
  expect(formatted).toContain('Bob <bob@company.com>')
  expect(formatted).toContain('let\'s discuss the Q4 budget')
})
```

#### TC-FMT-002: Multiple Emails Separation
```typescript
test('separates multiple emails with delimiter', () => {
  const emails = [email1, email2, email3]
  const formatted = service.formatEmailsForPrompt(emails)

  const separatorCount = (formatted.match(/---/g) || []).length
  expect(separatorCount).toBe(2)  // n-1 separators for n emails
})
```

#### TC-FMT-003: Empty Email List
```typescript
test('handles empty email list', () => {
  const formatted = service.formatEmailsForPrompt([])
  expect(formatted).toBe('No recent email context available.')
})
```

---

## 3. Integration Tests

### 3.1 Two-Tier Search Tests
**File**: `tests/integration/emailSearch.test.ts`

**Setup**: Mock Microsoft Graph API responses

#### TC-SEARCH-001: TIER 1 Priority
```typescript
test('prioritizes topic-relevant emails in TIER 1', async () => {
  // Mock Graph API responses
  const mockTopicEmails = [
    { id: '1', subject: 'Q4 Budget Planning' },
    { id: '2', subject: 'Budget Review Notes' }
  ]
  const mockParticipantEmails = [
    { id: '3', subject: 'Lunch plans' },
    { id: '4', subject: 'Team outing' }
  ]

  mockGraphClient
    .mockReturnValueOnce(mockTopicEmails)  // TIER 1 call
    .mockReturnValueOnce(mockParticipantEmails)  // TIER 2 call

  const emails = await service.getEmailsForMeeting(
    'meeting-1',
    ['alice@company.com'],
    { maxEmails: 4 },
    'Q4 Budget Review'
  )

  // TIER 1 emails should come first
  expect(emails[0].subject).toBe('Q4 Budget Planning')
  expect(emails[1].subject).toBe('Budget Review Notes')
  expect(emails[2].subject).toBe('Lunch plans')
  expect(emails[3].subject).toBe('Team outing')
})
```

#### TC-SEARCH-002: Deduplication Between Tiers
```typescript
test('deduplicates emails between TIER 1 and TIER 2', async () => {
  const mockTopicEmails = [
    { id: '1', subject: 'Q4 Budget Planning' },
    { id: '2', subject: 'Budget Review' }
  ]
  const mockParticipantEmails = [
    { id: '2', subject: 'Budget Review' },  // Duplicate!
    { id: '3', subject: 'Lunch plans' }
  ]

  mockGraphClient
    .mockReturnValueOnce(mockTopicEmails)
    .mockReturnValueOnce(mockParticipantEmails)

  const emails = await service.getEmailsForMeeting(
    'meeting-1',
    ['alice@company.com'],
    { maxEmails: 10 },
    'Q4 Budget Review'
  )

  const ids = emails.map(e => e.id)
  const uniqueIds = new Set(ids)

  expect(ids.length).toBe(uniqueIds.size)  // No duplicates
  expect(emails.length).toBe(3)  // Only unique emails
})
```

#### TC-SEARCH-003: Max Emails Limit
```typescript
test('respects maxEmails limit across both tiers', async () => {
  const mockTopicEmails = Array(8).fill(null).map((_, i) => ({
    id: `topic-${i}`,
    subject: `Budget email ${i}`
  }))

  const emails = await service.getEmailsForMeeting(
    'meeting-1',
    ['alice@company.com'],
    { maxEmails: 5 },
    'Budget Review'
  )

  expect(emails.length).toBeLessThanOrEqual(5)
})
```

#### TC-SEARCH-004: Fallback When No Keywords
```typescript
test('falls back to participant-only search when no keywords', async () => {
  const mockParticipantEmails = [
    { id: '1', subject: 'Email 1' },
    { id: '2', subject: 'Email 2' }
  ]

  mockGraphClient.mockReturnValueOnce(mockParticipantEmails)

  const emails = await service.getEmailsForMeeting(
    'meeting-1',
    ['alice@company.com'],
    { maxEmails: 10 },
    'Weekly Sync'  // All stop words - no keywords extracted
  )

  expect(emails.length).toBe(2)
  // Should skip TIER 1, go straight to TIER 2
})
```

#### TC-SEARCH-005: Cache Hit
```typescript
test('returns cached emails when available', async () => {
  const cachedEmails = [{ id: '1', subject: 'Cached email' }]
  mockDb.getCachedEmails.mockReturnValue(cachedEmails)

  const emails = await service.getEmailsForMeeting(
    'meeting-1',
    ['alice@company.com'],
    undefined,
    'Budget Review'
  )

  expect(emails).toEqual(cachedEmails)
  expect(mockGraphClient).not.toHaveBeenCalled()  // No API call
})
```

---

### 3.2 Graph API Filter Tests
**File**: `tests/integration/graphApiFilters.test.ts`

#### TC-FILTER-001: Topic Filter Construction
```typescript
test('constructs correct Graph API filter for topic search', async () => {
  const service = new EmailContextService(graphClient, db)

  await service.getTopicRelevantEmails(
    ['alice@company.com', 'bob@company.com'],
    ['budget', 'q4', 'planning'],
    { maxEmails: 10, daysBack: 30 }
  )

  const filter = graphClient.api.mock.calls[0][0].filter

  expect(filter).toContain("contains(subject, 'budget')")
  expect(filter).toContain("contains(subject, 'q4')")
  expect(filter).toContain("contains(subject, 'planning')")
  expect(filter).toContain("from/emailAddress/address eq 'alice@company.com'")
  expect(filter).toContain("from/emailAddress/address eq 'bob@company.com'")
})
```

---

## 4. End-to-End Tests

### 4.1 Prompt Inclusion Tests
**File**: `tests/e2e/promptInclusion.test.ts`

#### TC-E2E-001: Email Context in Pass 1 Prompt
```typescript
test('includes email context in Pass 1 summary prompt', async () => {
  const mockMeeting = {
    id: 'meeting-1',
    subject: 'Q4 Budget Review',
    attendees_json: JSON.stringify([
      { name: 'Alice', email: 'alice@company.com' }
    ])
  }

  const mockEmails = [
    {
      id: '1',
      subject: 'Q4 Budget Planning Draft',
      from: { name: 'Alice', email: 'alice@company.com' },
      truncatedBody: 'Here are the Q4 budget numbers...'
    }
  ]

  mockDb.getMeeting.mockReturnValue(mockMeeting)
  mockEmailService.getEmailsForMeeting.mockResolvedValue(mockEmails)

  const summaryId = await intelligenceService.generateSummary(
    'meeting-1',
    'transcript-1'
  )

  // Verify prompt includes email context
  const batchRequest = claudeService.submitBatch.mock.calls[0][0][0]
  const prompt = batchRequest.params.messages[0].content

  expect(prompt).toContain('Q4 Budget Planning Draft')
  expect(prompt).toContain('Alice <alice@company.com>')
  expect(prompt).toContain('Here are the Q4 budget numbers')
})
```

#### TC-E2E-002: Topic-Relevant Emails Appear First
```typescript
test('topic-relevant emails appear before generic emails in prompt', async () => {
  const mockEmails = [
    { id: '1', subject: 'Budget Discussion', /* TIER 1 */ },
    { id: '2', subject: 'Lunch plans', /* TIER 2 */ }
  ]

  mockEmailService.getEmailsForMeeting.mockResolvedValue(mockEmails)

  const context = await intelligenceService.gatherContext(
    'meeting-1',
    'transcript-1'
  )

  const emailText = context.emails
  const budgetIndex = emailText.indexOf('Budget Discussion')
  const lunchIndex = emailText.indexOf('Lunch plans')

  expect(budgetIndex).toBeLessThan(lunchIndex)  // Budget appears first
})
```

---

## 5. Real-World Validation

### 5.1 Calendar Meeting Test
**Manual Test**: Use actual calendar meeting

**Steps**:
1. Select a real meeting from calendar (e.g., "Q4 Planning Session")
2. Generate summary
3. Check console logs for:
   ```
   [EmailContext] TIER 1: Fetching topic-relevant emails for "Q4 Planning Session" (keywords: planning, session)
   [EmailContext] TIER 1: Found X topic-relevant emails
   [EmailContext] TIER 2: Fetching Y additional participant emails
   [EmailContext] Total emails fetched: Z
   ```
4. Verify in database:
   ```sql
   SELECT * FROM email_context_cache WHERE meeting_id = 'meeting-1';
   ```
5. Check prompt file (if saved) for email inclusion

**Expected Results**:
- [ ] TIER 1 emails contain meeting topic keywords in subject
- [ ] TIER 2 emails are from participants but generic
- [ ] Total emails ≤ maxEmails (default 10)
- [ ] No duplicate emails
- [ ] Emails formatted correctly in prompt

---

### 5.2 Edge Case Validation

#### Test Case: Generic Meeting Title
**Title**: "Weekly Sync"
**Expected**: All keywords filtered → TIER 1 skipped → TIER 2 only

#### Test Case: Single-Word Title
**Title**: "Planning"
**Expected**: 1 keyword ("planning") → TIER 1 search with single term

#### Test Case: No Participants
**Expected**: Graceful handling, no emails fetched

#### Test Case: API Failure
**Expected**: Catch error, return empty array, continue with "Email context unavailable"

---

## 6. Performance Tests

### 6.1 Timing Tests
**File**: `tests/performance/emailSearch.perf.ts`

```typescript
test('TIER 1 + TIER 2 search completes within 5 seconds', async () => {
  const start = Date.now()

  await service.getEmailsForMeeting(
    'meeting-1',
    ['alice@company.com'],
    { maxEmails: 10 },
    'Q4 Budget Review'
  )

  const duration = Date.now() - start
  expect(duration).toBeLessThan(5000)  // 5 seconds max
})
```

### 6.2 API Call Count
```typescript
test('makes exactly 2 Graph API calls (TIER 1 + TIER 2)', async () => {
  const apiCallSpy = jest.spyOn(graphClient, 'api')

  await service.getEmailsForMeeting(
    'meeting-1',
    ['alice@company.com'],
    { maxEmails: 10 },
    'Q4 Budget Review'
  )

  expect(apiCallSpy).toHaveBeenCalledTimes(2)  // TIER 1 + TIER 2
})
```

---

## 7. Test Execution Plan

### Phase 1: Unit Tests (Day 1)
1. Implement keyword extraction tests (TC-KW-001 to TC-KW-007)
2. Implement email formatting tests (TC-FMT-001 to TC-FMT-003)
3. Run: `npm test -- emailContext.test.ts`
4. Fix any failures
5. Achieve 100% code coverage for `extractKeywords()`

### Phase 2: Integration Tests (Day 1-2)
1. Set up Graph API mocking
2. Implement two-tier search tests (TC-SEARCH-001 to TC-SEARCH-005)
3. Implement filter tests (TC-FILTER-001)
4. Run: `npm test -- emailSearch.test.ts`
5. Fix any failures

### Phase 3: E2E Tests (Day 2)
1. Set up full service mocking
2. Implement prompt inclusion tests (TC-E2E-001 to TC-E2E-002)
3. Run: `npm test -- promptInclusion.test.ts`
4. Fix any failures

### Phase 4: Real-World Validation (Day 3)
1. Fetch real meeting data from calendar
2. Run manual tests with actual meetings
3. Verify console logs
4. Check database for cached emails
5. Inspect generated prompts
6. Document findings

### Phase 5: Performance Tests (Day 3)
1. Implement timing tests
2. Implement API call count tests
3. Run under realistic load
4. Optimize if needed

---

## 8. Test Data Requirements

### 8.1 Fetch Real Meeting Titles
**Script**: `scripts/fetch-test-meetings.ts`

```typescript
// Fetch last 30 days of meetings
// Extract:
// - Meeting subject
// - Attendee count
// - Organizer
// - Save to tests/fixtures/real-meetings.json
```

### 8.2 Sample Email Data
**Script**: `scripts/fetch-test-emails.ts`

```typescript
// For selected meetings, fetch actual emails
// Sanitize sensitive data
// Save to tests/fixtures/real-emails.json
```

---

## 9. Success Criteria

### Must-Have ✅
- [ ] All unit tests pass (100% coverage on `extractKeywords`)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] TIER 1 prioritization verified with real data
- [ ] No duplicate emails in results
- [ ] Emails correctly formatted in prompts
- [ ] Cache working correctly

### Nice-to-Have 🎯
- [ ] Performance under 5 seconds for TIER 1 + TIER 2
- [ ] Graph API call optimization (minimize calls)
- [ ] Comprehensive edge case handling
- [ ] Test coverage >90% overall

---

## 10. Documentation

### Test Results Document
**File**: `docs/testing/email-search-test-results.md`

Record:
- [ ] Test execution date
- [ ] Pass/fail results for each test
- [ ] Real-world validation findings
- [ ] Edge cases discovered
- [ ] Performance benchmarks
- [ ] Recommendations for improvement

---

## Next Steps

1. **Immediate**: Fetch real meeting data from calendar
2. **Short-term**: Implement unit tests (Phase 1)
3. **Medium-term**: Integration + E2E tests (Phase 2-3)
4. **Long-term**: Real-world validation (Phase 4-5)

**Estimated Timeline**: 3 days for complete test suite + validation
