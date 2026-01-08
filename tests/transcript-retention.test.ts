/**
 * Transcript Retention Tests
 * Phase 7: Storage Management - Task 1.2
 * TDD Approach: RED phase - Write failing tests first
 */

import { DatabaseService } from '../src/services/database'
import * as path from 'path'
import * as fs from 'fs'

describe('Transcript Retention', () => {
  let db: DatabaseService
  let testDbPath: string

  beforeEach(() => {
    // Create unique test database for each test
    const tmpDir = require('os').tmpdir()
    testDbPath = path.join(tmpDir, `test-transcript-retention-${Date.now()}.db`)
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
   * Helper: Insert transcript with specified age in days
   */
  function insertTranscript(daysOld: number): string {
    const recordingId = `recording-${Date.now()}-${Math.random()}`
    const transcriptId = `transcript-${Date.now()}-${Math.random()}`

    // Insert recording first
    db.saveRecording({
      id: recordingId,
      file_path: '/fake/path/audio.wav',
      duration_seconds: 600,
      file_size_bytes: 1000000
    })

    // Insert transcript
    db.saveTranscript({
      id: transcriptId,
      recording_id: recordingId,
      transcript_text: 'Test transcript content',
      language: 'en'
    })

    // Manually set created_at to simulate old data
    const db_instance = (db as any).db
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - daysOld)
    db_instance.prepare(`
      UPDATE transcripts
      SET created_at = ?
      WHERE id = ?
    `).run(targetDate.toISOString(), transcriptId)

    return transcriptId
  }

  /**
   * Helper: Insert transcript with diarization
   */
  function insertTranscriptWithDiarization(daysOld: number): { transcriptId: string; diarizationId: string } {
    const transcriptId = insertTranscript(daysOld)
    const diarizationId = `diarization-${Date.now()}-${Math.random()}`

    // Insert diarization
    db.saveDiarizationResult({
      id: diarizationId,
      transcript_id: transcriptId,
      segments_json: JSON.stringify([
        { start: 0, end: 10, speaker: 'SPEAKER_00', text: 'Hello' }
      ]),
      num_speakers: 1
    })

    return { transcriptId, diarizationId }
  }

  it('should delete transcripts older than retentionDays', () => {
    // Insert old transcript (100 days ago)
    const oldTranscriptId = insertTranscript(100)

    // Set retention to 30 days
    const result = db.cleanupOldTranscripts(30)

    // Assert transcript deleted
    expect(result.deletedCount).toBe(1)
    const transcript = db.getTranscript(oldTranscriptId)
    expect(transcript).toBeUndefined()
  })

  it('should delete associated diarization data', () => {
    // Insert old transcript with diarization (100 days ago)
    const { transcriptId, diarizationId } = insertTranscriptWithDiarization(100)

    // Run cleanup with 30-day retention
    const result = db.cleanupOldTranscripts(30)

    // Assert both deleted
    expect(result.deletedCount).toBe(1)
    const transcript = db.getTranscript(transcriptId)
    expect(transcript).toBeUndefined()

    const diarization = db.getDiarizationResult(diarizationId)
    expect(diarization).toBeUndefined()
  })

  it('should NOT delete recording when transcript is deleted', () => {
    // Insert old transcript (100 days ago)
    const recordingId = `recording-${Date.now()}`
    const transcriptId = `transcript-${Date.now()}`

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

    // Manually age the transcript
    const db_instance = (db as any).db
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - 100)
    db_instance.prepare(`
      UPDATE transcripts
      SET created_at = ?
      WHERE id = ?
    `).run(targetDate.toISOString(), transcriptId)

    // Run cleanup
    db.cleanupOldTranscripts(30)

    // Assert recording still exists
    const recording = db.getRecording(recordingId)
    expect(recording).toBeDefined()
    expect(recording.id).toBe(recordingId)
  })

  it('should keep transcripts within retention period', () => {
    // Insert recent transcript (10 days ago)
    const recentTranscriptId = insertTranscript(10)

    // Run cleanup with 30-day retention
    const result = db.cleanupOldTranscripts(30)

    // Assert NOT deleted
    expect(result.deletedCount).toBe(0)
    const transcript = db.getTranscript(recentTranscriptId)
    expect(transcript).toBeDefined()
    expect(transcript.id).toBe(recentTranscriptId)
  })

  it('should handle retentionDays = 0 (keep forever)', () => {
    // Insert old transcript (100 days ago)
    const oldTranscriptId = insertTranscript(100)

    // Run cleanup with 0-day retention (keep forever)
    const result = db.cleanupOldTranscripts(0)

    // Assert NOT deleted
    expect(result.deletedCount).toBe(0)
    const transcript = db.getTranscript(oldTranscriptId)
    expect(transcript).toBeDefined()
    expect(transcript.id).toBe(oldTranscriptId)
  })

  it('should return accurate deleted count', () => {
    // Insert 3 old transcripts (100, 120, 150 days ago)
    insertTranscript(100)
    insertTranscript(120)
    insertTranscript(150)

    // Insert 2 recent transcripts (10, 20 days ago)
    insertTranscript(10)
    insertTranscript(20)

    // Run cleanup with 30-day retention
    const result = db.cleanupOldTranscripts(30)

    // Assert deleted count = 3
    expect(result.deletedCount).toBe(3)
  })
})
