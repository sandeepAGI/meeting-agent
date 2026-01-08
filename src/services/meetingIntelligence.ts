/**
 * MeetingIntelligenceService - Orchestrates two-pass LLM workflow
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 *
 * Coordinates:
 * - Pass 1: Initial speaker identification + summary
 * - Pass 2: Validation and refinement
 * - Background polling with database persistence
 * - Error handling and cancellation
 */

import { ClaudeBatchService } from './claudeBatch'
import { DatabaseService } from './database'
import { PromptLoader } from '../utils/promptLoader'
import { mergeDiarizationWithTranscript } from '../utils/mergeDiarization'
import { settingsService } from './settings'
import type {
  MeetingContext,
  MeetingSummary,
  Pass1Result,
  Pass2Result,
  SummaryStatusDisplay,
  BatchRequest
} from '../types'

export class MeetingIntelligenceService {
  private claudeService: ClaudeBatchService
  private db: DatabaseService
  private promptLoader: PromptLoader

  constructor(
    claudeService: ClaudeBatchService,
    db: DatabaseService
  ) {
    this.claudeService = claudeService
    this.db = db
    this.promptLoader = new PromptLoader()
  }

  /**
   * Phase 6 Batch 3: Get verbosity instruction based on settings
   */
  private getVerbosityInstruction(): string {
    const summarySettings = settingsService.getCategory('summary')
    const verbosity = summarySettings.verbosity || 'detailed'

    switch (verbosity) {
      case 'concise':
        return 'IMPORTANT: Provide a brief, concise summary focusing only on key points. Keep all sections short and to the point.\n\n'
      case 'comprehensive':
        return 'IMPORTANT: Provide an exhaustive summary capturing all discussion points, nuances, and context. Include detailed explanations and background where relevant.\n\n'
      case 'detailed':
      default:
        return 'IMPORTANT: Provide a comprehensive summary with context and details. Balance brevity with completeness.\n\n'
    }
  }

  /**
   * Main entry point: Generate summary for a meeting
   * Starts the two-pass workflow in the background
   *
   * @param meetingId Microsoft Graph meeting ID
   * @param transcriptId Transcript ID with diarization
   * @returns Summary ID for tracking
   */
  async generateSummary(
    meetingId: string,
    transcriptId: string
  ): Promise<string> {
    try {
      // 1. Create summary record
      const summaryId = this.db.createSummary({
        meeting_id: meetingId,
        transcript_id: transcriptId
      })

      console.log(`Created summary ${summaryId} for meeting ${meetingId}`)

      // 2. Gather context (meeting, transcript, emails)
      const context = await this.gatherContext(meetingId, transcriptId)

      // 3. Submit Pass 1
      const pass1BatchId = await this.submitPass1(summaryId, context)

      // 4. Start background polling (non-blocking)
      this.pollPass1InBackground(summaryId, pass1BatchId, context).catch(
        (error) => {
          console.error(`Pass 1 polling failed for summary ${summaryId}:`, error)
          this.db.updateSummaryStatus(summaryId, 'error', error.message)
        }
      )

      return summaryId
    } catch (error: any) {
      console.error('Failed to generate summary:', error)
      throw new Error(`Failed to generate summary: ${error.message}`)
    }
  }

