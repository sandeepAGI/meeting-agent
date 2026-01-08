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

      // Run migrations to add any missing columns to existing tables
      this.runMigrations()
    } catch (error) {
      console.error('Schema execution error:', error)
      throw error
    }
  }

  /**
   * Run database migrations to add missing columns
   * This ensures existing databases get updated when schema changes
   */
  private runMigrations(): void {
    try {
      // Check if columns exist
      const columns = this.db.prepare(`PRAGMA table_info(meeting_summaries)`).all() as any[]
      const hasDetailedNotesPass1 = columns.some(col => col.name === 'pass1_detailed_notes_json')
      const hasDetailedNotesPass2 = columns.some(col => col.name === 'pass2_refined_detailed_notes_json')

      // Phase 4b: Editor columns
      const hasRecipients = columns.some(col => col.name === 'final_recipients_json')
      const hasSubjectLine = columns.some(col => col.name === 'final_subject_line')
      const hasEditedByUser = columns.some(col => col.name === 'edited_by_user')

      // Phase 5: Email distribution tracking
      const hasSentAt = columns.some(col => col.name === 'sent_at')
      const hasSentTo = columns.some(col => col.name === 'sent_to_json')

      if (!hasDetailedNotesPass1) {
        console.log('Migration: Adding pass1_detailed_notes_json column')
        this.db.exec('ALTER TABLE meeting_summaries ADD COLUMN pass1_detailed_notes_json TEXT')
      }

      if (!hasDetailedNotesPass2) {
        console.log('Migration: Adding pass2_refined_detailed_notes_json column')
        this.db.exec('ALTER TABLE meeting_summaries ADD COLUMN pass2_refined_detailed_notes_json TEXT')
      }

      // Phase 4b migrations
      if (!hasRecipients) {
        console.log('Migration: Adding final_recipients_json column (Phase 4b)')
        this.db.exec('ALTER TABLE meeting_summaries ADD COLUMN final_recipients_json TEXT')
      }

      if (!hasSubjectLine) {
        console.log('Migration: Adding final_subject_line column (Phase 4b)')
        this.db.exec('ALTER TABLE meeting_summaries ADD COLUMN final_subject_line TEXT')
      }

      if (!hasEditedByUser) {
        console.log('Migration: Adding edited_by_user column (Phase 4b)')
        this.db.exec('ALTER TABLE meeting_summaries ADD COLUMN edited_by_user INTEGER DEFAULT 0')
      }

      // Phase 5 migrations
      if (!hasSentAt) {
        console.log('Migration: Adding sent_at column (Phase 5)')
        this.db.exec('ALTER TABLE meeting_summaries ADD COLUMN sent_at DATETIME')
      }

      if (!hasSentTo) {
        console.log('Migration: Adding sent_to_json column (Phase 5)')
        this.db.exec('ALTER TABLE meeting_summaries ADD COLUMN sent_to_json TEXT')
      }

      // Phase 5.5 migrations
      const hasEnabledSections = columns.some(col => col.name === 'enabled_sections_json')
      const hasCustomIntroduction = columns.some(col => col.name === 'custom_introduction')

      if (!hasEnabledSections) {
        console.log('Migration: Adding enabled_sections_json column (Phase 5.5)')
        this.db.exec(`ALTER TABLE meeting_summaries ADD COLUMN enabled_sections_json TEXT
          DEFAULT '{"summary":true,"participants":true,"actionItems":true,"decisions":true,"discussionTopics":true,"quotes":true,"questions":true,"parkingLot":true}'`)
      }

      if (!hasCustomIntroduction) {
        console.log('Migration: Adding custom_introduction column (Phase 5.5)')
        this.db.exec('ALTER TABLE meeting_summaries ADD COLUMN custom_introduction TEXT')
      }

      if (!hasDetailedNotesPass1 || !hasDetailedNotesPass2 || !hasRecipients || !hasSubjectLine || !hasEditedByUser || !hasSentAt || !hasSentTo || !hasEnabledSections || !hasCustomIntroduction) {
        console.log('Database migrations completed successfully')
      }
    } catch (error) {
      console.error('Migration error:', error)
      // Don't throw - let the app continue with existing schema
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
    // Use ON CONFLICT DO UPDATE instead of INSERT OR REPLACE to avoid triggering CASCADE DELETE
    // INSERT OR REPLACE internally does DELETE + INSERT, which triggers CASCADE on foreign keys
    const stmt = this.db.prepare(`
      INSERT INTO meetings (
        id, subject, start_time, end_time, organizer_name, organizer_email,
        attendees_json, is_online_meeting, online_meeting_url, location, body_preview
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject = excluded.subject,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        organizer_name = excluded.organizer_name,
        organizer_email = excluded.organizer_email,
        attendees_json = excluded.attendees_json,
        is_online_meeting = excluded.is_online_meeting,
        online_meeting_url = excluded.online_meeting_url,
        location = excluded.location,
        body_preview = excluded.body_preview
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

  /**
   * Get meetings with recording and summary information (with full JOIN)
   * Phase 2.3-4: Meeting-Recording Association
   *
   * Returns meetings with their associated recordings and summaries for display.
   * Used by Calendar Meetings view to show recording and summary status.
   */
  getMeetingsWithRecordingsAndSummaries(startDate: string, endDate: string) {
    const stmt = this.db.prepare(`
      SELECT
        m.*,
        r.id as recording_id,
        r.duration_seconds as recording_duration,
        t.id as transcript_id,
        s.id as summary_id,
        s.overall_status as summary_status
      FROM meetings m
      LEFT JOIN recordings r ON r.meeting_id = m.id
      LEFT JOIN transcripts t ON t.recording_id = r.id
      LEFT JOIN meeting_summaries s ON s.transcript_id = t.id
      WHERE m.start_time >= ? AND m.start_time < ?
      ORDER BY m.start_time DESC
    `)
    return stmt.all(startDate, endDate) as any[]
  }

  /**
   * Search meetings by subject (case-insensitive)
   * Phase 2.3-4: Meeting-Recording Association
   *
   * @param query - Search query (empty string returns all meetings)
   * @param limit - Maximum results (default 50)
   */
  searchMeetingsByTitle(query: string, limit: number = 50) {
    // Empty query returns all meetings (documented behavior)
    const stmt = this.db.prepare(`
      SELECT * FROM meetings
      WHERE subject LIKE ?
      ORDER BY start_time DESC
      LIMIT ?
    `)
    // Note: %${query}% is safe here - prepared statement escapes the entire value
    return stmt.all(`%${query}%`, limit) as any[]
  }

  /**
   * Update meeting subject
   * TDD Plan: Meeting Metadata Editing & Participant Deletion
   *
   * @param meetingId - Meeting ID to update
   * @param subject - New subject (will be trimmed and truncated to 200 chars)
   * @returns true if update succeeded, false if meeting not found
   * @throws Error if subject is empty or whitespace-only
   */
  updateMeetingSubject(meetingId: string, subject: string): boolean {
    // Validate subject
    const trimmedSubject = subject.trim()
    if (trimmedSubject.length === 0) {
      throw new Error('Subject cannot be empty')
    }

    // Truncate to 200 characters
    const finalSubject = trimmedSubject.slice(0, 200)

    // Check if meeting exists
    const meeting = this.getMeeting(meetingId)
    if (!meeting) {
      return false
    }

    // Update subject and updated_at timestamp
    const stmt = this.db.prepare(`
      UPDATE meetings
      SET subject = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    const result = stmt.run(finalSubject, meetingId)
    return result.changes > 0
  }

  /**
   * Update meeting start and end times
   * TDD Plan: Meeting Metadata Editing & Participant Deletion
   *
   * @param meetingId - Meeting ID to update
   * @param startTime - New start time
   * @param endTime - New end time
   * @returns true if update succeeded, false if meeting not found
   * @throws Error if end time is not after start time
   */
  updateMeetingDateTime(meetingId: string, startTime: Date, endTime: Date): boolean {
    // Validate times
    if (endTime.getTime() <= startTime.getTime()) {
      throw new Error('End time must be after start time')
    }

    // Check if meeting exists
    const meeting = this.getMeeting(meetingId)
    if (!meeting) {
      return false
    }

    // Convert to ISO strings for database storage
    const startTimeISO = startTime.toISOString()
    const endTimeISO = endTime.toISOString()

    // Update times and updated_at timestamp
    const stmt = this.db.prepare(`
      UPDATE meetings
      SET start_time = ?,
          end_time = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    const result = stmt.run(startTimeISO, endTimeISO, meetingId)
    return result.changes > 0
  }

  /**
   * Delete attendee from meeting's attendees_json
   * TDD Plan: Meeting Metadata Editing & Participant Deletion
   *
   * @param meetingId - Meeting ID
   * @param attendeeEmail - Email of attendee to delete
   * @returns true if deletion succeeded, false if meeting/attendee not found
   * @throws Error if attempting to delete organizer
   */
  deleteMeetingAttendee(meetingId: string, attendeeEmail: string): boolean {
    // Get meeting
    const meeting = this.getMeeting(meetingId)
    if (!meeting) {
      return false
    }

    // Check if trying to delete organizer
    if (meeting.organizer_email &&
        meeting.organizer_email.toLowerCase() === attendeeEmail.toLowerCase()) {
      throw new Error('Cannot delete meeting organizer')
    }

    // Parse attendees JSON
    if (!meeting.attendees_json) {
      return false
    }

    let attendees: any[]
    try {
      attendees = JSON.parse(meeting.attendees_json)
    } catch {
      return false
    }

    // Find and remove attendee (case-insensitive email matching)
    const emailLower = attendeeEmail.toLowerCase()
    const originalLength = attendees.length
    const updatedAttendees = attendees.filter(
      (a: any) => a.email.toLowerCase() !== emailLower
    )

    // If no change, attendee wasn't found
    if (updatedAttendees.length === originalLength) {
      return false
    }

    // Update database
    const stmt = this.db.prepare(`
      UPDATE meetings
      SET attendees_json = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    const result = stmt.run(JSON.stringify(updatedAttendees), meetingId)
    return result.changes > 0
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

  /**
   * Get all recordings for a specific meeting
   * Phase 2.3-4: Meeting-Recording Association
   */
  getRecordingsByMeetingId(meetingId: string) {
    const stmt = this.db.prepare(`
      SELECT * FROM recordings
      WHERE meeting_id = ?
      ORDER BY created_at DESC
    `)
    return stmt.all(meetingId) as any[]
  }

  /**
   * Update recording's meeting_id (link recording to calendar meeting)
   * Phase 2.3-4: Meeting-Recording Association
   */
  updateRecordingMeetingId(recordingId: string, meetingId: string | null): void {
    // Get current value before update
    const current = this.db.prepare('SELECT meeting_id FROM recordings WHERE id = ?').get(recordingId) as { meeting_id: string | null } | undefined

    console.log(`[Database] updateRecordingMeetingId called:`, {
      recordingId,
      meetingId_new: meetingId,
      meetingId_old: current?.meeting_id || null,
      stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
    })

    const stmt = this.db.prepare(`
      UPDATE recordings
      SET meeting_id = ?
      WHERE id = ?
    `)
    const result = stmt.run(meetingId, recordingId)

    console.log(`[Database] UPDATE result:`, {
      changes: result.changes
    })

    // Verify the update
    const verify = this.db.prepare('SELECT id, meeting_id FROM recordings WHERE id = ?').get(recordingId)
    console.log(`[Database] Verification after update:`, verify)
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
   * Get recordings that have NOT been transcribed yet
   * Used for MeetingSelector "Untranscribed" tab
   */
  getUntranscribedRecordings(limit: number = 50) {
    const stmt = this.db.prepare(`
      SELECT
        r.id as recording_id,
        r.file_path,
        r.duration_seconds,
        r.created_at,
        r.meeting_id
      FROM recordings r
      WHERE NOT EXISTS (
        SELECT 1 FROM transcripts t WHERE t.recording_id = r.id
      )
      ORDER BY r.created_at DESC
      LIMIT ?
    `)
    return stmt.all(limit)
  }

  /**
   * Get recordings with their transcripts and diarization results
   * Used for MeetingSelector UI
   */
  getRecordingsWithTranscripts(limit: number = 20) {
    const stmt = this.db.prepare(`
      SELECT
        r.id as recording_id,
        r.meeting_id,
        r.file_path,
        r.duration_seconds,
        r.created_at as recording_created_at,
        t.id as transcript_id,
        t.transcript_text,
        t.created_at as transcript_created_at,
        d.id as diarization_id,
        d.num_speakers,
        d.created_at as diarization_created_at,
        m.id as calendar_meeting_id,
        m.subject as meeting_subject,
        m.start_time as meeting_start_time,
        -- Priority: latest complete summary, then latest in-progress, then any latest
        COALESCE(
          (SELECT id FROM meeting_summaries WHERE transcript_id = t.id AND overall_status = 'complete' ORDER BY created_at DESC LIMIT 1),
          (SELECT id FROM meeting_summaries WHERE transcript_id = t.id AND overall_status LIKE '%processing%' ORDER BY created_at DESC LIMIT 1),
          (SELECT id FROM meeting_summaries WHERE transcript_id = t.id AND overall_status LIKE '%submitted%' ORDER BY created_at DESC LIMIT 1),
          (SELECT id FROM meeting_summaries WHERE transcript_id = t.id ORDER BY created_at DESC LIMIT 1)
        ) as summary_id,
        (SELECT overall_status FROM meeting_summaries WHERE id = (
          COALESCE(
            (SELECT id FROM meeting_summaries WHERE transcript_id = t.id AND overall_status = 'complete' ORDER BY created_at DESC LIMIT 1),
            (SELECT id FROM meeting_summaries WHERE transcript_id = t.id AND overall_status LIKE '%processing%' ORDER BY created_at DESC LIMIT 1),
            (SELECT id FROM meeting_summaries WHERE transcript_id = t.id AND overall_status LIKE '%submitted%' ORDER BY created_at DESC LIMIT 1),
            (SELECT id FROM meeting_summaries WHERE transcript_id = t.id ORDER BY created_at DESC LIMIT 1)
          )
        )) as summary_status
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

    console.log(`[Database] createSummary called:`, {
      summaryId,
      meeting_id: data.meeting_id,
      transcript_id: data.transcript_id,
      dbPath: this.dbPath
    })

    const stmt = this.db.prepare(`
      INSERT INTO meeting_summaries (
        id, meeting_id, transcript_id, overall_status
      ) VALUES (?, ?, ?, 'pending')
    `)

    try {
      const result = stmt.run(summaryId, data.meeting_id || null, data.transcript_id)
      console.log(`[Database] INSERT result:`, {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      })

      // Immediately verify
      const verify = this.db.prepare('SELECT id, overall_status, created_at FROM meeting_summaries WHERE id = ?').get(summaryId)
      console.log(`[Database] Immediate verification:`, verify)

      if (!verify) {
        throw new Error(`CRITICAL: Summary ${summaryId} not found immediately after INSERT!`)
      }

      return summaryId
    } catch (error) {
      console.error(`[Database] createSummary ERROR:`, error)
      throw error
    }
  }

  getSummary(summaryId: string): MeetingSummary | null {
    const stmt = this.db.prepare(`
      SELECT
        s.*,
        m.subject as meeting_subject,
        m.start_time as meeting_start_time,
        m.end_time as meeting_end_time,
        m.organizer_name as meeting_organizer_name,
        m.organizer_email as meeting_organizer_email,
        m.location as meeting_location
      FROM meeting_summaries s
      LEFT JOIN meetings m ON s.meeting_id = m.id
      WHERE s.id = ?
    `)
    return stmt.get(summaryId) as MeetingSummary | null
  }

  getSummaryByMeetingId(meetingId: string): MeetingSummary | null {
    const stmt = this.db.prepare(
      'SELECT * FROM meeting_summaries WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1'
    )
    return stmt.get(meetingId) as MeetingSummary | null
  }

  // Phase 4: Get summary by recording ID
  getSummaryByRecordingId(recordingId: string): MeetingSummary | null {
    const stmt = this.db.prepare(`
      SELECT s.* FROM meeting_summaries s
      JOIN transcripts t ON s.transcript_id = t.id
      WHERE t.recording_id = ?
      ORDER BY s.created_at DESC
      LIMIT 1
    `)
    return stmt.get(recordingId) as MeetingSummary | null
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
    console.log(`[Database] updateSummaryPass1:`, { summaryId, batchId, hasData: !!data })

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
      const result = stmt.run(batchId, summaryId)
      console.log(`[Database] Pass1 batch submitted, changes: ${result.changes}`)
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

    const result = stmt.run(
      JSON.stringify(data.speaker_mappings),
      data.executive_summary || data.summary, // Support both field names
      JSON.stringify(data.action_items),
      JSON.stringify(data.key_decisions),
      data.detailed_notes ? JSON.stringify(data.detailed_notes) : null,
      summaryId
    )
    console.log(`[Database] Pass1 complete updated, changes: ${result.changes}`)

    // Verify update
    const verify = this.db.prepare('SELECT id, overall_status FROM meeting_summaries WHERE id = ?').get(summaryId)
    console.log(`[Database] Pass1 verification:`, verify)
  }

  updateSummaryPass2(
    summaryId: string,
    batchId: string,
    data?: Pass2Result
  ): void {
    console.log(`[Database] updateSummaryPass2:`, { summaryId, batchId, hasData: !!data })

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
      const result = stmt.run(batchId, summaryId)
      console.log(`[Database] Pass2 batch submitted, changes: ${result.changes}`)
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

    const result = stmt.run(
      data.refined_executive_summary || data.refined_summary, // Support both field names
      JSON.stringify(data.validated_speakers),
      JSON.stringify(data.validated_action_items),
      JSON.stringify(data.validated_key_decisions),
      data.refined_detailed_notes ? JSON.stringify(data.refined_detailed_notes) : null,
      JSON.stringify(data.corrections),
      summaryId
    )
    console.log(`[Database] Pass2 complete updated, changes: ${result.changes}`)

    // Verify update
    const verify = this.db.prepare('SELECT id, overall_status FROM meeting_summaries WHERE id = ?').get(summaryId)
    console.log(`[Database] Pass2 verification:`, verify)
  }

  /**
   * Update the meeting_id for a summary
   * Phase 2.3-4: Meeting-Recording Association
   */
  updateSummaryMeetingId(summaryId: string, meetingId: string | null): void {
    const stmt = this.db.prepare(`
      UPDATE meeting_summaries
      SET meeting_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    stmt.run(meetingId, summaryId)
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

    // Phase 4b: Email distribution fields
    if (userEdits.recipients !== undefined) {
      updates.push('final_recipients_json = ?')
      values.push(JSON.stringify(userEdits.recipients))
    }

    if (userEdits.subjectLine !== undefined) {
      updates.push('final_subject_line = ?')
      values.push(userEdits.subjectLine)
    }

    // Phase 5.5: Email customization fields
    if (userEdits.detailedNotes !== undefined) {
      // Store edited detailed notes - will be used instead of pass2_refined_detailed_notes_json
      updates.push('pass2_refined_detailed_notes_json = ?')
      values.push(JSON.stringify(userEdits.detailedNotes))
    }

    if (userEdits.enabledSections !== undefined) {
      updates.push('enabled_sections_json = ?')
      values.push(JSON.stringify(userEdits.enabledSections))
    }

    if (userEdits.customIntroduction !== undefined) {
      updates.push('custom_introduction = ?')
      values.push(userEdits.customIntroduction)
    }

    if (updates.length === 0) return

    // Mark as edited by user
    updates.push('edited_by_user = 1')
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

  /**
   * Mark summary as sent via email
   * Phase 5: Email Distribution
   *
   * @param summaryId - Summary ID
   * @param recipients - List of email recipients who received the summary
   */
  markSummaryAsSent(summaryId: string, recipients: { name: string; email: string }[]): void {
    const stmt = this.db.prepare(`
      UPDATE meeting_summaries
      SET
        sent_at = CURRENT_TIMESTAMP,
        sent_to_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    stmt.run(JSON.stringify(recipients), summaryId)
    console.log(`[DB] Marked summary ${summaryId} as sent to ${recipients.length} recipient(s)`)
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

  // ===========================================================================
  // Data Retention / Cleanup (Phase 7: Storage Management)
  // ===========================================================================

  /**
   * Clean up old transcripts based on retention policy
   * Phase 7: Storage Management - Task 1.2
   *
   * @param retentionDays - Delete transcripts older than this many days (0 = keep forever)
   * @returns Object with deletedCount
   */
  cleanupOldTranscripts(retentionDays: number): { deletedCount: number } {
    // 0 = keep forever
    if (retentionDays === 0) {
      return { deletedCount: 0 }
    }

    // Get transcripts to delete
    const toDelete = this.db.prepare(`
      SELECT t.id
      FROM transcripts t
      WHERE t.created_at < datetime('now', '-' || ? || ' days')
    `).all(retentionDays) as Array<{ id: string }>

    let deletedCount = 0

    // Delete transcripts and their associated diarization data
    for (const transcript of toDelete) {
      // Delete associated diarization results (CASCADE should handle this, but explicit is safer)
      this.db.prepare('DELETE FROM diarization_results WHERE transcript_id = ?')
        .run(transcript.id)

      // Delete transcript
      this.db.prepare('DELETE FROM transcripts WHERE id = ?')
        .run(transcript.id)

      deletedCount++
    }

    console.log(`[Cleanup] Deleted ${deletedCount} transcripts older than ${retentionDays} days`)
    return { deletedCount }
  }

  /**
   * Clean up old summaries based on retention policy
   * Phase 7: Storage Management - Task 1.3
   *
   * @param retentionDays - Delete summaries older than this many days (0 = keep forever)
   * @returns Object with deletedCount
   */
  cleanupOldSummaries(retentionDays: number): { deletedCount: number } {
    // 0 = keep forever
    if (retentionDays === 0) {
      return { deletedCount: 0 }
    }

    // Delete summaries older than retention period
    const result = this.db.prepare(`
      DELETE FROM meeting_summaries
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `).run(retentionDays)

    const deletedCount = result.changes
    console.log(`[Cleanup] Deleted ${deletedCount} summaries older than ${retentionDays} days`)
    return { deletedCount }
  }

  /**
   * Get current audio storage usage
   * Phase 7: Storage Management - Task 1.4
   *
   * @returns Object with totalBytes and totalGB
   */
  getAudioStorageUsage(): { totalBytes: number; totalGB: number } {
    const result = this.db.prepare(`
      SELECT COALESCE(SUM(file_size_bytes), 0) as total_bytes
      FROM recordings
      WHERE file_path != ''
    `).get() as { total_bytes: number }

    const totalBytes = result.total_bytes || 0
    const totalGB = totalBytes / (1024 ** 3)

    return { totalBytes, totalGB }
  }

  /**
   * Get oldest recordings ordered by created_at
   * Phase 7: Storage Management - Task 1.4
   *
   * @param limit - Maximum number of recordings to return
   * @returns Array of recordings with id, file_path, and file_size_bytes
   */
  getOldestRecordings(limit: number): Array<{ id: string; file_path: string; file_size_bytes: number }> {
    return this.db.prepare(`
      SELECT id, file_path, file_size_bytes
      FROM recordings
      WHERE file_path != ''
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit) as Array<{ id: string; file_path: string; file_size_bytes: number }>
  }

  /**
   * Clear recording file path (set to empty string)
   * Phase 7: Storage Management - Task 1.4
   *
   * Used when audio file is deleted to free up storage but keep database record.
   * Uses empty string instead of NULL due to NOT NULL constraint in schema.
   *
   * @param recordingId - Recording ID to update
   */
  clearRecordingFilePath(recordingId: string): void {
    this.db.prepare("UPDATE recordings SET file_path = '' WHERE id = ?")
      .run(recordingId)
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
  }
}
