-- Phase 2.3-3: LLM-Based Meeting Intelligence
-- Database schema for SQLite
-- Created: 2025-01-14

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- =============================================================================
-- Table: meetings
-- Stores Microsoft Graph calendar events
-- =============================================================================
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,              -- Microsoft Graph event ID
  subject TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  organizer_name TEXT,
  organizer_email TEXT,
  attendees_json TEXT,              -- JSON array of attendees
  is_online_meeting BOOLEAN DEFAULT 0,
  online_meeting_url TEXT,
  location TEXT,
  body_preview TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_organizer_email ON meetings(organizer_email);

-- =============================================================================
-- Table: recordings
-- Stores audio recording metadata
-- =============================================================================
CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,              -- UUID
  meeting_id TEXT,                  -- Foreign key to meetings (nullable if not linked)
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  duration_seconds REAL,
  sample_rate INTEGER DEFAULT 16000,
  channels INTEGER DEFAULT 1,
  format TEXT DEFAULT 'wav',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at);

-- =============================================================================
-- Table: transcripts
-- Stores Whisper transcription results
-- =============================================================================
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,              -- UUID
  recording_id TEXT NOT NULL,
  transcript_text TEXT NOT NULL,    -- Full transcript
  segments_json TEXT,               -- JSON array of segments with timestamps
  language TEXT,
  confidence_avg REAL,
  processing_time_seconds REAL,
  model_used TEXT DEFAULT 'base',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transcripts_recording_id ON transcripts(recording_id);

-- =============================================================================
-- Table: diarization_results
-- Stores pyannote.audio speaker diarization segments
-- =============================================================================
CREATE TABLE IF NOT EXISTS diarization_results (
  id TEXT PRIMARY KEY,              -- UUID
  transcript_id TEXT NOT NULL,
  segments_json TEXT NOT NULL,      -- JSON array: [{speaker, start, end}]
  num_speakers INTEGER,
  processing_time_seconds REAL,
  device_used TEXT DEFAULT 'cpu',   -- 'cpu', 'mps', 'cuda'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_diarization_transcript_id ON diarization_results(transcript_id);

-- =============================================================================
-- Table: meeting_summaries
-- Stores LLM-generated summaries (Pass 1, Pass 2, user edits)
-- =============================================================================
CREATE TABLE IF NOT EXISTS meeting_summaries (
  id TEXT PRIMARY KEY,              -- UUID
  meeting_id TEXT,                  -- Foreign key to meetings (nullable if recording not linked)
  transcript_id TEXT NOT NULL,

  -- Pass 1: Initial speaker identification + summary
  pass1_batch_id TEXT,
  pass1_status TEXT,                -- 'pending', 'processing', 'complete', 'error'
  pass1_speaker_mappings_json TEXT, -- JSON: [{label, name, confidence, reasoning}]
  pass1_summary TEXT,               -- Executive summary (1-2 paragraphs)
  pass1_action_items_json TEXT,     -- JSON: [{description, assignee, priority}]
  pass1_key_decisions_json TEXT,    -- JSON: [string]
  pass1_detailed_notes_json TEXT,   -- JSON: {discussion_by_topic, notable_quotes, open_questions, parking_lot}
  pass1_completed_at DATETIME,
  pass1_error_message TEXT,

  -- Pass 2: Validation and refinement
  pass2_batch_id TEXT,
  pass2_status TEXT,
  pass2_refined_summary TEXT,       -- Refined executive summary
  pass2_validated_speakers_json TEXT,
  pass2_validated_action_items_json TEXT,
  pass2_validated_key_decisions_json TEXT,
  pass2_refined_detailed_notes_json TEXT,  -- JSON: Refined detailed_notes structure
  pass2_corrections_json TEXT,      -- JSON: [string] - list of corrections made
  pass2_completed_at DATETIME,
  pass2_error_message TEXT,

  -- User edits (final version)
  final_summary TEXT,
  final_speakers_json TEXT,
  final_action_items_json TEXT,
  final_key_decisions_json TEXT,
  edited_at DATETIME,

  -- Phase 4b: Email distribution
  final_recipients_json TEXT,          -- JSON: [{name, email}] - selected recipients
  final_subject_line TEXT,             -- Custom email subject line
  edited_by_user INTEGER DEFAULT 0,    -- Flag: 1 if user has edited this summary

  -- Phase 5.5: Email customization
  enabled_sections_json TEXT DEFAULT '{"summary":true,"participants":true,"actionItems":true,"decisions":true,"discussionTopics":true,"quotes":true,"questions":true,"parkingLot":true}',
  custom_introduction TEXT,            -- Optional personalized introduction before summary

  -- Overall status
  overall_status TEXT DEFAULT 'pending',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summaries_meeting_id ON meeting_summaries(meeting_id);
CREATE INDEX IF NOT EXISTS idx_summaries_transcript_id ON meeting_summaries(transcript_id);
CREATE INDEX IF NOT EXISTS idx_summaries_overall_status ON meeting_summaries(overall_status);
CREATE INDEX IF NOT EXISTS idx_summaries_created_at ON meeting_summaries(created_at);

-- =============================================================================
-- Table: batch_jobs
-- Tracks Anthropic batch job lifecycle
-- =============================================================================
CREATE TABLE IF NOT EXISTS batch_jobs (
  id TEXT PRIMARY KEY,              -- Anthropic batch_id
  summary_id TEXT NOT NULL,
  pass_number INTEGER NOT NULL,     -- 1 or 2
  status TEXT NOT NULL,             -- 'in_progress', 'canceling', 'ended'
  request_counts_json TEXT,         -- JSON: {processing, succeeded, errored, canceled, expired}
  results_url TEXT,
  submitted_at DATETIME NOT NULL,
  ended_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (summary_id) REFERENCES meeting_summaries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_summary_id ON batch_jobs(summary_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);

-- =============================================================================
-- Triggers for updated_at timestamp
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS update_meetings_timestamp
  AFTER UPDATE ON meetings
  FOR EACH ROW
BEGIN
  UPDATE meetings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_summaries_timestamp
  AFTER UPDATE ON meeting_summaries
  FOR EACH ROW
BEGIN
  UPDATE meeting_summaries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_batch_jobs_timestamp
  AFTER UPDATE ON batch_jobs
  FOR EACH ROW
BEGIN
  UPDATE batch_jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