  /**
   * Gather all context needed for LLM prompts
   * Supports both calendar-linked meetings and standalone recordings
   */
  private async gatherContext(
    meetingId: string,
    transcriptId: string
  ): Promise<MeetingContext> {
    // Fetch transcript (required)
    const transcript = this.db.getTranscript(transcriptId)
    if (!transcript) {
      throw new Error(`Transcript not found: ${transcriptId}`)
    }

    // Fetch diarization and reconstruct speaker-labeled transcript
    const diarization = this.db.getDiarizationByTranscriptId(transcriptId)
    let mergedTranscript = transcript.transcript_text

    if (diarization && transcript.segments_json) {
      try {
        // Parse segments from database
        const transcriptSegments = JSON.parse(transcript.segments_json)
        const diarizationSegments = JSON.parse(diarization.segments_json)

        // Merge using the utility function
        const merged = mergeDiarizationWithTranscript(transcriptSegments, {
          segments: diarizationSegments
        })

        // Use the full text with speaker labels
        mergedTranscript = merged.fullText
        console.log(`Reconstructed transcript with ${merged.speakerCount} speakers`)
      } catch (error) {
        console.warn('Failed to merge transcript with diarization:', error)
        // Fall back to plain transcript
        mergedTranscript = transcript.transcript_text
      }
    }

    // Try to fetch meeting info (optional - may not exist for standalone recordings)
    const meeting = meetingId ? this.db.getMeeting(meetingId) : null

    let meetingContext

    if (meeting) {
      // Full meeting context available
      const attendees = meeting.attendees_json
        ? JSON.parse(meeting.attendees_json)
        : []

      meetingContext = {
        id: meeting.id,
        subject: meeting.subject,
        date: new Date(meeting.start_time).toLocaleDateString(),
        startTime: new Date(meeting.start_time).toLocaleTimeString(),
        endTime: new Date(meeting.end_time).toLocaleTimeString(),
        organizer: {
          name: meeting.organizer_name || 'Unknown',
          email: meeting.organizer_email || ''
        },
        attendees: attendees.map((a: any) => ({
          name: a.name || 'Unknown',
          email: a.email || '',
          type: a.type || 'required'
        }))
      }
    } else {
      // Standalone recording - use fallback values
      const recordingDate = new Date(transcript.created_at)
      meetingContext = {
        id: '',
        subject: 'Untitled Recording',
        date: recordingDate.toLocaleDateString(),
        startTime: recordingDate.toLocaleTimeString(),
        endTime: 'Unknown',
        organizer: {
          name: 'Unknown',
          email: ''
        },
        attendees: []
      }
    }

    return {
      meeting: meetingContext,
      transcript: mergedTranscript
    }
  }

  /**
   * Submit Pass 1 batch job
   */
  private async submitPass1(
    summaryId: string,
    context: MeetingContext
  ): Promise<string> {
    // Format attendees list
    const attendeesList = context.meeting.attendees
      .map((a) => `${a.name} (${a.email})`)
      .join(', ')

    // Substitute variables in prompt
    const basePrompt = this.promptLoader.loadAndSubstitute(
      'pass1-summary.txt',
      {
        subject: context.meeting.subject,
        date: context.meeting.date,
        startTime: context.meeting.startTime,
        endTime: context.meeting.endTime,
        organizerName: context.meeting.organizer.name,
        organizerEmail: context.meeting.organizer.email,
        attendeesList,
        transcript: context.transcript
      }
    )

    // Phase 6 Batch 3: Prepend verbosity instruction
    const verbosityInstruction = this.getVerbosityInstruction()
    const prompt = verbosityInstruction + basePrompt

    // Create batch request
    const request = ClaudeBatchService.createBatchRequest(
      `pass1-${summaryId}`,
      prompt
    )

    // Submit to Anthropic
    const batchId = await this.claudeService.submitBatch([request])

    // Update database
    this.db.updateSummaryPass1(summaryId, batchId)
    this.db.saveBatchJob({
      id: batchId,
      summary_id: summaryId,
      pass_number: 1,
      status: 'in_progress',
      submitted_at: new Date().toISOString()
    })

    console.log(`Submitted Pass 1 batch ${batchId} for summary ${summaryId}`)
    return batchId
  }

  /**
   * Strip markdown code blocks from JSON responses
   * Claude sometimes wraps JSON in ```json ... ```
   */
  private stripMarkdownCodeBlocks(text: string): string {
    // Remove leading/trailing whitespace
    text = text.trim()

    // Check for markdown code blocks
    const codeBlockRegex = /^```(?:json)?\s*\n([\s\S]*?)\n```$/
    const match = text.match(codeBlockRegex)

    if (match) {
      return match[1].trim()
    }

    return text
  }

  /**
   * Attempt to repair common JSON syntax issues
   * Returns fixed JSON string or null if repair failed
   */
  private attemptJsonRepair(brokenJson: string): string | null {
    try {
      // Try 1: Remove trailing commas (common issue)
      let fixed = brokenJson.replace(/,(\s*[}\]])/g, '$1')

