/**
 * EmailContextService - Microsoft Graph email fetching
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 *
 * Fetches recent emails with meeting participants to provide context
 * for speaker identification. Includes body truncation and caching.
 */

import { Client } from '@microsoft/microsoft-graph-client'
import type {
  EmailContext,
  EmailFetchOptions,
  FormattedEmailContext
} from '../types'
import { DatabaseService } from './database'
import { extractKeywords } from '../utils/keywordExtraction'

export class EmailContextService {
  private graphClient: Client
  private db: DatabaseService

  constructor(graphClient: Client, db: DatabaseService) {
    this.graphClient = graphClient
    this.db = db
  }

  /**
   * Fetch topic-relevant emails with meeting participants
   * Searches for emails matching BOTH participants AND topic keywords
   *
   * @param participantEmails Array of participant email addresses
   * @param keywords Array of topic keywords to search for
   * @param options Fetch options
   * @returns Array of email contexts matching topic
   */
  async getTopicRelevantEmails(
    participantEmails: string[],
    keywords: string[],
    options?: EmailFetchOptions
  ): Promise<EmailContext[]> {
    // Early return if no participants or keywords
    if (participantEmails.length === 0 || keywords.length === 0) return []

    const opts = {
      maxEmails: options?.maxEmails ?? 10,
      maxBodyLength: options?.maxBodyLength ?? 2000,
      includeBody: options?.includeBody !== false,
      daysBack: options?.daysBack ?? 30
    }

    try {
      // Use Microsoft Graph SEARCH API instead of filter
      // Search API supports "participants:" keyword which searches from/to/cc
      // Recommended approach per Microsoft documentation

      // Build search query: participants AND keywords
      // Each search clause must be in double quotes per Microsoft Graph KQL syntax
      const participantQuery = participantEmails
        .map((email) => `"participants:${email}"`)
        .join(' OR ')

      // Build keyword query: search BOTH subject AND body for better topic matching
      const keywordQuery = keywords
        .map((keyword) => `("subject:${keyword}" OR "body:${keyword}")`)
        .join(' OR ')

      // Combined search: (participants) AND (keywords in subject OR body)
      const searchQuery = `(${participantQuery}) AND (${keywordQuery})`

      console.log(`[EmailContext] Topic search query: ${searchQuery}`)

      // Date filter still uses $filter (supported)
      const dateThreshold = new Date()
      dateThreshold.setDate(dateThreshold.getDate() - opts.daysBack)
      const dateFilter = `receivedDateTime ge ${dateThreshold.toISOString()}`

      // Fetch emails using search
      const response = await this.graphClient
        .api('/me/messages')
        .search(searchQuery)
        .filter(dateFilter)
        .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments')
        .top(opts.maxEmails)
        .get()

      const emails: EmailContext[] = response.value.map((email: any) => {
        const body = opts.includeBody ? (email.body?.content || '') : ''
        const truncatedBody = opts.includeBody
          ? this.truncateBody(body, opts.maxBodyLength)
          : ''

        return {
          id: email.id,
          subject: email.subject || '(No subject)',
          from: {
            name: email.from?.emailAddress?.name || 'Unknown',
            email: email.from?.emailAddress?.address || ''
          },
          to: (email.toRecipients || []).map((r: any) => ({
            name: r.emailAddress?.name || 'Unknown',
            email: r.emailAddress?.address || ''
          })),
          receivedDateTime: email.receivedDateTime,
          bodyPreview: email.bodyPreview || '',
          body: body,
          truncatedBody: truncatedBody,
          hasAttachments: email.hasAttachments || false
        }
      })

      console.log(`[EmailContext] Fetched ${emails.length} topic-relevant emails`)

      return emails
    } catch (error: any) {
      console.error('[EmailContext] Failed to fetch topic-relevant emails:', error)
      // Don't throw - graceful degradation
      return []
    }
  }

