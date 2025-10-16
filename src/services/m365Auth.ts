/**
 * Microsoft 365 Authentication Service
 *
 * Handles OAuth2 authentication with Microsoft 365 using MSAL Node.
 * Implements secure token storage using system keychain (keytar).
 *
 * Architecture:
 * - Uses MSAL PublicClientApplication for OAuth2 flow
 * - Opens browser for interactive authentication
 * - Stores access/refresh tokens securely in system keychain
 * - Automatically refreshes tokens when expired
 *
 * Required Environment Variables:
 * - AZURE_CLIENT_ID: Azure AD application client ID
 * - AZURE_TENANT_ID: Azure AD tenant ID (or 'common' for multi-tenant)
 */

import {
  PublicClientApplication,
  Configuration,
  AuthenticationResult,
  AccountInfo,
  InteractiveRequest,
  SilentFlowRequest
} from '@azure/msal-node'
import * as keytar from 'keytar'
import { BrowserWindow } from 'electron'

// Microsoft Graph API scopes
const SCOPES = [
  'User.Read',                  // Read user profile
  'Calendars.Read',             // Read calendar events
  'Calendars.ReadWrite',        // Create calendar events (optional: for blocking time)
  'Mail.Read',                  // Read emails (for email context)
  'Mail.Send',                  // Send emails
  'offline_access'              // Refresh tokens
]

const KEYCHAIN_SERVICE = 'meeting-agent'
const KEYCHAIN_ACCOUNT_PREFIX = 'm365-token'
const KEYCHAIN_MSAL_CACHE = 'm365-msal-cache'

export interface AuthState {
  isAuthenticated: boolean
  user: {
    name: string
    email: string
    id: string
  } | null
  error: string | null
}

export interface TokenCache {
  accessToken: string
  expiresOn: number // Unix timestamp
  account: AccountInfo
}

/**
 * M365AuthService
 *
 * Manages Microsoft 365 authentication and token lifecycle.
 */
export class M365AuthService {
  private msalClient: PublicClientApplication | null = null
  private currentAccount: AccountInfo | null = null

  constructor(
    private clientId: string,
    private tenantId: string = 'common'
  ) {}