      // Try parsing
      JSON.parse(fixed)
      console.log('[JSON Repair] Successfully fixed trailing commas')
      return fixed
    } catch (e1) {
      // Try 2: Fix common escape issues
      try {
        // Replace common unescaped characters
        let fixed = brokenJson
          .replace(/([^\\])\\n/g, '$1\\\\n')  // Fix single backslash before n
          .replace(/([^\\])\\t/g, '$1\\\\t')  // Fix single backslash before t

        JSON.parse(fixed)
        console.log('[JSON Repair] Successfully fixed escape sequences')
        return fixed
      } catch (e2) {
        // Repair failed
        return null
      }
    }
  }

  /**
   * Poll Pass 1 in background (async, non-blocking)
   */
  private async pollPass1InBackground(
    summaryId: string,
    batchId: string,
    context: MeetingContext
  ): Promise<void> {
    try {
      // Update status
      this.db.updateSummaryStatus(summaryId, 'pass1_processing')

      // Poll until complete
      const status = await this.claudeService.pollBatchStatus(
        batchId,
        (progress) => {
          // Update batch job status
          this.db.updateBatchJobStatus(batchId, progress.status, progress.ended_at || undefined)
        }
      )

      // Retrieve results
      const results = await this.claudeService.retrieveResults(batchId)
      const result = results[0] // Single request

      // Extract and parse JSON
      const textContent = ClaudeBatchService.extractTextFromResult(result)
      const cleanedText = this.stripMarkdownCodeBlocks(textContent)

      // Parse JSON with error recovery
      let pass1Data: Pass1Result
      try {
        pass1Data = JSON.parse(cleanedText)
      } catch (parseError: any) {
        console.error('[Pass 1] JSON parse failed:', parseError.message)
        console.error('[Pass 1] Raw JSON (first 500 chars):', cleanedText.substring(0, 500))

        // Extract position from error message if available
        const positionMatch = parseError.message.match(/position (\d+)/)
        const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0
        if (errorPosition > 0) {
          console.error('[Pass 1] Raw JSON (around error position):',
            cleanedText.substring(Math.max(0, errorPosition - 100), errorPosition + 100))
        }

        // Attempt automatic repair
        console.log('[Pass 1] Attempting automatic JSON repair...')
        const repairedJson = this.attemptJsonRepair(cleanedText)

        if (repairedJson) {
          console.log('[Pass 1] ✅ JSON repair successful! Continuing with repaired data.')
          pass1Data = JSON.parse(repairedJson)
        } else {
          // Save the malformed response for debugging
          this.db.updateSummaryStatus(
            summaryId,
            'error',
            `LLM returned malformed JSON: ${parseError.message}. Automatic repair failed. Check logs.`
          )
          throw new Error(
            `Pass 1 JSON parsing failed: ${parseError.message}. ` +
            `Automatic repair attempted but failed. ` +
            `This usually happens when the transcript contains unescaped quotes or special characters. ` +
            `Raw response saved to logs for debugging.`
          )
        }
      }

      // Save to database
      this.db.updateSummaryPass1(summaryId, batchId, pass1Data)
      this.db.updateBatchJobStatus(batchId, 'ended', new Date().toISOString())

      console.log(`Pass 1 complete for summary ${summaryId}`)

      // Submit Pass 2
      const pass2BatchId = await this.submitPass2(summaryId, pass1Data, context)

      // Poll Pass 2
      await this.pollPass2InBackground(summaryId, pass2BatchId)
    } catch (error: any) {
      console.error(`Pass 1 failed for summary ${summaryId}:`, error)
      this.db.updateSummaryStatus(summaryId, 'error', error.message)
      throw error
    }
  }

  /**
   * Submit Pass 2 batch job (validation)
   */
  private async submitPass2(
    summaryId: string,
    pass1Data: Pass1Result,
    context: MeetingContext
  ): Promise<string> {
    // Format attendees list
    const attendeesList = context.meeting.attendees
      .map((a) => `${a.name} (${a.email})`)
      .join(', ')

    // Substitute variables in prompt
    const basePrompt = this.promptLoader.loadAndSubstitute(
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

    // Phase 6 Batch 3: Prepend verbosity instruction
    const verbosityInstruction = this.getVerbosityInstruction()
    const prompt = verbosityInstruction + basePrompt

    // Create batch request
    const request = ClaudeBatchService.createBatchRequest(
      `pass2-${summaryId}`,
      prompt
    )

    // Submit to Anthropic
    const batchId = await this.claudeService.submitBatch([request])

    // Update database
    this.db.updateSummaryPass2(summaryId, batchId)
    this.db.saveBatchJob({
      id: batchId,
      summary_id: summaryId,
      pass_number: 2,
      status: 'in_progress',
      submitted_at: new Date().toISOString()
    })

    console.log(`Submitted Pass 2 batch ${batchId} for summary ${summaryId}`)
    return batchId
  }

  /**
   * Poll Pass 2 in background (async, non-blocking)
   */
  private async pollPass2InBackground(
    summaryId: string,
    batchId: string
  ): Promise<void> {
    try {
      // Update status
      this.db.updateSummaryStatus(summaryId, 'pass2_processing')

      // Poll until complete
      const status = await this.claudeService.pollBatchStatus(
        batchId,
        (progress) => {
          // Update batch job status
          this.db.updateBatchJobStatus(batchId, progress.status, progress.ended_at || undefined)
        }
      )

      // Retrieve results
      const results = await this.claudeService.retrieveResults(batchId)
      const result = results[0] // Single request

      // Extract and parse JSON
      const textContent = ClaudeBatchService.extractTextFromResult(result)
      const cleanedText = this.stripMarkdownCodeBlocks(textContent)

      // Parse JSON with error recovery
      let pass2Data: Pass2Result
      try {
        pass2Data = JSON.parse(cleanedText)
      } catch (parseError: any) {
        console.error('[Pass 2] JSON parse failed:', parseError.message)
        console.error('[Pass 2] Raw JSON (first 500 chars):', cleanedText.substring(0, 500))

        // Extract position from error message if available
        const positionMatch = parseError.message.match(/position (\d+)/)
        const errorPosition = positionMatch ? parseInt(positionMatch[1]) : 0
        if (errorPosition > 0) {
          console.error('[Pass 2] Raw JSON (around error position):',
            cleanedText.substring(Math.max(0, errorPosition - 100), errorPosition + 100))
        }

        // Attempt automatic repair
        console.log('[Pass 2] Attempting automatic JSON repair...')
        const repairedJson = this.attemptJsonRepair(cleanedText)

        if (repairedJson) {
          console.log('[Pass 2] ✅ JSON repair successful! Continuing with repaired data.')
          pass2Data = JSON.parse(repairedJson)
        } else {
          // Save the malformed response for debugging
          this.db.updateSummaryStatus(
            summaryId,
            'error',
            `LLM returned malformed JSON: ${parseError.message}. Automatic repair failed. Check logs.`
          )
          throw new Error(
            `Pass 2 JSON parsing failed: ${parseError.message}. ` +
            `Automatic repair attempted but failed. ` +
            `This usually happens when the transcript contains unescaped quotes or special characters. ` +
            `Raw response saved to logs for debugging.`
          )
        }
      }

      // Save to database
      this.db.updateSummaryPass2(summaryId, batchId, pass2Data)
      this.db.updateBatchJobStatus(batchId, 'ended', new Date().toISOString())
      this.db.updateSummaryStatus(summaryId, 'complete')

      console.log(`Pass 2 complete - summary ${summaryId} is now complete`)
    } catch (error: any) {
      console.error(`Pass 2 failed for summary ${summaryId}:`, error)
      this.db.updateSummaryStatus(summaryId, 'error', error.message)
      throw error
    }
  }

  /**
   * Get current summary status (for UI polling)
   */
  async getSummaryStatus(summaryId: string): Promise<SummaryStatusDisplay> {
    const summary = this.db.getSummary(summaryId)
    if (!summary) {
      throw new Error(`Summary not found: ${summaryId}`)
    }

    // Determine current pass (include pass1_complete and complete states)
    let currentPass: 1 | 2 | null = null
    if (summary.overall_status === 'pass1_processing' ||
        summary.overall_status === 'pass1_submitted' ||
        summary.overall_status === 'pass1_complete') {
      currentPass = 1
    } else if (summary.overall_status === 'pass2_processing' ||
               summary.overall_status === 'pass2_submitted' ||
               summary.overall_status === 'complete') {
      currentPass = 2
    }

    // Get batch jobs to calculate accurate elapsed time and next check time
    const batchJobs = this.db.getBatchJobsBySummaryId(summaryId)
    const activeBatch = batchJobs.find(j =>
      j.pass_number === currentPass &&
      (j.status === 'in_progress' || j.status === 'ended')
    )

    // Calculate elapsed time from batch submission (more accurate than summary creation)
    let elapsedMinutes = 0
    if (activeBatch) {
      const batchStartTime = new Date(activeBatch.submitted_at).getTime()
      const now = Date.now()
      elapsedMinutes = Math.floor((now - batchStartTime) / 60000)
    } else {
      // Fallback to summary creation time if no batch found
      const startTime = new Date(summary.created_at).getTime()
      elapsedMinutes = Math.floor((Date.now() - startTime) / 60000)
    }

    // Calculate when backend will next poll Anthropic API (matches claudeBatch.ts logic)
    let backendNextCheckSeconds: number | undefined
    if (activeBatch && activeBatch.status === 'in_progress') {
      const batchStartTime = new Date(activeBatch.submitted_at).getTime()
      const batchElapsedMinutes = Math.floor((Date.now() - batchStartTime) / 60000)

      // Match the backend's adaptive polling interval
      let backendPollIntervalMs: number
      if (batchElapsedMinutes < 30) {
        backendPollIntervalMs = 5 * 60 * 1000  // 5 minutes
      } else if (batchElapsedMinutes < 45) {
        backendPollIntervalMs = 3 * 60 * 1000  // 3 minutes
      } else if (batchElapsedMinutes < 55) {
        backendPollIntervalMs = 1 * 60 * 1000  // 1 minute
      } else {
        backendPollIntervalMs = 30 * 1000  // 30 seconds
      }

      backendNextCheckSeconds = Math.floor(backendPollIntervalMs / 1000)
    }

    return {
      summaryId: summary.id,
      status: summary.overall_status,
      currentPass,
      elapsedMinutes,
      nextCheckInSeconds: 5,  // UI polls DB every 5 seconds (constant)
      backendNextCheckSeconds,  // When backend will actually poll Anthropic
      errorMessage: summary.pass1_error_message || summary.pass2_error_message || undefined
    }
  }

  /**
   * Cancel summary generation
   */
  async cancelSummary(summaryId: string): Promise<void> {
    const summary = this.db.getSummary(summaryId)
    if (!summary) {
      throw new Error(`Summary not found: ${summaryId}`)
    }

    // Cancel active batch jobs
    const batchJobs = this.db.getBatchJobsBySummaryId(summaryId)
    for (const job of batchJobs) {
      if (job.status === 'in_progress') {
        await this.claudeService.cancelBatch(job.id)
      }
    }

    // Update summary status
    this.db.updateSummaryStatus(summaryId, 'cancelled')
    console.log(`Cancelled summary ${summaryId}`)
  }

  /**
   * Regenerate summary (restart from Pass 1)
   */
  async regenerateSummary(summaryId: string): Promise<void> {
    const summary = this.db.getSummary(summaryId)
    if (!summary) {
      throw new Error(`Summary not found: ${summaryId}`)
    }

    console.log(`Regenerating summary ${summaryId}`)

    // Gather context again (meeting_id may be null for standalone recordings)
    const context = await this.gatherContext(summary.meeting_id || '', summary.transcript_id)

    // Reset status
    this.db.updateSummaryStatus(summaryId, 'pending')

    // Submit Pass 1 again
    const pass1BatchId = await this.submitPass1(summaryId, context)

    // Start background polling
    this.pollPass1InBackground(summaryId, pass1BatchId, context).catch((error) => {
      console.error(`Regeneration failed for summary ${summaryId}:`, error)
      this.db.updateSummaryStatus(summaryId, 'error', error.message)
    })
  }
}