  /**
   * Fetch recent emails with meeting participants
   * @param participantEmails Array of participant email addresses
   * @param options Fetch options (max emails, body length, etc.)
   * @returns Array of email contexts
   */
  async getRecentEmailsWithParticipants(
    participantEmails: string[],
    options?: EmailFetchOptions
  ): Promise<EmailContext[]> {
    // Early return if no participants
    if (participantEmails.length === 0) return []

    const opts = {
      maxEmails: options?.maxEmails ?? 10,
      maxBodyLength: options?.maxBodyLength ?? 2000,
      includeBody: options?.includeBody !== false,
      daysBack: options?.daysBack ?? 30
    }

    try {
      // Use Microsoft Graph SEARCH API with "participants:" keyword
      // This is the recommended approach to search across from/to/cc fields

      // Build search query with all participants
      // Each search clause must be in double quotes per Microsoft Graph KQL syntax
      const searchQuery = participantEmails
        .map((email) => `"participants:${email}"`)
        .join(' OR ')

      console.log(`[EmailContext] Participant search query: ${searchQuery}`)

      // Date filter (supported with search)
      const dateThreshold = new Date()
      dateThreshold.setDate(dateThreshold.getDate() - opts.daysBack)
      const dateFilter = `receivedDateTime ge ${dateThreshold.toISOString()}`

      // Fetch emails using search
      const response = await this.graphClient
        .api('/me/messages')
        .search(searchQuery)
        .filter(dateFilter)
        .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,body,hasAttachments')
        .top(opts.maxEmails)
        .get()

      const emails: EmailContext[] = response.value.map((email: any) => {
        const body = opts.includeBody ? (email.body?.content || '') : ''
        const truncatedBody = opts.includeBody
          ? this.truncateBody(body, opts.maxBodyLength)
          : ''

        return {
          id: email.id,
          subject: email.subject || '(No subject)',
          from: {
            name: email.from?.emailAddress?.name || 'Unknown',
            email: email.from?.emailAddress?.address || ''
          },
          to: (email.toRecipients || []).map((r: any) => ({
            name: r.emailAddress?.name || 'Unknown',
            email: r.emailAddress?.address || ''
          })),
          receivedDateTime: email.receivedDateTime,
          bodyPreview: email.bodyPreview || '',
          body: body,
          truncatedBody: truncatedBody,
          hasAttachments: email.hasAttachments || false
        }
      })

      console.log(
        `Fetched ${emails.length} emails for ${participantEmails.length} participants`
      )

      return emails
    } catch (error: any) {
      console.error('Failed to fetch emails:', error)
      // Don't throw - graceful degradation if emails unavailable
      return []
    }
  }

  /**
   * Format emails for LLM prompt
   * @param emails Array of email contexts
   * @returns Formatted email context string for prompt
   */
  formatEmailsForPrompt(emails: EmailContext[]): string {
    if (emails.length === 0) {
      return 'No recent email context available.'
    }

    const formatted = emails
      .map((email, index) => {
        const fromStr = `${email.from.name} <${email.from.email}>`
        const toStr = email.to.map((r) => `${r.name} <${r.email}>`).join(', ')
        const date = new Date(email.receivedDateTime).toLocaleString()

        return `
Email ${index + 1}:
Subject: ${email.subject}
From: ${fromStr}
To: ${toStr}
Date: ${date}
Body:
${email.truncatedBody}
`.trim()
      })
      .join('\n\n---\n\n')

    return formatted
  }

  /**
   * Truncate email body to specified length
   * Strips HTML, truncates at sentence boundaries
   *
   * @param body Email body (HTML or plain text)
   * @param maxLength Maximum characters
   * @returns Truncated plain text
   */
  private truncateBody(body: string, maxLength: number): string {
    // Strip HTML tags
    let plainText = body
      .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags
      .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
      .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp;
      .replace(/&[a-z]+;/gi, ' ') // Replace HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

    if (plainText.length <= maxLength) {
      return plainText
    }

    // Truncate at maxLength
    let truncated = plainText.substring(0, maxLength)

    // Try to find last sentence boundary (period, question mark, exclamation)
    const lastSentence = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('? '),
      truncated.lastIndexOf('! ')
    )

