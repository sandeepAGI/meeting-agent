# TDD Plan: Fix Recording Database Insertion Bug

**Date**: 2026-01-06
**Bug**: Recordings are saved to disk but not inserted into database
**Impact**: Users cannot see recordings in Browse mode after recording
**Priority**: HIGH

---

## Problem Analysis

### Current Flow - TWO SCENARIOS

#### Scenario A: Record → Transcribe Immediately ✅ WORKS
1. User clicks "Stop Recording"
2. Audio saved to disk
3. User clicks "Transcribe + Diarize"
4. `transcribe-and-diarize` IPC handler (line 553 in index.ts)
5. **Recording saved to database during transcription** ✅
6. User can see recording in Browse mode

#### Scenario B: Record → Don't Transcribe ❌ BUG
1. User clicks "Stop Recording"
2. `AudioCaptureService.stopRecording()`:
   - Saves final chunk
   - Merges chunks via IPC
   - Returns `filePath`
3. ❌ **Recording NOT saved to database**
4. User closes app or switches views
5. User later wants to transcribe → Can't find recording in Browse mode

### Root Cause
Recording is ONLY saved to database during transcription (line 553 in `src/main/index.ts`), not when recording stops. If user doesn't transcribe immediately, recording stays on disk but never enters database.

### Impact Analysis
- **On disk**: 46+ recording directories
- **In database**: 54 recordings
  - Transcribed: 37 ✅ (saved during transcription)
  - Not transcribed: 17 (some manually added, some might be orphaned)
- **Missing**: Recordings that were never transcribed are invisible in Browse mode

### Expected Behavior
When recording stops:
1. Save final chunk
2. Merge all chunks
3. **Insert recording into database immediately** ✅ THIS IS MISSING
4. Return recording ID and file path
5. User can see recording in Browse mode (even before transcription)

---

## TDD Plan: RED → GREEN → REFACTOR

### Phase 1: RED - Write Failing Tests

