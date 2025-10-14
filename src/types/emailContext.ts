/**
 * Types for email context fetching and caching
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 */

export interface EmailContext {
  id: string
  subject: string
  from: {
    name: string
    email: string
  }
  to: Array<{
    name: string
    email: string
  }>
  receivedDateTime: string // ISO date string
  bodyPreview: string
  body: string // HTML or plain text
  truncatedBody: string // Processed body (HTML stripped, truncated)
  hasAttachments: boolean
}

export interface EmailFetchOptions {
  maxEmails?: number // Default: 10
  maxBodyLength?: number // Default: 2000 chars per email
  includeBody?: boolean // Default: true
  daysBack?: number // Default: 30 days
}

export interface EmailCacheEntry {
  meeting_id: string
  emails_json: string // JSON stringified EmailContext[]
  fetched_at: string // ISO date string
  expires_at: string // ISO date string (cache for 7 days)
}

// For database storage
export interface CachedEmails {
  meetingId: string
  emails: EmailContext[]
  fetchedAt: Date
  expiresAt: Date
}

// Formatted email context for LLM prompt
export interface FormattedEmailContext {
  totalEmails: number
  emails: Array<{
    subject: string
    from: string
    to: string[]
    date: string
    body: string // Truncated and cleaned
  }>
}
