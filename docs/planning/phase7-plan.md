# Phase 7: Storage Management & Gmail Integration

**Status**: 📋 Planning
**Priority**: HIGH
**Estimated Duration**: 15-20 hours total
**Start Date**: TBD

---

## Overview

Phase 7 includes two major initiatives:

### Part 1: Storage Management (3-4 hours)
Implement critical data retention policies and storage quota enforcement. Currently, settings allow users to configure retention policies (e.g., delete transcripts after 30 days, limit audio storage to 5GB), but these are **not enforced**.

**Critical Issue**: User has `transcriptRetentionDays: 30` configured but transcripts are never deleted.

### Part 2: Gmail Integration (12-16 hours)
Add Gmail as an alternative email provider to Microsoft 365, allowing users with personal Gmail or Google Workspace accounts to send meeting summaries.

**See**: `docs/planning/gmail-integration.md` for comprehensive Gmail implementation details.

---

## Part 1: Storage Management (TDD Approach)

### Deferred Settings from Phase 6

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `dataRetention.transcriptRetentionDays` | number | 90 | Auto-delete transcripts after N days |
| `dataRetention.summaryRetentionDays` | number | 365 | Auto-delete summaries after N days |
| `dataRetention.audioStorageQuotaGB` | number | 10 | Max GB of audio files to keep |
| `dataRetention.keepAudioFiles` | boolean | false | Keep audio files after transcription (✅ Implemented in Phase 6 Batch 6) |

---

### Task 1.1: Background Job Scheduler

**Estimated**: 1 hour | **Priority**: HIGH

#### TDD Approach

**Phase 1 (RED - Write Failing Tests)**:

Create `tests/job-scheduler.test.ts`:

```typescript
describe('JobScheduler', () => {
  it('should start with 24-hour interval', () => {
    // Assert setInterval called with 24*60*60*1000
  })

  it('should run cleanup immediately on start', async () => {
    // Assert runRetentionCleanup called on start()
  })

  it('should stop interval on stop()', () => {
    // Assert clearInterval called
  })

  it('should call all cleanup methods', async () => {
    // Spy on cleanupTranscripts, cleanupSummaries, enforceAudioQuota
    // Assert all called
  })
})
```

