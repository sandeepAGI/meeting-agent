/**
 * Regenerate Summary Script
 *
 * Re-runs meeting intelligence (Pass 1 + Pass 2) for an existing summary.
 * Useful when you need to regenerate with updated context (e.g., corrected attendees list).
 *
 * Usage: tsx scripts/regenerate-summary.ts <summary_id>
 *
 * Example: tsx scripts/regenerate-summary.ts b470b32b-679b-4e38-aef4-34a329850f55
 */

import { DatabaseService } from '../src/services/database'
import { ClaudeBatchService } from '../src/services/claudeBatch'
import { MeetingIntelligenceService } from '../src/services/meetingIntelligence'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const userDataPath = process.env.ELECTRON_USER_DATA_PATH ||
  path.join(process.env.HOME || '', 'Library/Application Support/meeting-agent')

const dbPath = path.join(userDataPath, 'meeting-agent.db')

async function main() {
  const summaryId = process.argv[2]

  if (!summaryId) {
    console.error('Usage: tsx scripts/regenerate-summary.ts <summary_id>')
    process.exit(1)
  }

  console.log(`\n🔄 Regenerating summary: ${summaryId}`)
  console.log(`📂 Database: ${dbPath}\n`)

  // Initialize services
  const db = new DatabaseService(dbPath)
  const claudeService = new ClaudeBatchService(
    process.env.ANTHROPIC_API_KEY!,
    process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
  )
  const meetingIntelligence = new MeetingIntelligenceService(claudeService, db)

  try {
    // Verify summary exists
    const summary = db.getSummary(summaryId)
    if (!summary) {
      console.error(`❌ Summary not found: ${summaryId}`)
      process.exit(1)
    }

    console.log(`✅ Found summary:`)
    console.log(`   - Meeting ID: ${summary.meeting_id || 'Standalone Recording'}`)
    console.log(`   - Transcript ID: ${summary.transcript_id}`)
    console.log(`   - Current Status: ${summary.overall_status}`)
    console.log(`   - Created: ${summary.created_at}\n`)

    // Show current speaker mappings if available
    if (summary.pass1_speaker_mappings_json) {
      const speakers = JSON.parse(summary.pass1_speaker_mappings_json)
      console.log(`📋 Current speaker mappings (${speakers.length} speakers):`)
      speakers.forEach((s: any) => {
        console.log(`   - ${s.label}: ${s.name} (${s.email}) [${s.confidence}]`)
      })
      console.log()
    }

    // Check meeting attendees if available
    if (summary.meeting_id) {
      const meeting = db.getMeeting(summary.meeting_id)
      if (meeting && meeting.attendees_json) {
        const attendees = JSON.parse(meeting.attendees_json)
        console.log(`👥 Meeting attendees (${attendees.length}):`)
        attendees.forEach((a: any) => {
          console.log(`   - ${a.name} (${a.email})`)
        })
        console.log()
      }
    }

    console.log(`🚀 Starting regeneration...`)
    console.log(`   This will:`)
    console.log(`   1. Reset summary status to 'pending'`)
    console.log(`   2. Submit new Pass 1 batch job with updated context`)
    console.log(`   3. Poll until Pass 1 completes`)
    console.log(`   4. Submit Pass 2 batch job`)
    console.log(`   5. Poll until Pass 2 completes`)
    console.log(`\n⏱️  Expected time: 30-60 minutes (batch processing)`)
    console.log(`📊 Cost: ~$0.09 (two passes)\n`)

    // Regenerate
    await meetingIntelligence.regenerateSummary(summaryId)

    console.log(`✅ Regeneration started successfully!`)
    console.log(`\n📍 Next steps:`)
    console.log(`   1. The process is running in the background`)
    console.log(`   2. Check status with: tsx scripts/check-summary-status.ts ${summaryId}`)
    console.log(`   3. Or monitor in the Meeting Agent UI`)
    console.log(`\n⏳ The summary will be ready in 30-60 minutes.\n`)

  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message)
    process.exit(1)
  }
}

main()