    // If we found a sentence boundary in the last 20% of the text, use it
    if (lastSentence > maxLength * 0.8) {
      truncated = truncated.substring(0, lastSentence + 1)
    } else {
      // Otherwise, try to find last word boundary
      const lastSpace = truncated.lastIndexOf(' ')
      if (lastSpace > maxLength * 0.9) {
        truncated = truncated.substring(0, lastSpace)
      }
      truncated += '...'
    }

    return truncated
  }

  /**
   * Get cached emails for a meeting (with expiration check)
   * @param meetingId Meeting ID
   * @returns Cached emails or null if not cached/expired
   */
  async getCachedEmails(meetingId: string): Promise<EmailContext[] | null> {
    return this.db.getCachedEmails(meetingId)
  }

  /**
   * Cache emails for a meeting (7-day expiration)
   * @param meetingId Meeting ID
   * @param emails Array of email contexts
   */
  async cacheEmails(meetingId: string, emails: EmailContext[]): Promise<void> {
    this.db.cacheEmails(meetingId, emails)
  }

  /**
   * Fetch or get cached emails for meeting participants
   * Uses TWO-TIER SEARCH STRATEGY:
   * 1. Prioritize emails matching BOTH participants AND topic keywords
   * 2. Fill remainder with any emails from participants (up to maxEmails)
   *
   * Uses cache if available and not expired
   *
   * @param meetingId Meeting ID (for caching)
   * @param participantEmails Participant email addresses
   * @param options Fetch options
   * @param meetingTitle Optional meeting title for topic-based search
   * @returns Array of email contexts (topic-relevant first, then participants)
   */
  async getEmailsForMeeting(
    meetingId: string,
    participantEmails: string[],
    options?: EmailFetchOptions,
    meetingTitle?: string
  ): Promise<EmailContext[]> {
    // Check cache first
    const cached = await this.getCachedEmails(meetingId)
    if (cached) {
      console.log(`[EmailContext] Using cached emails for meeting ${meetingId}`)
      return cached
    }

    const maxEmails = options?.maxEmails ?? 10

    // Early return if maxEmails is 0 (no need to make API calls)
    if (maxEmails === 0) {
      return []
    }

    let emails: EmailContext[] = []

    // TIER 1: Fetch topic-relevant emails (if meeting title provided)
    if (meetingTitle) {
      const keywords = extractKeywords(meetingTitle)

      if (keywords.length > 0) {
        console.log(`[EmailContext] TIER 1: Fetching topic-relevant emails for "${meetingTitle}" (keywords: ${keywords.join(', ')})`)

        const topicEmails = await this.getTopicRelevantEmails(
          participantEmails,
          keywords,
          { ...options, maxEmails }
        )

        emails.push(...topicEmails)
        console.log(`[EmailContext] TIER 1: Found ${topicEmails.length} topic-relevant emails`)
      }
    }

    // TIER 2: Fill remainder with participant-only emails
    const remaining = maxEmails - emails.length
    if (remaining > 0) {
      console.log(`[EmailContext] TIER 2: Fetching ${remaining} additional participant emails`)

      const participantEmails2 = await this.getRecentEmailsWithParticipants(
        participantEmails,
        { ...options, maxEmails: remaining }
      )

      // Deduplicate: only add emails not already in the list
      const existingIds = new Set(emails.map(e => e.id))
      const newEmails = participantEmails2.filter(e => !existingIds.has(e.id))

      emails.push(...newEmails)
      console.log(`[EmailContext] TIER 2: Added ${newEmails.length} additional emails (deduplicated)`)
    }

    console.log(`[EmailContext] Total emails fetched: ${emails.length} (topic-relevant: ${meetingTitle ? emails.filter((_, i) => i < maxEmails - remaining).length : 0}, participants: ${remaining > 0 ? emails.length - (maxEmails - remaining) : 0})`)

    // Cache for future use
    if (emails.length > 0) {
      await this.cacheEmails(meetingId, emails)
    }

    return emails
  }
}
