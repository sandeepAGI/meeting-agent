/**
 * Storage Dashboard IPC Tests
 * Phase 7: Storage Management - Task 1.5
 * TDD Approach: RED phase - Write failing tests first
 *
 * Note: These are integration tests for IPC handlers.
 * We test the handlers directly rather than through IPC.
 */

import { DatabaseService } from '../src/services/database'
import { SettingsService } from '../src/services/settings'
import { JobScheduler } from '../src/services/jobScheduler'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

describe('Storage Dashboard IPC Handlers', () => {
  let db: DatabaseService
  let settings: SettingsService
  let scheduler: JobScheduler
  let testDbPath: string
  let testSettingsPath: string

  beforeEach(() => {
    // Create unique test database and settings
    const tmpDir = os.tmpdir()
    testDbPath = path.join(tmpDir, `test-storage-ipc-${Date.now()}.db`)
    testSettingsPath = path.join(tmpDir, `test-settings-${Date.now()}.json`)

    db = new DatabaseService(testDbPath)
    settings = new SettingsService(testSettingsPath)
    scheduler = new JobScheduler(db, settings)
  })

  afterEach(() => {
    db.close()

    // Clean up test files
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    if (fs.existsSync(testSettingsPath)) {
      fs.unlinkSync(testSettingsPath)
    }
  })

  /**
   * Helper: Insert test data
   */
  function insertTestData() {
    // Insert recordings
    const recordingId1 = 'recording-1'
    const recordingId2 = 'recording-2'

    db.saveRecording({
      id: recordingId1,
      file_path: '/fake/path/audio1.wav',
      file_size_bytes: 10 * 1024 * 1024, // 10 MB
      duration_seconds: 600
    })

    db.saveRecording({
      id: recordingId2,
      file_path: '/fake/path/audio2.wav',
      file_size_bytes: 20 * 1024 * 1024, // 20 MB
      duration_seconds: 1200
    })

    // Insert transcripts
    const transcriptId1 = 'transcript-1'
    const transcriptId2 = 'transcript-2'

    db.saveTranscript({
      id: transcriptId1,
      recording_id: recordingId1,
      transcript_text: 'Test transcript 1',
      language: 'en'
    })

    db.saveTranscript({
      id: transcriptId2,
      recording_id: recordingId2,
      transcript_text: 'Test transcript 2',
      language: 'en'
    })

    // Insert summaries
    db.createSummary({
      transcript_id: transcriptId1
    })

    db.createSummary({
      transcript_id: transcriptId2
    })
  }

  describe('getStorageUsage', () => {
    it('should return accurate storage usage stats', () => {
      insertTestData()

      // Calculate expected values
      const audioUsage = db.getAudioStorageUsage()
      const expectedAudioGB = 30 / 1024 // 30 MB in GB

      // Verify audio storage
      expect(audioUsage.totalBytes).toBe(30 * 1024 * 1024)
      expect(audioUsage.totalGB).toBeCloseTo(expectedAudioGB, 3)

      // Get counts
      const db_instance = (db as any).db
      const transcriptCount = db_instance.prepare('SELECT COUNT(*) as count FROM transcripts').get().count
      const summaryCount = db_instance.prepare('SELECT COUNT(*) as count FROM meeting_summaries').get().count
      const recordingCount = db_instance.prepare("SELECT COUNT(*) as count FROM recordings WHERE file_path != ''").get().count

      expect(transcriptCount).toBe(2)
      expect(summaryCount).toBe(2)
      expect(recordingCount).toBe(2)
    })

    it('should return zero values for empty database', () => {
      const audioUsage = db.getAudioStorageUsage()

      expect(audioUsage.totalBytes).toBe(0)
      expect(audioUsage.totalGB).toBe(0)
    })

    it('should calculate oldest transcript age', () => {
      insertTestData()

      // Age oldest transcript (100 days old)
      const db_instance = (db as any).db
      const transcripts = db_instance.prepare('SELECT id FROM transcripts ORDER BY created_at ASC LIMIT 1').all()
      const oldestTranscriptId = transcripts[0].id

      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() - 100)
      db_instance.prepare('UPDATE transcripts SET created_at = ? WHERE id = ?')
        .run(targetDate.toISOString(), oldestTranscriptId)

      // Calculate age
      const ageResult = db_instance.prepare(`
        SELECT (julianday('now') - julianday(created_at)) as age_days
        FROM transcripts
        ORDER BY created_at ASC
        LIMIT 1
      `).get()

      expect(Math.floor(ageResult.age_days)).toBeGreaterThanOrEqual(99)
      expect(Math.floor(ageResult.age_days)).toBeLessThanOrEqual(101)
    })
  })

  describe('runCleanupNow', () => {
    it('should delete old transcripts based on retention setting', () => {
      insertTestData()

      // Age one transcript (100 days old)
      const db_instance = (db as any).db
      const transcripts = db_instance.prepare('SELECT id FROM transcripts LIMIT 1').all()
      const oldTranscriptId = transcripts[0].id

      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() - 100)
      db_instance.prepare('UPDATE transcripts SET created_at = ? WHERE id = ?')
        .run(targetDate.toISOString(), oldTranscriptId)

      // Set retention to 30 days
      settings.updateCategory('dataRetention', { transcriptRetentionDays: 30 })

      // Run cleanup
      const result = db.cleanupOldTranscripts(30)

      expect(result.deletedCount).toBe(1)
    })

    it('should delete old summaries based on retention setting', () => {
      insertTestData()

      // Age one summary (400 days old)
      const db_instance = (db as any).db
      const summaries = db_instance.prepare('SELECT id FROM meeting_summaries LIMIT 1').all()
      const oldSummaryId = summaries[0].id

      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() - 400)
      db_instance.prepare('UPDATE meeting_summaries SET created_at = ? WHERE id = ?')
        .run(targetDate.toISOString(), oldSummaryId)

      // Set retention to 365 days
      settings.updateCategory('dataRetention', { summaryRetentionDays: 365 })

      // Run cleanup
      const result = db.cleanupOldSummaries(365)

      expect(result.deletedCount).toBe(1)
    })

    it('should return deleted counts', () => {
      insertTestData()

      // Age data
      const db_instance = (db as any).db
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() - 100)

      db_instance.prepare('UPDATE transcripts SET created_at = ?').run(targetDate.toISOString())
      db_instance.prepare('UPDATE meeting_summaries SET created_at = ?').run(targetDate.toISOString())

      // Run cleanups
      const transcriptResult = db.cleanupOldTranscripts(30)
      const summaryResult = db.cleanupOldSummaries(30)

      expect(transcriptResult.deletedCount).toBe(2)
      expect(summaryResult.deletedCount).toBe(2)
    })
  })
})
