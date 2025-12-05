/**
 * useSettings Hook - Phase 6
 *
 * React hook for managing application settings in the renderer process.
 */

import { useState, useEffect, useCallback } from 'react'
import type { AppSettings, ApiKeyStatus, SettingsTab } from '../../types/settings'

interface SettingsState {
  settings: AppSettings | null
  apiKeyStatus: ApiKeyStatus | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  activeTab: SettingsTab
}

interface SettingsActions {
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  updateCategory: <K extends keyof AppSettings>(
    category: K,
    updates: Partial<AppSettings[K]>
  ) => Promise<void>
  setApiKey: (service: 'anthropic' | 'huggingface', key: string) => Promise<{ success: boolean; error?: string }>
  validateApiKey: (service: 'anthropic' | 'huggingface', key: string) => Promise<{ valid: boolean; error?: string }>
  resetToDefaults: () => Promise<void>
  setActiveTab: (tab: SettingsTab) => void
  clearError: () => void
}

export function useSettings(): { state: SettingsState; actions: SettingsActions } {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('api')

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.settings.getSettings()
      if (result.success && result.settings) {
        setSettings(result.settings)
      } else {
        setError(result.error || 'Failed to load settings')
      }

      // Also load API key status
      const statusResult = await window.electronAPI.settings.getApiKeyStatus()
      if (statusResult.success && statusResult.status) {
        setApiKeyStatus(statusResult.status)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Update settings
  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    setIsSaving(true)
    setError(null)

    try {
      const result = await window.electronAPI.settings.updateSettings(updates)
      if (result.success && result.settings) {
        setSettings(result.settings)
      } else {
        setError(result.error || 'Failed to update settings')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
    } finally {
      setIsSaving(false)
    }
  }, [])

  // Update a specific category
  const updateCategory = useCallback(
    async <K extends keyof AppSettings>(category: K, updates: Partial<AppSettings[K]>) => {
      setIsSaving(true)
      setError(null)

      try {
        const result = await window.electronAPI.settings.updateCategory(category, updates)
        if (result.success && result.settings) {
          setSettings(result.settings)
        } else {
          setError(result.error || 'Failed to update settings')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update settings')
      } finally {
        setIsSaving(false)
      }
    },
    []
  )

  // Set API key
  const setApiKey = useCallback(
    async (
      service: 'anthropic' | 'huggingface',
      key: string
    ): Promise<{ success: boolean; error?: string }> => {
      setIsSaving(true)
      setError(null)

      try {
        const result = await window.electronAPI.settings.setApiKey(service, key)
        if (result.success) {
          // Refresh API key status
          const statusResult = await window.electronAPI.settings.getApiKeyStatus()
          if (statusResult.success && statusResult.status) {
            setApiKeyStatus(statusResult.status)
          }
          return { success: true }
        } else {
          setError(result.error || 'Failed to save API key')
          return { success: false, error: result.error }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to save API key'
        setError(errorMsg)
        return { success: false, error: errorMsg }
      } finally {
        setIsSaving(false)
      }
    },
    []
  )

  // Validate API key format
  const validateApiKey = useCallback(
    async (
      service: 'anthropic' | 'huggingface',
      key: string
    ): Promise<{ valid: boolean; error?: string }> => {
      try {
        const result = await window.electronAPI.settings.validateApiKey(service, key)
        return result
      } catch {
        return { valid: false, error: 'Validation failed' }
      }
    },
    []
  )

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      const result = await window.electronAPI.settings.resetToDefaults()
      if (result.success && result.settings) {
        setSettings(result.settings)
      } else {
        setError(result.error || 'Failed to reset settings')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings')
    } finally {
      setIsSaving(false)
    }
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    state: {
      settings,
      apiKeyStatus,
      isLoading,
      isSaving,
      error,
      activeTab
    },
    actions: {
      loadSettings,
      updateSettings,
      updateCategory,
      setApiKey,
      validateApiKey,
      resetToDefaults,
      setActiveTab,
      clearError
    }
  }
}
