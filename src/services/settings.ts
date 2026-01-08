/**
 * Settings Service - Phase 6
 *
 * Manages application settings with secure storage for sensitive data.
 * - Regular settings stored in SQLite database
 * - API keys stored securely in system keychain (keytar)
 *
 * Settings Categories:
 * 1. API Credentials (encrypted in keychain)
 * 2. Transcription Settings (Whisper model, threads)
 * 3. Summary Settings (verbosity, disclaimer)
 * 4. Data Retention Settings (quotas, periods)
 * 5. UI Preferences (theme, font, default view)
 */

import * as keytar from 'keytar'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

// Keychain constants
const KEYCHAIN_SERVICE = 'meeting-agent'
const KEYCHAIN_ANTHROPIC_KEY = 'anthropic-api-key'
const KEYCHAIN_HUGGINGFACE_KEY = 'huggingface-token'

// Settings file path (for non-sensitive settings)
const getSettingsPath = (): string => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'settings.json')
}

/**
 * Application settings interface
 */
export interface AppSettings {
  // API Configuration (keys stored separately in keychain)
  azure: {
    clientId: string
    tenantId: string
  }
  anthropic: {
    model: string
  }

  // Transcription Settings
  transcription: {
    model: 'tiny' | 'base' | 'small' | 'medium' | 'large'
    threads: number // 0 = auto-detect
    language: string
  }

  // Summary Settings
  summary: {
    verbosity: 'concise' | 'detailed' | 'comprehensive'
    customDisclaimer: string | null // null = use default
    emailBodyMaxLength: number
    emailContextMaxCount: number
  }

  // Data Retention Settings
  dataRetention: {
    keepAudioFiles: boolean
    audioStorageQuotaGB: number // 1-10 GB
    transcriptRetentionDays: number // 30, 60, 90, 0 = forever
    summaryRetentionDays: number // 30, 60, 90, 0 = forever
  }

  // UI Preferences
  ui: {
    theme: 'light' | 'dark' | 'system'
    fontSize: 'small' | 'medium' | 'large'
    defaultView: 'browse' | 'generate'
    showRecordingAnnouncement: boolean
  }

  // Audio Settings
  audio: {
    includeMicrophone: boolean
    announcementText: string
  }

  // Email Settings
  email: {
    provider: 'm365' | 'gmail'
    googleCredentialsPath: string | null
  }
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: AppSettings = {
  azure: {
    clientId: '',
    tenantId: 'common'
  },
  anthropic: {
    model: 'claude-sonnet-4-20250514'
  },
  transcription: {
    model: 'base',
    threads: 0, // Auto-detect
    language: 'en'
  },
  summary: {
    verbosity: 'detailed',
    customDisclaimer: null,
    emailBodyMaxLength: 2000,
    emailContextMaxCount: 10
  },
  dataRetention: {
    keepAudioFiles: false,
    audioStorageQuotaGB: 5,
    transcriptRetentionDays: 0, // Forever
    summaryRetentionDays: 0 // Forever
  },
  ui: {
    theme: 'light',
    fontSize: 'medium',
    defaultView: 'generate',
    showRecordingAnnouncement: true
  },
  audio: {
    includeMicrophone: true,
    announcementText:
      'This meeting, with your permission, is being recorded to generate meeting notes. These recordings will be deleted after notes are generated.'
  },
  email: {
    provider: 'm365',
    googleCredentialsPath: null
  }
}

/**
 * API Keys interface (stored in keychain)
 */
export interface ApiKeys {
  anthropicApiKey: string | null
  huggingfaceToken: string | null
}

/**
 * Settings Service
 */
export class SettingsService {
  private settings: AppSettings = { ...DEFAULT_SETTINGS }
  private initialized = false

