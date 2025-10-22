/**
 * Types for meeting summaries, action items, and speaker mappings
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 */

export interface SpeakerMapping {
  label: string // e.g., "SPEAKER_00"
  name: string // e.g., "John Smith"
  email?: string // Optional: matched from attendees
  confidence: 'high' | 'medium' | 'low'
  reasoning: string // Why this mapping was made
}

export interface ActionItem {
  description: string
  assignee: string | null // Name of person assigned, or null if unclear
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null // ISO date string, or null if not specified
}

export interface KeyDecision {
  decision: string
  participants: string[] // Names of people involved in decision
}

// Detailed notes structure - comprehensive meeting documentation by topic
export interface DetailedNotes {
  discussion_by_topic: DiscussionTopic[]
  notable_quotes: NotableQuote[]
  open_questions: string[]
  parking_lot: string[]
}

export interface DiscussionTopic {
  topic: string // Clear, descriptive topic heading
  key_points: string[] // Actual discussion points (not just "they discussed X")
  decisions: string[] // Decisions made related to this topic
  action_items: ActionItem[] // Action items arising from this topic
}

export interface NotableQuote {
  speaker: string // Speaker name (not generic label)
  quote: string // Verbatim quote from transcript
}

// Pass 1 Output: Initial speaker identification + comprehensive summary
export interface Pass1Result {
  speaker_mappings: SpeakerMapping[]
  executive_summary: string // 1-2 paragraph high-level overview
  summary?: string // Deprecated: use executive_summary instead
  detailed_notes?: DetailedNotes // Comprehensive notes by topic
  action_items: ActionItem[]
  key_decisions: string[] // Simplified for Pass 1, just text
}

// Pass 2 Output: Validated and refined
export interface Pass2Result {
  validated_speakers: SpeakerMapping[]
  refined_executive_summary: string // Refined 1-2 paragraph overview
  refined_summary?: string // Deprecated: use refined_executive_summary instead
  refined_detailed_notes?: DetailedNotes // Refined comprehensive notes
  validated_action_items: ActionItem[]
  validated_key_decisions: string[]
  corrections: string[] // List of corrections made from Pass 1
}

// Database representation
export interface MeetingSummary {
  id: string
  meeting_id: string
  transcript_id: string

  // Pass 1
  pass1_batch_id: string | null
  pass1_status: string | null
  pass1_speaker_mappings_json: string | null
  pass1_summary: string | null // Executive summary
  pass1_action_items_json: string | null
  pass1_key_decisions_json: string | null
  pass1_detailed_notes_json: string | null // Detailed notes by topic
  pass1_completed_at: string | null
  pass1_error_message: string | null

  // Pass 2
  pass2_batch_id: string | null
  pass2_status: string | null
  pass2_refined_summary: string | null // Refined executive summary
  pass2_validated_speakers_json: string | null
  pass2_validated_action_items_json: string | null
  pass2_validated_key_decisions_json: string | null
  pass2_refined_detailed_notes_json: string | null // Refined detailed notes
  pass2_corrections_json: string | null
  pass2_completed_at: string | null
  pass2_error_message: string | null

  // User edits
  final_summary: string | null
  final_speakers_json: string | null
  final_action_items_json: string | null
  final_key_decisions_json: string | null
  edited_at: string | null

  overall_status: SummaryStatus
  created_at: string
  updated_at: string
}

export type SummaryStatus =
  | 'pending'         // Created, not yet submitted
  | 'pass1_submitted' // Pass 1 batch submitted
  | 'pass1_processing'// Pass 1 in progress
  | 'pass1_complete'  // Pass 1 done, Pass 2 not yet submitted
  | 'pass2_submitted' // Pass 2 batch submitted
  | 'pass2_processing'// Pass 2 in progress
  | 'complete'        // Both passes done
  | 'error'           // Error occurred
  | 'cancelled'       // User cancelled

// UI-friendly status for display
export interface SummaryStatusDisplay {
  summaryId: string
  status: SummaryStatus
  currentPass: 1 | 2 | null
  elapsedMinutes: number
  nextCheckInSeconds: number // Deprecated: UI now uses constant 5s polling
  backendNextCheckSeconds?: number // When backend will next poll Anthropic API
  errorMessage?: string
}

// Meeting context for LLM prompts
export interface MeetingContext {
  meeting: {
    id: string
    subject: string
    date: string
    startTime: string
    endTime: string
    organizer: {
      name: string
      email: string
    }
    attendees: Array<{
      name: string
      email: string
      type: 'required' | 'optional'
    }>
  }
  transcript: string // Full transcript with SPEAKER_XX labels
}

// Create summary request
export interface CreateSummaryRequest {
  meeting_id: string
  transcript_id: string
}

// User edit request
export interface UpdateSummaryRequest {
  summaryId: string
  summary?: string
  speakers?: SpeakerMapping[]
  actionItems?: ActionItem[]
  keyDecisions?: string[]
}
