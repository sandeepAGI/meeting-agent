/**
 * EmailProvider Abstraction
 * Phase 7: Gmail Integration - Task 2.3
 *
 * Provides a unified interface for sending emails via either M365 or Gmail.
 * Implements factory pattern to create the appropriate provider based on settings.
 */

import { GraphApiService, SendEmailOptions } from './graphApi'
import { GmailApiService } from './gmailApi'
import { GoogleAuthService } from './googleAuth'
import { M365AuthService } from './m365Auth'
import type { EmailRecipient } from '../types/meetingSummary'

/**
 * Simple settings interface for email provider configuration
 * This allows the factory to work with any settings source, not just SettingsService
 */
interface EmailSettings {
  get(key: string): any
}

/**
 * Standard email data format used by both providers
 */
export interface StandardEmailData {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
}

/**
 * Email provider interface
 */
export interface EmailProvider {
  sendEmail(emailData: StandardEmailData): Promise<void>
  isAuthenticated(): Promise<boolean>
  getProviderType(): 'm365' | 'gmail'
}

/**
 * M365 Email Provider - wraps GraphApiService
 */
export class M365EmailProvider implements EmailProvider {
  private graphService: GraphApiService
  private authService: M365AuthService

  constructor(authService: M365AuthService) {
    this.authService = authService
    this.graphService = new GraphApiService()
  }

  async sendEmail(emailData: StandardEmailData): Promise<void> {
    // Convert standard format to M365 format
    const toRecipients: EmailRecipient[] = emailData.to.map(email => ({
      name: email.split('@')[0], // Extract name from email
      email: email
    }))

    const ccRecipients: EmailRecipient[] | undefined = emailData.cc?.map(email => ({
      name: email.split('@')[0],
      email: email
    }))

    const m365Options: SendEmailOptions = {
      to: toRecipients,
      cc: ccRecipients,
      subject: emailData.subject,
      bodyHtml: emailData.body
    }

    console.log('[M365EmailProvider] Sending email via Microsoft Graph API')
    await this.graphService.sendEmail(m365Options)
    console.log('[M365EmailProvider] Email sent successfully')
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const authState = await this.authService.getAuthState()
      return authState.isAuthenticated
    } catch (error) {
      console.error('[M365EmailProvider] Auth check failed:', error)
      return false
    }
  }

  getProviderType(): 'm365' {
    return 'm365'
  }
}

/**
 * Gmail Email Provider - wraps GmailApiService
 */
export class GmailEmailProvider implements EmailProvider {
  private gmailService: GmailApiService
  private authService: GoogleAuthService

  constructor(authService: GoogleAuthService) {
    this.authService = authService
    this.gmailService = new GmailApiService(authService)
  }

  async sendEmail(emailData: StandardEmailData): Promise<void> {
    // Gmail service already uses the standard format
    console.log('[GmailEmailProvider] Sending email via Gmail API')
    const result = await this.gmailService.sendEmail(emailData)

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email')
    }

    console.log('[GmailEmailProvider] Email sent successfully')
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      return await this.authService.isAuthenticated()
    } catch (error) {
      console.error('[GmailEmailProvider] Auth check failed:', error)
      return false
    }
  }

  getProviderType(): 'gmail' {
    return 'gmail'
  }
}

/**
 * Email Provider Factory
 * Creates the appropriate email provider based on settings
 */
export class EmailProviderFactory {
  /**
   * Create email provider based on settings
   */
  static createProvider(
    settings: EmailSettings,
    clientId?: string,
    tenantId?: string
  ): EmailProvider {
    // Get email provider type from settings
    const providerType = settings.get('email.provider') as string | undefined

    console.log(`[EmailProviderFactory] Creating provider: ${providerType || 'm365 (default)'}`)

    switch (providerType) {
      case 'gmail': {
        // Get Google credentials path from settings
        const credentialsPath = settings.get('email.googleCredentialsPath') as string

        if (!credentialsPath) {
          throw new Error('Google credentials path not configured in settings')
        }

        const googleAuth = new GoogleAuthService(credentialsPath)
        return new GmailEmailProvider(googleAuth)
      }

      case 'm365':
      case undefined:
      case null:
        // Default to M365
        // Use provided clientId/tenantId or get from environment
        const effectiveClientId = clientId || process.env.AZURE_CLIENT_ID || ''
        const effectiveTenantId = tenantId || process.env.AZURE_TENANT_ID || 'common'

        const m365Auth = new M365AuthService(effectiveClientId, effectiveTenantId)
        return new M365EmailProvider(m365Auth)

      default:
        throw new Error(`Unsupported email provider: ${providerType}`)
    }
  }
}
