# Phase 7: Data Management & Storage

**Status**: 📋 Planning
**Priority**: HIGH
**Estimated Duration**: 3-4 hours
**Start Date**: TBD

---

## Overview

Phase 7 implements critical data retention policies and storage quota enforcement. Currently, the settings UI allows users to configure retention policies (e.g., delete transcripts after 30 days, limit audio storage to 5GB), but these settings are **not enforced** by the application.

**Critical Issue**: User has `transcriptRetentionDays: 30` configured but transcripts are never deleted. This could lead to unbounded database growth and privacy concerns.

---

## Goals

1. **Enforce retention policies** for transcripts, summaries, and audio files
2. **Enforce storage quotas** to prevent disk space exhaustion
3. **Implement background job scheduler** for periodic cleanup tasks
4. **Add storage usage dashboard** to settings UI for visibility
5. **Maintain data integrity** during cleanup operations

---

## Deferred Settings from Phase 6

These settings exist in `settings.json` but are not currently enforced:

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `dataRetention.transcriptRetentionDays` | number | 90 | Auto-delete transcripts after N days |
| `dataRetention.summaryRetentionDays` | number | 365 | Auto-delete summaries after N days |
| `dataRetention.audioStorageQuotaGB` | number | 10 | Max GB of audio files to keep |
| `dataRetention.keepAudioFiles` | boolean | false | Keep audio files after transcription (✅ Implemented in Phase 6 Batch 6) |

---

## Implementation Plan

### Task 1: Background Job Scheduler
**Estimated**: 1 hour | **Priority**: HIGH

**Goal**: Create a simple job scheduler that runs retention cleanup tasks periodically.

**Implementation**:
- Create `src/services/jobScheduler.ts`
- Use `setInterval()` to run cleanup every 24 hours
- Start scheduler on app ready
- Stop scheduler on app quit
- Log all scheduled job executions

**API**:
```typescript
class JobScheduler {
  private intervalId: NodeJS.Timeout | null = null

  start(): void {
    // Run cleanup every 24 hours
    this.intervalId = setInterval(() => {
      this.runRetentionCleanup()
    }, 24 * 60 * 60 * 1000)

    // Run immediately on start
    this.runRetentionCleanup()
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }

  private async runRetentionCleanup(): Promise<void> {
    console.log('[JobScheduler] Starting retention cleanup...')
    await this.cleanupTranscripts()
    await this.cleanupSummaries()
    await this.enforceAudioQuota()
    console.log('[JobScheduler] Retention cleanup complete')
  }

  private async cleanupTranscripts(): Promise<void> { /* ... */ }
  private async cleanupSummaries(): Promise<void> { /* ... */ }
  private async enforceAudioQuota(): Promise<void> { /* ... */ }
}
```

**Integration**:
- In `src/main/index.ts`:
  - Import `JobScheduler`
  - Call `jobScheduler.start()` in `app.on('ready')`
  - Call `jobScheduler.stop()` in `app.on('will-quit')`

**Testing**:
- Unit tests for scheduler logic (start, stop, interval)
- Mock `setInterval()` to verify 24-hour interval
- Verify cleanup runs on start

---

### Task 2: Transcript Retention Policy
**Estimated**: 1 hour | **Priority**: CRITICAL

**Goal**: Automatically delete transcripts (and associated data) older than `transcriptRetentionDays`.

**Database Operations**:
1. Get all transcripts older than retention threshold:
   ```sql
   SELECT t.id, t.recording_id
   FROM transcripts t
   WHERE t.created_at < datetime('now', '-' || ? || ' days')
   ```
2. For each transcript:
   - Delete associated diarization data: `DELETE FROM diarizations WHERE transcript_id = ?`
   - Delete transcript: `DELETE FROM transcripts WHERE id = ?`
   - **Do NOT delete recording** (user may want to re-transcribe)

