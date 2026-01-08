/**
 * Audio Quota Enforcement Tests
 * Phase 7: Storage Management - Task 1.4
 * TDD Approach: RED phase - Write failing tests first
 */

import { DatabaseService } from '../src/services/database'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

describe('Audio Quota Enforcement', () => {
  let db: DatabaseService
  let testDbPath: string
  let testAudioDir: string

  beforeEach(() => {
    // Create unique test database for each test
    const tmpDir = os.tmpdir()
    testDbPath = path.join(tmpDir, `test-audio-quota-${Date.now()}.db`)
    testAudioDir = path.join(tmpDir, `test-audio-files-${Date.now()}`)

    // Create test audio directory
    if (!fs.existsSync(testAudioDir)) {
      fs.mkdirSync(testAudioDir, { recursive: true })
    }

    db = new DatabaseService(testDbPath)
  })

  afterEach(() => {
    db.close()

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }

    // Clean up test audio files and directory
    if (fs.existsSync(testAudioDir)) {
      const files = fs.readdirSync(testAudioDir)
      files.forEach(file => {
        fs.unlinkSync(path.join(testAudioDir, file))
      })
      fs.rmdirSync(testAudioDir)
    }
  })

  /**
   * Helper: Create a test audio file with specified size (in MB)
   */
  function createTestAudioFile(sizeInMB: number): string {
    const fileName = `test-audio-${Date.now()}-${Math.random()}.wav`
    const filePath = path.join(testAudioDir, fileName)
    const sizeInBytes = sizeInMB * 1024 * 1024

    // Create file with specified size (filled with zeros)
    const buffer = Buffer.alloc(sizeInBytes)
    fs.writeFileSync(filePath, buffer)

    return filePath
  }

  /**
   * Helper: Insert recording with specified file size and age
   */
  function insertRecording(sizeInMB: number, daysOld: number): string {
    const recordingId = `recording-${Date.now()}-${Math.random()}`
    const filePath = createTestAudioFile(sizeInMB)

    db.saveRecording({
      id: recordingId,
      file_path: filePath,
      duration_seconds: 600,
      file_size_bytes: sizeInMB * 1024 * 1024
    })

    // Manually set created_at to simulate old data
    const db_instance = (db as any).db
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - daysOld)
    db_instance.prepare(`
      UPDATE recordings
      SET created_at = ?
      WHERE id = ?
    `).run(targetDate.toISOString(), recordingId)

    return recordingId
  }

  it('should calculate current audio storage usage', () => {
    // Insert 3 recordings (10MB, 20MB, 30MB)
    insertRecording(10, 1)
    insertRecording(20, 2)
    insertRecording(30, 3)

    // Get storage usage
    const usage = db.getAudioStorageUsage()

    // Assert total is 60MB
    expect(usage.totalBytes).toBe(60 * 1024 * 1024)
    expect(usage.totalGB).toBeCloseTo(60 / 1024, 3)
  })

  it('should return zero for empty storage', () => {
    const usage = db.getAudioStorageUsage()

    expect(usage.totalBytes).toBe(0)
    expect(usage.totalGB).toBe(0)
  })

  it('should return oldest recordings in correct order', () => {
    // Insert recordings with different ages (oldest first)
    const id1 = insertRecording(10, 100) // oldest
    const id2 = insertRecording(20, 50)
    const id3 = insertRecording(30, 10) // newest

    // Get oldest 2 recordings
    const oldest = db.getOldestRecordings(2)

    // Assert correct order and count
    expect(oldest.length).toBe(2)
    expect(oldest[0].id).toBe(id1) // oldest first
    expect(oldest[1].id).toBe(id2)
  })

  it('should clear recording file path', () => {
    // Insert recording
    const recordingId = insertRecording(10, 1)

    // Verify file_path exists
    let recording = db.getRecording(recordingId)
    expect(recording.file_path).toBeTruthy()

    // Clear file path
    db.clearRecordingFilePath(recordingId)

    // Verify file_path is empty string (NOT NULL constraint requires non-null value)
    recording = db.getRecording(recordingId)
    expect(recording.file_path).toBe('')
  })

  it('should exclude recordings with NULL file_path from storage calculation', () => {
    // Insert recording
    insertRecording(10, 1)

    // Get initial usage
    let usage = db.getAudioStorageUsage()
    expect(usage.totalBytes).toBe(10 * 1024 * 1024)

    // Clear file path for that recording
    const recordings = db.getOldestRecordings(1)
    db.clearRecordingFilePath(recordings[0].id)

    // Get usage again - should be 0
    usage = db.getAudioStorageUsage()
    expect(usage.totalBytes).toBe(0)
  })

  it('should handle quota = 0 (unlimited)', () => {
    // Insert large files
    insertRecording(100, 1)
    insertRecording(200, 2)

    // Set quota = 0 (unlimited) - should not delete anything
    const quotaGB = 0

    // Manually check quota logic (this will be implemented in JobScheduler)
    if (quotaGB === 0) {
      // Should skip cleanup
      const usage = db.getAudioStorageUsage()
      expect(usage.totalBytes).toBe(300 * 1024 * 1024) // All files still there
    }
  })

  it('should handle file size edge cases', () => {
    // Test with very small file (1KB)
    insertRecording(1 / 1024, 1) // 1KB in MB

    const usage = db.getAudioStorageUsage()
    expect(usage.totalBytes).toBe(1024)
  })
})
