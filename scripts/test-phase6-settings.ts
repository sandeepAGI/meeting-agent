#!/usr/bin/env npx ts-node
/**
 * Phase 6: Settings Service Integration Tests
 *
 * Tests the SettingsService in isolation before UI integration.
 * Run with: npx ts-node scripts/test-phase6-settings.ts
 */

import { settingsService, DEFAULT_SETTINGS, AppSettings } from '../src/services/settings'
import * as keytar from 'keytar'
import * as fs from 'fs'
import * as path from 'path'

const KEYCHAIN_SERVICE = 'meeting-agent'
const KEYCHAIN_ANTHROPIC_KEY = 'anthropic-api-key'
const KEYCHAIN_HUGGINGFACE_KEY = 'huggingface-token'

// Test results tracking
interface TestResult {
  name: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn()
      results.push({ name, passed: true })
      console.log(`✅ PASS: ${name}`)
    } catch (error) {
      results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) })
      console.log(`❌ FAIL: ${name}`)
      console.log(`   Error: ${error instanceof Error ? error.message : error}`)
    }
  }
}

// ============================================
// Settings Service Tests
// ============================================

async function runTests() {
  console.log('\n========================================')
  console.log('Phase 6: Settings Service Integration Tests')
  console.log('========================================\n')

  // Test 1: Service initialization
  await test('Settings service initializes without error', async () => {
    await settingsService.initialize()
  })()

  // Test 2: Get default settings
  await test('getSettings returns valid settings object', () => {
    const settings = settingsService.getSettings()
    if (!settings) throw new Error('Settings is null')
    if (!settings.azure) throw new Error('Missing azure settings')
    if (!settings.transcription) throw new Error('Missing transcription settings')
    if (!settings.summary) throw new Error('Missing summary settings')
    if (!settings.dataRetention) throw new Error('Missing dataRetention settings')
    if (!settings.ui) throw new Error('Missing ui settings')
    if (!settings.audio) throw new Error('Missing audio settings')
  })()

  // Test 3: Get category
  await test('getCategory returns correct category', () => {
    const transcription = settingsService.getCategory('transcription')
    if (!transcription.model) throw new Error('Missing model in transcription')
    if (typeof transcription.threads !== 'number') throw new Error('threads should be a number')
  })()

  // Test 4: Update settings
  await test('updateSettings updates and persists settings', async () => {
    const originalSettings = settingsService.getSettings()
    const newModel = originalSettings.transcription.model === 'base' ? 'small' : 'base'

    await settingsService.updateSettings({
      transcription: { ...originalSettings.transcription, model: newModel }
    })

    const updatedSettings = settingsService.getSettings()
    if (updatedSettings.transcription.model !== newModel) {
      throw new Error(`Model not updated: expected ${newModel}, got ${updatedSettings.transcription.model}`)
    }

    // Restore original
    await settingsService.updateSettings({
      transcription: { ...originalSettings.transcription }
    })
  })()

  // Test 5: Update category
  await test('updateCategory updates single category', async () => {
    const originalVerbosity = settingsService.getCategory('summary').verbosity
    const newVerbosity = originalVerbosity === 'detailed' ? 'concise' : 'detailed'

    await settingsService.updateCategory('summary', { verbosity: newVerbosity })

    const updated = settingsService.getCategory('summary')
    if (updated.verbosity !== newVerbosity) {
      throw new Error(`Verbosity not updated: expected ${newVerbosity}, got ${updated.verbosity}`)
    }

    // Restore
    await settingsService.updateCategory('summary', { verbosity: originalVerbosity })
  })()

  // Test 6: API key validation - Anthropic
  await test('validateApiKey validates Anthropic key format', () => {
    const validKey = 'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef12'
    const invalidKey1 = 'invalid-key'
    const invalidKey2 = 'sk-ant-short'
    const emptyKey = ''

    const validResult = settingsService.validateApiKey('anthropic', validKey)
    if (!validResult.valid) throw new Error(`Valid key rejected: ${validResult.error}`)

    const invalidResult1 = settingsService.validateApiKey('anthropic', invalidKey1)
    if (invalidResult1.valid) throw new Error('Invalid key accepted (no prefix)')

    const invalidResult2 = settingsService.validateApiKey('anthropic', invalidKey2)
    if (invalidResult2.valid) throw new Error('Invalid key accepted (too short)')

    const emptyResult = settingsService.validateApiKey('anthropic', emptyKey)
    if (emptyResult.valid) throw new Error('Empty key accepted')
  })()

  // Test 7: API key validation - HuggingFace
  await test('validateApiKey validates HuggingFace token format', () => {
    const validToken = 'hf_abcdefghijklmnop'
    const invalidToken = 'invalid-token'

    const validResult = settingsService.validateApiKey('huggingface', validToken)
    if (!validResult.valid) throw new Error(`Valid token rejected: ${validResult.error}`)

    const invalidResult = settingsService.validateApiKey('huggingface', invalidToken)
    if (invalidResult.valid) throw new Error('Invalid token accepted')
  })()

  // Test 8: API key status
  await test('getApiKeyStatus returns status object', async () => {
    const status = await settingsService.getApiKeyStatus()
    if (typeof status.anthropic !== 'boolean') throw new Error('anthropic status should be boolean')
    if (typeof status.huggingface !== 'boolean') throw new Error('huggingface status should be boolean')
    if (typeof status.azure !== 'boolean') throw new Error('azure status should be boolean')
  })()

  // Test 9: Deep merge preserves unmodified settings
  await test('updateSettings preserves unmodified nested settings', async () => {
    const original = settingsService.getSettings()
    const originalAudioAnnouncement = original.audio.announcementText

    // Update only UI settings
    await settingsService.updateSettings({
      ui: { ...original.ui, fontSize: 'large' }
    })

    const updated = settingsService.getSettings()
    if (updated.audio.announcementText !== originalAudioAnnouncement) {
      throw new Error('Audio announcement was modified when it should not have been')
    }

    // Restore
    await settingsService.updateSettings({ ui: { ...original.ui } })
  })()

  // Test 10: Reset to defaults
  await test('resetToDefaults restores default settings', async () => {
    // Make a change
    await settingsService.updateCategory('transcription', { model: 'large' })

    // Reset
    await settingsService.resetToDefaults()

    const settings = settingsService.getSettings()
    if (settings.transcription.model !== DEFAULT_SETTINGS.transcription.model) {
      throw new Error(`Reset failed: expected ${DEFAULT_SETTINGS.transcription.model}, got ${settings.transcription.model}`)
    }
  })()

  // ============================================
  // Keychain Tests (Optional - requires keychain access)
  // ============================================

  console.log('\n--- Keychain Tests (may require password prompt) ---\n')

  // Test 11: Set and get API key
  await test('setApiKey and getApiKey work with keychain', async () => {
    const testKey = 'sk-ant-api03-test1234567890abcdef1234567890abcdef1234567890test'

    // Save key
    await settingsService.setApiKey('anthropic', testKey)

    // Retrieve key
    const retrievedKey = await settingsService.getApiKey('anthropic')
    if (retrievedKey !== testKey) {
      throw new Error(`Key mismatch: expected ${testKey}, got ${retrievedKey}`)
    }

    // Clean up - remove test key
    await settingsService.setApiKey('anthropic', '')

    const afterDelete = await settingsService.getApiKey('anthropic')
    if (afterDelete !== null) {
      throw new Error('Key was not deleted from keychain')
    }
  })()

  // ============================================
  // Print Summary
  // ============================================

  console.log('\n========================================')
  console.log('Test Summary')
  console.log('========================================')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`\nTotal: ${results.length} tests`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)

  if (failed > 0) {
    console.log('\n❌ Failed Tests:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`)
    })
    process.exit(1)
  } else {
    console.log('\n✅ All tests passed!')
    process.exit(0)
  }
}

// Run tests
runTests().catch(err => {
  console.error('Test runner error:', err)
  process.exit(1)
})
