/**
 * Check Summary Status Script
 *
 * Displays current status of a summary generation job.
 *
 * Usage: tsx scripts/check-summary-status.ts <summary_id>
 *
 * Example: tsx scripts/check-summary-status.ts b470b32b-679b-4e38-aef4-34a329850f55
 */

import { DatabaseService } from '../src/services/database'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const userDataPath = process.env.ELECTRON_USER_DATA_PATH ||
  path.join(process.env.HOME || '', 'Library/Application Support/meeting-agent')

const dbPath = path.join(userDataPath, 'meeting-agent.db')

function formatElapsedTime(isoDate: string): string {
  const start = new Date(isoDate).getTime()
  const now = Date.now()
  const elapsedMs = now - start
  const elapsedMinutes = Math.floor(elapsedMs / 60000)
  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)

  if (elapsedMinutes > 0) {
    return `${elapsedMinutes}m ${elapsedSeconds}s`
  } else {
    return `${elapsedSeconds}s`
  }
}

function main() {
  const summaryId = process.argv[2]

  if (!summaryId) {
    console.error('Usage: tsx scripts/check-summary-status.ts <summary_id>')
    process.exit(1)
  }

  console.log(`\n📊 Summary Status: ${summaryId}`)
  console.log(`📂 Database: ${dbPath}\n`)

  // Initialize database
  const db = new DatabaseService(dbPath)

  try {
    // Fetch summary
    const summary = db.getSummary(summaryId)
    if (!summary) {
      console.error(`❌ Summary not found: ${summaryId}`)
      process.exit(1)
    }

    // Display basic info
    console.log(`📋 Basic Information:`)
    console.log(`   - Meeting ID: ${summary.meeting_id || 'Standalone Recording'}`)
    console.log(`   - Transcript ID: ${summary.transcript_id}`)
    console.log(`   - Created: ${summary.created_at}`)
    console.log(`   - Updated: ${summary.updated_at}`)
    console.log()

    // Display overall status
    const statusEmoji = {
      'pending': '⏸️',
      'pass1_processing': '🔄',
      'pass1_complete': '✅',
      'pass2_processing': '🔄',
      'complete': '✅',
      'error': '❌',
      'cancelled': '🚫'
    }[summary.overall_status] || '❓'

    console.log(`📊 Overall Status: ${statusEmoji} ${summary.overall_status.toUpperCase()}`)
    console.log()

    // Pass 1 details
    console.log(`🔵 Pass 1 (Speaker Identification + Initial Summary):`)
    console.log(`   - Batch ID: ${summary.pass1_batch_id || 'Not started'}`)
    console.log(`   - Status: ${summary.pass1_status || 'pending'}`)
    if (summary.pass1_completed_at) {
      console.log(`   - Completed: ${summary.pass1_completed_at}`)
    }
    if (summary.pass1_error_message) {
      console.log(`   - Error: ${summary.pass1_error_message}`)
    }
    console.log()

    // Pass 2 details
    console.log(`🟢 Pass 2 (Validation + Refinement):`)
    console.log(`   - Batch ID: ${summary.pass2_batch_id || 'Not started'}`)
    console.log(`   - Status: ${summary.pass2_status || 'pending'}`)
    if (summary.pass2_completed_at) {
      console.log(`   - Completed: ${summary.pass2_completed_at}`)
    }
    if (summary.pass2_error_message) {
      console.log(`   - Error: ${summary.pass2_error_message}`)
    }
    console.log()

    // Batch jobs
    const batchJobs = db.getBatchJobsBySummaryId(summaryId)
    if (batchJobs.length > 0) {
      console.log(`⏱️  Batch Jobs:`)
      batchJobs.forEach((job) => {
        const elapsed = formatElapsedTime(job.submitted_at)
        console.log(`   - Pass ${job.pass_number}: ${job.status} (${elapsed} elapsed)`)
        console.log(`     Submitted: ${job.submitted_at}`)
        if (job.ended_at) {
          console.log(`     Ended: ${job.ended_at}`)
        }
      })
      console.log()
    }

    // Speaker mappings (if available)
    if (summary.pass1_speaker_mappings_json || summary.pass2_validated_speakers_json) {
      const speakersJson = summary.pass2_validated_speakers_json || summary.pass1_speaker_mappings_json
      const speakers = JSON.parse(speakersJson)
      console.log(`👥 Speaker Mappings (${speakers.length} speakers):`)
      speakers.forEach((s: any) => {
        console.log(`   - ${s.label}: ${s.name} (${s.email}) [${s.confidence}]`)
      })
      console.log()
    }

    // Summary preview (if available)
    if (summary.pass2_refined_summary || summary.pass1_summary) {
      const summaryText = summary.pass2_refined_summary || summary.pass1_summary
      console.log(`📝 Summary Preview:`)
      console.log(`   ${summaryText.substring(0, 200)}${summaryText.length > 200 ? '...' : ''}`)
      console.log()
    }

    // Next steps
    if (summary.overall_status === 'complete') {
      console.log(`✅ Summary is complete!`)
      console.log(`   View it in the Meeting Agent UI or export to markdown.`)
    } else if (summary.overall_status === 'error') {
      console.log(`❌ Summary generation failed.`)
      console.log(`   Check error messages above for details.`)
    } else if (summary.overall_status.includes('processing')) {
      console.log(`⏳ Summary is still processing...`)
      console.log(`   Check back in a few minutes or monitor in the UI.`)
    } else if (summary.overall_status === 'pending') {
      console.log(`⏸️  Summary is pending...`)
      console.log(`   It should start processing shortly.`)
    }
    console.log()

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message)
    process.exit(1)
  }
}

main()
