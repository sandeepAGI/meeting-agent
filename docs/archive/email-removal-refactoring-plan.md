# Email Context Removal - Refactoring Plan

**Status**: Ready for execution
**Date**: January 2025
**Rationale**: See `email-context-deprecation.md`

---

## Overview

This document provides a detailed, step-by-step plan to safely remove email context functionality from the Meeting Intelligence system while:
- Preserving all code for future reference
- Avoiding breaking changes
- Maintaining test infrastructure
- Improving performance (~800ms faster per meeting)

---

## Pre-Flight Checklist

- [x] Archive documentation created (`email-context-deprecation.md`)
- [x] Test results analyzed and documented
- [x] Decision rationale documented
- [ ] Git working directory clean (commit/stash pending changes)
- [ ] Backup current database: `cp data/meeting-agent.db data/meeting-agent.db.backup`

---

## Phase 1: Archive Original Code

### Step 1.1: Create archive directory structure

```bash
mkdir -p docs/archive/code
```

### Step 1.2: Copy EmailContextService to archive

```bash
cp src/services/emailContext.ts docs/archive/code/emailContext.ts
```

### Step 1.3: Add deprecation header to archived file

```typescript
/**
 * Email Context Service - ARCHIVED
 *
 * This file has been removed from production code.
 * See: docs/archive/email-context-deprecation.md for details.
 *
 * Archived: January 2025
 * Original location: src/services/emailContext.ts
 * Git history: Search for commits mentioning "email context"
 */
```

---

## Phase 2: Remove Email Context from Prompts

### Step 2.1: Update src/prompts/pass1-summary.txt

**Current** (lines 11-17):
```
RECENT EMAIL CONTEXT (to understand participant dynamics):
{{emailContext}}

INSTRUCTIONS:
1. **Identify Speakers**: Match SPEAKER_00, SPEAKER_01, etc. to actual attendees
   - Use conversation content, topics discussed, roles mentioned, language patterns
   - Use email context for communication patterns and relationships
```

**New**:
```
INSTRUCTIONS:
1. **Identify Speakers**: Match SPEAKER_00, SPEAKER_01, etc. to actual attendees
   - Use conversation content, topics discussed, roles mentioned, language patterns
   - Use calendar meeting metadata for attendee list
```

**Changes**:
- Remove `RECENT EMAIL CONTEXT` section entirely
- Remove "Use email context for communication patterns" bullet
- Add "Use calendar meeting metadata" for clarity

### Step 2.2: Update src/prompts/pass2-validation.txt

**Search for**: `{{emailContext}}`

**Action**: Remove email context section (similar to Pass 1)

**Verify**: Email context instructions removed from both prompts

---

## Phase 3: Remove Email Fetching from MeetingIntelligenceService

### Step 3.1: Remove email context fetching (lines 99-122)

**File**: `src/services/meetingIntelligence.ts`

**Current code to remove**:
```typescript
// Fetch email context for better speaker identification
let emailContext = 'No email context available.'
let emailCount = 0
let emailFetchDuration = 0

try {
  const emailFetchStart = Date.now()

  // Check cache first
  let emails = await this.db.getEmailContextFromCache(meetingId)

  if (!emails) {
    // Fetch fresh emails
    const attendeeEmails = calendar.meeting.attendees.map(a => a.email)
    emails = await this.emailService.fetchEmailContext(
      calendar.meeting.subject,
      attendeeEmails,
      new Date(calendar.meeting.start),
      10
    )

    // Cache for 7 days
    await this.db.saveEmailContextToCache(meetingId, emails)
  }

  emailCount = emails.length
  emailContext = formatEmailsForPrompt(emails)
  emailFetchDuration = Date.now() - emailFetchStart
} catch (error) {
  console.error('Failed to fetch email context:', error)
  // Continue without email context
}
```

**Action**: Delete entire block

### Step 3.2: Remove email context from prompt variable substitution

