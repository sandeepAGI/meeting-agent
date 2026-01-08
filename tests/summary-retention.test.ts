/**
 * Summary Retention Tests
 * Phase 7: Storage Management - Task 1.3
 * TDD Approach: RED phase - Write failing tests first
 */

import { DatabaseService } from '../src/services/database'
import * as path from 'path'
import * as fs from 'fs'

describe('Summary Retention', () => {
  let db: DatabaseService
  let testDbPath: string

  beforeEach(() => {
    // Create unique test database for each test
    const tmpDir = require('os').tmpdir()
    testDbPath = path.join(tmpDir, `test-summary-retention-${Date.now()}.db`)
    db = new DatabaseService(testDbPath)
  })

  afterEach(() => {
    db.close()
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  /**
   * Helper: Insert summary with specified age in days
   */
  function insertSummary(daysOld: number): string {
    // Create prerequisite data
    const recordingId = `recording-${Date.now()}-${Math.random()}`
    const transcriptId = `transcript-${Date.now()}-${Math.random()}`

    db.saveRecording({
      id: recordingId,
      file_path: '/fake/path/audio.wav',
      duration_seconds: 600,
      file_size_bytes: 1000000
    })

    db.saveTranscript({
      id: transcriptId,
      recording_id: recordingId,
      transcript_text: 'Test transcript',
      language: 'en'
    })

    // Create summary
    const summaryId = db.createSummary({
      transcript_id: transcriptId
    })

    // Manually set created_at to simulate old data
    const db_instance = (db as any).db
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - daysOld)
    db_instance.prepare(`
      UPDATE meeting_summaries
      SET created_at = ?
      WHERE id = ?
    `).run(targetDate.toISOString(), summaryId)

    return summaryId
  }

  it('should delete summaries older than retentionDays', () => {
    // Insert old summary (400 days ago)
    const oldSummaryId = insertSummary(400)

    // Set retention to 365 days
    const result = db.cleanupOldSummaries(365)

    // Assert summary deleted
    expect(result.deletedCount).toBe(1)
    const summary = db.getSummary(oldSummaryId)
    expect(summary).toBeFalsy() // getSummary returns undefined when not found
  })

  it('should keep summaries within retention period', () => {
    // Insert recent summary (100 days ago)
    const recentSummaryId = insertSummary(100)

    // Run cleanup with 365-day retention
    const result = db.cleanupOldSummaries(365)

    // Assert NOT deleted
    expect(result.deletedCount).toBe(0)
    const summary = db.getSummary(recentSummaryId)
    expect(summary).not.toBeNull()
    expect(summary?.id).toBe(recentSummaryId)
  })

  it('should handle retentionDays = 0 (keep forever)', () => {
    // Insert old summary (400 days ago)
    const oldSummaryId = insertSummary(400)

    // Run cleanup with 0-day retention (keep forever)
    const result = db.cleanupOldSummaries(0)

    // Assert NOT deleted
    expect(result.deletedCount).toBe(0)
    const summary = db.getSummary(oldSummaryId)
    expect(summary).not.toBeNull()
    expect(summary?.id).toBe(oldSummaryId)
  })

  it('should return accurate deleted count', () => {
    // Insert 5 old summaries (400, 450, 500, 550, 600 days ago)
    insertSummary(400)
    insertSummary(450)
    insertSummary(500)
    insertSummary(550)
    insertSummary(600)

    // Insert 2 recent summaries (100, 200 days ago)
    insertSummary(100)
    insertSummary(200)

    // Run cleanup with 365-day retention
    const result = db.cleanupOldSummaries(365)

    // Assert deleted count = 5 (all summaries older than 365 days)
    expect(result.deletedCount).toBe(5)
  })
})