Run: `npm test` → Tests fail (JobScheduler doesn't exist)

**Phase 2 (GREEN - Implement to Pass Tests)**:

Create `src/services/jobScheduler.ts`:

```typescript
export class JobScheduler {
  private intervalId: NodeJS.Timeout | null = null

  start(): void {
    // Run immediately
    this.runRetentionCleanup()

    // Schedule every 24 hours
    this.intervalId = setInterval(() => {
      this.runRetentionCleanup()
    }, 24 * 60 * 60 * 1000)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async runRetentionCleanup(): Promise<void> {
    console.log('[JobScheduler] Starting retention cleanup...')
    await this.cleanupTranscripts()
    await this.cleanupSummaries()
    await this.enforceAudioQuota()
    console.log('[JobScheduler] Retention cleanup complete')
  }

  private async cleanupTranscripts(): Promise<void> { /* Implemented in Task 1.2 */ }
  private async cleanupSummaries(): Promise<void> { /* Implemented in Task 1.3 */ }
  private async enforceAudioQuota(): Promise<void> { /* Implemented in Task 1.4 */ }
}
```

Integrate in `src/main/index.ts`:

```typescript
import { JobScheduler } from './services/jobScheduler'

const jobScheduler = new JobScheduler()

app.on('ready', () => {
  // ... existing initialization
  jobScheduler.start()
})

app.on('will-quit', () => {
  jobScheduler.stop()
})
```

Run: `npm test` → Tests pass ✅

**Phase 3 (REFACTOR - Optional)**:
- Extract cleanup methods to separate service if needed
- Add error handling for failed cleanup operations

---

### Task 1.2: Transcript Retention Policy

**Estimated**: 1 hour | **Priority**: CRITICAL

#### TDD Approach

**Phase 1 (RED - Write Failing Tests)**:

Create `tests/transcript-retention.test.ts`:

```typescript
describe('Transcript Retention', () => {
  it('should delete transcripts older than retentionDays', async () => {
    // Insert old transcript (created_at = 100 days ago)
    // Set retentionDays = 30
    // Run cleanup
    // Assert transcript deleted
  })

  it('should delete associated diarization data', async () => {
    // Insert old transcript with diarization
    // Run cleanup
    // Assert diarization deleted
  })

  it('should NOT delete recording', async () => {
    // Insert old transcript with recording
    // Run cleanup
    // Assert recording still exists
  })

  it('should keep transcripts within retention period', async () => {
    // Insert recent transcript (created_at = 10 days ago)
    // Set retentionDays = 30
    // Run cleanup
    // Assert transcript NOT deleted
  })

  it('should handle retentionDays = 0 (keep forever)', async () => {
    // Insert old transcript
    // Set retentionDays = 0
    // Run cleanup
    // Assert transcript NOT deleted
  })

  it('should return deleted count', async () => {
    // Insert 3 old transcripts
    // Run cleanup
    // Assert deletedCount = 3
  })
})
```

Run: `npm test` → Tests fail (method doesn't exist)

**Phase 2 (GREEN - Implement to Pass Tests)**:

Add to `src/services/database.ts`:

```typescript
cleanupOldTranscripts(retentionDays: number): { deletedCount: number } {
  if (retentionDays === 0) {
    return { deletedCount: 0 } // Keep forever
  }

  const db = this.getDatabase()

  // Get transcripts to delete
  const toDelete = db.prepare(`
    SELECT t.id, t.recording_id
    FROM transcripts t
    WHERE t.created_at < datetime('now', '-' || ? || ' days')
  `).all(retentionDays)

  let deletedCount = 0

  for (const transcript of toDelete) {
    // Delete associated diarization
    db.prepare('DELETE FROM diarizations WHERE transcript_id = ?').run(transcript.id)

    // Delete transcript
    db.prepare('DELETE FROM transcripts WHERE id = ?').run(transcript.id)

    deletedCount++
  }

  console.log(`[Cleanup] Deleted ${deletedCount} transcripts older than ${retentionDays} days`)
  return { deletedCount }
}
```

Update `JobScheduler.cleanupTranscripts()`:

```typescript
private async cleanupTranscripts(): Promise<void> {
  const settings = settingsService.getCategory('dataRetention')
  const retentionDays = settings.transcriptRetentionDays ?? 90
  const result = dbService.cleanupOldTranscripts(retentionDays)
  console.log(`[JobScheduler] Transcript cleanup: ${result.deletedCount} deleted`)
}
```

Run: `npm test` → Tests pass ✅

**Phase 3 (REFACTOR)**:
- Add transaction for atomic deletion
- Add error handling for database errors

---

### Task 1.3: Summary Retention Policy

**Estimated**: 30 min | **Priority**: HIGH

#### TDD Approach

**Phase 1 (RED - Write Failing Tests)**:

Create `tests/summary-retention.test.ts`:

```typescript
describe('Summary Retention', () => {
  it('should delete summaries older than retentionDays', async () => {
    // Insert old summary (created_at = 400 days ago)
    // Set retentionDays = 365
    // Run cleanup
    // Assert summary deleted
  })

  it('should keep summaries within retention period', async () => {
    // Insert recent summary (created_at = 100 days ago)
    // Set retentionDays = 365
    // Run cleanup
    // Assert summary NOT deleted
  })

  it('should handle retentionDays = 0 (keep forever)', async () => {
    // Insert old summary
    // Set retentionDays = 0
    // Run cleanup
    // Assert summary NOT deleted
  })

  it('should return deleted count', async () => {
    // Insert 5 old summaries
    // Run cleanup
    // Assert deletedCount = 5
  })
})
```

Run: `npm test` → Tests fail

**Phase 2 (GREEN - Implement to Pass Tests)**:

Add to `src/services/database.ts`:

```typescript
cleanupOldSummaries(retentionDays: number): { deletedCount: number } {
  if (retentionDays === 0) {
    return { deletedCount: 0 }
  }

  const db = this.getDatabase()

  const result = db.prepare(`
    DELETE FROM summaries
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `).run(retentionDays)

  const deletedCount = result.changes
  console.log(`[Cleanup] Deleted ${deletedCount} summaries older than ${retentionDays} days`)
  return { deletedCount }
}
```

Update `JobScheduler.cleanupSummaries()`:

```typescript
private async cleanupSummaries(): Promise<void> {
  const settings = settingsService.getCategory('dataRetention')
  const retentionDays = settings.summaryRetentionDays ?? 365
  const result = dbService.cleanupOldSummaries(retentionDays)
  console.log(`[JobScheduler] Summary cleanup: ${result.deletedCount} deleted`)
}
```

Run: `npm test` → Tests pass ✅

---

### Task 1.4: Audio Storage Quota Enforcement

**Estimated**: 1.5 hours | **Priority**: MEDIUM

#### TDD Approach

**Phase 1 (RED - Write Failing Tests)**:

Create `tests/audio-quota-enforcement.test.ts`:

```typescript
describe('Audio Quota Enforcement', () => {
  it('should calculate current audio storage usage', async () => {
    // Insert 3 recordings (10MB, 20MB, 30MB)
    // Assert getAudioStorageUsage() returns 60MB
  })

  it('should delete oldest files when over quota', async () => {
    // Insert 3 recordings (10MB, 20MB, 30MB) with timestamps
    // Set quota = 40MB
    // Run enforcement
    // Assert oldest 2 files deleted, newest kept
  })

  it('should update database (file_path = NULL)', async () => {
    // Insert recordings
    // Run enforcement
    // Assert deleted recordings have file_path = NULL
  })

  it('should NOT delete transcripts/summaries', async () => {
    // Insert recordings with transcripts and summaries
    // Run enforcement (delete files)
    // Assert transcripts and summaries still exist
  })

  it('should handle quota = 0 (unlimited)', async () => {
    // Insert large files
    // Set quota = 0
    // Run enforcement
    // Assert no files deleted
  })

  it('should handle missing files gracefully', async () => {
    // Insert recording with non-existent file_path
    // Run enforcement
    // Assert no error thrown
  })
})
```

Run: `npm test` → Tests fail

**Phase 2 (GREEN - Implement to Pass Tests)**:

Add to `src/services/database.ts`:

```typescript
getAudioStorageUsage(): { totalBytes: number; totalGB: number } {
  const db = this.getDatabase()
  const result = db.prepare(`
    SELECT SUM(file_size_bytes) as total_bytes
    FROM recordings
    WHERE file_path IS NOT NULL
  `).get()

  const totalBytes = result?.total_bytes || 0
  const totalGB = totalBytes / (1024 ** 3)

  return { totalBytes, totalGB }
}

getOldestRecordings(limit: number): Array<{ id: string; file_path: string; file_size_bytes: number }> {
  const db = this.getDatabase()
  return db.prepare(`
    SELECT id, file_path, file_size_bytes
    FROM recordings
    WHERE file_path IS NOT NULL
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit)
}

