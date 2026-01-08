# Gmail Integration Implementation Plan

**Feature**: Add Gmail as an alternative email provider to Microsoft 365
**Status**: Planning
**Created**: 2026-01-07
**Estimated Effort**: 12-16 hours
**Target**: Phase 7+

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Requirements](#requirements)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Plan](#implementation-plan)
6. [User Setup Experience](#user-setup-experience)
7. [Testing Strategy](#testing-strategy)
8. [Documentation Requirements](#documentation-requirements)
9. [Risks & Mitigations](#risks--mitigations)
10. [Success Metrics](#success-metrics)

---

## Executive Summary

### Problem Statement
The Meeting Agent currently supports **only Microsoft 365** for sending email summaries. Users with Gmail/Google Workspace accounts cannot use the email distribution feature without a Microsoft 365 subscription.

### Proposed Solution
Add **Gmail API integration** as an alternative email provider, allowing users to choose between Microsoft 365 or Gmail for sending meeting summaries.

### Benefits
- ✅ **Wider user base**: Support users with personal Gmail or Google Workspace accounts
- ✅ **Flexibility**: Users can choose their preferred email provider
- ✅ **No additional cost**: Gmail API is free (500 emails/day quota)
- ✅ **Zero vendor lock-in**: Not dependent on Microsoft ecosystem

### Key Design Decision
**User-owned OAuth credentials**: Each user creates their own Google Cloud project and OAuth credentials. This avoids:
- Google verification process (weeks/months)
- Scary "unverified app" warnings
- Shared rate limits across users
- Centralized credential management burden

### Implementation Approach
- **Non-breaking change**: Existing M365 users unaffected
- **Provider abstraction**: Clean architecture supporting multiple providers
- **Consistent UX**: Gmail setup mirrors existing M365 setup pattern

---

## Current State Analysis

### Existing M365 Implementation

#### Authentication (`src/services/m365Auth.ts`)
```typescript
class M365AuthService {
  // OAuth 2.0 with MSAL (@azure/msal-node)
  // Interactive browser authentication
  // Token storage: macOS Keychain via keytar

  login()           // Opens browser for OAuth consent
  getAccessToken()  // Returns token, auto-refreshes if expired
  logout()          // Clears tokens from keychain
  refreshToken()    // Forces token refresh
}
```

**Scopes Required**:
- `Mail.Send` - Send emails
- `Calendars.Read` - Read calendar events
- `User.Read` - Read user profile
- `offline_access` - Refresh tokens

**Token Storage** (Keychain):
- Service: `meeting-agent`
- Account: `m365-token-{homeAccountId}`
- Contains: MSAL cache with access/refresh tokens

#### Email Sending (`src/services/graphApi.ts`)
```typescript
class GraphApiService {
  async sendEmail(options: SendEmailOptions): Promise<void> {
    await this.client.api('/me/sendMail').post({
      message: {
        subject: string,
        body: { contentType: 'HTML', content: string },
        toRecipients: [{ emailAddress: { name, address } }],
        ccRecipients: [...],
      },
      saveToSentItems: true
    })
  }
}
```

**Features**:
- HTML email body support
- Multiple recipients (To/CC)
- Automatic save to Sent Items folder
- Comprehensive error handling

#### IPC Layer (`src/main/index.ts`, lines 877-919)
```typescript
ipcMain.handle('graph-send-email', async (_event, options) => {
  // 1. Validate M365 auth service initialized
  // 2. Get fresh access token
  // 3. Initialize GraphApiService with token
  // 4. Send email
  // 5. Return success/error
})
```

#### Renderer Usage (`src/renderer/components/SummaryDisplay.tsx`)
```typescript
// Generate HTML email
const emailHtml = generateEmailHTML({ ... })

// Send via Graph API
const result = await window.electronAPI.graphApi.sendEmail({
  to: recipients,
  subject: subjectLine,
  bodyHtml: emailHtml
})

// Mark as sent in database
await window.electronAPI.database.markSummarySent(summaryId, recipients)
```

#### Settings Storage (`src/services/settings.ts`)
```typescript
interface AppSettings {
  azure: {
    clientId: string    // User's Azure App Registration ID
    tenantId: string    // User's Azure AD Tenant ID
  }
}
```

**Storage Locations**:
- **Azure credentials**: JSON file (`settings.json` in userData)
- **M365 tokens**: Keychain (managed by MSAL)
- **API keys**: Keychain (`anthropic-api-key`, `huggingface-token`)

### Current Email Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                      │
│                                                          │
│  SummaryDisplay.tsx                                     │
│    ↓                                                    │
│  generateEmailHTML() → HTML string                      │
│    ↓                                                    │
│  window.electronAPI.graphApi.sendEmail()               │
└────────────────────────┬────────────────────────────────┘
                         │ IPC: graph-send-email
                         ↓
┌─────────────────────────────────────────────────────────┐
│                     Main Process                         │
│                                                          │
│  IPC Handler                                            │
│    ↓                                                    │
│  m365AuthService.getAccessToken()                       │
│    ↓                                                    │
│  graphApiService.sendEmail({ to, subject, bodyHtml })  │
│    ↓                                                    │
│  Microsoft Graph API: POST /me/sendMail                │
└─────────────────────────────────────────────────────────┘
```

---

## Requirements

### Functional Requirements

#### FR1: Google Authentication
- **FR1.1**: User can authenticate with Google account via OAuth 2.0
- **FR1.2**: User can log out of Google account
- **FR1.3**: Access tokens automatically refresh (1 hour expiry)
- **FR1.4**: Tokens persist across app restarts (stored in keychain)
- **FR1.5**: User can view authentication status (authenticated user email/name)

#### FR2: Gmail Email Sending
- **FR2.1**: User can send HTML emails via Gmail API
- **FR2.2**: Support multiple recipients (To, CC)
- **FR2.3**: Emails automatically save to Gmail Sent folder
- **FR2.4**: Support meeting metadata in emails (title, date, time, location)
- **FR2.5**: Support all current email sections (summary, speakers, action items, etc.)

#### FR3: Email Provider Selection
- **FR3.1**: User can select email provider: Microsoft 365 or Gmail
- **FR3.2**: Provider selection persists across app restarts
- **FR3.3**: User can switch providers at any time
- **FR3.4**: Switching providers does not affect stored credentials for other provider
- **FR3.5**: App gracefully handles case where selected provider is not authenticated

#### FR4: Settings Management
- **FR4.1**: User can enter Google OAuth credentials (Client ID, Client Secret)
- **FR4.2**: Google credentials persist in settings
- **FR4.3**: Settings UI shows authentication status for both providers
- **FR4.4**: User can sign in/out of each provider independently

### Non-Functional Requirements

#### NFR1: Security
- **NFR1.1**: OAuth tokens stored in macOS Keychain (encrypted)
- **NFR1.2**: Tokens never logged to console or error messages
- **NFR1.3**: Client Secret stored in settings file (acceptable for desktop app)
- **NFR1.4**: Minimal OAuth scopes (`gmail.send`, `userinfo.profile` only)

#### NFR2: Performance
- **NFR2.1**: Email sending completes within 5 seconds (typical)
- **NFR2.2**: Token refresh does not block UI
- **NFR2.3**: Provider switching is instant (no re-initialization required)

#### NFR3: Reliability
- **NFR3.1**: Graceful error handling for network failures
- **NFR3.2**: Graceful error handling for expired/invalid tokens
- **NFR3.3**: Clear error messages for common failure scenarios
- **NFR3.4**: No data loss if email sending fails

#### NFR4: Maintainability
- **NFR4.1**: Clean separation between M365 and Gmail implementations
- **NFR4.2**: Shared abstraction layer for email providers
- **NFR4.3**: Consistent error handling patterns
- **NFR4.4**: Comprehensive unit tests for new code

#### NFR5: Usability
- **NFR5.1**: Setup complexity equivalent to M365 (not harder)
- **NFR5.2**: Clear documentation for Google Cloud Console setup
- **NFR5.3**: Helpful error messages for OAuth failures
- **NFR5.4**: No breaking changes for existing M365 users

---

## Technical Architecture

### Proposed Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Renderer Process                         │
│                                                               │
│  SummaryDisplay.tsx                                          │
│    ↓                                                         │
│  generateEmailHTML() → HTML string                           │
│    ↓                                                         │
│  window.electronAPI.email.sendEmail()  ← UNIFIED API        │
└────────────────────────┬─────────────────────────────────────┘
                         │ IPC: email-send
                         ↓
┌──────────────────────────────────────────────────────────────┐
│                       Main Process                            │
│                                                               │
│  IPC Handler (email-send)                                    │
│    ↓                                                         │
│  settingsService.getCategory('email').provider               │
│    ↓                                                         │
│  ┌─────────────────────────────────────────┐                │
│  │    EmailProviderFactory.create()        │                │
│  │                                         │                │
│  │    if (provider === 'microsoft'):      │                │
│  │      ↓                                  │                │
│  │    M365EmailProvider                   │                │
│  │      - m365AuthService                 │                │
│  │      - graphApiService                 │                │
│  │      - sendEmail()                     │                │
│  │                                         │                │
│  │    if (provider === 'gmail'):          │                │
│  │      ↓                                  │                │
│  │    GmailEmailProvider                  │                │
│  │      - googleAuthService               │                │
│  │      - gmailApiService                 │                │
│  │      - sendEmail()                     │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
│  ┌─────────────────┐       ┌──────────────────┐            │
│  │ M365AuthService │       │ GoogleAuthService│            │
│  │                 │       │                  │            │
│  │ - login()       │       │ - login()        │            │
│  │ - getToken()    │       │ - getToken()     │            │
│  │ - refreshToken()│       │ - refreshToken() │            │
│  │ - logout()      │       │ - logout()       │            │
│  └────────┬────────┘       └────────┬─────────┘            │
│           │                         │                       │
│      Keychain                   Keychain                    │
│           │                         │                       │
│  ┌────────▼────────┐       ┌────────▼─────────┐            │
│  │ GraphApiService │       │ GmailApiService  │            │
│  │                 │       │                  │            │
│  │ - sendEmail()   │       │ - sendEmail()    │            │
│  └────────┬────────┘       └────────┬─────────┘            │
│           │                         │                       │
│           ▼                         ▼                       │
│   Microsoft Graph API          Gmail API                    │
│   POST /me/sendMail      POST users/messages/send           │
└──────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. GoogleAuthService (NEW)

**File**: `src/services/googleAuth.ts`

**Purpose**: Handle Google OAuth 2.0 authentication

**Dependencies**:
- `googleapis` npm package
- `keytar` (for token storage)

**Key Methods**:
```typescript
class GoogleAuthService {
  constructor(clientId: string, clientSecret: string)

  async initialize(): Promise<void>
  async login(): Promise<GoogleAuthResult>
  async logout(): Promise<void>
  async getAccessToken(): Promise<string>
  async refreshToken(): Promise<string>
  isAuthenticated(): boolean
  getCurrentUser(): { name: string; email: string; id: string } | null
  getAuthState(): GoogleAuthState
}
```

**OAuth Flow**:
1. Create OAuth2 client with Client ID/Secret
2. Generate authorization URL
3. Start local HTTP server on localhost:3000 (or random port)
4. Open browser to authorization URL (redirects to localhost after consent)
5. Exchange authorization code for access/refresh tokens
6. Store tokens in keychain
7. Close local server

**Token Storage** (Keychain):
- Service: `meeting-agent`
- Account: `google-token-{userId}`
- Content: JSON with `{ access_token, refresh_token, expiry_date, scope }`

**Error Handling**:
- Network failures → Retry with exponential backoff
- Invalid credentials → Clear tokens, prompt re-authentication
- User denies consent → Clear state, show error message
- Token expired → Automatic refresh using refresh token

#### 2. GmailApiService (NEW)

**File**: `src/services/gmailApi.ts`

**Purpose**: Handle Gmail API operations (email sending)

**Dependencies**:
- `googleapis` npm package

**Key Methods**:
```typescript
class GmailApiService {
  initialize(accessToken: string): void

  async sendEmail(options: SendEmailOptions): Promise<void>

  private createMimeMessage(options: SendEmailOptions): string
  private base64UrlEncode(data: string): string
}
```

**MIME Message Format** (RFC 2822):
```
To: alice@example.com, bob@example.com
Cc: carol@example.com
Subject: Meeting Summary: Q4 Planning
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

<html>
  <body>
    <!-- Email content -->
  </body>
</html>
```

**Sending Process**:
1. Build MIME message from options (To, CC, Subject, HTML body)
2. Encode to Base64url (required by Gmail API)
3. Call `gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } })`
4. Gmail automatically saves to Sent folder

**Error Handling**:
- 401 Unauthorized → Token expired, trigger refresh
- 403 Forbidden → Insufficient permissions, show helpful error
- 400 Bad Request → Malformed MIME message, log details
- 429 Too Many Requests → Rate limit exceeded, show retry message

#### 3. EmailProvider Interface (NEW)

**File**: `src/services/emailProvider.ts`

**Purpose**: Abstract interface for all email providers

**Interface**:
```typescript
interface EmailProvider {
  name: 'microsoft' | 'gmail'
  isAuthenticated(): boolean
  sendEmail(options: SendEmailOptions): Promise<void>
}

interface SendEmailOptions {
  to: { name: string; email: string }[]
  cc?: { name: string; email: string }[]
  subject: string
  bodyHtml: string
}
```

**Implementations**:
```typescript
class M365EmailProvider implements EmailProvider {
  constructor(
    private m365AuthService: M365AuthService,
    private graphApiService: GraphApiService
  )

  name = 'microsoft'

  isAuthenticated(): boolean {
    return this.m365AuthService.isAuthenticated()
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const token = await this.m365AuthService.getAccessToken()
    this.graphApiService.initialize(token)
    await this.graphApiService.sendEmail(options)
  }
}

class GmailEmailProvider implements EmailProvider {
  constructor(
    private googleAuthService: GoogleAuthService,
    private gmailApiService: GmailApiService
  )

  name = 'gmail'

  isAuthenticated(): boolean {
    return this.googleAuthService.isAuthenticated()
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const token = await this.googleAuthService.getAccessToken()
    this.gmailApiService.initialize(token)
    await this.gmailApiService.sendEmail(options)
  }
}
```

**Factory**:
```typescript
class EmailProviderFactory {
  static create(
    provider: 'microsoft' | 'gmail',
    services: {
      m365Auth?: M365AuthService,
      graphApi?: GraphApiService,
      googleAuth?: GoogleAuthService,
      gmailApi?: GmailApiService
    }
  ): EmailProvider {
    if (provider === 'microsoft') {
      return new M365EmailProvider(services.m365Auth!, services.graphApi!)
    } else {
      return new GmailEmailProvider(services.googleAuth!, services.gmailApi!)
    }
  }
}
```

#### 4. Settings Schema Changes

**File**: `src/types/settings.ts`

**New Fields**:
```typescript
export interface AppSettings {
  // ... existing fields ...

  email: {
    provider: 'microsoft' | 'gmail'  // Default: 'microsoft'
  }

  google: {
    clientId: string       // e.g., "123456789-abc.apps.googleusercontent.com"
    clientSecret: string   // e.g., "GOCSPX-abc123..."
  }
}
```

**Default Values**:
```typescript
const DEFAULT_SETTINGS: AppSettings = {
  // ... existing defaults ...

  email: {
    provider: 'microsoft'
  },

  google: {
    clientId: '',
    clientSecret: ''
  }
}
```

**Storage Locations**:
- `email.provider`: JSON file (`settings.json`)
- `google.clientId`: JSON file
- `google.clientSecret`: JSON file (not truly secret in desktop app, acceptable)
- Google tokens: Keychain (managed by GoogleAuthService)

#### 5. IPC Handlers

**File**: `src/main/index.ts`

**New Handlers** (Google Authentication):
```typescript
ipcMain.handle('google-auth-initialize', async () => {
  try {
    const settings = settingsService.getCategory('google')
    if (!settings.clientId || !settings.clientSecret) {
      return { success: false, error: 'Google credentials not configured' }
    }

    googleAuthService = new GoogleAuthService(settings.clientId, settings.clientSecret)
    await googleAuthService.initialize()

    const authState = googleAuthService.getAuthState()
    return { success: true, authState }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('google-auth-login', async () => {
  try {
    const result = await googleAuthService.login()
    const authState = googleAuthService.getAuthState()
    return { success: true, authState }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('google-auth-logout', async () => {
  try {
    await googleAuthService.logout()
    const authState = googleAuthService.getAuthState()
    return { success: true, authState }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('google-auth-get-state', async () => {
  try {
    const authState = googleAuthService.getAuthState()
    return { success: true, authState }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

**Unified Email Sending Handler**:
```typescript
ipcMain.handle('email-send', async (_event, options: SendEmailOptions) => {
  try {
    const provider = settingsService.getCategory('email').provider

    // Get appropriate email provider
    let emailProvider: EmailProvider

    if (provider === 'microsoft') {
      if (!m365AuthService) {
        return { success: false, error: 'Microsoft 365 not configured' }
      }
      emailProvider = new M365EmailProvider(m365AuthService, graphApiService)
    } else if (provider === 'gmail') {
      if (!googleAuthService) {
        return { success: false, error: 'Gmail not configured' }
      }
      emailProvider = new GmailEmailProvider(googleAuthService, gmailApiService)
    } else {
      return { success: false, error: 'Invalid email provider' }
    }

    // Check authentication
    if (!emailProvider.isAuthenticated()) {
      return { success: false, error: `${provider} not authenticated. Please sign in.` }
    }

    // Send email
    await emailProvider.sendEmail(options)

    return { success: true }
  } catch (error) {
    console.error('[Email] Send failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    }
  }
})
```

**Backward Compatibility**:
```typescript
// Keep existing handler for backward compatibility
ipcMain.handle('graph-send-email', async (_event, options) => {
  // Delegate to unified handler
  return ipcRenderer.invoke('email-send', options)
})
```

#### 6. Preload Bridge

**File**: `src/preload/index.ts`

**New APIs**:
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs ...

  googleAuth: {
    initialize: () => ipcRenderer.invoke('google-auth-initialize'),
    login: () => ipcRenderer.invoke('google-auth-login'),
    logout: () => ipcRenderer.invoke('google-auth-logout'),
    getState: () => ipcRenderer.invoke('google-auth-get-state')
  },

  email: {
    sendEmail: (options: SendEmailOptions) =>
      ipcRenderer.invoke('email-send', options)
  }
})
```

#### 7. TypeScript Type Definitions

**File**: `src/types/electron.d.ts`

**New Types**:
```typescript
export interface GoogleAuthState {
  isAuthenticated: boolean
  user: {
    name: string
    email: string
    id: string
  } | null
  error: string | null
}

export interface ElectronAPI {
  // ... existing APIs ...

  googleAuth: {
    initialize: () => Promise<{ success: boolean; authState?: GoogleAuthState; error?: string }>
    login: () => Promise<{ success: boolean; authState?: GoogleAuthState; error?: string }>
    logout: () => Promise<{ success: boolean; authState?: GoogleAuthState; error?: string }>
    getState: () => Promise<{ success: boolean; authState?: GoogleAuthState; error?: string }>
  }

  email: {
    sendEmail: (options: SendEmailOptions) => Promise<{ success: boolean; error?: string }>
  }
}
```

#### 8. Settings UI

**File**: `src/renderer/components/SettingsPanel.tsx`

**New Tab**: "Email Provider"

**UI Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Settings                                                 │
│                                                          │
│  [General] [API Keys] [Email Provider] [Advanced]       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Email Provider                                    │  │
│  │                                                   │  │
│  │  Choose your email provider for sending meeting  │  │
│  │  summaries:                                       │  │
│  │                                                   │  │
│  │  ○ Microsoft 365                                  │  │
│  │    Send emails via Microsoft Graph API           │  │
│  │    Requires: Azure App Registration              │  │
│  │                                                   │  │
│  │  ● Gmail                                          │  │
│  │    Send emails via Gmail API                     │  │
│  │    Requires: Google Cloud OAuth credentials      │  │
│  │                                                   │  │
│  │  [Setup Instructions]                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Google OAuth Configuration                        │  │
│  │                                                   │  │
│  │  Client ID:                                       │  │
│  │  ┌──────────────────────────────────────────┐   │  │
│  │  │ 123456789-abc.apps.googleusercontent.com │   │  │
│  │  └──────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  │  Client Secret:                                   │  │
│  │  ┌──────────────────────────────────────────┐   │  │
│  │  │ ••••••••••••••••••••                     │   │  │
│  │  └──────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  │  Status: ✅ Authenticated as john@gmail.com      │  │
│  │                                                   │  │
│  │  [Sign in to Google]  [Sign Out]                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Conditional Rendering**:
- Show Microsoft 365 section if provider = 'microsoft'
- Show Gmail section if provider = 'gmail'
- Disable provider radio button if credentials not configured
- Show authentication status for selected provider

**State Management**:
```typescript
const [selectedProvider, setSelectedProvider] = useState<'microsoft' | 'gmail'>('microsoft')
const [googleClientId, setGoogleClientId] = useState('')
const [googleClientSecret, setGoogleClientSecret] = useState('')
const [googleAuthState, setGoogleAuthState] = useState<GoogleAuthState | null>(null)
```

**Event Handlers**:
```typescript
const handleProviderChange = async (provider: 'microsoft' | 'gmail') => {
  await window.electronAPI.updateSettings({ email: { provider } })
  setSelectedProvider(provider)
}

const handleGoogleLogin = async () => {
  // Save credentials first
  await window.electronAPI.updateSettings({
    google: { clientId: googleClientId, clientSecret: googleClientSecret }
  })

  // Initialize auth service
  const initResult = await window.electronAPI.googleAuth.initialize()
  if (!initResult.success) {
    setError(initResult.error)
    return
  }

  // Trigger login flow
  const loginResult = await window.electronAPI.googleAuth.login()
  if (loginResult.success) {
    setGoogleAuthState(loginResult.authState)
  } else {
    setError(loginResult.error)
  }
}

const handleGoogleLogout = async () => {
  const result = await window.electronAPI.googleAuth.logout()
  if (result.success) {
    setGoogleAuthState(result.authState)
  }
}
```

#### 9. Renderer Email Sending

**File**: `src/renderer/components/SummaryDisplay.tsx`

**Before (M365 only)**:
```typescript
const emailHtml = generateEmailHTML({ ... })
const result = await window.electronAPI.graphApi.sendEmail({
  to: recipients,
  subject: subjectLine,
  bodyHtml: emailHtml
})
```

**After (Provider-agnostic)**:
```typescript
const emailHtml = generateEmailHTML({ ... })
const result = await window.electronAPI.email.sendEmail({
  to: recipients,
  subject: subjectLine,
  bodyHtml: emailHtml
})
```

**Error Handling**:
```typescript
if (!result.success) {
  // Show provider-specific error message
  if (result.error?.includes('not authenticated')) {
    setError('Please sign in to your email provider in Settings.')
  } else if (result.error?.includes('not configured')) {
    setError('Please configure your email provider in Settings.')
  } else {
    setError(result.error || 'Failed to send email')
  }
}
```

---

## Implementation Plan

### Phase 1: Backend - Google Services (5-6 hours)

#### Task 1.1: Install Dependencies
**File**: `package.json`
```bash
npm install googleapis@^140.0.1
```

**Estimated Time**: 5 minutes

#### Task 1.2: Implement GoogleAuthService
**File**: `src/services/googleAuth.ts`

**Subtasks**:
1. Create class structure and constructor
2. Implement OAuth2 flow with local server
3. Implement token storage in keychain
4. Implement token refresh logic
5. Implement `login()`, `logout()`, `getAccessToken()`, `isAuthenticated()`
6. Add error handling and logging

**Reference Implementation**:
- Study `src/services/m365Auth.ts` for patterns
- Use `googleapis` OAuth2Client
- Use `keytar` for token storage (same pattern as M365)

**Estimated Time**: 3 hours

**Acceptance Criteria**:
- [ ] User can authenticate with Google account
- [ ] Tokens stored securely in keychain
- [ ] Tokens auto-refresh before expiry
- [ ] Graceful error handling for common OAuth failures
- [ ] TypeScript types fully defined

#### Task 1.3: Implement GmailApiService
**File**: `src/services/gmailApi.ts`

**Subtasks**:
1. Create class structure
2. Implement MIME message builder
3. Implement Base64url encoder
4. Implement `sendEmail()` method
5. Add error handling for Gmail API errors
6. Add logging for debugging

**Test Cases**:
- HTML email with single recipient
- HTML email with multiple recipients (To + CC)
- Email with special characters (emoji, unicode)
- Large email body (>50KB)

**Estimated Time**: 2 hours

**Acceptance Criteria**:
- [ ] Can send HTML emails via Gmail API
- [ ] MIME message format is RFC 2822 compliant
- [ ] Support To and CC recipients
- [ ] Emails appear in Gmail Sent folder
- [ ] Error messages are user-friendly

#### Task 1.4: Add IPC Handlers
**File**: `src/main/index.ts`

**Subtasks**:
1. Add `google-auth-initialize` handler
2. Add `google-auth-login` handler
3. Add `google-auth-logout` handler
4. Add `google-auth-get-state` handler
5. Implement unified `email-send` handler
6. Add error handling and logging

**Estimated Time**: 1.5 hours

**Acceptance Criteria**:
- [ ] All Google auth IPC calls work from renderer
- [ ] Unified email-send handler routes to correct provider
- [ ] Error messages propagate correctly to renderer
- [ ] No breaking changes to existing M365 handlers

#### Task 1.5: Update Preload Bridge
**File**: `src/preload/index.ts`

**Subtasks**:
1. Add `googleAuth` API to context bridge
2. Add `email` API to context bridge
3. Update TypeScript types in `electron.d.ts`

**Estimated Time**: 30 minutes

**Acceptance Criteria**:
- [ ] `window.electronAPI.googleAuth.*` available in renderer
- [ ] `window.electronAPI.email.sendEmail()` available in renderer
- [ ] TypeScript autocomplete works in renderer

#### Task 1.6: Testing
**Tests to Write**:
- Unit tests for MIME message builder
- Unit tests for Base64url encoder
- Integration test: Full OAuth flow (manual, requires browser)
- Integration test: Send email via Gmail API (manual, requires account)

**Estimated Time**: 1 hour

**Acceptance Criteria**:
- [ ] Can authenticate with real Google account
- [ ] Can send test email to personal email address
- [ ] Email appears correctly formatted in Gmail
- [ ] Tokens persist after app restart

---

### Phase 2: Settings Integration (3-4 hours)

#### Task 2.1: Update Settings Schema
**File**: `src/types/settings.ts`

**Subtasks**:
1. Add `email.provider` field
2. Add `google.clientId` and `google.clientSecret` fields
3. Update default settings
4. Update settings validation

**Estimated Time**: 30 minutes

**Acceptance Criteria**:
- [ ] Settings schema includes new fields
- [ ] Default values set correctly
- [ ] TypeScript types updated

#### Task 2.2: Update Settings Service
**File**: `src/services/settings.ts`

**Subtasks**:
1. Add migration logic for existing settings (add new fields)
2. Test settings persistence
3. Add validation for Google credentials format

**Estimated Time**: 1 hour

**Acceptance Criteria**:
- [ ] Existing users' settings migrate correctly
- [ ] New settings persist across app restarts
- [ ] Invalid credentials rejected with helpful error

#### Task 2.3: Build Settings UI
**File**: `src/renderer/components/SettingsPanel.tsx`

**Subtasks**:
1. Add "Email Provider" tab
2. Add provider selection radio buttons
3. Add Google OAuth credentials section
4. Add "Sign in to Google" button
5. Add authentication status display
6. Add "Sign Out" button
7. Add conditional rendering based on selected provider
8. Add setup instructions link/modal

**Estimated Time**: 2 hours

**Acceptance Criteria**:
- [ ] User can select email provider
- [ ] User can enter Google credentials
- [ ] User can sign in to Google (opens browser)
- [ ] Authentication status displays correctly
- [ ] User can sign out
- [ ] Provider selection persists

#### Task 2.4: Testing
**Test Scenarios**:
- Enter invalid Google credentials → Show error
- Enter valid credentials, sign in → Show authenticated status
- Switch from M365 to Gmail → Gmail credentials section appears
- Switch from Gmail to M365 → M365 credentials section appears
- Sign out → Status updates to "Not authenticated"
- Restart app → Settings persist, authentication status correct

**Estimated Time**: 30 minutes

---

### Phase 3: Provider Abstraction (2-3 hours)

#### Task 3.1: Create EmailProvider Interface
**File**: `src/services/emailProvider.ts`

**Subtasks**:
1. Define `EmailProvider` interface
2. Define `SendEmailOptions` interface (shared)
3. Implement `M365EmailProvider` class
4. Implement `GmailEmailProvider` class
5. Implement `EmailProviderFactory`

**Estimated Time**: 1.5 hours

**Acceptance Criteria**:
- [ ] Both providers implement common interface
- [ ] Factory can instantiate either provider
- [ ] SendEmailOptions type is shared (no duplication)

#### Task 3.2: Refactor IPC Handlers
**File**: `src/main/index.ts`

**Subtasks**:
1. Refactor existing `graph-send-email` to use M365EmailProvider
2. Implement new unified `email-send` handler using factory
3. Add provider selection logic
4. Add authentication checks
5. Maintain backward compatibility

**Estimated Time**: 1 hour

**Acceptance Criteria**:
- [ ] Unified handler works for both providers
- [ ] Existing M365 users unaffected
- [ ] Gmail users can send emails
- [ ] Error messages are provider-agnostic

#### Task 3.3: Update Renderer
**File**: `src/renderer/components/SummaryDisplay.tsx`

**Subtasks**:
1. Replace `window.electronAPI.graphApi.sendEmail()` with `window.electronAPI.email.sendEmail()`
2. Update error handling to be provider-agnostic
3. Test with both providers

**Estimated Time**: 30 minutes

**Acceptance Criteria**:
- [ ] Email sending works with M365 (regression test)
- [ ] Email sending works with Gmail (new test)
- [ ] Error messages make sense for both providers

---

### Phase 4: Testing & Documentation (2-3 hours)

#### Task 4.1: Comprehensive Testing

**Manual Test Checklist**:

**Authentication**:
- [ ] Sign in to Gmail with personal account
- [ ] Sign in to Gmail with Google Workspace account
- [ ] Sign out from Gmail
- [ ] Switch from M365 to Gmail while authenticated to M365
- [ ] Switch from Gmail to M365 while authenticated to Gmail
- [ ] Restart app after Gmail sign-in → Still authenticated
- [ ] Token expires (wait 1 hour) → Auto-refreshes on next email send

**Email Sending**:
- [ ] Send email via Gmail to single recipient
- [ ] Send email via Gmail to multiple recipients (To + CC)
- [ ] Email appears in Gmail Sent folder
- [ ] Email contains meeting metadata (title, date, time, location)
- [ ] Email contains summary, speakers, action items
- [ ] Email HTML renders correctly in Gmail web UI
- [ ] Email HTML renders correctly in Gmail mobile app
- [ ] Special characters (emoji, unicode) display correctly

**Error Scenarios**:
- [ ] Send email without signing in → Clear error message
- [ ] Send email with invalid Google credentials → Clear error message
- [ ] Send email with expired token → Auto-refresh, then send
- [ ] Send email with revoked OAuth consent → Prompt re-authentication
- [ ] Network failure during send → Retry or clear error
- [ ] Gmail API disabled in Google Cloud Console → Clear error

**Settings**:
- [ ] Enter invalid Client ID format → Validation error
- [ ] Enter valid credentials → Saved successfully
- [ ] Change provider → Settings persist
- [ ] Restart app → Provider selection and credentials persist

**Estimated Time**: 1.5 hours

#### Task 4.2: Write User Documentation

**New Files**:
1. `docs/guides/google-cloud-setup.md` - Step-by-step Google Cloud Console setup
2. `docs/guides/gmail-setup.md` - Gmail integration setup in app
3. Update `README.md` - Add Gmail as supported email provider
4. Update `docs/developer/architecture.md` - Add email provider abstraction diagram

**Documentation Content**:

**`docs/guides/google-cloud-setup.md`**:
- Creating Google Cloud Project
- Enabling Gmail API
- Creating OAuth 2.0 credentials
- Configuring OAuth consent screen
- Finding Client ID and Client Secret
- Screenshots for each step

**`docs/guides/gmail-setup.md`**:
- Prerequisites (Google account)
- Obtaining Google Cloud credentials
- Entering credentials in app settings
- Signing in to Google
- Sending test email
- Troubleshooting common issues

**Estimated Time**: 1 hour

#### Task 4.3: Update Developer Documentation

**Files to Update**:
1. `docs/developer/architecture.md` - Add email provider abstraction
2. `docs/technical/email-distribution.md` (NEW) - Document both M365 and Gmail implementations
3. `CLAUDE.md` - Update tech stack section

**Content**:
- Email provider abstraction architecture diagram
- OAuth flow diagrams for both providers
- MIME message format documentation
- Error handling patterns
- Testing guidelines

**Estimated Time**: 30 minutes

---

## User Setup Experience

### For Personal Gmail Users (Most Common)

#### Step 1: Google Cloud Console Setup (One-time, 5-10 minutes)

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Click "Select a project" → "New Project"
   - Project name: "Meeting Agent - Personal"
   - Click "Create"

2. **Enable Gmail API**
   - In left sidebar: APIs & Services → Library
   - Search: "Gmail API"
   - Click "Gmail API" → Click "Enable"

3. **Configure OAuth Consent Screen**
   - In left sidebar: APIs & Services → OAuth consent screen
   - User type: "External" (for personal Gmail)
   - Click "Create"
   - App name: "Meeting Agent"
   - User support email: [your email]
   - Developer contact: [your email]
   - Click "Save and Continue"
   - Scopes: Click "Add or Remove Scopes"
     - Search: "gmail.send"
     - Check: `https://www.googleapis.com/auth/gmail.send`
     - Check: `https://www.googleapis.com/auth/userinfo.profile`
     - Click "Update"
   - Click "Save and Continue"
   - Test users: Add your email address
   - Click "Save and Continue"

4. **Create OAuth 2.0 Credentials**
   - In left sidebar: APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Desktop app"
   - Name: "Meeting Agent Desktop"
   - Click "Create"
   - **Copy Client ID** (looks like: `123456789-abc.apps.googleusercontent.com`)
   - **Copy Client Secret** (looks like: `GOCSPX-abc123...`)
   - Click "OK"

#### Step 2: App Configuration (2 minutes)

1. **Open Meeting Agent Settings**
   - Click Settings icon (⚙️) in top right
   - Click "Email Provider" tab

2. **Select Gmail**
   - Click radio button: "Gmail"

3. **Enter Google Credentials**
   - Paste Client ID from Step 1
   - Paste Client Secret from Step 1
   - Click "Save"

4. **Sign In**
   - Click "Sign in to Google"
   - Browser opens to Google consent screen
   - Sign in with your Gmail account
   - Click "Allow" (grants permission to send emails)
   - Browser shows "Authentication successful, you may close this window"
   - Return to Meeting Agent
   - Status shows: "✅ Authenticated as [your-email@gmail.com]"

5. **Done!**
   - Close Settings
   - Meeting summaries will now be sent via Gmail

### For Google Workspace Users

**Same process** as personal Gmail, with one difference:
- OAuth consent screen can be "Internal" (only for your organization)
- Admin approval may be required (depending on Workspace settings)

---

## Testing Strategy

### Unit Tests

**Files to Test**:
1. `src/services/googleAuth.ts`
   - Mock `googleapis` OAuth2Client
   - Test token storage/retrieval from keychain
   - Test token refresh logic
   - Test error handling

2. `src/services/gmailApi.ts`
   - Test MIME message builder (various inputs)
   - Test Base64url encoder
   - Mock Gmail API calls
   - Test error handling

3. `src/services/emailProvider.ts`
   - Test factory creates correct provider
   - Test interface methods work for both implementations

**Test Framework**: Jest (already configured)

**Estimated Tests**: 20-30 unit tests

### Integration Tests

**Manual Testing Required** (OAuth and email sending cannot be fully automated):

1. **OAuth Flow**
   - Real Google account
   - Real browser consent
   - Verify tokens stored in keychain
   - Verify tokens work after app restart

2. **Email Sending**
   - Real Gmail account
   - Send to real email address
   - Verify email appears in recipient inbox
   - Verify email appears in sender's Sent folder
   - Verify HTML rendering

3. **Provider Switching**
   - Sign in to M365
   - Send test email via M365
   - Switch to Gmail
   - Sign in to Gmail
   - Send test email via Gmail
   - Both emails should arrive correctly

### Regression Tests

**Ensure No Breaking Changes**:
- [ ] Existing M365 users can still send emails
- [ ] M365 authentication flow unchanged
- [ ] Settings UI for M365 unchanged
- [ ] Error messages for M365 unchanged

### Performance Tests

**Benchmarks**:
- [ ] Email sending completes within 5 seconds (typical network)
- [ ] Token refresh completes within 2 seconds
- [ ] Settings UI is responsive (no lag when switching providers)
- [ ] App startup time not significantly impacted (<100ms increase)

---

## Documentation Requirements

### User Documentation

#### 1. Google Cloud Console Setup Guide
**File**: `docs/guides/google-cloud-setup.md`

**Content**:
- Prerequisites (Google account)
- Step-by-step instructions with screenshots
- Common issues and solutions
- Security best practices
- Cost information (free for personal use)

**Length**: ~2 pages

#### 2. Gmail Integration Guide
**File**: `docs/guides/gmail-setup.md`

**Content**:
- Overview of Gmail integration
- When to use Gmail vs M365
- Setup instructions (references google-cloud-setup.md)
- Testing email sending
- Troubleshooting
- FAQ

**Length**: ~1 page

#### 3. README Updates
**File**: `README.md`

**Changes**:
- Add Gmail to list of features
- Update "Email Distribution" section to mention both providers
- Link to setup guides

**Lines Changed**: ~10 lines

### Developer Documentation

#### 4. Architecture Documentation
**File**: `docs/developer/architecture.md`

**Changes**:
- Add "Email Provider Abstraction" section
- Add architecture diagram showing both providers
- Explain factory pattern and interface design

**Lines Changed**: ~50 lines

#### 5. Email Distribution Technical Doc
**File**: `docs/technical/email-distribution.md` (NEW)

**Content**:
- Overview of email distribution feature
- M365 implementation details
- Gmail implementation details
- MIME message format
- OAuth flows for both providers
- Error handling patterns
- Testing guidelines

**Length**: ~3 pages

#### 6. CLAUDE.md Updates
**File**: `CLAUDE.md`

**Changes**:
- Update "Tech Stack" section to include `googleapis`
- Add Gmail to "M365 calendar and email integration" feature description
- Update "Email Distribution" phase notes

**Lines Changed**: ~5 lines

---

## Risks & Mitigations

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Gmail API rate limits** | LOW | LOW | 500 emails/day is sufficient for personal use; quota is per user (not shared) |
| **OAuth complexity** | MEDIUM | MEDIUM | Use `googleapis` library (handles OAuth), follow M365 pattern, comprehensive testing |
| **MIME formatting errors** | MEDIUM | HIGH | Extensive testing with various email content, reference RFC 2822 spec, use proven email libraries |
| **Token refresh failures** | MEDIUM | MEDIUM | Robust error handling, prompt user to re-authenticate, auto-retry with exponential backoff |
| **Google Cloud Console setup complexity** | HIGH | LOW | Detailed documentation with screenshots, video tutorial (optional), support in issues |
| **Breaking existing M365 users** | LOW | HIGH | Thorough regression testing, backward compatible changes, staged rollout |

### User Experience Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Confusing provider selection** | MEDIUM | MEDIUM | Clear UI with descriptions, default to M365 (existing behavior), help text |
| **Users don't understand OAuth credentials** | HIGH | MEDIUM | Comprehensive setup guide, screenshots for every step, video walkthrough |
| **Users expect instant switching** | MEDIUM | LOW | Clear messaging that re-authentication required when switching providers |
| **Frustration with setup time** | MEDIUM | MEDIUM | Emphasize one-time setup (5-10 minutes), compare to M365 setup (same complexity) |

### Security Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **OAuth tokens leaked** | LOW | HIGH | Store in macOS Keychain (encrypted), never log tokens, follow OAuth best practices |
| **Client Secret in codebase** | MEDIUM | LOW | Accept that desktop apps can't keep secrets, use user-owned credentials (each user has unique secret) |
| **Phishing via fake OAuth screen** | LOW | HIGH | Use official Google OAuth endpoints only, verify SSL certificates, educate users |
| **Revoked OAuth consent** | MEDIUM | LOW | Graceful error handling, prompt re-authentication, clear error message |

### Maintenance Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Google API changes** | LOW | MEDIUM | Pin `googleapis` version, test before upgrading, subscribe to Google API announcements |
| **OAuth flow breaks in Electron updates** | LOW | HIGH | Test with Electron upgrades before releasing, maintain compatibility with older Electron versions |
| **Supporting two auth systems** | MEDIUM | MEDIUM | Shared abstraction interface, consistent error handling, comprehensive tests for both |
| **Documentation becomes outdated** | MEDIUM | LOW | Version documentation, keep screenshots updated, community contributions |

---

## Success Metrics

### Development Metrics

- [ ] **All unit tests pass** (target: 100% of new code)
- [ ] **All integration tests pass** (manual checklist)
- [ ] **No breaking changes** (existing M365 users unaffected)
- [ ] **Code review approved** (if applicable)
- [ ] **Documentation complete** (user + developer docs)

### User Success Metrics (Post-Launch)

- [ ] **Setup success rate** >90% (users who start setup complete it)
- [ ] **Email delivery success rate** >99% (successful sends / total attempts)
- [ ] **Support ticket volume** <5 tickets/week (Gmail-related issues)
- [ ] **User satisfaction** >4.0/5.0 (if user feedback collected)

### Adoption Metrics (Post-Launch)

- [ ] **% of users using Gmail** (target: 20-40% within 3 months)
- [ ] **% of users switching providers** (target: <5% churn)
- [ ] **Average setup time** <10 minutes (from docs to first email sent)

---

## Appendix

### A. Gmail API Quotas

**Free Tier Limits** (per Google account):
- **Sending quota**: 500 emails per day
- **API quota**: 1 billion quota units per day
  - Sending an email: 100 units
  - Effective limit: 10 million API calls per day

**Conclusion**: Quotas are not a concern for this use case (personal use, <10 emails/day typical).

### B. OAuth Scopes Explained

**Required Scopes**:
- `https://www.googleapis.com/auth/gmail.send`
  - Permission: Send email on behalf of user
  - Sensitive: Yes (requires OAuth consent)
  - Justification: Core feature requirement

- `https://www.googleapis.com/auth/userinfo.profile`
  - Permission: Read user's name and email
  - Sensitive: No (basic profile info)
  - Justification: Display authenticated user in UI

**Scopes to Avoid**:
- `gmail.modify` - Too broad, not needed
- `gmail.readonly` - Not needed (no reading emails in current version)
- `gmail.compose` - Too broad, `send` is more specific

### C. MIME Message Format

**Example MIME Message**:
```
To: alice@example.com
Cc: bob@example.com
Subject: Meeting Summary: Q4 Planning Session
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; }
      .summary { background: #f0f0f0; padding: 20px; }
    </style>
  </head>
  <body>
    <div class="summary">
      <h1>Q4 Planning Session</h1>
      <p>Date: Monday, January 7, 2026</p>
      <p>Time: 2:00 PM - 3:00 PM</p>

      <h2>Summary</h2>
      <p>Discussed Q4 goals and resource allocation...</p>

      <h2>Participants</h2>
      <ul>
        <li>Alice Smith (alice@example.com)</li>
        <li>Bob Jones (bob@example.com)</li>
      </ul>

      <h2>Action Items</h2>
      <ul>
        <li>[HIGH] Alice: Finalize Q4 budget by Friday</li>
        <li>[MEDIUM] Bob: Review hiring plan by next week</li>
      </ul>
    </div>
  </body>
</html>
```

**Base64url Encoding** (required by Gmail API):
```javascript
const message = /* MIME message above */
const base64 = Buffer.from(message)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '')
```

### D. Comparison: M365 vs Gmail APIs

| Feature | Microsoft Graph API | Gmail API |
|---------|---------------------|-----------|
| **Authentication** | OAuth 2.0 (MSAL) | OAuth 2.0 (googleapis) |
| **Send Email Endpoint** | `POST /me/sendMail` | `POST users/me/messages/send` |
| **Message Format** | JSON | MIME (Base64url encoded) |
| **HTML Support** | Yes (body.contentType: 'HTML') | Yes (Content-Type: text/html) |
| **Multiple Recipients** | Yes (toRecipients[], ccRecipients[]) | Yes (To:, Cc: headers) |
| **Save to Sent** | Optional (saveToSentItems: true) | Automatic (always saved) |
| **Rate Limits** | ~10,000 requests/day | 500 emails/day, 1B quota units/day |
| **Token Expiry** | 1 hour (auto-refresh with MSAL) | 1 hour (manual refresh) |
| **Setup Complexity** | Azure Portal (App Registration) | Google Cloud Console (OAuth Client) |

**Conclusion**: Both APIs have similar capabilities and complexity. Gmail API requires MIME formatting (slightly more complex) but has generous quotas.

### E. Error Code Mappings

**Gmail API Error Codes**:
| Code | Description | User-Friendly Message |
|------|-------------|----------------------|
| 400 | Bad Request (malformed MIME) | "Failed to send email. Please contact support." |
| 401 | Unauthorized (invalid token) | "Gmail authentication expired. Please sign in again." |
| 403 | Forbidden (insufficient permissions) | "Gmail API permission denied. Please re-authorize in Settings." |
| 404 | Not Found (user doesn't exist) | "Gmail account not found. Please check your credentials." |
| 429 | Too Many Requests (rate limit) | "Email sending limit reached (500/day). Try again tomorrow." |
| 500 | Internal Server Error | "Gmail service temporarily unavailable. Please try again." |

**Microsoft Graph API Error Codes** (for comparison):
| Code | Description | User-Friendly Message |
|------|-------------|----------------------|
| 400 | Bad Request | "Failed to send email. Please contact support." |
| 401 | Unauthorized | "Microsoft 365 authentication expired. Please sign in again." |
| 403 | Forbidden | "Mail.Send permission denied. Please re-authorize in Settings." |
| 404 | Not Found | "Microsoft 365 account not found. Please check your credentials." |
| 429 | Too Many Requests | "Too many requests. Please try again in a few minutes." |
| 500 | Internal Server Error | "Microsoft 365 service temporarily unavailable. Please try again." |

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-07 | Claude Sonnet 4.5 | Initial comprehensive implementation plan |

---

## References

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Gmail API Node.js Quickstart](https://developers.google.com/gmail/api/quickstart/nodejs)
- [Google OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [RFC 2822: Internet Message Format](https://www.rfc-editor.org/rfc/rfc2822)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)
- [Microsoft Graph API Documentation](https://learn.microsoft.com/en-us/graph/api/user-sendmail)
- [MSAL Node Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)