  /**
   * Initialize MSAL client
   */
  async initialize(): Promise<void> {
    const config: Configuration = {
      auth: {
        clientId: this.clientId,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
        // Redirect URI must be registered in Azure AD
        // For Electron apps, we use localhost with custom protocol
        knownAuthorities: [`login.microsoftonline.com`]
      },
      cache: {
        cachePlugin: {
          beforeCacheAccess: (cacheContext) => {
            return (async () => {
              // Load MSAL cache from keychain
              const cachedData = await this.loadMsalCacheFromKeychain()
              if (cachedData) {
                cacheContext.tokenCache.deserialize(cachedData)
              }
            })()
          },
          afterCacheAccess: (cacheContext) => {
            return (async () => {
              // Save MSAL cache to keychain after any changes
              if (cacheContext.cacheHasChanged) {
                const serializedCache = cacheContext.tokenCache.serialize()
                await this.saveMsalCacheToKeychain(serializedCache)
              }
            })()
          }
        }
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (containsPii) return
            console.log(`[MSAL] ${level}: ${message}`)
          },
          piiLoggingEnabled: false,
          logLevel: 3 // Info level
        }
      }
    }

    this.msalClient = new PublicClientApplication(config)

    // Try to restore cached account and verify token
    const cachedToken = await this.loadTokenFromKeychain()
    if (cachedToken) {
      this.currentAccount = cachedToken.account

      // Verify token is still valid by attempting silent refresh
      try {
        const silentRequest: SilentFlowRequest = {
          account: cachedToken.account,
          scopes: SCOPES,
          forceRefresh: false
        }

        const response = await this.msalClient.acquireTokenSilent(silentRequest)
        await this.saveTokenToKeychain(response)
        console.log('[M365Auth] Session restored for', cachedToken.account.username)
      } catch (error) {
        // Token refresh failed - clear the account
        console.log('[M365Auth] Token expired, please login again')
        this.currentAccount = null
        await this.deleteTokenFromKeychain()
      }
    }
  }

  /**
   * Login with interactive browser flow
   */
  async login(mainWindow?: BrowserWindow): Promise<AuthenticationResult> {
    if (!this.msalClient) {
      throw new Error('MSAL client not initialized. Call initialize() first.')
    }

    // Configure interactive request
    // MSAL Node uses loopback server automatically - no need to specify redirectUri
    const authRequest: InteractiveRequest = {
      scopes: SCOPES,
      prompt: 'select_account', // Always show account picker
      openBrowser: async (url: string) => {
        // Open system default browser
        const { shell } = require('electron')
        await shell.openExternal(url)
      }
    }

    try {
      // Open browser for authentication
      const response = await this.msalClient.acquireTokenInteractive(authRequest)

      // Save tokens securely
      await this.saveTokenToKeychain(response)

      // Update current account
      this.currentAccount = response.account

      return response
    } catch (error) {
      console.error('[M365Auth] Login failed:', error)
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Logout - clear tokens and account
   */
  async logout(): Promise<void> {
    if (!this.msalClient || !this.currentAccount) {
      throw new Error('No active session to logout')
    }

    try {
      // Remove account from MSAL cache
      await this.msalClient.getTokenCache().removeAccount(this.currentAccount)

      // Remove tokens from keychain
      await this.deleteTokenFromKeychain()

      // Remove MSAL cache from keychain
      await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_MSAL_CACHE)

      // Clear current account
      this.currentAccount = null
    } catch (error) {
      console.error('[M365Auth] Logout failed:', error)
      throw new Error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get access token (refreshes if expired)
   */
  async getAccessToken(): Promise<string> {
    if (!this.msalClient) {
      throw new Error('MSAL client not initialized')
    }

    if (!this.currentAccount) {
      throw new Error('No authenticated user. Call login() first.')
    }

    // Try silent token acquisition (uses refresh token if needed)
    const silentRequest: SilentFlowRequest = {
      account: this.currentAccount,
      scopes: SCOPES,
      forceRefresh: false
    }

    try {
      const response = await this.msalClient.acquireTokenSilent(silentRequest)

      // Update cached token
      await this.saveTokenToKeychain(response)

      return response.accessToken
    } catch (error) {
      console.error('[M365Auth] Silent token acquisition failed:', error)

      // If silent refresh fails, user needs to re-authenticate
      throw new Error('Token expired. Please login again.')
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentAccount !== null
  }

  /**
   * Get current user info
   */
  getCurrentUser(): { name: string; email: string; id: string } | null {
    if (!this.currentAccount) return null

    return {
      name: this.currentAccount.name || 'Unknown User',
      email: this.currentAccount.username,
      id: this.currentAccount.homeAccountId
    }
  }

  /**
   * Get authentication state
   */
  getAuthState(): AuthState {
    return {
      isAuthenticated: this.isAuthenticated(),
      user: this.getCurrentUser(),
      error: null
    }
  }

  /**
   * Save token to system keychain
   */
  private async saveTokenToKeychain(authResult: AuthenticationResult): Promise<void> {
    if (!authResult.account) {
      throw new Error('No account in authentication result')
    }

    const tokenCache: TokenCache = {
      accessToken: authResult.accessToken,
      expiresOn: authResult.expiresOn ? authResult.expiresOn.getTime() : Date.now() + 3600000, // Default 1 hour
      account: authResult.account
    }

    const keychainAccount = `${KEYCHAIN_ACCOUNT_PREFIX}-${authResult.account.homeAccountId}`

    try {
      await keytar.setPassword(
        KEYCHAIN_SERVICE,
        keychainAccount,
        JSON.stringify(tokenCache)
      )
    } catch (error) {
      console.error('[M365Auth] Failed to save token to keychain:', error)
      throw new Error('Failed to save credentials securely')
    }
  }

  /**
   * Load token from system keychain
   */
  private async loadTokenFromKeychain(): Promise<TokenCache | null> {
    try {
      // Get all credentials for this service
      const credentials = await keytar.findCredentials(KEYCHAIN_SERVICE)

      // Find the most recent token
      let latestToken: TokenCache | null = null
      let latestTimestamp = 0

      for (const cred of credentials) {
        if (cred.account.startsWith(KEYCHAIN_ACCOUNT_PREFIX)) {
          const tokenCache: TokenCache = JSON.parse(cred.password)
          if (tokenCache.expiresOn > latestTimestamp) {
            latestToken = tokenCache
            latestTimestamp = tokenCache.expiresOn
          }
        }
      }

      return latestToken
    } catch (error) {
      console.error('[M365Auth] Failed to load token from keychain:', error)
      return null
    }
  }

  /**
   * Delete token from system keychain
   */
  private async deleteTokenFromKeychain(): Promise<void> {
    if (!this.currentAccount) return

    const keychainAccount = `${KEYCHAIN_ACCOUNT_PREFIX}-${this.currentAccount.homeAccountId}`

    try {
      await keytar.deletePassword(KEYCHAIN_SERVICE, keychainAccount)
    } catch (error) {
      console.error('[M365Auth] Failed to delete token from keychain:', error)
      // Don't throw - logout should succeed even if keychain cleanup fails
    }
  }

  /**
   * Force token refresh
   */
  async refreshToken(): Promise<string> {
    if (!this.msalClient || !this.currentAccount) {
      throw new Error('Not authenticated')
    }

    const silentRequest: SilentFlowRequest = {
      account: this.currentAccount,
      scopes: SCOPES,
      forceRefresh: true // Force refresh even if token not expired
    }

    try {
      const response = await this.msalClient.acquireTokenSilent(silentRequest)
      await this.saveTokenToKeychain(response)
      return response.accessToken
    } catch (error) {
      console.error('[M365Auth] Token refresh failed:', error)
      throw new Error('Failed to refresh token. Please login again.')
    }
  }

  /**
   * Save MSAL cache to keychain
   */
  private async saveMsalCacheToKeychain(cache: string): Promise<void> {
    try {
      await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_MSAL_CACHE, cache)
    } catch (error) {
      console.error('[M365Auth] Failed to save MSAL cache to keychain:', error)
    }
  }

  /**
   * Load MSAL cache from keychain
   */
  private async loadMsalCacheFromKeychain(): Promise<string | null> {
    try {
      const cache = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_MSAL_CACHE)
      return cache
    } catch (error) {
      console.error('[M365Auth] Failed to load MSAL cache from keychain:', error)
      return null
    }
  }
}
