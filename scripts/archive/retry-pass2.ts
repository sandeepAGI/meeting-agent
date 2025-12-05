/**
 * Retry Pass 2 for a specific summary that failed
 *
 * Usage: tsx scripts/retry-pass2.ts <summary-id>
 * Example: tsx scripts/retry-pass2.ts 9b645522-c02f-47af-a6a8-6d8d9530c5c0
 */

import { DatabaseService } from '../src/services/database'
import { ClaudeBatchService } from '../src/services/claudeBatch'
import { MeetingIntelligenceService } from '../src/services/meetingIntelligence'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') })

async function retryPass2(summaryId: string) {
  console.log(`\n🔄 Retrying Pass 2 for summary: ${summaryId}\n`)

  // Initialize services
  const dbPath = path.join(__dirname, '..', 'data', 'test-meeting-agent.db')
  const db = new DatabaseService(dbPath)

  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment')
  }

  const claudeService = new ClaudeBatchService(apiKey, model)
  const intelligenceService = new MeetingIntelligenceService(claudeService, db)

  // 1. Fetch existing summary
  const summary = db.getSummary(summaryId)
  if (!summary) {
    throw new Error(`Summary not found: ${summaryId}`)
  }

  console.log('✅ Found summary:')
  console.log(`   Meeting ID: ${summary.meeting_id}`)
  console.log(`   Transcript ID: ${summary.transcript_id}`)
  console.log(`   Status: ${summary.status}`)
  console.log(`   Pass 1 Batch: ${summary.pass1_batch_id}`)
  console.log(`   Pass 2 Batch: ${summary.pass2_batch_id || 'None'}`)

  // 2. Verify Pass 1 completed successfully
  if (!summary.pass1_summary) {
    throw new Error('Pass 1 data not found - cannot retry Pass 2 without Pass 1 results')
  }

  console.log('\n✅ Pass 1 data exists:')
  console.log(`   Summary: ${summary.pass1_summary.substring(0, 100)}...`)
  console.log(`   Speakers: ${summary.pass1_speaker_mappings_json ? JSON.parse(summary.pass1_speaker_mappings_json).length : 0}`)
  console.log(`   Action Items: ${summary.pass1_action_items_json ? JSON.parse(summary.pass1_action_items_json).length : 0}`)

  // 3. Parse Pass 1 data
  const pass1Data = {
    summary: summary.pass1_summary,
    executive_summary: summary.pass1_summary,
    speaker_mappings: summary.pass1_speaker_mappings_json ? JSON.parse(summary.pass1_speaker_mappings_json) : [],
    action_items: summary.pass1_action_items_json ? JSON.parse(summary.pass1_action_items_json) : [],
    key_decisions: summary.pass1_key_decisions_json ? JSON.parse(summary.pass1_key_decisions_json) : [],
    detailed_notes: summary.pass1_detailed_notes_json ? JSON.parse(summary.pass1_detailed_notes_json) : null
  }

  // 4. Gather context (same as original submission)
  console.log('\n📥 Gathering context...')

  const transcript = db.getTranscript(summary.transcript_id)
  if (!transcript) {
    throw new Error(`Transcript not found: ${summary.transcript_id}`)
  }

  const diarization = db.getDiarizationByTranscriptId(summary.transcript_id)

  // Reconstruct speaker-labeled transcript
  let mergedTranscript = transcript.transcript_text
  if (diarization && transcript.segments_json) {
    const { mergeDiarizationWithTranscript } = await import('../src/utils/mergeDiarization')
    const segments = JSON.parse(transcript.segments_json)
    const diarizationData = JSON.parse(diarization.diarization_json)
    mergedTranscript = mergeDiarizationWithTranscript(segments, diarizationData)
  }

  // Fetch meeting metadata
  const meeting = db.getMeetingById(summary.meeting_id)
  if (!meeting) {
    throw new Error(`Meeting not found: ${summary.meeting_id}`)
  }

  const context = {
    meeting: {
      id: meeting.id,
      subject: meeting.subject,
      date: meeting.start_time,
      organizer: {
        name: meeting.organizer_name,
        email: meeting.organizer_email
      },
      attendees: meeting.attendees_json ? JSON.parse(meeting.attendees_json) : []
    },
    transcript: mergedTranscript
  }

  console.log('✅ Context gathered')

  // 5. Submit Pass 2 using the private method (we'll need to expose it or recreate logic)
  console.log('\n📤 Submitting Pass 2 batch...')

  // Load prompt template
  const { PromptLoader } = await import('../src/utils/promptLoader')
  const promptLoader = new PromptLoader()

  const attendeesList = context.meeting.attendees
    .map((a: any) => `${a.name} (${a.email})`)
    .join(', ')

  const prompt = promptLoader.loadAndSubstitute(
    'pass2-validation.txt',
    {
      subject: context.meeting.subject,
      date: context.meeting.date,
      organizerName: context.meeting.organizer.name,
      organizerEmail: context.meeting.organizer.email,
      attendeesList,
      transcript: context.transcript,
      pass1Summary: pass1Data.executive_summary || pass1Data.summary || '',
      pass1Speakers: JSON.stringify(pass1Data.speaker_mappings, null, 2),
      pass1ActionItems: JSON.stringify(pass1Data.action_items, null, 2),
      pass1KeyDecisions: JSON.stringify(pass1Data.key_decisions, null, 2),
      pass1DetailedNotes: pass1Data.detailed_notes ? JSON.stringify(pass1Data.detailed_notes, null, 2) : ''
    }
  )

  // Create batch request
  const request = ClaudeBatchService.createBatchRequest(
    `pass2-${summaryId}`,
    prompt
  )

  const batchId = await claudeService.submitBatch([request])

  console.log(`✅ Pass 2 batch submitted: ${batchId}`)

  // Update database
  db.updateSummaryPass2(summaryId, batchId, { summary: '', speaker_mappings: [], action_items: [], key_decisions: [] })
  db.updateSummaryStatus(summaryId, 'pass2_processing')

  console.log('✅ Database updated with new batch ID')

  // 6. Poll for completion
  console.log('\n⏳ Polling for completion...')
  console.log('   (This may take 5-30 minutes - batch processing time)')

  const status = await claudeService.pollBatchStatus(
    batchId,
    (progress) => {
      console.log(`   Status: ${progress.status}, Processed: ${progress.request_counts?.succeeded || 0}/${progress.request_counts?.total || 1}`)
      db.updateBatchJobStatus(batchId, progress.status, progress.ended_at || undefined)
    }
  )

  console.log(`✅ Batch complete: ${status}`)

  // 7. Retrieve and parse results
  console.log('\n📥 Retrieving results...')

  const results = await claudeService.retrieveResults(batchId)
  const result = results[0]

  const textContent = ClaudeBatchService.extractTextFromResult(result)

  // Strip markdown code blocks
  let cleanedText = textContent.trim()
  const codeBlockRegex = /^```(?:json)?\s*\n([\s\S]*?)\n```$/
  const match = cleanedText.match(codeBlockRegex)
  if (match) {
    cleanedText = match[1].trim()
  }

  // Parse with automatic repair (same logic as meetingIntelligence.ts)
  let pass2Data: any
  try {
    pass2Data = JSON.parse(cleanedText)
    console.log('✅ JSON parsed successfully')
  } catch (parseError: any) {
    console.error('❌ JSON parse failed:', parseError.message)
    console.error('Raw JSON (first 500 chars):', cleanedText.substring(0, 500))

    // Extract position
    const positionMatch = parseError.message.match(/position (\d+)/)
    const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0
    if (errorPosition > 0) {
      console.error('Raw JSON (around error position):',
        cleanedText.substring(Math.max(0, errorPosition - 100), errorPosition + 100))
    }

    // Attempt repair
    console.log('\n🔧 Attempting automatic JSON repair...')

    // Try 1: Remove trailing commas
    try {
      let fixed = cleanedText.replace(/,(\s*[}\]])/g, '$1')
      pass2Data = JSON.parse(fixed)
      console.log('✅ Repair successful (trailing commas removed)')
    } catch (e1) {
      // Try 2: Fix escape sequences
      try {
        let fixed = cleanedText
          .replace(/([^\\])\\n/g, '$1\\\\n')
          .replace(/([^\\])\\t/g, '$1\\\\t')
        pass2Data = JSON.parse(fixed)
        console.log('✅ Repair successful (escape sequences fixed)')
      } catch (e2) {
        console.error('❌ Automatic repair failed')
        db.updateSummaryStatus(summaryId, 'error', `Pass 2 JSON parsing failed: ${parseError.message}`)
        throw parseError
      }
    }
  }

  // 8. Save to database
  console.log('\n💾 Saving Pass 2 results to database...')

  db.updateSummaryPass2(summaryId, batchId, pass2Data)
  db.updateBatchJobStatus(batchId, 'ended', new Date().toISOString())
  db.updateSummaryStatus(summaryId, 'complete')

  console.log('✅ Pass 2 complete!')
  console.log('\n📊 Summary results:')
  console.log(`   Refined Summary: ${pass2Data.summary?.substring(0, 100)}...`)
  console.log(`   Speakers: ${pass2Data.speaker_mappings?.length || 0}`)
  console.log(`   Action Items: ${pass2Data.action_items?.length || 0}`)
  console.log(`   Key Decisions: ${pass2Data.key_decisions?.length || 0}`)
  console.log(`   Corrections: ${pass2Data.corrections?.length || 0}`)

  console.log('\n✅ Done! You can now view the complete summary in the UI.')
}

// Main execution
const summaryId = process.argv[2]

if (!summaryId) {
  console.error('❌ Error: Summary ID required')
  console.error('Usage: tsx scripts/retry-pass2.ts <summary-id>')
  console.error('Example: tsx scripts/retry-pass2.ts 9b645522-c02f-47af-a6a8-6d8d9530c5c0')
  process.exit(1)
}

retryPass2(summaryId)
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  })
