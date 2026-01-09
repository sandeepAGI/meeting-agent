/**
 * SettingsPanel Component - Phase 6
 *
 * Main settings UI with tabbed interface for configuring:
 * - API Keys (Anthropic, HuggingFace, Azure)
 * - Transcription (Whisper model, threads)
 * - Summary (verbosity, disclaimer)
 * - Storage (retention, quotas)
 * - UI Preferences (theme, font size)
 * - Audio (microphone, announcement)
 */

import { useState, useEffect } from 'react'
import { useSettings } from '../hooks/useSettings'
import type { SettingsTab } from '../../types/settings'
import {
  WHISPER_MODELS,
  VERBOSITY_OPTIONS,
  RETENTION_OPTIONS,
  THEME_OPTIONS,
  FONT_SIZE_OPTIONS
} from '../../types/settings'
import './SettingsPanel.css'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { state, actions } = useSettings()
  const { settings, apiKeyStatus, isLoading, isSaving, error, activeTab } = state

  // Local state for API key inputs (not stored until saved)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [huggingfaceKey, setHuggingfaceKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [keySaveSuccess, setKeySaveSuccess] = useState<string | null>(null)

  // Phase 7: Storage Dashboard state
  const [storageUsage, setStorageUsage] = useState<{
    audioGB: number
    quotaGB: number
    transcriptCount: number
    summaryCount: number
    recordingCount: number
    oldestTranscriptDays: number
    oldestSummaryDays: number
    transcriptRetentionDays: number
    summaryRetentionDays: number
  } | null>(null)
  const [isLoadingStorage, setIsLoadingStorage] = useState(false)
  const [isRunningCleanup, setIsRunningCleanup] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{
    deletedTranscripts: number;
    deletedSummaries: number;
    deletedAudioFiles: number;
    deletedAudioMB: number;
  } | null>(null)

  // Load storage usage when storage tab is active
  useEffect(() => {
    if (activeTab === 'storage') {
      loadStorageUsage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const loadStorageUsage = async () => {
    setIsLoadingStorage(true)
    try {
      const result = await window.electronAPI.storage.getUsage()
      if (result.success && result.usage) {
        setStorageUsage(result.usage)
      }
    } catch (err) {
      console.error('Failed to load storage usage:', err)
    } finally {
      setIsLoadingStorage(false)
    }
  }

  const handleRunCleanup = async () => {
    setIsRunningCleanup(true)
    setCleanupResult(null)
    try {
      const result = await window.electronAPI.storage.runCleanupNow()
      if (result.success && result.result) {
        setCleanupResult(result.result)
        // Refresh usage stats
        await loadStorageUsage()
      }
    } catch (err) {
      console.error('Cleanup failed:', err)
    } finally {
      setIsRunningCleanup(false)
    }
  }

  if (isLoading) {
    return (
      <div className="settings-panel">
        <div className="settings-loading">Loading settings...</div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="settings-panel">
        <div className="settings-error">Failed to load settings</div>
      </div>
    )
  }

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'api', label: 'API Keys', icon: '🔑' },
    { id: 'transcription', label: 'Transcription', icon: '🎤' },
    { id: 'summary', label: 'Summary', icon: '📝' },
    { id: 'storage', label: 'Storage', icon: '💾' },
    { id: 'ui', label: 'Interface', icon: '🎨' },
    { id: 'audio', label: 'Audio', icon: '🔊' },
    { id: 'email', label: 'Email', icon: '📧' }
  ]

  // Handle click on overlay to close
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleSaveApiKey = async (service: 'anthropic' | 'huggingface') => {
    const key = service === 'anthropic' ? anthropicKey : huggingfaceKey
    setKeyError(null)
    setKeySaveSuccess(null)

    // Validate first
    const validation = await actions.validateApiKey(service, key)
    if (!validation.valid) {
      setKeyError(validation.error || 'Invalid API key')
      return
    }

    // Save the key
    const result = await actions.setApiKey(service, key)
    if (result.success) {
      setKeySaveSuccess(`${service === 'anthropic' ? 'Anthropic' : 'HuggingFace'} API key saved successfully!`)
      // Clear the input after saving
      if (service === 'anthropic') {
        setAnthropicKey('')
      } else {
        setHuggingfaceKey('')
      }
      // Clear success message after 3 seconds
      setTimeout(() => setKeySaveSuccess(null), 3000)
    } else {
      setKeyError(result.error || 'Failed to save API key')
    }
  }

  const handleRemoveApiKey = async (service: 'anthropic' | 'huggingface') => {
    setKeyError(null)
    setKeySaveSuccess(null)

    const result = await actions.setApiKey(service, '')
    if (result.success) {
      setKeySaveSuccess(`${service === 'anthropic' ? 'Anthropic' : 'HuggingFace'} API key removed`)
      setTimeout(() => setKeySaveSuccess(null), 3000)
    } else {
      setKeyError(result.error || 'Failed to remove API key')
    }
  }

  return (
    <div className="settings-panel" onClick={handleOverlayClick}>
      <div className="settings-container">
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="settings-close-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {error && (
          <div className="settings-error-banner">
            {error}
            <button onClick={actions.clearError}>Dismiss</button>
          </div>
        )}

        <div className="settings-content">
        {/* Tab Navigation */}
        <div className="settings-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => actions.setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="settings-tab-content">
          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <div className="settings-section">
              <h3>API Keys</h3>
              <p className="settings-description">
                API keys are stored securely in your system keychain.
              </p>

              {keyError && <div className="settings-field-error">{keyError}</div>}
              {keySaveSuccess && <div className="settings-field-success">{keySaveSuccess}</div>}

              {/* Anthropic API Key */}
              <div className="settings-field">
                <label>
                  Anthropic API Key
                  {apiKeyStatus?.anthropic && <span className="key-status configured">✓ Configured</span>}
                  {!apiKeyStatus?.anthropic && <span className="key-status not-configured">Not configured</span>}
                </label>
                <div className="api-key-input-group">
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder={apiKeyStatus?.anthropic ? '••••••••••••••••' : 'sk-ant-...'}
                  />
                  <button
                    onClick={() => handleSaveApiKey('anthropic')}
                    disabled={!anthropicKey || isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  {apiKeyStatus?.anthropic && (
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveApiKey('anthropic')}
                      disabled={isSaving}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <span className="settings-hint">
                  Required for AI summarization. Get your key from{' '}
                  <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
                    console.anthropic.com
                  </a>
                </span>
              </div>

              {/* HuggingFace Token */}
              <div className="settings-field">
                <label>
                  HuggingFace Token
                  {apiKeyStatus?.huggingface && <span className="key-status configured">✓ Configured</span>}
                  {!apiKeyStatus?.huggingface && <span className="key-status not-configured">Not configured</span>}
                </label>
                <div className="api-key-input-group">
                  <input
                    type="password"
                    value={huggingfaceKey}
                    onChange={(e) => setHuggingfaceKey(e.target.value)}
                    placeholder={apiKeyStatus?.huggingface ? '••••••••••••••••' : 'hf_...'}
                  />
                  <button
                    onClick={() => handleSaveApiKey('huggingface')}
                    disabled={!huggingfaceKey || isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  {apiKeyStatus?.huggingface && (
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveApiKey('huggingface')}
                      disabled={isSaving}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <span className="settings-hint">
                  Required for speaker diarization. Get your token from{' '}
                  <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer">
                    huggingface.co/settings/tokens
                  </a>
                </span>
              </div>

              {/* Azure Configuration */}
              <div className="settings-field">
                <label>
                  Azure Client ID
                  {apiKeyStatus?.azure && <span className="key-status configured">✓ Configured</span>}
                  {!apiKeyStatus?.azure && <span className="key-status not-configured">Not configured</span>}
                </label>
                <input
                  type="text"
                  value={settings.azure.clientId}
                  onChange={(e) =>
                    actions.updateCategory('azure', { clientId: e.target.value })
                  }
                  placeholder="Your Azure AD Client ID"
                />
                <span className="settings-hint">Required for Microsoft 365 integration</span>
              </div>

              <div className="settings-field">
                <label>Azure Tenant ID</label>
                <input
                  type="text"
                  value={settings.azure.tenantId}
                  onChange={(e) =>
                    actions.updateCategory('azure', { tenantId: e.target.value })
                  }
                  placeholder="common"
                />
                <span className="settings-hint">Use &quot;common&quot; for multi-tenant apps</span>
              </div>

              {/* Anthropic Model */}
              <div className="settings-field">
                <label>Anthropic Model</label>
                <input
                  type="text"
                  value={settings.anthropic.model}
                  onChange={(e) =>
                    actions.updateCategory('anthropic', { model: e.target.value })
                  }
                  placeholder="claude-sonnet-4-20250514"
                />
                <span className="settings-hint">Model used for AI summarization</span>
              </div>
            </div>
          )}

          {/* Transcription Tab */}
          {activeTab === 'transcription' && (
            <div className="settings-section">
              <h3>Transcription Settings</h3>

              {/* DISABLED: Model selection requires proper download UX (Phase 9)
                  Current model: base (141 MB) - hard-coded until Phase 9
                  Issue: Changing to large (3 GB) would block app startup for 10+ minutes
                  with no progress indicator. See Phase 9 roadmap for proper implementation.
              <div className="settings-field">
                <label>Whisper Model</label>
                <select
                  value={settings.transcription.model}
                  onChange={(e) =>
                    actions.updateCategory('transcription', {
                      model: e.target.value as typeof settings.transcription.model
                    })
                  }
                >
                  {WHISPER_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label} - {model.description}
                    </option>
                  ))}
                </select>
                <span className="settings-hint">
                  Larger models are more accurate but slower. Base is recommended for most users.
                </span>
              </div>
              */}

              <div className="settings-field">
                <label>CPU Threads</label>
                <input
                  type="number"
                  min="0"
                  max="32"
                  value={settings.transcription.threads}
                  onChange={(e) =>
                    actions.updateCategory('transcription', {
                      threads: parseInt(e.target.value, 10) || 0
                    })
                  }
                />
                <span className="settings-hint">
                  Controls transcription speed vs CPU usage. 0 = auto (recommended). Increase for faster processing, decrease to preserve CPU for other tasks.
                </span>
              </div>

              <div className="settings-field">
                <label>Language</label>
                <select
                  value={settings.transcription.language}
                  onChange={(e) =>
                    actions.updateCategory('transcription', { language: e.target.value })
                  }
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                  <option value="auto">Auto-detect</option>
                </select>
                <span className="settings-hint">
                  Language for transcription. Auto-detect may be slower.
                </span>
              </div>
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="settings-section">
              <h3>Summary Settings</h3>

              <div className="settings-field">
                <label>Summary Verbosity</label>
                <select
                  value={settings.summary.verbosity}
                  onChange={(e) =>
                    actions.updateCategory('summary', {
                      verbosity: e.target.value as typeof settings.summary.verbosity
                    })
                  }
                >
                  {VERBOSITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label>Custom AI Disclaimer</label>
                <textarea
                  value={settings.summary.customDisclaimer || ''}
                  onChange={(e) =>
                    actions.updateCategory('summary', {
                      customDisclaimer: e.target.value || null
                    })
                  }
                  placeholder="Leave empty to use default disclaimer"
                  rows={3}
                />
                <span className="settings-hint">
                  Custom disclaimer added to all AI-generated emails. Leave empty for default.
                </span>
              </div>

            </div>
          )}

          {/* Storage Tab */}
          {activeTab === 'storage' && (
            <div className="settings-section">
              <h3>Data Retention Settings</h3>

              <div className="settings-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.dataRetention.keepAudioFiles}
                    onChange={(e) =>
                      actions.updateCategory('dataRetention', {
                        keepAudioFiles: e.target.checked
                      })
                    }
                  />
                  Keep audio files after transcription
                </label>
                <span className="settings-hint">
                  When disabled, audio files are deleted after transcription completes.
                </span>
              </div>

              {settings.dataRetention.keepAudioFiles && (
                <div className="settings-field">
                  <label>Audio Storage Quota (GB)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.dataRetention.audioStorageQuotaGB}
                    onChange={(e) =>
                      actions.updateCategory('dataRetention', {
                        audioStorageQuotaGB: parseInt(e.target.value, 10) || 5
                      })
                    }
                  />
                  <span className="settings-hint">
                    Maximum disk space for audio files (1-10 GB). Oldest files deleted when exceeded.
                  </span>
                </div>
              )}

              <div className="settings-field">
                <label>Transcript Retention</label>
                <select
                  value={settings.dataRetention.transcriptRetentionDays}
                  onChange={(e) =>
                    actions.updateCategory('dataRetention', {
                      transcriptRetentionDays: parseInt(e.target.value, 10)
                    })
                  }
                >
                  {RETENTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label>Summary Retention</label>
                <select
                  value={settings.dataRetention.summaryRetentionDays}
                  onChange={(e) =>
                    actions.updateCategory('dataRetention', {
                      summaryRetentionDays: parseInt(e.target.value, 10)
                    })
                  }
                >
                  {RETENTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="storage-dashboard">
                <h3>Storage Usage</h3>
                {isLoadingStorage ? (
                  <div className="storage-loading">Loading storage stats...</div>
                ) : storageUsage ? (
                  <>
                    <div className="storage-stats">
                      <div className="storage-stat-card">
                        <div className="storage-stat-label">Audio Files</div>
                        <div className="storage-stat-value">
                          {storageUsage.audioGB.toFixed(2)} GB / {storageUsage.quotaGB} GB
                        </div>
                        <div className="storage-progress-bar">
                          <div
                            className="storage-progress-fill"
                            style={{
                              width: `${storageUsage.quotaGB > 0 ? Math.min((storageUsage.audioGB / storageUsage.quotaGB) * 100, 100) : 0}%`,
                              backgroundColor:
                                storageUsage.audioGB > storageUsage.quotaGB * 0.9
                                  ? '#ff4444'
                                  : storageUsage.audioGB > storageUsage.quotaGB * 0.7
                                  ? '#ffaa00'
                                  : '#44ff44'
                            }}
                          />
                        </div>
                        <div className="storage-stat-detail">
                          {storageUsage.recordingCount} recording{storageUsage.recordingCount !== 1 ? 's' : ''}
                        </div>
                      </div>

                      <div className="storage-stat-card">
                        <div className="storage-stat-label">Transcripts</div>
                        <div className="storage-stat-value">{storageUsage.transcriptCount}</div>
                        <div className="storage-stat-detail">
                          Oldest: {storageUsage.oldestTranscriptDays} day
                          {storageUsage.oldestTranscriptDays !== 1 ? 's' : ''} ago
                        </div>
                        <div className="storage-stat-detail">
                          Retention: {storageUsage.transcriptRetentionDays === 0 ? 'Forever' : `${storageUsage.transcriptRetentionDays} days`}
                        </div>
                      </div>

                      <div className="storage-stat-card">
                        <div className="storage-stat-label">Summaries</div>
                        <div className="storage-stat-value">{storageUsage.summaryCount}</div>
                        <div className="storage-stat-detail">
                          Oldest: {storageUsage.oldestSummaryDays} day
                          {storageUsage.oldestSummaryDays !== 1 ? 's' : ''} ago
                        </div>
                        <div className="storage-stat-detail">
                          Retention: {storageUsage.summaryRetentionDays === 0 ? 'Forever' : `${storageUsage.summaryRetentionDays} days`}
                        </div>
                      </div>
                    </div>

                    <div className="storage-actions">
                      <button
                        className="cleanup-button"
                        onClick={handleRunCleanup}
                        disabled={isRunningCleanup}
                      >
                        {isRunningCleanup ? 'Running Cleanup...' : 'Run Cleanup Now'}
                      </button>
                      {cleanupResult && (
                        <div className="cleanup-result">
                          Cleanup complete: {cleanupResult.deletedTranscripts} transcript
                          {cleanupResult.deletedTranscripts !== 1 ? 's' : ''},{' '}
                          {cleanupResult.deletedSummaries} summar
                          {cleanupResult.deletedSummaries !== 1 ? 'ies' : 'y'},{' '}
                          {cleanupResult.deletedAudioFiles} audio file
                          {cleanupResult.deletedAudioFiles !== 1 ? 's' : ''}{' '}
                          ({cleanupResult.deletedAudioMB?.toFixed(1) || 0} MB) deleted
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="storage-error">Failed to load storage stats</div>
                )}
              </div>
            </div>
          )}

          {/* UI Tab */}
          {activeTab === 'ui' && (
            <div className="settings-section">
              <h3>Interface Preferences</h3>

              <div className="settings-field">
                <label>Theme</label>
                <select
                  value={settings.ui.theme}
                  onChange={(e) =>
                    actions.updateCategory('ui', {
                      theme: e.target.value as typeof settings.ui.theme
                    })
                  }
                >
                  {THEME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="settings-hint">Dark theme coming in a future update</span>
              </div>

              <div className="settings-field">
                <label>Font Size</label>
                <select
                  value={settings.ui.fontSize}
                  onChange={(e) =>
                    actions.updateCategory('ui', {
                      fontSize: e.target.value as typeof settings.ui.fontSize
                    })
                  }
                >
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-field">
                <label>Default View</label>
                <select
                  value={settings.ui.defaultView}
                  onChange={(e) =>
                    actions.updateCategory('ui', {
                      defaultView: e.target.value as typeof settings.ui.defaultView
                    })
                  }
                >
                  <option value="generate">Generate (New Summaries)</option>
                  <option value="browse">Browse (Past Recordings)</option>
                </select>
              </div>

              <div className="settings-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.ui.showRecordingAnnouncement}
                    onChange={(e) =>
                      actions.updateCategory('ui', {
                        showRecordingAnnouncement: e.target.checked
                      })
                    }
                  />
                  Show recording announcement status
                </label>
              </div>
            </div>
          )}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <div className="settings-section">
              <h3>Audio Settings</h3>

              <div className="settings-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.audio.includeMicrophone}
                    onChange={(e) =>
                      actions.updateCategory('audio', {
                        includeMicrophone: e.target.checked
                      })
                    }
                  />
                  Include microphone audio
                </label>
                <span className="settings-hint">
                  Capture your voice along with system audio
                </span>
              </div>

              <div className="settings-field">
                <label>Recording Announcement Text</label>
                <textarea
                  value={settings.audio.announcementText}
                  onChange={(e) =>
                    actions.updateCategory('audio', {
                      announcementText: e.target.value
                    })
                  }
                  rows={3}
                />
                <span className="settings-hint">
                  This message is spoken when recording starts to inform participants.
                </span>
              </div>
            </div>
          )}

          {/* Email Settings Tab */}
          {activeTab === 'email' && (
            <div className="settings-section">
              <h3>Email Settings</h3>

              <div className="settings-field">
                <label>Email Provider</label>
                <select
                  value={settings.email.provider}
                  onChange={(e) =>
                    actions.updateCategory('email', {
                      provider: e.target.value as 'm365' | 'gmail'
                    })
                  }
                >
                  <option value="m365">Microsoft 365 (Graph API)</option>
                  <option value="gmail">Gmail (Google API)</option>
                </select>
                <span className="settings-hint">
                  Select which email service to use for sending meeting summaries
                </span>
              </div>

              {settings.email.provider === 'gmail' && (
                <div className="settings-field">
                  <label>Google Credentials Path</label>
                  <input
                    type="text"
                    value={settings.email.googleCredentialsPath || ''}
                    onChange={(e) =>
                      actions.updateCategory('email', {
                        googleCredentialsPath: e.target.value || null
                      })
                    }
                    placeholder="/path/to/credentials.json"
                  />
                  <span className="settings-hint">
                    Absolute path to your Google OAuth2 credentials JSON file. Required for Gmail.
                  </span>
                </div>
              )}

              {settings.email.provider === 'm365' && (
                <div className="settings-info">
                  <p>
                    Microsoft 365 email uses your Azure credentials configured in the API Keys tab.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

        {/* Footer */}
        <div className="settings-footer">
          <button
            className="reset-btn"
            onClick={async () => {
              if (confirm('Reset all settings to defaults? This cannot be undone.')) {
                await actions.resetToDefaults()
              }
            }}
            disabled={isSaving}
          >
            Reset to Defaults
          </button>
          <button className="close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