clearRecordingFilePath(recordingId: string): void {
  const db = this.getDatabase()
  db.prepare('UPDATE recordings SET file_path = NULL WHERE id = ?').run(recordingId)
}
```

Update `JobScheduler.enforceAudioQuota()`:

```typescript
private async enforceAudioQuota(): Promise<void> {
  const settings = settingsService.getCategory('dataRetention')
  const quotaGB = settings.audioStorageQuotaGB ?? 0

  if (quotaGB === 0) {
    return // Unlimited
  }

  const usage = dbService.getAudioStorageUsage()
  console.log(`[Quota] Current audio storage: ${usage.totalGB.toFixed(2)} GB / ${quotaGB} GB`)

  if (usage.totalGB <= quotaGB) {
    return // Under quota
  }

  // Delete oldest files until under quota
  const quotaBytes = quotaGB * (1024 ** 3)
  let currentBytes = usage.totalBytes
  let deletedCount = 0

  const oldestRecordings = dbService.getOldestRecordings(1000) // Max 1000 at a time

  for (const recording of oldestRecordings) {
    if (currentBytes <= quotaBytes) {
      break // Under quota now
    }

    try {
      // Delete file from disk
      if (fs.existsSync(recording.file_path)) {
        fs.unlinkSync(recording.file_path)
      }

      // Update database
      dbService.clearRecordingFilePath(recording.id)

      currentBytes -= recording.file_size_bytes
      deletedCount++

      console.log(`[Quota] Deleted: ${recording.file_path} (${(recording.file_size_bytes / (1024 ** 2)).toFixed(1)} MB)`)
    } catch (error) {
      console.error(`[Quota] Failed to delete ${recording.file_path}:`, error)
    }
  }

  console.log(`[Quota] Enforcement complete: ${deletedCount} files deleted`)
}
```

Run: `npm test` → Tests pass ✅

**Phase 3 (REFACTOR)**:
- Optimize deletion loop (batch deletes)
- Add safety margin (delete to 90% of quota, not 100%)

---

### Task 1.5: Storage Usage Dashboard

**Estimated**: 1 hour | **Priority**: MEDIUM

#### TDD Approach

**Phase 1 (RED - Write Failing Tests)**:

Create `tests/storage-dashboard.test.ts`:

```typescript
describe('Storage Dashboard IPC', () => {
  it('should return accurate storage usage stats', async () => {
    // Insert test data
    // Call get-storage-usage
    // Assert stats match expected values
  })

  it('should trigger manual cleanup', async () => {
    // Insert old data
    // Call run-cleanup-now
    // Assert data deleted
  })
})
```

Run: `npm test` → Tests fail

**Phase 2 (GREEN - Implement to Pass Tests)**:

Add IPC handlers to `src/main/index.ts`:

```typescript
ipcMain.handle('get-storage-usage', async () => {
  try {
    const audioUsage = dbService.getAudioStorageUsage()
    const settings = settingsService.getCategory('dataRetention')

    const db = dbService.getDatabase()

    const transcriptCount = db.prepare('SELECT COUNT(*) as count FROM transcripts').get().count
    const summaryCount = db.prepare('SELECT COUNT(*) as count FROM summaries').get().count
    const recordingCount = db.prepare('SELECT COUNT(*) as count FROM recordings WHERE file_path IS NOT NULL').get().count

    // Get oldest transcript/summary age
    const oldestTranscript = db.prepare(`
      SELECT (julianday('now') - julianday(created_at)) as age_days
      FROM transcripts
      ORDER BY created_at ASC
      LIMIT 1
    `).get()

    const oldestSummary = db.prepare(`
      SELECT (julianday('now') - julianday(created_at)) as age_days
      FROM summaries
      ORDER BY created_at ASC
      LIMIT 1
    `).get()

    return {
      success: true,
      usage: {
        audioGB: audioUsage.totalGB,
        quotaGB: settings.audioStorageQuotaGB ?? 10,
        transcriptCount,
        summaryCount,
        recordingCount,
        oldestTranscriptDays: Math.floor(oldestTranscript?.age_days || 0),
        oldestSummaryDays: Math.floor(oldestSummary?.age_days || 0)
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get storage usage'
    }
  }
})

ipcMain.handle('run-cleanup-now', async () => {
  try {
    const settings = settingsService.getCategory('dataRetention')

    const transcriptResult = dbService.cleanupOldTranscripts(settings.transcriptRetentionDays ?? 90)
    const summaryResult = dbService.cleanupOldSummaries(settings.summaryRetentionDays ?? 365)

    // Run audio quota enforcement
    await jobScheduler.enforceAudioQuota()

    return {
      success: true,
      result: {
        deletedTranscripts: transcriptResult.deletedCount,
        deletedSummaries: summaryResult.deletedCount
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cleanup failed'
    }
  }
})
```

Add to `src/preload/index.ts`:

```typescript
storage: {
  getUsage: () => ipcRenderer.invoke('get-storage-usage'),
  runCleanupNow: () => ipcRenderer.invoke('run-cleanup-now')
}
```

Add Storage section to `src/renderer/components/SettingsPanel.tsx`:

```tsx
// In Storage tab
const [storageUsage, setStorageUsage] = useState(null)

useEffect(() => {
  window.electronAPI.storage.getUsage().then(result => {
    if (result.success) {
      setStorageUsage(result.usage)
    }
  })
}, [])

const handleRunCleanup = async () => {
  const result = await window.electronAPI.storage.runCleanupNow()
  if (result.success) {
    // Refresh usage stats
    const usage = await window.electronAPI.storage.getUsage()
    setStorageUsage(usage.usage)
  }
}

return (
  <div className="storage-usage">
    <h3>Storage Usage</h3>
    <div className="storage-audio">
      <p>Audio Files: {storageUsage.audioGB.toFixed(2)} GB / {storageUsage.quotaGB} GB</p>
      <progress value={storageUsage.audioGB} max={storageUsage.quotaGB} />
    </div>
    <div className="storage-database">
      <p>Transcripts: {storageUsage.transcriptCount} (oldest: {storageUsage.oldestTranscriptDays} days)</p>
      <p>Summaries: {storageUsage.summaryCount} (oldest: {storageUsage.oldestSummaryDays} days)</p>
      <p>Recordings: {storageUsage.recordingCount} files</p>
    </div>
    <button onClick={handleRunCleanup}>Run Cleanup Now</button>
  </div>
)
```

Run: `npm test` → Tests pass ✅

---

### Part 1 Summary: Storage Management Testing Checklist

**Unit Tests**:
- [ ] JobScheduler: Start, stop, interval timing
- [ ] cleanupOldTranscripts: SQL correctness, edge cases
- [ ] cleanupOldSummaries: SQL correctness, edge cases
- [ ] Audio quota: Deletion algorithm accuracy

**Integration Tests**:
- [ ] End-to-end cleanup (insert old data → run cleanup → verify deleted)
- [ ] Database integrity after cleanup (no orphaned records)

**Manual Tests**:
- [ ] Set retention to 1 day, verify cleanup after 24 hours
- [ ] Set quota to 100MB, add 200MB audio, verify oldest deleted
- [ ] Use "Run Cleanup Now" button, verify immediate cleanup

---

## Part 2: Gmail Integration (TDD Approach)

**See**: `docs/planning/gmail-integration.md` for comprehensive 12-16 hour implementation plan with detailed specifications, architecture diagrams, and testing strategy.

### High-Level TDD Approach

#### Task 2.1: GoogleAuthService (3 hours)

**Phase 1 (RED - Write Failing Tests)**:

```typescript
describe('GoogleAuthService', () => {
  it('should initialize OAuth2 client', async () => { /* ... */ })
  it('should store tokens in keychain', async () => { /* ... */ })
  it('should refresh expired tokens', async () => { /* ... */ })
  it('should handle login flow', async () => { /* ... */ })
  it('should handle logout', async () => { /* ... */ })
})
```

**Phase 2 (GREEN)**: Implement `src/services/googleAuth.ts` using `googleapis` package

**Phase 3 (REFACTOR)**: Error handling, logging

#### Task 2.2: GmailApiService (2 hours)

**Phase 1 (RED)**:

```typescript
describe('GmailApiService', () => {
  it('should build MIME message correctly', () => { /* ... */ })
  it('should encode to Base64url', () => { /* ... */ })
  it('should send email via Gmail API', async () => { /* ... */ })
  it('should handle To and CC recipients', () => { /* ... */ })
})
```

**Phase 2 (GREEN)**: Implement `src/services/gmailApi.ts`

**Phase 3 (REFACTOR)**: MIME message builder optimization

#### Task 2.3: EmailProvider Abstraction (1.5 hours)

**Phase 1 (RED)**:

```typescript
describe('EmailProvider', () => {
  it('should create M365 provider', () => { /* ... */ })
  it('should create Gmail provider', () => { /* ... */ })
  it('should route emails to correct provider', async () => { /* ... */ })
})
```

**Phase 2 (GREEN)**: Implement `src/services/emailProvider.ts` with factory pattern

**Phase 3 (REFACTOR)**: Shared interface validation

#### Task 2.4: Settings Integration (2 hours)

**Phase 1 (RED)**:

```typescript
describe('Gmail Settings', () => {
  it('should save Google credentials', async () => { /* ... */ })
  it('should persist provider selection', async () => { /* ... */ })
  it('should validate credential format', () => { /* ... */ })
})
```

**Phase 2 (GREEN)**: Update settings schema, UI components

**Phase 3 (REFACTOR)**: UI polish, validation messages

#### Task 2.5: Integration Testing (1.5 hours)

**Manual Tests** (cannot be fully automated due to OAuth):
- [ ] Authenticate with real Google account
- [ ] Send test email via Gmail API
- [ ] Verify email in recipient inbox
- [ ] Switch between M365 and Gmail
- [ ] Verify token persistence after restart

---

## Success Criteria

### Part 1: Storage Management
- [ ] Transcripts older than retention period automatically deleted
- [ ] Summaries older than retention period automatically deleted
- [ ] Audio storage under quota (oldest deleted when exceeded)
- [ ] Cleanup runs every 24 hours
- [ ] Storage dashboard shows accurate stats
- [ ] Manual cleanup works
- [ ] Database integrity maintained

### Part 2: Gmail Integration
- [ ] User can authenticate with Google account
- [ ] User can send emails via Gmail API
- [ ] Emails appear correctly formatted in Gmail
- [ ] Provider switching works seamlessly
- [ ] Tokens persist across app restarts
- [ ] No breaking changes for M365 users

---

## Testing Strategy Summary

**Total Tests Estimated**:
- Storage Management: ~30 unit tests + 5 integration tests
- Gmail Integration: ~25 unit tests + manual testing checklist

**Test Framework**: Jest (existing)

**Coverage Goal**: >80% for new code

**Manual Testing**: Required for OAuth flows and email delivery verification

---

## Documentation Updates

**New Files**:
- `docs/guides/google-cloud-setup.md` - Google Cloud Console setup
- `docs/guides/gmail-setup.md` - Gmail integration guide
- `docs/technical/email-distribution.md` - Email provider architecture

**Updated Files**:
- `README.md` - Add Gmail to features
- `docs/developer/architecture.md` - Email provider abstraction
- `CLAUDE.md` - Update tech stack

---

## Notes

- Part 1 (Storage Management) is **critical** - user has retention policies configured but not enforced
- Part 2 (Gmail Integration) is **high priority** - expands user base beyond M365 users
- Both parts use TDD methodology for quality and maintainability
- After completion, move this plan to `docs/archive/phase7/`
- Create `docs/planning/phase8-plan.md` for performance optimization
