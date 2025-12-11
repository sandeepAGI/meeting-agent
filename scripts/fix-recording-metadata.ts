/**
 * Fix recording metadata: duration and timestamp
 *
 * This script:
 * 1. Calculates actual duration from WAV files
 * 2. Extracts correct timestamp from folder name (ISO 8601)
 * 3. Updates database with correct values
 *
 * Usage: tsx scripts/fix-recording-metadata.ts
 */

import { DatabaseService } from '../src/services/database'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'

const userDataPath = process.env.ELECTRON_USER_DATA_PATH ||
  path.join(process.env.HOME || '', 'Library/Application Support/meeting-agent')

const dbPath = path.join(userDataPath, 'meeting-agent.db')

/**
 * Get audio duration using ffprobe
 */
async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ])

    let stdout = ''
    let stderr = ''

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(stdout.trim())
        resolve(duration)
      } else {
        reject(new Error(`ffprobe failed: ${stderr}`))
      }
    })

    ffprobe.on('error', (error) => {
      reject(new Error(`Failed to run ffprobe: ${error.message}`))
    })
  })
}

/**
 * Extract timestamp from folder name
 * Format: 2025-12-09T18:34:23.336Z
 */
function extractTimestampFromPath(filePath: string): string | null {
  const match = filePath.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/)
  if (match) {
    // Convert ISO 8601 to SQLite datetime format
    const isoDate = match[1]
    const date = new Date(isoDate)
    // Format as: YYYY-MM-DD HH:MM:SS
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
  }
  return null
}

async function fixRecordingMetadata() {
  console.log('\n🔧 Fixing recording metadata...')
  console.log(`Database: ${dbPath}\n`)

  // Initialize database
  const db = new DatabaseService(dbPath)

  // Get all recordings
  const recordings = db.db.prepare(`
    SELECT id, file_path, duration_seconds, created_at
    FROM recordings
    ORDER BY created_at DESC
  `).all() as any[]

  console.log(`Found ${recordings.length} recordings\n`)

  let fixedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const recording of recordings) {
    const { id, file_path, duration_seconds, created_at } = recording

    let needsUpdate = false
    let newDuration = duration_seconds
    let newTimestamp = created_at

    // Check if file exists
    if (!fs.existsSync(file_path)) {
      console.log(`⚠️  Skipping ${path.basename(path.dirname(file_path))} (file not found)`)
      skippedCount++
      continue
    }

    try {
      // Fix duration if missing or zero
      if (!duration_seconds || duration_seconds === 0) {
        newDuration = await getAudioDuration(file_path)
        needsUpdate = true
        console.log(`📏 Duration: ${(newDuration / 60).toFixed(1)} min for ${path.basename(path.dirname(file_path))}`)
      }

      // Fix timestamp from folder name
      const extractedTimestamp = extractTimestampFromPath(file_path)
      if (extractedTimestamp && extractedTimestamp !== created_at) {
        newTimestamp = extractedTimestamp
        needsUpdate = true
        console.log(`📅 Timestamp: ${newTimestamp} for ${path.basename(path.dirname(file_path))}`)
      }

      if (needsUpdate) {
        // Update database
        db.db.prepare(`
          UPDATE recordings
          SET duration_seconds = ?, created_at = ?
          WHERE id = ?
        `).run(newDuration, newTimestamp, id)

        fixedCount++
        console.log(`✅ Fixed: ${path.basename(path.dirname(file_path))}\n`)
      } else {
        skippedCount++
      }
    } catch (error) {
      console.error(`❌ Error processing ${path.basename(path.dirname(file_path))}:`, error)
      errorCount++
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Fixed: ${fixedCount}`)
  console.log(`   Skipped: ${skippedCount}`)
  console.log(`   Errors: ${errorCount}`)
  console.log(`   Total: ${recordings.length}`)
  console.log('\n✅ Done!')
}

fixRecordingMetadata()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
