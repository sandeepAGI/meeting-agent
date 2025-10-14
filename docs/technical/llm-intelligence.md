# Phase 2.3-3: LLM-Based Meeting Intelligence

**Status**: Planning Complete (Ready for Implementation)
**Version**: 0.3.0 (Target)
**Last Updated**: 2025-01-13

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Services](#services)
- [Prompt Engineering](#prompt-engineering)
- [UI Components](#ui-components)
- [IPC Handlers](#ipc-handlers)
- [Cost Analysis](#cost-analysis)
- [Testing Strategy](#testing-strategy)
- [Known Limitations](#known-limitations)

---

## Overview

Phase 2.3-3 introduces intelligent meeting summarization using Claude's LLM via the Batch API. The system uses a two-pass workflow to:

1. **Pass 1**: Identify speakers and generate comprehensive summary
2. **Pass 2**: Validate speakers, check facts, refine output

This approach achieves **96% cost savings** compared to cloud-only alternatives while maintaining high quality through self-correction.

### Key Features

- **Two-Pass Validation**: Self-correcting workflow reduces errors
- **Batch API**: 50% cost savings with acceptable latency (30-60 min)
- **SQLite Persistence**: All data stored locally for reliability
- **Email Context**: Uses email history to improve speaker identification
- **User Editable**: Manual correction of summaries and speaker mappings
- **Adaptive Polling**: Smart polling strategy reduces API calls

---

## Architecture

### Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User selects meeting from calendar                       │
│    - Date filter: Today or Last 7 Days                      │
│    - Meeting list with attendees                            │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Gather Context                                           │
│    - Meeting metadata (subject, attendees, time)            │
│    - Recent emails with participants (10 emails, 2000 chars)│
│    - Transcript with SPEAKER_XX labels                      │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Submit Pass 1 Batch Job                                  │
│    - Create batch request with custom_id                    │
│    - Prompt: Identify speakers + generate summary           │
│    - Submit to Anthropic Batch API                          │
│    - Save batch_id to database                              │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Adaptive Polling (Pass 1)                                │
│    - Poll every 5 min for first 30 min                      │
│    - Poll every 3 min for min 30-45                         │
│    - Poll every 1 min for min 45-55                         │
│    - Poll every 30 sec after min 55                         │
│    - UI shows: "Pass 1: Generating... (Next check: 5:00)"   │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Pass 1 Complete                                          │
│    - Retrieve results from Anthropic                        │
│    - Parse JSON: speakers, summary, action items            │
│    - Save to database (pass1_* fields)                      │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Submit Pass 2 Batch Job                                  │
│    - Prompt: Validate Pass 1 against transcript             │
│    - Check speaker IDs, action items, completeness          │
│    - Submit to Anthropic Batch API                          │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Adaptive Polling (Pass 2)                                │
│    - Same strategy as Pass 1                                │
│    - UI shows: "Pass 2: Validating... (Next check: 3:00)"   │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Pass 2 Complete                                          │
│    - Retrieve validated results                             │
│    - Save to database (pass2_* fields)                      │
│    - Set overall_status = 'complete'                        │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. Display Summary                                          │
│    - Show speaker mappings with confidence                  │
│    - Show refined summary (editable)                        │
│    - Show action items (editable)                           │
│    - Show key decisions                                     │
│    - "Regenerate" button available                          │
└─────────────────────────────────────────────────────────────┘
```

### Component Relationships

```
┌────────────────────────────────────────────────────────┐
│                     Main Process                       │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │  MeetingIntelligenceService (Orchestrator)   │    │
│  │                                              │    │
│  │  ┌─────────────────┐  ┌──────────────────┐ │    │
│  │  │ ClaudeBatchAPI  │  │ EmailContext     │ │    │
│  │  │ Service         │  │ Service          │ │    │
│  │  └────────┬────────┘  └────────┬─────────┘ │    │
│  │           │                     │           │    │
│  │           ↓                     ↓           │    │
│  │  ┌─────────────────────────────────────┐   │    │
│  │  │      DatabaseService (SQLite)       │   │    │
│  │  └─────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  IPC Handlers:                                        │
│  - meeting-intelligence-start                         │
│  - meeting-intelligence-status                        │
│  - meeting-intelligence-cancel                        │
└────────────────────────────────────────────────────────┘
                           ↕
┌────────────────────────────────────────────────────────┐
│                   Renderer Process                     │
│                                                        │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────┐ │
│  │  Meeting     │  │  Summary         │  │ Summary │ │
│  │  Selector    │→ │  Processing      │→ │ Display │ │
│  └──────────────┘  └──────────────────┘  └─────────┘ │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Database Schema

See `src/database/schema.sql` for full schema.

### Key Tables

#### `meetings`

Stores Microsoft Graph calendar events.

```sql
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,              -- Graph event ID
  subject TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  organizer_name TEXT,
  organizer_email TEXT,
  attendees_json TEXT,              -- JSON array
  is_online_meeting BOOLEAN,
  online_meeting_url TEXT,
  location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `meeting_summaries`

Stores Pass 1, Pass 2, and user-edited summaries.

```sql
CREATE TABLE meeting_summaries (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  transcript_id TEXT NOT NULL,

  -- Pass 1
  pass1_batch_id TEXT,
  pass1_status TEXT,
  pass1_speaker_mappings_json TEXT,
  pass1_summary TEXT,
  pass1_action_items_json TEXT,
  pass1_completed_at DATETIME,

  -- Pass 2
  pass2_batch_id TEXT,
  pass2_refined_summary TEXT,
  pass2_validated_speakers_json TEXT,
  pass2_corrections_json TEXT,
  pass2_completed_at DATETIME,

  -- User edits
  final_summary TEXT,
  final_speakers_json TEXT,
  edited_at DATETIME,

  overall_status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `batch_jobs`

Tracks Anthropic batch jobs.

```sql
CREATE TABLE batch_jobs (
  id TEXT PRIMARY KEY,              -- Anthropic batch_id
  summary_id TEXT NOT NULL,
  pass_number INTEGER,              -- 1 or 2
  status TEXT,                      -- 'in_progress', 'ended', etc.
  results_url TEXT,
  submitted_at DATETIME,
  completed_at DATETIME
);
```

---

## Services

### ClaudeBatchService

**File**: `src/services/claudeBatch.ts`

Handles all Batch API interactions with Anthropic.

#### Methods

```typescript
class ClaudeBatchService {
  constructor(apiKey: string)

  // Submit batch job
  async submitBatch(requests: BatchRequest[]): Promise<string>

  // Poll until completion (with adaptive intervals)
  async pollBatchStatus(
    batchId: string,
    onProgress?: (status: BatchStatus) => void
  ): Promise<BatchStatus>

  // Retrieve results (JSONL format)
  async retrieveResults(batchId: string): Promise<any[]>

  // Cancel batch
  async cancelBatch(batchId: string): Promise<void>
}
```

#### Adaptive Polling Logic

```typescript
private getPollingInterval(elapsedMinutes: number): number {
  if (elapsedMinutes < 30) return 5 * 60 * 1000   // 5 min
  if (elapsedMinutes < 45) return 3 * 60 * 1000   // 3 min
  if (elapsedMinutes < 55) return 1 * 60 * 1000   // 1 min
  return 30 * 1000                                 // 30 sec
}
```

**Rationale**: Most batches complete in <1 hour. Start with longer intervals, then accelerate as completion nears.

---

### EmailContextService

**File**: `src/services/emailContext.ts`

Fetches recent emails with meeting participants via Microsoft Graph API.

#### Methods

```typescript
class EmailContextService {
  constructor(graphClient: Client)

  // Fetch recent emails
  async getRecentEmailsWithParticipants(
    participantEmails: string[],
    options?: EmailFetchOptions
  ): Promise<EmailContext[]>

  // Format for prompt
  formatEmailsForPrompt(emails: EmailContext[]): string

  // Cache management
  async getCachedEmails(meetingId: string): Promise<EmailContext[] | null>
  async cacheEmails(meetingId: string, emails: EmailContext[]): Promise<void>
}
```

#### Email Body Handling

```typescript
interface EmailFetchOptions {
  maxEmails?: number        // Default: 10
  maxBodyLength?: number    // Default: 2000 chars per email
  includeBody?: boolean     // Default: true
}

private truncateBody(body: string, maxLength: number): string {
  // Strip HTML tags
  const plainText = body.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (plainText.length <= maxLength) return plainText

  // Truncate at sentence boundary
  const truncated = plainText.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')

  return lastPeriod > maxLength * 0.8
    ? truncated.substring(0, lastPeriod + 1)
    : truncated + '...'
}
```

---

### MeetingIntelligenceService

**File**: `src/services/meetingIntelligence.ts`

Orchestrates the entire two-pass workflow.

#### Methods

```typescript
class MeetingIntelligenceService {
  constructor(
    claudeService: ClaudeBatchService,
    emailService: EmailContextService,
    dbService: DatabaseService
  )

  // Main entry point
  async generateSummary(
    meetingId: string,
    transcriptId: string
  ): Promise<string>  // Returns summary_id

  // Pass 1: Initial summary
  private async submitPass1(
    summaryId: string,
    context: MeetingContext
  ): Promise<string>  // Returns batch_id

  // Pass 2: Validation
  private async submitPass2(
    summaryId: string,
    pass1Result: Pass1Result,
    context: MeetingContext
  ): Promise<string>  // Returns batch_id

  // Check status
  async getSummaryStatus(summaryId: string): Promise<SummaryStatus>

  // Regenerate from Pass 1
  async regenerateSummary(summaryId: string): Promise<void>

  // Cancel in-progress job
  async cancelSummary(summaryId: string): Promise<void>
}
```

#### Workflow Implementation

```typescript
async generateSummary(meetingId: string, transcriptId: string): Promise<string> {
  // 1. Create summary record
  const summaryId = await this.db.createSummary({
    meetingId,
    transcriptId,
    overall_status: 'pending'
  })

  // 2. Gather context
  const context = await this.gatherContext(meetingId, transcriptId)

  // 3. Submit Pass 1
  const pass1BatchId = await this.submitPass1(summaryId, context)

  // 4. Start background polling for Pass 1
  this.pollPass1InBackground(summaryId, pass1BatchId, context)

  return summaryId
}

private async pollPass1InBackground(
  summaryId: string,
  batchId: string,
  context: MeetingContext
): Promise<void> {
  try {
    // Poll until complete
    const status = await this.claudeService.pollBatchStatus(
      batchId,
      (progress) => {
        // Update database with progress
        this.db.updateBatchJobStatus(batchId, progress)
      }
    )

    // Retrieve results
    const results = await this.claudeService.retrieveResults(batchId)
    const pass1Data = this.parsePass1Results(results)

    // Save to database
    await this.db.updateSummaryPass1(summaryId, pass1Data)

    // Submit Pass 2
    const pass2BatchId = await this.submitPass2(summaryId, pass1Data, context)

    // Poll Pass 2
    await this.pollPass2InBackground(summaryId, pass2BatchId)

  } catch (error) {
    await this.db.updateSummaryStatus(summaryId, 'error', error.message)
  }
}
```

---

### DatabaseService

**File**: `src/services/database.ts`

Wrapper around better-sqlite3.

#### Methods

```typescript
class DatabaseService {
  constructor(dbPath?: string)

  // Meetings
  saveMeeting(meeting: MeetingInfo): void
  getMeeting(meetingId: string): MeetingInfo | null

  // Summaries
  createSummary(data: CreateSummaryData): string
  getSummary(summaryId: string): MeetingSummary | null
  updateSummaryPass1(summaryId: string, data: Pass1Data): void
  updateSummaryPass2(summaryId: string, data: Pass2Data): void
  updateSummaryFinal(summaryId: string, userEdits: FinalData): void

  // Batch jobs
  saveBatchJob(data: BatchJobData): void
  updateBatchJobStatus(batchId: string, status: string): void
  getBatchJob(batchId: string): BatchJob | null

  // Email cache
  getCachedEmails(meetingId: string): EmailContext[] | null
  cacheEmails(meetingId: string, emails: EmailContext[]): void
}
```

---

## Prompt Engineering

### Pass 1: Speaker Identification + Initial Summary

**File**: `src/prompts/pass1-summary.txt`

```
You are an expert meeting analyst. Your task is to identify speakers in a transcript and generate a comprehensive meeting summary.

MEETING CONTEXT:
- Subject: {{subject}}
- Date: {{date}}
- Attendees: {{attendees_list}}
- Organizer: {{organizer_name}} ({{organizer_email}})

RECENT EMAIL CONTEXT (to understand participant dynamics):
{{email_context}}

TRANSCRIPT (with generic speaker labels):
{{transcript}}

INSTRUCTIONS:
1. **Identify Speakers**: Match SPEAKER_00, SPEAKER_01, etc. to actual attendees
   - Use conversation content, topics discussed, roles mentioned
   - Use email context for communication patterns
   - Assign confidence level: high/medium/low
   - Provide reasoning for each mapping

2. **Generate Summary**: Comprehensive meeting summary with:
   - Key topics discussed
   - Decisions made
   - Action items (with assignments if clear)
   - Follow-up items

3. **Extract Action Items**: List concrete actions with:
   - Description
   - Assignee (if identified)
   - Priority (high/medium/low)

OUTPUT FORMAT (JSON):
{
  "speaker_mappings": [
    {
      "label": "SPEAKER_00",
      "name": "John Smith",
      "confidence": "high",
      "reasoning": "Mentioned 'my team' and discussed backend architecture. John is listed as Tech Lead in attendees."
    }
  ],
  "summary": "The team discussed Q1 roadmap priorities...",
  "action_items": [
    {
      "description": "Review API design document",
      "assignee": "John Smith",
      "priority": "high",
      "dueDate": null
    }
  ],
  "key_decisions": [
    "Decided to prioritize API redesign over new features",
    "Agreed on weekly status updates every Monday"
  ]
}
```

### Pass 2: Validation and Refinement

**File**: `src/prompts/pass2-validation.txt`

```
You are a fact-checker reviewing a meeting summary for accuracy and completeness.

ORIGINAL MEETING CONTEXT:
{{original_context}}

ORIGINAL TRANSCRIPT:
{{transcript}}

PASS 1 SUMMARY TO REVIEW:
{{pass1_summary}}

INSTRUCTIONS:
1. **Verify Speaker Identifications**:
   - Check each speaker mapping against the transcript
   - Look for contradictions or misassignments
   - Correct any errors found

2. **Check Completeness**:
   - Are all major topics covered?
   - Are any action items missed?
   - Are all decisions captured?

3. **Refine Summary**:
   - Improve clarity and conciseness
   - Ensure all speaker names are used correctly
   - Add any missing context

4. **Document Corrections**:
   - List all changes made
   - Explain reasoning for corrections

OUTPUT FORMAT (JSON):
{
  "validated_speakers": [
    {
      "label": "SPEAKER_00",
      "name": "John Smith",
      "confidence": "high",
      "reasoning": "Verified: John discussed backend architecture throughout"
    }
  ],
  "refined_summary": "Improved summary with corrected speaker names...",
  "validated_action_items": [...],
  "corrections": [
    "Changed SPEAKER_01 from 'Alice' to 'Bob' - Alice was not present, Bob discussed frontend work which matches SPEAKER_01's topics"
  ]
}
```

---

## UI Components

### MeetingSelector

**File**: `src/renderer/components/MeetingSelector.tsx`

```typescript
interface MeetingSelectorProps {
  onGenerateSummary: (meetingId: string, transcriptId: string) => void
}

export function MeetingSelector({ onGenerateSummary }: MeetingSelectorProps) {
  const [dateRange, setDateRange] = useState<'today' | 'last7days'>('today')
  const [meetings, setMeetings] = useState<MeetingInfo[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null)

  // Fetch meetings when date range changes
  useEffect(() => {
    fetchMeetings(dateRange)
  }, [dateRange])

  return (
    <div className="meeting-selector">
      <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
        <option value="today">Today</option>
        <option value="last7days">Last 7 Days</option>
      </select>

      <div className="meeting-list">
        {meetings.map(meeting => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            isSelected={selectedMeeting === meeting.id}
            onSelect={() => setSelectedMeeting(meeting.id)}
          />
        ))}
      </div>

      <button
        disabled={!selectedMeeting}
        onClick={() => onGenerateSummary(selectedMeeting, transcriptId)}
      >
        Generate Summary
      </button>
    </div>
  )
}
```

### SummaryProcessing

**File**: `src/renderer/components/SummaryProcessing.tsx`

```typescript
interface SummaryProcessingProps {
  summaryId: string
  onCancel: () => void
}

export function SummaryProcessing({ summaryId, onCancel }: SummaryProcessingProps) {
  const [status, setStatus] = useState<SummaryStatus | null>(null)

  useEffect(() => {
    const interval = setInterval(async () => {
      const newStatus = await window.electronAPI.getSummaryStatus(summaryId)
      setStatus(newStatus)
    }, 5000)  // Check every 5 seconds

    return () => clearInterval(interval)
  }, [summaryId])

  const getTimeUntilNextCheck = () => {
    // Calculate based on elapsed time
    const elapsed = status.elapsedMinutes
    if (elapsed < 30) return '5:00'
    if (elapsed < 45) return '3:00'
    if (elapsed < 55) return '1:00'
    return '0:30'
  }

  return (
    <div className="summary-processing">
      {status.pass === 1 && (
        <div>
          <h3>Pass 1: Generating Initial Summary</h3>
          <p>Identifying speakers and creating comprehensive summary...</p>
          <p>Next check: {getTimeUntilNextCheck()}</p>
          <p>Elapsed: {formatDuration(status.elapsedMinutes * 60)}</p>
        </div>
      )}

      {status.pass === 2 && (
        <div>
          <h3>Pass 2: Validating and Refining</h3>
          <p>Fact-checking speakers and action items...</p>
          <p>Next check: {getTimeUntilNextCheck()}</p>
        </div>
      )}

      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}
```

### SummaryDisplay

**File**: `src/renderer/components/SummaryDisplay.tsx`

```typescript
interface SummaryDisplayProps {
  summaryId: string
  onRegenerate: () => void
}

export function SummaryDisplay({ summaryId, onRegenerate }: SummaryDisplayProps) {
  const [summary, setSummary] = useState<MeetingSummary | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="summary-display">
      <h2>Meeting Summary</h2>

      {/* Speaker Mappings */}
      <section>
        <h3>Identified Speakers</h3>
        {summary.pass2_validated_speakers.map(speaker => (
          <div key={speaker.label} className="speaker-mapping">
            <span className="label">{speaker.label}</span>
            <span className="name">{speaker.name}</span>
            <span className={`confidence ${speaker.confidence}`}>
              {speaker.confidence}
            </span>
          </div>
        ))}
      </section>

      {/* Summary */}
      <section>
        <h3>Summary</h3>
        {isEditing ? (
          <textarea
            value={summary.final_summary || summary.pass2_refined_summary}
            onChange={(e) => updateSummary(e.target.value)}
          />
        ) : (
          <div>{summary.final_summary || summary.pass2_refined_summary}</div>
        )}
      </section>

      {/* Action Items */}
      <section>
        <h3>Action Items</h3>
        <ul>
          {summary.pass2_validated_actions.map((item, i) => (
            <li key={i}>
              <strong>{item.description}</strong>
              {item.assignee && ` - ${item.assignee}`}
              <span className={`priority ${item.priority}`}>{item.priority}</span>
            </li>
          ))}
        </ul>
      </section>

      <button onClick={() => setIsEditing(!isEditing)}>
        {isEditing ? 'Save' : 'Edit'}
      </button>
      <button onClick={onRegenerate}>Regenerate</button>
    </div>
  )
}
```

---

## IPC Handlers

**File**: `src/main/index.ts`

```typescript
// Initialize services
const claudeService = new ClaudeBatchService(process.env.ANTHROPIC_API_KEY!)
const emailService = new EmailContextService(graphApiService)
const dbService = new DatabaseService()
const intelligenceService = new MeetingIntelligenceService(
  claudeService,
  emailService,
  dbService
)

// Start summary generation
ipcMain.handle('meeting-intelligence-start', async (_event, meetingId: string, transcriptId: string) => {
  try {
    const summaryId = await intelligenceService.generateSummary(meetingId, transcriptId)
    return { success: true, summaryId }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Get summary status
ipcMain.handle('meeting-intelligence-status', async (_event, summaryId: string) => {
  try {
    const status = await intelligenceService.getSummaryStatus(summaryId)
    return { success: true, status }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Cancel summary
ipcMain.handle('meeting-intelligence-cancel', async (_event, summaryId: string) => {
  try {
    await intelligenceService.cancelSummary(summaryId)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Fetch email context
ipcMain.handle('email-context-fetch', async (_event, participantEmails: string[]) => {
  try {
    const emails = await emailService.getRecentEmailsWithParticipants(participantEmails)
    return { success: true, emails }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

---

## Cost Analysis

### Per-Meeting Breakdown (60-minute meeting)

**Assumptions**:

- Transcript: ~15K tokens
- Meeting context: ~3K tokens
- Email context (10 emails × 200 tokens): ~2K tokens
- Total input Pass 1: ~20K tokens
- Output Pass 1: ~2K tokens
- Total input Pass 2: ~22K tokens (transcript + Pass 1 result)
- Output Pass 2: ~2K tokens

**Claude Sonnet 4.5 Batch API Pricing**:

- Input: $1.50 per million tokens
- Output: $7.50 per million tokens

**Pass 1 Cost**:

- Input: 20K × $1.50 / 1M = $0.030
- Output: 2K × $7.50 / 1M = $0.015
- **Total: $0.045**

**Pass 2 Cost**:

- Input: 22K × $1.50 / 1M = $0.033
- Output: 2K × $7.50 / 1M = $0.015
- **Total: $0.048**

**Per Meeting: $0.093** (~9 cents)

**Monthly (20 meetings): $1.86**

### Comparison

| Solution | Cost per Meeting | Monthly (20 meetings) |
|----------|------------------|-----------------------|
| Azure Speech + GPT-4 | $2.50 | $50.00 |
| **Meeting Agent** | **$0.09** | **$1.86** |
| **Savings** | **96%** | **96%** |

---

## Testing Strategy

### Level 1: Static Analysis

```bash
npm run type-check
npm run build
```

### Level 2: Logic Review

- Verify prompt templates capture all requirements
- Check adaptive polling logic correctly adjusts intervals
- Review database transactions for atomicity
- Validate error handling in all async paths
- Check cleanup of resources (batch jobs, temp files)

### Level 3: Manual Testing

**Test Scenarios**:

1. **Short meeting (5 min)**:
   - Verify Pass 1 completes
   - Verify Pass 2 validates
   - Check speaker identification accuracy

2. **Medium meeting (30 min)**:
   - Same as above
   - Verify action item extraction
   - Check key decisions captured

3. **Long meeting (60 min)**:
   - Verify no timeout issues
   - Check cost stays under $0.10
   - Verify summary quality

4. **Edge cases**:
   - Meeting with 1 speaker (no diarization)
   - Meeting with no emails (limited context)
   - API error during Pass 1
   - User cancels mid-processing
   - Regeneration after edit

5. **Database persistence**:
   - Verify all data saved correctly
   - Check recovery after app restart
   - Verify cache expiration works

---

## Known Limitations

1. **Latency**: 30-60 minute wait for summaries (tradeoff for 50% cost savings)
2. **Email context**: Limited to 2000 chars per email (configurable)
3. **Speaker accuracy**: Depends on context quality and transcript clarity
4. **M365 requirement**: Email context requires Microsoft 365 subscription
5. **SQLite**: Single writer limitation (not an issue for our use case)
6. **Batch API**: Results expire after 29 days (we save to database, so not a problem)

---

## Future Enhancements

1. **Real-time API option**: For urgent summaries (2x cost)
2. **Extended date ranges**: 30 days, custom ranges
3. **Automatic linking**: Recording-to-meeting association
4. **Voice profiles**: Train on speaker voices for better ID
5. **Multi-language**: Support non-English meetings
6. **Search**: Full-text search across summaries
7. **Analytics**: Meeting trends, action item completion tracking

---

**Last Updated**: 2025-01-13
**Maintained by**: Claude Code (Sonnet 4.5)
