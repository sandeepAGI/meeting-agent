/**
 * Import orphaned recordings that exist as files but not in database
 *
 * This script scans the recordings directory and adds any recordings
 * that exist as merged.wav files but aren't in the database.
 *
 * Usage: tsx scripts/import-orphaned-recordings.ts
 */

import { DatabaseService } from '../src/services/database'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { randomUUID } from 'crypto'

// Manually set the userData path since app may not be ready
const userDataPath = process.env.ELECTRON_USER_DATA_PATH ||
  path.join(process.env.HOME || '', 'Library/Application Support/meeting-agent')

const recordingsDir = path.join(userDataPath, 'recordings')
const dbPath = path.join(userDataPath, 'meeting-agent.db')

async function importOrphanedRecordings() {
  console.log('\n🔍 Scanning for orphaned recordings...')
  console.log(`Recordings directory: ${recordingsDir}`)
  console.log(`Database: ${dbPath}\n`)

  // Initialize database
  const db = new DatabaseService(dbPath)

  // Get all session directories
  const sessions = fs.readdirSync(recordingsDir)
    .filter(name => name.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/))

  console.log(`Found ${sessions.length} session directories`)

  let importedCount = 0
  let skippedCount = 0

  for (const sessionId of sessions) {
    const sessionDir = path.join(recordingsDir, sessionId)
    const mergedFile = path.join(sessionDir, 'merged.wav')

    // Check if merged.wav exists
    if (!fs.existsSync(mergedFile)) {
      console.log(`⏭️  Skipping ${sessionId} (no merged.wav)`)
      skippedCount++
      continue
    }

    // Check if already in database
    const existingRecordings = db.getRecordingsWithTranscripts()
    const exists = existingRecordings.some(r => r.file_path === mergedFile)

    if (exists) {
      console.log(`⏭️  Skipping ${sessionId} (already in database)`)
      skippedCount++
      continue
    }

    // Import the recording
    try {
      const stats = fs.statSync(mergedFile)
      const recordingId = randomUUID()

      db.saveRecording({
        id: recordingId,
        file_path: mergedFile,
        file_size_bytes: stats.size,
        duration_seconds: 0, // Will be calculated during transcription
        sample_rate: 16000,
        channels: 1,
        format: 'wav'
      })

      console.log(`✅ Imported: ${sessionId}`)
      console.log(`   Path: ${mergedFile}`)
      console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   ID: ${recordingId}\n`)

      importedCount++
    } catch (error) {
      console.error(`❌ Failed to import ${sessionId}:`, error)
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Imported: ${importedCount}`)
  console.log(`   Skipped: ${skippedCount}`)
  console.log(`   Total: ${sessions.length}`)
  console.log('\n✅ Done!')
}

importOrphanedRecordings()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