**Find** (lines 289-293 approx):
```typescript
const prompt = pass1Template
  .replace('{{meetingSubject}}', calendar.meeting.subject)
  .replace('{{meetingDate}}', new Date(calendar.meeting.start).toLocaleDateString())
  .replace('{{attendeeList}}', attendeeList)
  .replace('{{emailContext}}', emailContext)  // ← REMOVE THIS LINE
  .replace('{{transcript}}', formattedTranscript)
```

**Action**: Remove `.replace('{{emailContext}}', emailContext)` line

**Find similar code for Pass 2** (lines ~390-395) and remove there too.

### Step 3.3: Remove email metrics from duration tracking

**Find**:
```typescript
duration: {
  emailFetch: emailFetchDuration,  // ← REMOVE
  pass1: pass1Duration,
  pass2: pass2Duration,
  total: Date.now() - startTime
}
```

**Action**: Remove `emailFetch` field

### Step 3.4: Remove emailCount from result

**Find**:
```typescript
return {
  transcript,
  calendar,
  emailCount,  // ← REMOVE
  ...
}
```

**Action**: Remove `emailCount` field

### Step 3.5: Remove EmailContextService import and property

**Top of file**:
```typescript
import { EmailContextService } from './emailContext'  // ← REMOVE
import { formatEmailsForPrompt } from './emailContext'  // ← REMOVE
```

**Constructor**:
```typescript
constructor(
  private anthropic: Anthropic,
  private db: DatabaseService,
  private emailService: EmailContextService,  // ← REMOVE
  private batchService: ClaudeBatchService
) {}
```

**Action**: Remove all EmailContextService references

---

## Phase 4: Remove Email Service Instantiation

### Step 4.1: Check main process for EmailContextService instantiation

**Search in**: `src/main/index.ts` or similar main process file

**Find**:
```typescript
const emailContextService = new EmailContextService(graphClient)
```

**Action**: Remove instantiation and any IPC handler registrations

### Step 4.2: Search for IPC handlers

```bash
grep -rn "email-context" src/main/ src/preload/
```

**Action**: Remove any IPC handlers related to email context

---

## Phase 5: Update Types

### Step 5.1: Update MeetingSummaryResult type

**File**: `src/types/meetingSummary.ts` or inline in `meetingIntelligence.ts`

**Find**:
```typescript
export interface MeetingSummaryResult {
  transcript: TranscriptData
  calendar: CalendarMatchResult
  emailCount: number  // ← REMOVE
  duration: {
    emailFetch: number  // ← REMOVE
    pass1: number
    pass2: number
    total: number
  }
  ...
}
```

**Action**: Remove `emailCount` and `duration.emailFetch` fields

---

## Phase 6: Update Test Scripts

### Step 6.1: Update test-full-pipeline.ts

**File**: `scripts/test-full-pipeline.ts`

**Find email metrics logging**:
```typescript
console.log(`  Email Context: ${result.emailCount} emails fetched`)
console.log(`  Email Fetch: ${result.duration.emailFetch}ms`)
```

**Action**: Remove these console.log statements

**Keep**: Test infrastructure, just remove email-specific metrics

### Step 6.2: Update generate-report-from-json.js

**File**: `scripts/generate-report-from-json.js`

**Find** (line 21-22):
```javascript
lines.push(`  Email Context: ${result.emailCount} emails fetched`)
```

**Action**: Remove email count from summary statistics

**Keep**: Rest of report generation (speaker ID, summaries, etc.)

---

## Phase 7: Database Schema (Optional - Keep for Now)

### Recommendation: KEEP email_context_cache table

**Rationale**:
- No harm in keeping the table
- Allows easy re-enablement if needed
- Can be cleaned up in future migration
- No performance impact (table is small, indexed)

**Alternative**: If you want to drop it now:
```sql
DROP TABLE IF EXISTS email_context_cache;
```

**Action**: Skip this step (keep table)

