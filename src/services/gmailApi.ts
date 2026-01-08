/**
 * GmailApiService
 * Phase 7: Gmail Integration - Task 2.2
 *
 * Handles email sending via Gmail API including MIME message construction
 * and Base64url encoding.
 */

import { google } from 'googleapis'
import { GoogleAuthService } from './googleAuth'

export interface EmailData {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export class GmailApiService {
  private authService: GoogleAuthService

  constructor(authService: GoogleAuthService) {
    this.authService = authService
  }

  /**
   * Validate email data before sending
   */
  validateEmailData(emailData: EmailData): void {
    // Validate at least one recipient
    if (!emailData.to || emailData.to.length === 0) {
      throw new Error('At least one recipient is required')
    }

    // Validate subject
    if (!emailData.subject || emailData.subject.trim() === '') {
      throw new Error('Subject is required')
    }

    // Validate body
    if (!emailData.body || emailData.body.trim() === '') {
      throw new Error('Email body is required')
    }

    // Email regex for validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    // Validate To emails
    for (const email of emailData.to) {
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid email format: ${email}`)
      }
    }

    // Validate CC emails
    if (emailData.cc) {
      for (const email of emailData.cc) {
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email format in CC: ${email}`)
        }
      }
    }

    // Validate BCC emails
    if (emailData.bcc) {
      for (const email of emailData.bcc) {
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email format in BCC: ${email}`)
        }
      }
    }
  }

  /**
   * Build RFC 2822 compliant MIME message
   */
  buildMimeMessage(emailData: EmailData): string {
    // Validate before building
    this.validateEmailData(emailData)

    const lines: string[] = []

    // MIME Version
    lines.push('MIME-Version: 1.0')

    // To header
    lines.push(`To: ${emailData.to.join(', ')}`)

    // CC header (if provided)
    if (emailData.cc && emailData.cc.length > 0) {
      lines.push(`Cc: ${emailData.cc.join(', ')}`)
    }

    // BCC header (if provided)
    if (emailData.bcc && emailData.bcc.length > 0) {
      lines.push(`Bcc: ${emailData.bcc.join(', ')}`)
    }

    // Subject header
    lines.push(`Subject: ${emailData.subject}`)

    // Content-Type header
    lines.push('Content-Type: text/html; charset=utf-8')

    // Empty line between headers and body (RFC 2822)
    lines.push('')

    // Email body
    lines.push(emailData.body)

    return lines.join('\n')
  }

  /**
   * Encode string to Base64url format (Gmail API requirement)
   * Base64url uses - and _ instead of + and /, and removes padding
   */
  encodeBase64url(input: string): string {
    if (input === '') {
      return ''
    }

    // Convert to base64
    const base64 = Buffer.from(input, 'utf-8').toString('base64')

    // Convert to base64url by replacing + with -, / with _, and removing =
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

    return base64url
  }

  /**
   * Send email via Gmail API
   */
  async sendEmail(emailData: EmailData): Promise<SendEmailResult> {
    try {
      console.log('[GmailApi] Preparing to send email')
      console.log(`[GmailApi] Recipients - To: ${emailData.to.join(', ')}${emailData.cc ? `, CC: ${emailData.cc.join(', ')}` : ''}`)
      console.log(`[GmailApi] Subject: ${emailData.subject}`)

      // Validate email data
      this.validateEmailData(emailData)
      console.log('[GmailApi] Email data validated successfully')

      // Get authenticated OAuth2 client
      const auth = await this.authService.getAuthenticatedClient()
      console.log('[GmailApi] OAuth2 client authenticated')

      // Build MIME message
      const mimeMessage = this.buildMimeMessage(emailData)
      console.log('[GmailApi] MIME message constructed')

      // Encode to Base64url
      const encodedMessage = this.encodeBase64url(mimeMessage)
      console.log('[GmailApi] Message encoded to Base64url')

      // Initialize Gmail API
      const gmail = google.gmail({ version: 'v1', auth })

      // Send email
      console.log('[GmailApi] Sending via Gmail API...')
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      })

      console.log(`[GmailApi] ✅ Email sent successfully! Message ID: ${response.data.id}`)

      return {
        success: true,
        messageId: response.data.id || undefined
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[GmailApi] ❌ Failed to send email: ${errorMsg}`)

      // Log stack trace for debugging
      if (error instanceof Error && error.stack) {
        console.error('[GmailApi] Stack trace:', error.stack)
      }

      return {
        success: false,
        error: `Failed to send email: ${errorMsg}`
      }
    }
  }
}