  /**
   * Initialize the settings service
   * Loads settings from file and migrates from .env if needed
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Load settings from file
      await this.loadSettings()

      // Migrate from .env if this is first run
      await this.migrateFromEnv()

      this.initialized = true
      console.log('[SettingsService] Initialized successfully')
    } catch (error) {
      console.error('[SettingsService] Initialization error:', error)
      throw error
    }
  }

  /**
   * Load settings from JSON file
   */
  private async loadSettings(): Promise<void> {
    const settingsPath = getSettingsPath()

    if (fs.existsSync(settingsPath)) {
      try {
        const data = fs.readFileSync(settingsPath, 'utf-8')
        const loaded = JSON.parse(data)
        // Deep merge with defaults to handle new settings
        this.settings = this.deepMerge(DEFAULT_SETTINGS, loaded)
        console.log('[SettingsService] Loaded settings from file')
      } catch (error) {
        console.error('[SettingsService] Error loading settings, using defaults:', error)
        this.settings = { ...DEFAULT_SETTINGS }
      }
    } else {
      console.log('[SettingsService] No settings file found, using defaults')
      this.settings = { ...DEFAULT_SETTINGS }
    }
  }

  /**
   * Save settings to JSON file
   */
  private async saveSettings(): Promise<void> {
    const settingsPath = getSettingsPath()
    const dir = path.dirname(settingsPath)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2))
    console.log('[SettingsService] Settings saved to file')
  }

  /**
   * Migrate settings from .env file (one-time migration)
   */
  private async migrateFromEnv(): Promise<void> {
    const migrationFlagPath = path.join(path.dirname(getSettingsPath()), '.env-migrated')

    if (fs.existsSync(migrationFlagPath)) {
      return // Already migrated
    }

    console.log('[SettingsService] Checking for .env migration...')

    // Migrate Azure settings
    if (process.env.AZURE_CLIENT_ID && !this.settings.azure.clientId) {
      this.settings.azure.clientId = process.env.AZURE_CLIENT_ID
      this.settings.azure.tenantId = process.env.AZURE_TENANT_ID || 'common'
    }

    // Migrate Anthropic model
    if (process.env.ANTHROPIC_MODEL) {
      this.settings.anthropic.model = process.env.ANTHROPIC_MODEL
    }

    // Migrate Anthropic API key to keychain
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-xxx') {
      await this.setApiKey('anthropic', process.env.ANTHROPIC_API_KEY)
    }

    // Migrate HuggingFace token to keychain
    if (process.env.HUGGINGFACE_TOKEN && process.env.HUGGINGFACE_TOKEN !== 'hf_xxx') {
      await this.setApiKey('huggingface', process.env.HUGGINGFACE_TOKEN)
    }

    // Migrate other settings
    if (process.env.WHISPER_MODEL) {
      const model = process.env.WHISPER_MODEL as AppSettings['transcription']['model']
      if (['tiny', 'base', 'small', 'medium', 'large'].includes(model)) {
        this.settings.transcription.model = model
      }
    }

    if (process.env.EMAIL_BODY_MAX_LENGTH) {
      this.settings.summary.emailBodyMaxLength = parseInt(process.env.EMAIL_BODY_MAX_LENGTH, 10)
    }

    if (process.env.EMAIL_CONTEXT_MAX_COUNT) {
      this.settings.summary.emailContextMaxCount = parseInt(process.env.EMAIL_CONTEXT_MAX_COUNT, 10)
    }

    if (process.env.DATA_RETENTION_DAYS) {
      const days = parseInt(process.env.DATA_RETENTION_DAYS, 10)
      this.settings.dataRetention.transcriptRetentionDays = days
      this.settings.dataRetention.summaryRetentionDays = days
    }

    if (process.env.AUDIO_STORAGE_QUOTA_GB) {
      this.settings.dataRetention.audioStorageQuotaGB = parseInt(process.env.AUDIO_STORAGE_QUOTA_GB, 10)
    }

    if (process.env.KEEP_AUDIO_FILES) {
      this.settings.dataRetention.keepAudioFiles = process.env.KEEP_AUDIO_FILES === 'true'
    }

    // Save migrated settings and mark as migrated
    await this.saveSettings()
    fs.writeFileSync(migrationFlagPath, new Date().toISOString())
    console.log('[SettingsService] Migration from .env completed')
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const result = { ...target }

    for (const key of Object.keys(source) as (keyof T)[]) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(targetValue as object, sourceValue as object) as T[keyof T]
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[keyof T]
      }
    }

    return result
  }

  /**
   * Get all settings
   */
  getSettings(): AppSettings {
    return { ...this.settings }
  }

  /**
   * Get a specific setting category
   */
  getCategory<K extends keyof AppSettings>(category: K): AppSettings[K] {
    return { ...this.settings[category] }
  }

  /**
   * Update settings (partial update)
   */
  async updateSettings(updates: Partial<AppSettings>): Promise<void> {
    this.settings = this.deepMerge(this.settings, updates)
    await this.saveSettings()
    console.log('[SettingsService] Settings updated')
  }

  /**
   * Update a specific category
   */
  async updateCategory<K extends keyof AppSettings>(
    category: K,
    updates: Partial<AppSettings[K]>
  ): Promise<void> {
    this.settings[category] = { ...this.settings[category], ...updates }
    await this.saveSettings()
    console.log(`[SettingsService] Category '${category}' updated`)
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS }
    await this.saveSettings()
    console.log('[SettingsService] Settings reset to defaults')
  }

  // ============================================
  // API Key Management (Secure Keychain Storage)
  // ============================================

  /**
   * Get API key from keychain
   */
  async getApiKey(service: 'anthropic' | 'huggingface'): Promise<string | null> {
    const keychainKey = service === 'anthropic' ? KEYCHAIN_ANTHROPIC_KEY : KEYCHAIN_HUGGINGFACE_KEY

    try {
      const key = await keytar.getPassword(KEYCHAIN_SERVICE, keychainKey)
      return key
    } catch (error) {
      console.error(`[SettingsService] Error getting ${service} API key:`, error)
      return null
    }
  }

  /**
   * Set API key in keychain
   */
  async setApiKey(service: 'anthropic' | 'huggingface', key: string): Promise<void> {
    const keychainKey = service === 'anthropic' ? KEYCHAIN_ANTHROPIC_KEY : KEYCHAIN_HUGGINGFACE_KEY

    try {
      if (key) {
        await keytar.setPassword(KEYCHAIN_SERVICE, keychainKey, key)
        console.log(`[SettingsService] ${service} API key saved to keychain`)
      } else {
        await keytar.deletePassword(KEYCHAIN_SERVICE, keychainKey)
        console.log(`[SettingsService] ${service} API key removed from keychain`)
      }
    } catch (error) {
      console.error(`[SettingsService] Error setting ${service} API key:`, error)
      throw error
    }
  }

  /**
   * Check if API keys are configured
   */
  async getApiKeyStatus(): Promise<{
    anthropic: boolean
    huggingface: boolean
    azure: boolean
  }> {
    const anthropicKey = await this.getApiKey('anthropic')
    const huggingfaceKey = await this.getApiKey('huggingface')

    return {
      anthropic: !!anthropicKey,
      huggingface: !!huggingfaceKey,
      azure: !!this.settings.azure.clientId
    }
  }

  /**
   * Get all API keys (for service initialization)
   */
  async getAllApiKeys(): Promise<ApiKeys> {
    return {
      anthropicApiKey: await this.getApiKey('anthropic'),
      huggingfaceToken: await this.getApiKey('huggingface')
    }
  }

  /**
   * Validate API key format
   */
  validateApiKey(service: 'anthropic' | 'huggingface', key: string): { valid: boolean; error?: string } {
    if (!key || key.trim().length === 0) {
      return { valid: false, error: 'API key cannot be empty' }
    }

    if (service === 'anthropic') {
      if (!key.startsWith('sk-ant-')) {
        return { valid: false, error: 'Anthropic API key must start with "sk-ant-"' }
      }
      if (key.length < 50) {
        return { valid: false, error: 'Anthropic API key appears too short' }
      }
    }

    if (service === 'huggingface') {
      if (!key.startsWith('hf_')) {
        return { valid: false, error: 'HuggingFace token must start with "hf_"' }
      }
    }

    return { valid: true }
  }
}

// Singleton instance
export const settingsService = new SettingsService()
