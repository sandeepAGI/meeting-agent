/**
 * DatabaseService - SQLite database wrapper
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 * 
 * Provides CRUD operations for all database tables with proper
 * error handling, transactions, and foreign key support.
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'
import type {
  MeetingSummary,
  SummaryStatus,
  Pass1Result,
  Pass2Result,
  UpdateSummaryRequest,
  EmailContext
} from '../types'

// Conditional electron import - only available in Electron environment
let app: any
try {
  app = require('electron').app
} catch {
  // Running in Node.js (test environment) - app will be undefined
  app = undefined
}

export class DatabaseService {
  private db: Database.Database
  private dbPath: string

  constructor(dbPath?: string) {
    // Default: Store in userData directory (Electron) or temp directory (tests)
    if (dbPath) {
      this.dbPath = dbPath
    } else if (app && app.getPath) {
      // Electron environment - use userData directory
      this.dbPath = path.join(app.getPath('userData'), 'meeting-agent.db')
    } else {
      // Test/Node.js environment - use temp directory
      const tmpDir = require('os').tmpdir()
      this.dbPath = path.join(tmpDir, `meeting-agent-test-${Date.now()}.db`)
    }

    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    // Initialize database
    this.db = new Database(this.dbPath)
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('journal_mode = WAL') // Better concurrency

    // Initialize schema
    this.initializeSchema()
  }

  /**
   * Initialize database schema from schema.sql
   */
  private initializeSchema(): void {
    const schemaPath = path.join(__dirname, '../database/schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf-8')

    try {
      // Execute entire schema at once - better-sqlite3 handles multiple statements
      this.db.exec(schema)
      console.log(`Database initialized at: ${this.dbPath}`)
    } catch (error) {
      console.error('Schema execution error:', error)
      throw error
    }
  }

  // ===========================================================================
  // Meetings
  // ===========================================================================

  saveMeeting(meeting: {
    id: string
    subject: string
    start_time: string
    end_time: string
    organizer_name?: string
    organizer_email?: string
    attendees_json?: string
    is_online_meeting?: boolean
    online_meeting_url?: string
    location?: string
    body_preview?: string
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO meetings (
        id, subject, start_time, end_time, organizer_name, organizer_email,
        attendees_json, is_online_meeting, online_meeting_url, location, body_preview
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      meeting.id,
      meeting.subject,
      meeting.start_time,
      meeting.end_time,
      meeting.organizer_name || null,
      meeting.organizer_email || null,
      meeting.attendees_json || null,
      meeting.is_online_meeting ? 1 : 0,
      meeting.online_meeting_url || null,
      meeting.location || null,
      meeting.body_preview || null
    )
  }

  getMeeting(meetingId: string) {
    const stmt = this.db.prepare('SELECT * FROM meetings WHERE id = ?')
    return stmt.get(meetingId) as any
  }

  getMeetingsByDateRange(startDate: string, endDate: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM meetings
      WHERE start_time >= ? AND start_time < ?
      ORDER BY start_time DESC
    `)
    return stmt.all(startDate, endDate) as any[]
  }

  // ===========================================================================
  // Recordings
  // ===========================================================================

  saveRecording(recording: {
    id: string
    meeting_id?: string
    file_path: string
    file_size_bytes?: number
    duration_seconds?: number
    sample_rate?: number
    channels?: number
    format?: string
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO recordings (
        id, meeting_id, file_path, file_size_bytes, duration_seconds,
        sample_rate, channels, format
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      recording.id,
      recording.meeting_id || null,
      recording.file_path,
      recording.file_size_bytes || null,
      recording.duration_seconds || null,
      recording.sample_rate || 16000,
      recording.channels || 1,
      recording.format || 'wav'
    )
  }

  getRecording(recordingId: string) {
    const stmt = this.db.prepare('SELECT * FROM recordings WHERE id = ?')
    return stmt.get(recordingId) as any
  }

  getRecentRecordings(limit: number = 20) {
    const stmt = this.db.prepare(`
      SELECT * FROM recordings
      ORDER BY created_at DESC
      LIMIT ?
    `)
    return stmt.all(limit) as any[]
  }

  // ===========================================================================
  // Transcripts
  // ===========================================================================

  saveTranscript(transcript: {
    id: string
    recording_id: string
    transcript_text: string
    segments_json?: string
    language?: string
    confidence_avg?: number
    processing_time_seconds?: number
    model_used?: string
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO transcripts (
        id, recording_id, transcript_text, segments_json, language,
        confidence_avg, processing_time_seconds, model_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      transcript.id,
      transcript.recording_id,
      transcript.transcript_text,
      transcript.segments_json || null,
      transcript.language || null,
      transcript.confidence_avg || null,
      transcript.processing_time_seconds || null,
      transcript.model_used || 'base'
    )
  }

  getTranscript(transcriptId: string) {
    const stmt = this.db.prepare('SELECT * FROM transcripts WHERE id = ?')
    return stmt.get(transcriptId) as any
  }

  getTranscriptByRecordingId(recordingId: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM transcripts
      WHERE recording_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    return stmt.get(recordingId) as any
  }

  // ===========================================================================
  // Diarization Results
  // ===========================================================================

  saveDiarizationResult(diarization: {
    id: string
    transcript_id: string
    segments_json: string
    num_speakers?: number
    processing_time_seconds?: number
    device_used?: string
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO diarization_results (
        id, transcript_id, segments_json, num_speakers,
        processing_time_seconds, device_used
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      diarization.id,
      diarization.transcript_id,
      diarization.segments_json,
      diarization.num_speakers || null,
      diarization.processing_time_seconds || null,
      diarization.device_used || 'cpu'
    )
  }

  getDiarizationResult(diarizationId: string) {
    const stmt = this.db.prepare('SELECT * FROM diarization_results WHERE id = ?')
    return stmt.get(diarizationId) as any
  }

  getDiarizationByTranscriptId(transcriptId: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM diarization_results
      WHERE transcript_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    return stmt.get(transcriptId) as any
  }

  // ===========================================================================
  // Joined Queries (for UI)
  // ===========================================================================

  /**
   * Get recordings with their transcripts and diarization results
   * Used for MeetingSelector UI
   */
  getRecordingsWithTranscripts(limit: number = 20) {
    const stmt = this.db.prepare(`
      SELECT
        r.id as recording_id,
        r.file_path,
        r.duration_seconds,
        r.created_at as recording_created_at,
        t.id as transcript_id,
        t.transcript_text,
        t.created_at as transcript_created_at,
        d.id as diarization_id,
        d.num_speakers,
        d.created_at as diarization_created_at,
        m.id as meeting_id,
        m.subject as meeting_subject,
        m.start_time as meeting_start_time
      FROM recordings r
      LEFT JOIN transcripts t ON t.recording_id = r.id
      LEFT JOIN diarization_results d ON d.transcript_id = t.id
      LEFT JOIN meetings m ON m.id = r.meeting_id
      WHERE t.id IS NOT NULL
      ORDER BY r.created_at DESC
      LIMIT ?
    `)
    return stmt.all(limit) as any[]
  }

  // ===========================================================================
  // Meeting Summaries
  // ===========================================================================

  createSummary(data: {
    meeting_id?: string | null
    transcript_id: string
  }): string {
    const summaryId = randomUUID()

    const stmt = this.db.prepare(`
      INSERT INTO meeting_summaries (
        id, meeting_id, transcript_id, overall_status
      ) VALUES (?, ?, ?, 'pending')
    `)

    stmt.run(summaryId, data.meeting_id || null, data.transcript_id)
    return summaryId
  }

  getSummary(summaryId: string): MeetingSummary | null {
    const stmt = this.db.prepare('SELECT * FROM meeting_summaries WHERE id = ?')
    return stmt.get(summaryId) as MeetingSummary | null
  }

  getSummaryByMeetingId(meetingId: string): MeetingSummary | null {
    const stmt = this.db.prepare(
      'SELECT * FROM meeting_summaries WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1'
    )
    return stmt.get(meetingId) as MeetingSummary | null
  }

  updateSummaryStatus(
    summaryId: string,
    status: SummaryStatus,
    errorMessage?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE meeting_summaries 
      SET overall_status = ?, 
          ${errorMessage ? 'pass1_error_message = ?,' : ''}
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    if (errorMessage) {
      stmt.run(status, errorMessage, summaryId)
    } else {
      stmt.run(status, summaryId)
    }
  }

  updateSummaryPass1(
    summaryId: string,
    batchId: string,
    data?: Pass1Result
  ): void {
    if (!data) {
      // Just update batch ID (when submitting)
      const stmt = this.db.prepare(`
        UPDATE meeting_summaries 
        SET pass1_batch_id = ?,
            pass1_status = 'submitted',
            overall_status = 'pass1_submitted',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      stmt.run(batchId, summaryId)
      return
    }

    // Update with results (when complete)
    const stmt = this.db.prepare(`
      UPDATE meeting_summaries
      SET pass1_status = 'complete',
          pass1_speaker_mappings_json = ?,
          pass1_summary = ?,
          pass1_action_items_json = ?,
          pass1_key_decisions_json = ?,
          pass1_detailed_notes_json = ?,
          pass1_completed_at = CURRENT_TIMESTAMP,
          overall_status = 'pass1_complete',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    stmt.run(
      JSON.stringify(data.speaker_mappings),
      data.executive_summary || data.summary, // Support both field names
      JSON.stringify(data.action_items),
      JSON.stringify(data.key_decisions),
      data.detailed_notes ? JSON.stringify(data.detailed_notes) : null,
      summaryId
    )
  }

  updateSummaryPass2(
    summaryId: string,
    batchId: string,
    data?: Pass2Result
  ): void {
    if (!data) {
      // Just update batch ID (when submitting)
      const stmt = this.db.prepare(`
        UPDATE meeting_summaries 
        SET pass2_batch_id = ?,
            pass2_status = 'submitted',
            overall_status = 'pass2_submitted',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      stmt.run(batchId, summaryId)
      return
    }

    // Update with results (when complete)
    const stmt = this.db.prepare(`
      UPDATE meeting_summaries
      SET pass2_status = 'complete',
          pass2_refined_summary = ?,
          pass2_validated_speakers_json = ?,
          pass2_validated_action_items_json = ?,
          pass2_validated_key_decisions_json = ?,
          pass2_refined_detailed_notes_json = ?,
          pass2_corrections_json = ?,
          pass2_completed_at = CURRENT_TIMESTAMP,
          overall_status = 'complete',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    stmt.run(
      data.refined_executive_summary || data.refined_summary, // Support both field names
      JSON.stringify(data.validated_speakers),
      JSON.stringify(data.validated_action_items),
      JSON.stringify(data.validated_key_decisions),
      data.refined_detailed_notes ? JSON.stringify(data.refined_detailed_notes) : null,
      JSON.stringify(data.corrections),
      summaryId
    )
  }

  updateSummaryFinal(summaryId: string, userEdits: UpdateSummaryRequest): void {
    const updates: string[] = []
    const values: any[] = []

    if (userEdits.summary !== undefined) {
      updates.push('final_summary = ?')
      values.push(userEdits.summary)
    }

    if (userEdits.speakers !== undefined) {
      updates.push('final_speakers_json = ?')
      values.push(JSON.stringify(userEdits.speakers))
    }

    if (userEdits.actionItems !== undefined) {
      updates.push('final_action_items_json = ?')
      values.push(JSON.stringify(userEdits.actionItems))
    }

    if (userEdits.keyDecisions !== undefined) {
      updates.push('final_key_decisions_json = ?')
      values.push(JSON.stringify(userEdits.keyDecisions))
    }

    if (updates.length === 0) return

    updates.push('edited_at = CURRENT_TIMESTAMP')
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(summaryId)

    const stmt = this.db.prepare(`
      UPDATE meeting_summaries 
      SET ${updates.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...values)
  }

  // ===========================================================================
  // Batch Jobs
  // ===========================================================================

  saveBatchJob(data: {
    id: string
    summary_id: string
    pass_number: number
    status: string
    submitted_at: string
    expires_at?: string
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO batch_jobs (
        id, summary_id, pass_number, status, submitted_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      data.id,
      data.summary_id,
      data.pass_number,
      data.status,
      data.submitted_at,
      data.expires_at || null
    )
  }

  updateBatchJobStatus(batchId: string, status: string, endedAt?: string): void {
    const stmt = this.db.prepare(`
      UPDATE batch_jobs 
      SET status = ?, 
          ended_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    stmt.run(status, endedAt || null, batchId)
  }

  getBatchJob(batchId: string) {
    const stmt = this.db.prepare('SELECT * FROM batch_jobs WHERE id = ?')
    return stmt.get(batchId) as any
  }

  getBatchJobsBySummaryId(summaryId: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM batch_jobs 
      WHERE summary_id = ? 
      ORDER BY pass_number ASC
    `)
    return stmt.all(summaryId) as any[]
  }

  // ===========================================================================
  // Email Context Cache
  // ===========================================================================

  cacheEmails(meetingId: string, emails: EmailContext[]): void {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 day cache

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO email_context_cache (
        meeting_id, emails_json, fetched_at, expires_at
      ) VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    `)

    stmt.run(meetingId, JSON.stringify(emails), expiresAt.toISOString())
  }

  getCachedEmails(meetingId: string): EmailContext[] | null {
    const stmt = this.db.prepare(`
      SELECT emails_json, expires_at 
      FROM email_context_cache 
      WHERE meeting_id = ?
    `)

    const result = stmt.get(meetingId) as any

    if (!result) return null

    // Check if expired
    const expiresAt = new Date(result.expires_at)
    if (expiresAt < new Date()) {
      // Cache expired, delete it
      this.db
        .prepare('DELETE FROM email_context_cache WHERE meeting_id = ?')
        .run(meetingId)
      return null
    }

    return JSON.parse(result.emails_json)
  }

  // ===========================================================================
  // Cleanup / Maintenance
  // ===========================================================================

  cleanupExpiredCache(): void {
    const stmt = this.db.prepare(`
      DELETE FROM email_context_cache 
      WHERE expires_at < CURRENT_TIMESTAMP
    `)
    const result = stmt.run()
    console.log(`Cleaned up ${result.changes} expired email cache entries`)
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
  }
}
