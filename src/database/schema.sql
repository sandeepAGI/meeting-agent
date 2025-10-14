-- Meeting Agent Database Schema
-- SQLite database for Phase 2.3-3: LLM-Based Meeting Intelligence
--
-- This schema stores:
-- - Meeting metadata from Microsoft Graph
-- - Recording and transcription data
-- - Speaker diarization results
-- - LLM-generated summaries (Pass 1, Pass 2, user edits)
-- - Batch job tracking
-- - Email context cache

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Meetings table
-- Stores Microsoft 365 calendar events
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,              -- Microsoft Graph event ID
  subject TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  organizer_name TEXT,
  organizer_email TEXT,
  attendees_json TEXT,              -- JSON array of {name, email, type}
  is_online_meeting BOOLEAN DEFAULT 0,
  online_meeting_url TEXT,
  location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_organizer_email ON meetings(organizer_email);

-- Recordings table
-- Stores audio file metadata
CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,              -- UUID
  meeting_id TEXT,                  -- NULL if recording not linked to meeting yet
  audio_file_path TEXT NOT NULL,
  duration_seconds INTEGER,
  file_size_bytes INTEGER,
  sample_rate INTEGER DEFAULT 16000,
  channels INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);

-- Transcripts table
-- Stores Whisper transcription results
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,              -- UUID
  recording_id TEXT NOT NULL,
  transcript_text TEXT NOT NULL,
  segments_json TEXT,               -- JSON array of {start, end, text}
  language TEXT DEFAULT 'en',
  processing_time_seconds REAL,
  model_name TEXT,                  -- e.g., 'base', 'small', 'medium'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transcripts_recording_id ON transcripts(recording_id);

-- Diarization results table
-- Stores pyannote.audio speaker segmentation
CREATE TABLE IF NOT EXISTS diarization_results (
  id TEXT PRIMARY KEY,              -- UUID
  transcript_id TEXT NOT NULL,
  segments_json TEXT NOT NULL,      -- JSON array of {start, end, speaker}
  speaker_count INTEGER,
  processing_time_seconds REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_diarization_transcript_id ON diarization_results(transcript_id);

-- Meeting summaries table
-- Stores LLM-generated summaries (Pass 1, Pass 2, user edits)
CREATE TABLE IF NOT EXISTS meeting_summaries (
  id TEXT PRIMARY KEY,              -- UUID
  meeting_id TEXT NOT NULL,
  transcript_id TEXT NOT NULL,
  diarization_id TEXT,              -- Optional: NULL if no diarization

  -- Pass 1 data
  pass1_batch_id TEXT,
  pass1_status TEXT CHECK(pass1_status IN ('pending', 'processing', 'complete', 'error')),
  pass1_speaker_mappings_json TEXT, -- JSON array of {label, name, confidence, reasoning}
  pass1_summary TEXT,
  pass1_action_items_json TEXT,     -- JSON array of {description, assignee, priority, dueDate}
  pass1_key_decisions_json TEXT,    -- JSON array of strings
  pass1_started_at DATETIME,
  pass1_completed_at DATETIME,
  pass1_error_message TEXT,

  -- Pass 2 data
  pass2_batch_id TEXT,
  pass2_status TEXT CHECK(pass2_status IN ('pending', 'processing', 'complete', 'error')),
  pass2_refined_summary TEXT,
  pass2_validated_speakers_json TEXT, -- JSON array of {label, name, confidence, reasoning}
  pass2_validated_actions_json TEXT,  -- JSON array of action items
  pass2_corrections_json TEXT,        -- JSON array of correction descriptions
  pass2_started_at DATETIME,
  pass2_completed_at DATETIME,
  pass2_error_message TEXT,

  -- User edits
  final_summary TEXT,               -- User-edited final version
  final_speakers_json TEXT,         -- User-corrected speaker mappings
  final_actions_json TEXT,          -- User-edited action items
  edited_at DATETIME,

  -- Overall status
  overall_status TEXT DEFAULT 'pending'
    CHECK(overall_status IN ('pending', 'pass1_processing', 'pass1_complete',
                              'pass2_processing', 'pass2_complete', 'complete', 'error')),

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE,
  FOREIGN KEY (diarization_id) REFERENCES diarization_results(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_summaries_meeting_id ON meeting_summaries(meeting_id);
CREATE INDEX IF NOT EXISTS idx_summaries_overall_status ON meeting_summaries(overall_status);
CREATE INDEX IF NOT EXISTS idx_summaries_created_at ON meeting_summaries(created_at DESC);

-- Batch jobs table
-- Tracks Anthropic batch API jobs
CREATE TABLE IF NOT EXISTS batch_jobs (
  id TEXT PRIMARY KEY,              -- Anthropic batch_id
  summary_id TEXT NOT NULL,
  pass_number INTEGER NOT NULL CHECK(pass_number IN (1, 2)),
  status TEXT NOT NULL CHECK(status IN ('in_progress', 'ended', 'canceled', 'error')),
  request_json TEXT,                -- Original request for debugging
  response_json TEXT,               -- Full response from Anthropic
  request_counts_json TEXT,         -- JSON {processing, succeeded, errored, canceled}
  results_url TEXT,                 -- Anthropic results URL
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  expires_at DATETIME,              -- Results expire after 29 days
  error_message TEXT,

  FOREIGN KEY (summary_id) REFERENCES meeting_summaries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_summary_id ON batch_jobs(summary_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);

-- Email context cache
-- Caches email context to avoid repeated Graph API calls
CREATE TABLE IF NOT EXISTS email_context_cache (
  id TEXT PRIMARY KEY,              -- UUID
  meeting_id TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  emails_json TEXT,                 -- JSON array of recent emails
  email_count INTEGER DEFAULT 0,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,              -- Cache for 7 days

  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,

  UNIQUE(meeting_id, participant_email)
);

CREATE INDEX IF NOT EXISTS idx_email_cache_meeting_id ON email_context_cache(meeting_id);
CREATE INDEX IF NOT EXISTS idx_email_cache_expires_at ON email_context_cache(expires_at);

-- Trigger to update updated_at timestamp on meeting_summaries
CREATE TRIGGER IF NOT EXISTS update_meeting_summaries_timestamp
AFTER UPDATE ON meeting_summaries
FOR EACH ROW
BEGIN
  UPDATE meeting_summaries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- View: Recent summaries with meeting details
CREATE VIEW IF NOT EXISTS recent_summaries AS
SELECT
  ms.id,
  ms.overall_status,
  m.subject AS meeting_subject,
  m.start_time,
  m.organizer_name,
  ms.final_summary,
  ms.pass2_refined_summary,
  ms.pass1_summary,
  ms.created_at,
  ms.updated_at
FROM meeting_summaries ms
JOIN meetings m ON ms.meeting_id = m.id
ORDER BY ms.created_at DESC;
