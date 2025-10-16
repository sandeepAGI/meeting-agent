-- Migration: Add detailed_notes columns to meeting_summaries table
-- Created: 2025-01-16
-- Reason: Schema was updated to include detailed_notes structure, but existing databases don't have these columns

-- Add pass1_detailed_notes_json column if it doesn't exist
ALTER TABLE meeting_summaries ADD COLUMN pass1_detailed_notes_json TEXT;

-- Add pass2_refined_detailed_notes_json column if it doesn't exist
ALTER TABLE meeting_summaries ADD COLUMN pass2_refined_detailed_notes_json TEXT;