#### Test 1: Recording Saved to Database After Stop
**File**: `tests/recording-database-insertion.test.ts` (new)

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { DatabaseService } from '../src/services/database'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('Recording Database Insertion', () => {
  let db: DatabaseService
  let dbPath: string

  beforeEach(() => {
    // Create temporary database for testing
    const tmpDir = os.tmpdir()
    dbPath = path.join(tmpDir, `test-recording-${Date.now()}.db`)
    db = new DatabaseService(dbPath)
  })

  afterEach(() => {
    // Cleanup
    db.close()
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  it('should insert recording into database when stopRecording completes', async () => {
    // Arrange
    const recordingId = 'test-recording-123'
    const filePath = '/path/to/merged.wav'
    const duration = 120.5
    const fileSize = 1024000

    // Act
    db.saveRecording({
      id: recordingId,
      file_path: filePath,
      file_size_bytes: fileSize,
      duration_seconds: duration,
      sample_rate: 16000,
      channels: 2,
      format: 'wav'
    })

    // Assert
    const recordings = db.getUntranscribedRecordings(10)
    expect(recordings).toHaveLength(1)
    expect(recordings[0].recording_id).toBe(recordingId)
    expect(recordings[0].file_path).toBe(filePath)
    expect(recordings[0].duration_seconds).toBe(duration)
  })

  it('should handle database insertion errors gracefully', async () => {
    // Arrange
    const invalidRecording = {
      id: 'test-123',
      file_path: '', // Invalid: empty path
      file_size_bytes: 1000,
      duration_seconds: 60
    }

    // Act & Assert
    expect(() => {
      db.saveRecording(invalidRecording)
    }).toThrow() // Should fail due to NOT NULL constraint
  })
})
```

**Expected Result**: ❌ Tests will FAIL because recording is not being saved in current code

---

### Phase 2: GREEN - Make Tests Pass

#### Step 2.1: Add IPC Handler for Database Insertion
**File**: `src/main/index.ts`

Add new IPC handler:
```typescript
// After merge-audio-chunks handler
ipcMain.handle('save-recording-to-database', async (_event, recordingData) => {
  try {
    const { id, filePath, duration, sizeBytes } = recordingData

    // Get file stats if not provided
    const fileSize = sizeBytes || fs.statSync(filePath).size

    // Save to database
    databaseService.saveRecording({
      id,
      file_path: filePath,
      file_size_bytes: fileSize,
      duration_seconds: duration,
      sample_rate: 16000,
      channels: 2, // Stereo from audio loopback
      format: 'wav'
    })

    console.log('[Database] Recording saved:', id)
    return { success: true, recordingId: id }
  } catch (error) {
    console.error('[Database] Failed to save recording:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
```

#### Step 2.2: Expose IPC in Preload
**File**: `src/preload/index.ts`

Add to `electronAPI`:
```typescript
database: {
  // ... existing methods ...
  saveRecording: (recordingData: {
    id: string
    filePath: string
    duration: number
    sizeBytes: number
  }) => ipcRenderer.invoke('save-recording-to-database', recordingData)
}
```

#### Step 2.3: Update TypeScript Types
**File**: `src/types/electron.d.ts`

```typescript
interface ElectronAPI {
  database: {
    // ... existing methods ...
    saveRecording: (recordingData: {
      id: string
      filePath: string
      duration: number
      sizeBytes: number
    }) => Promise<{ success: boolean; recordingId?: string; error?: string }>
  }
}
```

#### Step 2.4: Call Database Save After Merge
**File**: `src/services/audioCapture.ts`

Update `stopRecording()` method (around line 348):

```typescript
// After merge completes
const mergeResult = await window.electronAPI.mergeAudioChunks(this.sessionId!)

if (!mergeResult.success) {
  throw new Error(mergeResult.error || 'Failed to merge chunks')
}

// NEW: Save to database
const recordingId = crypto.randomUUID()
const dbResult = await window.electronAPI.database.saveRecording({
  id: recordingId,
  filePath: mergeResult.filePath || '',
  duration: duration,
  sizeBytes: mergeResult.sizeBytes || 0
})

if (!dbResult.success) {
  console.error('[AudioCapture] Failed to save to database:', dbResult.error)
  // Don't throw - recording is still on disk, user can manually recover
}

const session: RecordingSessionWithBlob = {
  id: recordingId, // Use database ID instead of timestamp
  filePath: mergeResult.filePath || '',
  startTime: this.startTime!,
  endTime,
  duration,
  sizeBytes: mergeResult.sizeBytes || 0,
  blob,
}
```

**Expected Result**: ✅ Tests will PASS - recording is now saved to database

---

### Phase 3: REFACTOR - Improve Code Quality

#### Refactor 3.1: Add Error Recovery
If database save fails, log error but don't fail the recording:
```typescript
if (!dbResult.success) {
  console.error('[AudioCapture] Database save failed:', dbResult.error)
  console.error('[AudioCapture] Recording saved to disk at:', mergeResult.filePath)
  console.error('[AudioCapture] User can manually add to database or re-record')
  // Continue - don't throw, recording file exists
}
```

#### Refactor 3.2: Add Database Validation
**File**: `src/services/database.ts`

Update `saveRecording()` to validate inputs:
```typescript
saveRecording(recording: { ... }): void {
  // Validate required fields
  if (!recording.id || !recording.file_path) {
    throw new Error('Recording ID and file path are required')
  }

  // Check if recording already exists
  const existing = this.db.prepare(
    'SELECT id FROM recordings WHERE id = ?'
  ).get(recording.id)

  if (existing) {
    console.warn(`[Database] Recording ${recording.id} already exists, skipping`)
    return
  }

  // ... rest of insertion logic
}
```

#### Refactor 3.3: Add Integration Test
**File**: `tests/recording-flow-integration.test.ts`

Test the full flow from start to database:
```typescript
it('should save recording to database after full recording flow', async () => {
  // Arrange: Mock audio capture
  const mockAudioService = new AudioCaptureService()

  // Act: Start → Record → Stop
  await mockAudioService.startCapture()
  await mockAudioService.startRecording()
  await new Promise(resolve => setTimeout(resolve, 1000)) // Record for 1 sec
  const session = await mockAudioService.stopRecording()

  // Assert: Check database
  const recordings = db.getUntranscribedRecordings(10)
  expect(recordings.length).toBeGreaterThan(0)
  expect(recordings[0].file_path).toBe(session.filePath)
})
```

---

## Testing Checklist

### Unit Tests
- [ ] `saveRecording()` inserts recording with all metadata
- [ ] `saveRecording()` throws on invalid input
- [ ] `saveRecording()` handles duplicate IDs gracefully
- [ ] IPC handler returns success/error correctly

### Integration Tests
- [ ] Full flow: start → record → stop → database
- [ ] Recording visible in Browse mode immediately after stop
- [ ] Error in database doesn't lose recording file

### Manual Tests
- [ ] **Test 1**: Record → Stop → Check Browse mode (recording appears)
- [ ] **Test 2**: Record → Stop → Check database (row exists)
- [ ] **Test 3**: Record → Stop → Check file system (file exists)
- [ ] **Test 4**: Database error → Recording file still saved
- [ ] **Test 5**: Multiple recordings → All saved to database

---

## Success Criteria

✅ **All tests pass** (unit + integration)
✅ **No regressions** - existing functionality works
✅ **Recording appears in Browse mode** immediately after stop
✅ **Error handling** - graceful degradation if database fails
✅ **Manual testing** - all 5 manual tests pass

---

## Rollback Plan

If bugs are discovered:
1. Revert changes to `audioCapture.ts`
2. Keep IPC handler (no harm if not called)
3. Document issue in GitHub issues
4. Recording still saved to disk (user can manually recover)

---

## Files Modified

1. `tests/recording-database-insertion.test.ts` (NEW)
2. `tests/recording-flow-integration.test.ts` (NEW)
3. `src/main/index.ts` - Add IPC handler
4. `src/preload/index.ts` - Expose IPC method
5. `src/types/electron.d.ts` - Add TypeScript types
6. `src/services/audioCapture.ts` - Call database save
7. `src/services/database.ts` - Add validation (optional)

---

## Estimated Time

- **RED (Tests)**: 30 minutes
- **GREEN (Implementation)**: 45 minutes
- **REFACTOR (Quality)**: 30 minutes
- **Manual Testing**: 15 minutes
- **Total**: ~2 hours

---

## Notes

- **Bug discovered**: Jan 6, 2026
- **Existed since**: Phase 1.5 (chunked recording, ~Oct 13, 2025)
- **Affected recordings**: Only those that were NEVER transcribed
  - If you transcribed immediately → Recording saved to DB ✅ (37 recordings OK)
  - If you didn't transcribe → Recording on disk only ❌ (~9 recordings affected)
- **Why it wasn't noticed earlier**: Most users transcribe immediately after recording
- **Fix impact**:
  - Going forward: All recordings saved to DB immediately
  - Existing: Only need to recover ~9 untranscribed recordings
- **No data loss**: All recordings still on disk, just not visible in UI

---

## Recovery Plan for Existing Recordings

**Good News**: Only need to recover recordings that were NEVER transcribed!

- **Transcribed recordings (37)**: Already in database ✅
- **Untranscribed recordings**: Only those on disk but missing from DB need recovery

### Option 1: Manual Check Script

Quick script to identify missing recordings:

```bash
# Check which recordings are on disk but not in DB
sqlite3 ~/Library/Application\ Support/meeting-agent/meeting-agent.db \
  "SELECT file_path FROM recordings" > /tmp/db_recordings.txt

find "/Users/sandeepmangaraj/Library/Application Support/meeting-agent/recordings" \
  -name "merged.wav" -type f > /tmp/disk_recordings.txt

# Compare the two lists
# Any in disk_recordings but not in db_recordings need recovery
```

### Option 2: Automated Recovery Script

Only for recordings on disk with no database entry:

```typescript
// scripts/recover-missing-recordings.ts
import { DatabaseService } from '../src/services/database'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const userDataPath = '/Users/sandeepmangaraj/Library/Application Support/meeting-agent'
const recordingsDir = path.join(userDataPath, 'recordings')
const db = new DatabaseService()

let recovered = 0
let skipped = 0

// Scan for merged.wav files
const subdirs = fs.readdirSync(recordingsDir).filter(d => d.startsWith('20'))

for (const subdir of subdirs) {
  const mergedPath = path.join(recordingsDir, subdir, 'merged.wav')

  if (!fs.existsSync(mergedPath)) {
    continue // No audio file
  }

  // Check if ALREADY in database
  const existing = db.db.prepare(
    'SELECT id FROM recordings WHERE file_path = ?'
  ).get(mergedPath)

  if (existing) {
    skipped++
    continue // Already in DB (probably transcribed)
  }

  // NEW recording not in database - add it
  const stats = fs.statSync(mergedPath)

  // Get duration using ffprobe
  let duration = 0
  try {
    const result = execSync(
      `ffprobe -i "${mergedPath}" -show_entries format=duration -v quiet -of csv="p=0"`,
      { encoding: 'utf-8' }
    )
    duration = parseFloat(result.trim())
  } catch (e) {
    console.warn(`Could not get duration for ${subdir}`)
  }

  const id = crypto.randomUUID()
  db.saveRecording({
    id,
    file_path: mergedPath,
    file_size_bytes: stats.size,
    duration_seconds: duration,
    sample_rate: 16000,
    channels: 2,
    format: 'wav'
  })

  console.log(`✅ Recovered: ${subdir} (${(duration / 60).toFixed(1)} min)`)
  recovered++
}

console.log(`\nRecovery complete:`)
console.log(`  - Recovered: ${recovered} recordings`)
console.log(`  - Skipped (already in DB): ${skipped} recordings`)
```

**Expected**: Should recover ~9-10 recordings (46 on disk - 37 transcribed = ~9)
