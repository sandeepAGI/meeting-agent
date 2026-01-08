/**
 * Settings Types - Phase 6
 *
 * Shared type definitions for settings between main and renderer processes.
 */

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
 * API key status
 */
export interface ApiKeyStatus {
  anthropic: boolean
  huggingface: boolean
  azure: boolean
}

/**
 * Settings tab types for UI
 */
export type SettingsTab = 'api' | 'transcription' | 'summary' | 'storage' | 'ui' | 'audio' | 'email'

/**
 * Whisper model options with descriptions
 */
export const WHISPER_MODELS = [
  { value: 'tiny', label: 'Tiny', description: 'Fastest, lowest accuracy (~75MB)' },
  { value: 'base', label: 'Base', description: 'Fast, good accuracy (~150MB)' },
  { value: 'small', label: 'Small', description: 'Balanced speed/accuracy (~500MB)' },
  { value: 'medium', label: 'Medium', description: 'Slower, high accuracy (~1.5GB)' },
  { value: 'large', label: 'Large', description: 'Slowest, best accuracy (~3GB)' }
] as const

/**
 * Summary verbosity options
 */
export const VERBOSITY_OPTIONS = [
  { value: 'concise', label: 'Concise', description: 'Brief summary with key points only' },
  { value: 'detailed', label: 'Detailed', description: 'Comprehensive summary with context' },
  { value: 'comprehensive', label: 'Comprehensive', description: 'Full summary with all details' }
] as const

/**
 * Data retention period options
 */
export const RETENTION_OPTIONS = [
  { value: 0, label: 'Forever', description: 'Keep indefinitely' },
  { value: 30, label: '30 Days', description: 'Delete after 30 days' },
  { value: 60, label: '60 Days', description: 'Delete after 60 days' },
  { value: 90, label: '90 Days', description: 'Delete after 90 days' }
] as const

/**
 * Theme options
 */
export const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
] as const

/**
 * Font size options
 */
export const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
] as const