**Implementation**:
- Add method to `DatabaseService`: `cleanupOldTranscripts(retentionDays: number): { deletedCount: number }`
- In `JobScheduler.cleanupTranscripts()`:
  - Read `settings.dataRetention.transcriptRetentionDays`
  - Call `dbService.cleanupOldTranscripts(retentionDays)`
  - Log results: `[Cleanup] Deleted ${count} transcripts older than ${retentionDays} days`

**Edge Cases**:
- If `retentionDays === 0`, skip cleanup (keep forever)
- If `retentionDays === null/undefined`, use default (90 days)
- Handle database errors gracefully (log, don't crash)

**Testing**:
- Create old transcript (set `created_at` to 100 days ago)
- Run cleanup with `retentionDays: 30`
- Verify transcript deleted
- Verify associated diarization deleted
- Verify recording NOT deleted

---

### Task 3: Summary Retention Policy
**Estimated**: 30 min | **Priority**: HIGH

**Goal**: Automatically delete summaries older than `summaryRetentionDays`.

**Database Operations**:
1. Get all summaries older than retention threshold:
   ```sql
   SELECT id FROM summaries
   WHERE created_at < datetime('now', '-' || ? || ' days')
   ```
2. Delete summaries:
   ```sql
   DELETE FROM summaries WHERE id IN (...)
   ```

**Implementation**:
- Add method to `DatabaseService`: `cleanupOldSummaries(retentionDays: number): { deletedCount: number }`
- In `JobScheduler.cleanupSummaries()`:
  - Read `settings.dataRetention.summaryRetentionDays`
  - Call `dbService.cleanupOldSummaries(retentionDays)`
  - Log results

**Edge Cases**:
- Same as transcript retention (0 = keep forever, null = default 365 days)
- Handle database errors gracefully

**Testing**:
- Create old summary (set `created_at` to 400 days ago)
- Run cleanup with `retentionDays: 365`
- Verify summary deleted

---

### Task 4: Audio Storage Quota Enforcement
**Estimated**: 1.5 hours | **Priority**: MEDIUM

**Goal**: Enforce maximum audio storage (GB). When quota exceeded, delete oldest audio files.

**Algorithm**:
1. Calculate current audio storage usage:
   ```sql
   SELECT SUM(file_size_bytes) as total_bytes
   FROM recordings
   WHERE file_path IS NOT NULL
   ```
2. If `total_bytes > quotaGB * 1024^3`:
   - Get oldest recordings:
     ```sql
     SELECT id, file_path, file_size_bytes
     FROM recordings
     ORDER BY created_at ASC
     ```
   - Delete oldest files until under quota:
     - Delete file from disk: `fs.unlinkSync(file_path)`
     - Update database: `UPDATE recordings SET file_path = NULL WHERE id = ?`
     - Keep database record (transcript/summary may still exist)

**Implementation**:
- Add method to `DatabaseService`:
  - `getAudioStorageUsage(): { totalBytes: number, totalGB: number }`
  - `getOldestRecordings(limit: number): Recording[]`
  - `clearRecordingFilePath(recordingId: string): void`
- In `JobScheduler.enforceAudioQuota()`:
  - Read `settings.dataRetention.audioStorageQuotaGB`
  - If quota is 0, skip (unlimited)
  - Calculate usage
  - If over quota, delete oldest until under quota

**Edge Cases**:
- Handle missing files gracefully (file already deleted manually)
- Don't delete if `file_path` is NULL (already deleted)
- Log each deletion: `[Quota] Deleted audio file: ${filePath} (${sizeGB} GB)`
- Stop if quota unreachable (all files deleted but still over)

**Testing**:
- Create 3 recordings with known sizes (10MB, 20MB, 30MB)
- Set quota to 40MB
- Run enforcement
- Verify oldest 2 files deleted (keeping total under 40MB)
- Verify database records updated (`file_path = NULL`)
- Verify transcripts/summaries NOT deleted

---

### Task 5: Storage Usage Dashboard
**Estimated**: 1 hour | **Priority**: MEDIUM

**Goal**: Add visibility into storage usage in Settings UI.

**UI Design**:
```
┌─────────────────────────────────────────┐
│ Storage Usage                           │
├─────────────────────────────────────────┤
│ Audio Files: 2.3 GB / 10 GB (23%)      │
│ ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│                                         │
│ Database: 45 MB                         │
│ - Transcripts: 32 (oldest: 45 days)   │
│ - Summaries: 12 (oldest: 120 days)    │
│ - Recordings: 32 files                 │
│                                         │
│ [Run Cleanup Now]                       │
└─────────────────────────────────────────┘
```

**Implementation**:
- Add IPC handler: `get-storage-usage`
  - Returns: `{ audioGB, quotaGB, transcriptCount, summaryCount, recordingCount, oldestTranscriptDays, oldestSummaryDays }`
- Add IPC handler: `run-cleanup-now`
  - Manually triggers retention cleanup
  - Returns: `{ deletedTranscripts, deletedSummaries, deletedAudioFiles }`
- In `SettingsPanel.tsx`:
  - Add new "Storage" tab section at bottom
  - Fetch usage on mount
  - Display progress bar for audio quota
  - Display stats for database
  - Add "Run Cleanup Now" button

**Testing**:
- Verify usage stats are accurate
- Verify progress bar displays correctly
- Verify manual cleanup works

---

## Testing Strategy

### Unit Tests
- `JobScheduler`: Start, stop, interval timing
- `DatabaseService.cleanupOldTranscripts()`: Correct SQL, edge cases
- `DatabaseService.cleanupOldSummaries()`: Correct SQL, edge cases
- `DatabaseService.getAudioStorageUsage()`: Correct calculation
- Quota enforcement algorithm: Delete correct files

### Integration Tests
- End-to-end cleanup flow:
  1. Create old data (transcripts, summaries, audio)
  2. Run scheduler
  3. Verify correct data deleted
  4. Verify database integrity maintained

### Manual Tests
- Set retention to 1 day, wait 24 hours, verify cleanup
- Set quota to 100MB, add 200MB audio, verify oldest deleted
- Use "Run Cleanup Now" button, verify immediate cleanup
- Check logs for cleanup activity

---

## Database Schema Updates

**No schema changes required** - existing tables support retention:
- `transcripts.created_at` - used for age calculation
- `summaries.created_at` - used for age calculation
- `recordings.file_path` - set to NULL when file deleted
- `recordings.file_size_bytes` - used for quota calculation

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| **Data loss** (accidentally delete active data) | Add 7-day safety buffer (delete only if > retention + 7) |
| **Quota thrashing** (constantly deleting/re-recording) | Warn user if quota too small (< 1GB) |
| **Long-running cleanup** (blocks app) | Run cleanup in async tasks, add timeout |
| **Disk space errors** (can't delete files) | Catch errors, log, continue with next file |
| **User surprise** (data disappeared) | Add notification: "Cleanup deleted 5 transcripts (>30 days old)" |

---

## Success Criteria

- [ ] Transcripts older than retention period are automatically deleted
- [ ] Summaries older than retention period are automatically deleted
- [ ] Audio storage stays under quota (oldest files deleted when exceeded)
- [ ] Cleanup runs every 24 hours automatically
- [ ] Storage usage dashboard shows accurate stats
- [ ] Manual "Run Cleanup Now" works
- [ ] All retention settings respected (0 = keep forever)
- [ ] Database integrity maintained (no orphaned records)
- [ ] Comprehensive logging for troubleshooting

---

## Future Enhancements (Phase 8+)

- Export/archive old data before deletion
- User confirmation before first cleanup
- Scheduled cleanup time (e.g., 3am daily)
- Email notifications for cleanup activity
- Retention policy per meeting (keep important meetings longer)
- Compression for old transcripts (save space without deletion)

---

## Notes

- Start with conservative safety margins (retention + 7 days)
- Add extensive logging for first few releases
- Consider user notification for first cleanup
- Monitor user feedback on retention defaults
- May need to adjust defaults based on usage patterns
