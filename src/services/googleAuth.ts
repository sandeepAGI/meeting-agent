/**
 * GoogleAuthService
 * Phase 7: Gmail Integration - Task 2.1
 *
 * Handles Google OAuth2 authentication flow for Gmail API access.
 * Manages token storage in macOS Keychain for secure persistence.
 */

import { google, Auth } from 'googleapis'
import * as fs from 'fs'
import * as keytar from 'keytar'

const KEYTAR_SERVICE = 'meeting-agent'
const KEYTAR_ACCOUNT = 'google-oauth-tokens'
const SCOPES = ['https://www.googleapis.com/auth/gmail.send']

export interface GoogleTokens {
  access_token: string
  refresh_token: string
  scope: string
  token_type: string
  expiry_date: number
}

export interface GoogleCredentials {
  installed: {
    client_id: string
    project_id: string
    auth_uri: string
    token_uri: string
    auth_provider_x509_cert_url: string
    client_secret: string
    redirect_uris: string[]
  }
}

export class GoogleAuthService {
  private oauth2Client: Auth.OAuth2Client
  private credentials: GoogleCredentials

  constructor(credentialsPath: string) {
    // Validate credentials file exists
    if (!fs.existsSync(credentialsPath)) {
      throw new Error('Google credentials file not found')
    }

    // Load and validate credentials
    try {
      const credentialsContent = fs.readFileSync(credentialsPath, 'utf-8')
      this.credentials = JSON.parse(credentialsContent)

      if (!this.credentials.installed || !this.credentials.installed.client_id) {
        throw new Error('Invalid Google credentials format')
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid')) {
        throw error
      }
      throw new Error('Invalid Google credentials format')
    }

    // Initialize OAuth2 client
    const { client_id, client_secret, redirect_uris } = this.credentials.installed
    this.oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.oauth2Client !== null && this.oauth2Client !== undefined
  }

  /**
   * Store OAuth tokens in macOS Keychain
   */
  async storeTokens(tokens: GoogleTokens): Promise<void> {
    try {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, JSON.stringify(tokens))
      console.log('[GoogleAuth] Tokens stored successfully in keychain')
    } catch (error) {
      console.error('[GoogleAuth] Failed to store tokens in keychain:', error)
      throw new Error('Failed to store authentication tokens')
    }
  }

  /**
   * Retrieve OAuth tokens from macOS Keychain
   */
  async getTokens(): Promise<GoogleTokens | null> {
    try {
      const tokensJson = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
      if (!tokensJson) {
        console.log('[GoogleAuth] No tokens found in keychain')
        return null
      }
      const tokens = JSON.parse(tokensJson)
      console.log('[GoogleAuth] Tokens retrieved from keychain')
      return tokens
    } catch (error) {
      console.error('[GoogleAuth] Failed to retrieve tokens from keychain:', error)
      return null
    }
  }

  /**
   * Delete tokens from Keychain (logout)
   */
  async logout(): Promise<void> {
    try {
      const deleted = await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
      if (deleted) {
        console.log('[GoogleAuth] User logged out successfully')
      } else {
        console.log('[GoogleAuth] No tokens to delete')
      }
    } catch (error) {
      console.error('[GoogleAuth] Error during logout:', error)
      throw new Error('Failed to logout')
    }
  }

  /**
   * Check if stored tokens are expired
   */
  async areTokensExpired(): Promise<boolean> {
    const tokens = await this.getTokens()
    if (!tokens || !tokens.expiry_date) {
      return true
    }
    return Date.now() >= tokens.expiry_date
  }

  /**
   * Refresh expired access token using refresh_token
   */
  async refreshTokens(): Promise<boolean> {
    const tokens = await this.getTokens()
    if (!tokens || !tokens.refresh_token) {
      const errorMsg = 'No refresh token available'
      console.error(`[GoogleAuth] ${errorMsg}`)
      throw new Error(errorMsg)
    }

    console.log('[GoogleAuth] Refreshing access token...')
    this.oauth2Client.setCredentials(tokens)

    try {
      const response = await this.oauth2Client.refreshAccessToken()
      const newTokens: GoogleTokens = {
        access_token: response.credentials.access_token!,
        refresh_token: response.credentials.refresh_token || tokens.refresh_token,
        scope: response.credentials.scope || tokens.scope,
        token_type: response.credentials.token_type || tokens.token_type,
        expiry_date: response.credentials.expiry_date || Date.now() + 3600000
      }

      await this.storeTokens(newTokens)
      console.log('[GoogleAuth] Access token refreshed successfully')
      return true
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[GoogleAuth] Token refresh failed: ${errorMsg}`)
      throw new Error(`Token refresh failed: ${errorMsg}`)
    }
  }

  /**
   * Generate authorization URL for user consent
   */
  getAuthorizationUrl(): string {
    console.log('[GoogleAuth] Generating authorization URL')
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent' // Force consent screen to get refresh_token
    })
    console.log('[GoogleAuth] Authorization URL generated')
    return authUrl
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(authCode: string): Promise<GoogleTokens> {
    console.log('[GoogleAuth] Exchanging authorization code for tokens')
    try {
      const { tokens } = await this.oauth2Client.getToken(authCode)

      if (!tokens.access_token || !tokens.refresh_token) {
        const errorMsg = 'Response missing required tokens (access_token or refresh_token)'
        console.error(`[GoogleAuth] ${errorMsg}`)
        throw new Error(errorMsg)
      }

      const googleTokens: GoogleTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope || SCOPES.join(' '),
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || Date.now() + 3600000
      }

      await this.storeTokens(googleTokens)
      console.log('[GoogleAuth] Authorization code exchanged successfully')
      return googleTokens
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[GoogleAuth] Code exchange failed: ${errorMsg}`)
      throw new Error(`Failed to exchange authorization code: ${errorMsg}`)
    }
  }

  /**
   * Check if user is authenticated (has valid, non-expired tokens)
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getTokens()
    if (!tokens) {
      return false
    }

    const isExpired = await this.areTokensExpired()
    return !isExpired
  }

  /**
   * Get authenticated OAuth2 client for API calls
   */
  async getAuthenticatedClient(): Promise<Auth.OAuth2Client> {
    const tokens = await this.getTokens()
    if (!tokens) {
      throw new Error('Not authenticated. Please login first.')
    }

    // Refresh if expired
    if (await this.areTokensExpired()) {
      await this.refreshTokens()
      const newTokens = await this.getTokens()
      this.oauth2Client.setCredentials(newTokens!)
    } else {
      this.oauth2Client.setCredentials(tokens)
    }

    return this.oauth2Client
  }
}