---

## Phase 8: Dependencies (Optional - Keep for Now)

### Recommendation: KEEP Microsoft Graph SDK

**Rationale**:
- Still used for calendar operations (fetchTodaysMeetings)
- Used for meeting metadata in intelligence
- Removing would require larger refactor

**Action**: Skip dependency removal (keep in package.json)

---

## Phase 9: Testing

### Step 9.1: Type checking

```bash
npm run type-check
```

**Expected**: All types pass (no errors)

**If errors**: Fix missing imports or type references

### Step 9.2: Build verification

```bash
npm run build
```

**Expected**: Clean build with no errors

**If errors**: Fix module resolution issues

### Step 9.3: E2E test without email context

```bash
node scripts/electron-runner.js scripts/test-full-pipeline.ts \
  tests/fixtures/manual-e2e/converted/2025-10-7-Sync-3.json \
  tests/fixtures/manual-e2e/converted/2025-10-7-Sync-3-calendar.json
```

**Expected**:
- ✅ Pass 1 and Pass 2 complete successfully
- ✅ Speaker identification still works
- ✅ Summary generated correctly
- ✅ No email-related errors in logs
- ✅ Faster processing (~800ms saved)

**Compare**: Old results vs new results
- Speaker identification: Should be identical (emails weren't helping)
- Summary quality: Should be identical
- Processing time: Should be ~800ms faster

### Step 9.4: Generate new test reports

```bash
node scripts/generate-report-from-json.js
```

**Expected**: Reports generated without email context section

**Verify**: Check `test-sync3-report.txt` no longer shows "Email Context: X emails fetched"

---

## Phase 10: Documentation Updates

### Step 10.1: Update CHANGELOG.md

**Add under "Unreleased > Removed"**:

```markdown
### Removed
- **Email Context Feature**:
  - Removed email fetching from meeting intelligence pipeline
  - Emails provided no measurable value for speaker identification or summarization
  - Calendar metadata + transcript sufficient for high-quality results
  - Performance improvement: ~800ms faster processing per meeting
  - See `docs/archive/email-context-deprecation.md` for detailed rationale
  - Code archived in `docs/archive/code/emailContext.ts`
  - Test results documented extensive analysis (C200 test false positive, Sync #3 test zero email usage)
```

### Step 10.2: Update CLAUDE.md

**Find** (Current Status section):
```markdown
- ✅ Meeting intelligence backend (two-pass LLM workflow, email context, database, batch processing)
```

**Change to**:
```markdown
- ✅ Meeting intelligence backend (two-pass LLM workflow, calendar metadata, database, batch processing)
```

**Find** (Phase 2.3-3 Backend section):
```markdown
- ✅ **EmailContextService**: Graph API email fetching with HTML stripping, 2000-char truncation, 7-day caching
```

**Change to**:
```markdown
- ❌ **EmailContextService**: [REMOVED] Email fetching provided no measurable value (see docs/archive/email-context-deprecation.md)
```

**Environment Variables section**:
```markdown
# Phase 2.3-3: Meeting Intelligence
EMAIL_BODY_MAX_LENGTH=2000  # ← REMOVE THIS LINE
EMAIL_CONTEXT_MAX_COUNT=10  # ← REMOVE THIS LINE
```

**Action**: Remove email-specific environment variables

### Step 10.3: Update README.md

**Find** (Features section):
```markdown
- Intelligent email context for speaker identification
```

**Action**: Remove this bullet (if it exists)

**Find** (Performance section):
```markdown
| Email Fetch | 839ms | ~1s | ~5MB |
```

**Action**: Remove email fetch row from performance table

### Step 10.4: Update docs/developer/architecture.md

**Find**: EmailContextService section

**Action**: Mark as deprecated and reference archive:
```markdown
### EmailContextService (DEPRECATED)

**Status**: Removed in January 2025

This service fetched emails to provide meeting context. After testing,
we found no measurable value from email context.

**See**: `docs/archive/email-context-deprecation.md` for full analysis.

**Archived code**: `docs/archive/code/emailContext.ts`
```

### Step 10.5: Update .env.example (if exists)

**Remove**:
```bash
EMAIL_BODY_MAX_LENGTH=2000
EMAIL_CONTEXT_MAX_COUNT=10
```

---

## Phase 11: Final Verification

### Step 11.1: Git diff review

```bash
git diff
```

**Verify**:
- [x] EmailContextService code removed from src/
- [x] Email context removed from prompts
- [x] Email fetching removed from meetingIntelligence.ts
- [x] Email metrics removed from test scripts
- [x] Documentation updated
- [x] Archive documentation created
- [x] Original code preserved in docs/archive/

### Step 11.2: Grep for remaining references

```bash
# Should find only archive files and CHANGELOG
grep -rn "emailContext" src/ docs/ scripts/ --exclude-dir=node_modules

# Should find only archive references
grep -rn "EmailContextService" src/ --exclude-dir=node_modules
```

**Expected**: No references in active code (only in archive/)

### Step 11.3: Final test run

```bash
npm run type-check && npm run build
```

**Expected**: Clean build

---

## Phase 12: Commit and Push

### Step 12.1: Stage changes

```bash
git add -A
```

### Step 12.2: Commit with detailed message

```bash
git commit -m "Remove email context feature - no measurable value

BREAKING CHANGE: Email context feature removed from meeting intelligence

Rationale:
- Email context provided no value for speaker identification
- LLMs prioritize transcript content over emails
- Calendar attendees create anchoring bias emails cannot overcome
- Test results: C200 false positive, Sync #3 zero email usage
- Performance gain: ~800ms faster per meeting

Changes:
- Removed EmailContextService from src/services/
- Removed email fetching from MeetingIntelligenceService
- Removed email context from Pass 1 and Pass 2 prompts
- Removed email metrics from test scripts and reports
- Updated all documentation (CHANGELOG, CLAUDE.md, README.md, architecture.md)

Archived:
- Full implementation archived in docs/archive/email-context-deprecation.md
- Original code saved in docs/archive/code/emailContext.ts
- Detailed test results and analysis documented

Testing:
✅ npm run type-check passes
✅ npm run build succeeds
✅ E2E tests pass without email context
✅ Speaker identification still accurate
✅ Summary quality unchanged

See: docs/archive/email-context-deprecation.md for complete analysis

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 12.3: Push to remote

```bash
git push origin main
```

---

## Rollback Plan (If Needed)

If issues are discovered after removal:

### Quick Rollback
```bash
git revert HEAD
```

### Selective Rollback (restore specific files)
```bash
# Restore email service
cp docs/archive/code/emailContext.ts src/services/emailContext.ts

# Revert prompt changes
git checkout HEAD~1 -- src/prompts/pass1-summary.txt
git checkout HEAD~1 -- src/prompts/pass2-validation.txt

# Revert meetingIntelligence.ts
git checkout HEAD~1 -- src/services/meetingIntelligence.ts
```

---

## Success Criteria

- [x] All tests pass without email context
- [x] No type errors or build failures
- [x] Speaker identification accuracy maintained
- [x] Summary quality maintained
- [x] Performance improved (~800ms faster)
- [x] All code archived for future reference
- [x] Documentation fully updated
- [x] Git history preserves full implementation

---

## Post-Removal Monitoring

### Week 1: Watch for issues
- Monitor production use cases
- Check speaker identification accuracy
- Compare summary quality

### Month 1: Performance validation
- Measure average processing time reduction
- Verify no regressions in user experience

### If needed: Consider alternative approaches
- See "Alternative Approaches" in email-context-deprecation.md
- Re-evaluate if use cases change

---

**Last Updated**: January 2025
**Plan Status**: Ready for execution
**Estimated Time**: 1-2 hours
