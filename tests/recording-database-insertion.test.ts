/**
 * TDD Tests: Recording Database Insertion Bug
 *
 * Bug: Recordings are saved to disk but not inserted into database
 * Priority: HIGH
 *
 * Phase 1 (RED): These tests should FAIL initially
 * Phase 2 (GREEN): Implement features to make tests pass
 */

import { DatabaseService } from '../src/services/database'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('Recording Database Insertion', () => {
  let dbService: DatabaseService
  let testDbPath: string

  beforeEach(() => {
    // Create a unique temp database for each test
    testDbPath = path.join(os.tmpdir(), `test-recording-db-${Date.now()}-${Math.random()}.db`)
    dbService = new DatabaseService(testDbPath)
  })

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  // ===========================================================================
  // Test 1: Recording should be saved to database immediately after stop
  // ===========================================================================
  it('should save recording to database with all metadata', () => {
    // GIVEN: A recording has been completed
    const recordingId = 'test-recording-123'
    const filePath = '/path/to/merged.wav'
    const duration = 120.5
    const fileSize = 1024000

    // WHEN: saveRecording is called
    dbService.saveRecording({
      id: recordingId,
      file_path: filePath,
      file_size_bytes: fileSize,
      duration_seconds: duration,
      sample_rate: 16000,
      channels: 2,
      format: 'wav'
    })

    // THEN: Recording should be in database
    const recording = dbService.getRecording(recordingId)
    expect(recording).toBeDefined()
    expect(recording.id).toBe(recordingId)
    expect(recording.file_path).toBe(filePath)
    expect(recording.duration_seconds).toBe(duration)
    expect(recording.file_size_bytes).toBe(fileSize)
    expect(recording.sample_rate).toBe(16000)
    expect(recording.channels).toBe(2)
    expect(recording.format).toBe('wav')

    // AND: Should appear in untranscribed recordings list
    const untranscribed = dbService.getUntranscribedRecordings(10)
    expect(untranscribed.length).toBeGreaterThan(0)
    expect(untranscribed[0].recording_id).toBe(recordingId)
  })

  // ===========================================================================
  // Test 2: Recording should be retrievable by ID after insertion
  // ===========================================================================
  it('should retrieve recording by ID after saving', () => {
    // GIVEN: A recording is saved to database
    const recordingId = 'test-recording-456'
    dbService.saveRecording({
      id: recordingId,
      file_path: '/test/path.wav',
      duration_seconds: 60.0,
      file_size_bytes: 500000
    })

    // WHEN: Getting recording by ID
    const recording = dbService.getRecording(recordingId)

    // THEN: Should return the recording
    expect(recording).toBeDefined()
    expect(recording.id).toBe(recordingId)
    expect(recording.file_path).toBe('/test/path.wav')
  })

  // ===========================================================================
  // Test 3: Multiple recordings should all be saved
  // ===========================================================================
  it('should save multiple recordings to database', () => {
    // GIVEN: Three recordings
    const recordings = [
      { id: 'rec-1', file_path: '/test/rec1.wav', duration_seconds: 30 },
      { id: 'rec-2', file_path: '/test/rec2.wav', duration_seconds: 45 },
      { id: 'rec-3', file_path: '/test/rec3.wav', duration_seconds: 60 }
    ]

    // WHEN: Saving all recordings
    recordings.forEach(rec => dbService.saveRecording(rec))

    // THEN: All should be in database
    const untranscribed = dbService.getUntranscribedRecordings(10)
    expect(untranscribed.length).toBe(3)

    // AND: Each should be retrievable by ID
    recordings.forEach(rec => {
      const saved = dbService.getRecording(rec.id)
      expect(saved).toBeDefined()
      expect(saved.file_path).toBe(rec.file_path)
    })
  })

  // ===========================================================================
  // Test 4: Should handle missing optional fields gracefully
  // ===========================================================================
  it('should save recording with minimal required fields', () => {
    // GIVEN: Recording with only required fields (id and file_path)
    const recordingId = 'test-recording-minimal'

    // WHEN: Saving with minimal data
    dbService.saveRecording({
      id: recordingId,
      file_path: '/minimal/path.wav'
      // No duration, file_size, sample_rate, channels, or format
    })

    // THEN: Should save successfully
    const recording = dbService.getRecording(recordingId)
    expect(recording).toBeDefined()
    expect(recording.id).toBe(recordingId)
    expect(recording.file_path).toBe('/minimal/path.wav')

    // AND: Optional fields should have defaults or null
    expect(recording.sample_rate).toBe(16000) // Default
    expect(recording.channels).toBe(1) // Default
    expect(recording.format).toBe('wav') // Default
  })

  // ===========================================================================
  // Test 5: Should handle empty file_path (SQL constraint will catch NULL)
  // ===========================================================================
  it('should save recording even with empty file_path (SQL allows empty strings)', () => {
    // GIVEN: Recording with empty string for file_path
    const recordingId = 'test-recording-empty-path'

    // WHEN: Saving with empty path (not NULL, just empty)
    dbService.saveRecording({
      id: recordingId,
      file_path: '', // Empty string (not NULL)
      duration_seconds: 60
    })

    // THEN: Should save successfully (SQL NOT NULL only blocks NULL, not empty string)
    const recording = dbService.getRecording(recordingId)
    expect(recording).toBeDefined()
    expect(recording.file_path).toBe('')
  })

  // ===========================================================================
  // Test 6: Should handle duplicate ID gracefully
  // ===========================================================================
  it('should handle duplicate recording ID', () => {
    // GIVEN: A recording already exists
    const recordingId = 'test-recording-duplicate'
    dbService.saveRecording({
      id: recordingId,
      file_path: '/first/path.wav',
      duration_seconds: 60
    })

    // WHEN: Trying to save with same ID
    // THEN: Should throw constraint error
    expect(() => {
      dbService.saveRecording({
        id: recordingId,
        file_path: '/second/path.wav',
        duration_seconds: 90
      })
    }).toThrow()
  })

  // ===========================================================================
  // Test 7: Recording should have created_at timestamp
  // ===========================================================================
  it('should automatically set created_at timestamp', () => {
    // GIVEN: A recording is saved
    const recordingId = 'test-recording-timestamp'

    dbService.saveRecording({
      id: recordingId,
      file_path: '/test/timestamp.wav'
    })

    // WHEN: Retrieving the recording
    const recording = dbService.getRecording(recordingId)

    // THEN: Should have created_at timestamp (SQLite CURRENT_TIMESTAMP format)
    expect(recording.created_at).toBeDefined()
    expect(typeof recording.created_at).toBe('string')

    // AND: Should be a valid datetime string that can be parsed
    const createdAt = new Date(recording.created_at)
    expect(createdAt.getTime()).not.toBeNaN()

    // AND: Should be a reasonable date (not year 1970 or year 3000)
    const year = createdAt.getFullYear()
    expect(year).toBeGreaterThan(2020)
    expect(year).toBeLessThan(2100)
  })
})
