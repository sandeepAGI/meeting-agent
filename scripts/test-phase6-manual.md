# Phase 6: Manual Testing Script

Run these tests in the app console (DevTools) after starting with `npm run dev`.

## Pre-Test: Open Developer Console

1. Run `npm run dev`
2. Wait for app to open
3. Press `Cmd+Option+I` to open DevTools
4. Go to Console tab

## Test 1: Settings API Available

```javascript
// Check if settings API is exposed
console.log('Settings API:', typeof window.electronAPI.settings)
// Expected: 'object'
```

## Test 2: Get Settings

```javascript
// Get current settings
const result = await window.electronAPI.settings.getSettings()
console.log('Get Settings Result:', result)
// Expected: { success: true, settings: { azure: {...}, transcription: {...}, ... } }
```

## Test 3: Get API Key Status

```javascript
// Check which API keys are configured
const status = await window.electronAPI.settings.getApiKeyStatus()
console.log('API Key Status:', status)
// Expected: { success: true, status: { anthropic: true/false, huggingface: true/false, azure: true/false } }
```

## Test 4: Validate API Key - Valid Anthropic

```javascript
// Test valid Anthropic key format
const valid = await window.electronAPI.settings.validateApiKey('anthropic', 'sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef12')
console.log('Valid Key Result:', valid)
// Expected: { valid: true }
```

## Test 5: Validate API Key - Invalid Anthropic

```javascript
// Test invalid Anthropic key format
const invalid = await window.electronAPI.settings.validateApiKey('anthropic', 'invalid-key')
console.log('Invalid Key Result:', invalid)
// Expected: { valid: false, error: 'Anthropic API key must start with "sk-ant-"' }
```

## Test 6: Update Settings Category

```javascript
// Update transcription model
const update = await window.electronAPI.settings.updateCategory('transcription', { model: 'small' })
console.log('Update Result:', update)
// Expected: { success: true, settings: { transcription: { model: 'small', ... }, ... } }

// Verify it persisted
const verify = await window.electronAPI.settings.getSettings()
console.log('Transcription model:', verify.settings.transcription.model)
// Expected: 'small'
```

## Test 7: Reset to Defaults

```javascript
// Reset all settings
const reset = await window.electronAPI.settings.resetToDefaults()
console.log('Reset Result:', reset)
// Expected: { success: true, settings: { ... with default values } }

// Verify model is back to default
const afterReset = await window.electronAPI.settings.getSettings()
console.log('After reset, model:', afterReset.settings.transcription.model)
// Expected: 'base' (the default)
```

## Test 8: Settings Panel UI

1. Click ⚙️ button in app header
2. Verify panel opens with overlay
3. Click each tab and verify content loads
4. Verify close button works
5. Verify clicking outside closes panel (if implemented)

## Test 9: API Key Save/Remove

1. Open Settings > API Keys tab
2. Enter a test Anthropic key: `sk-ant-api03-test1234567890abcdef1234567890abcdef1234567890test`
3. Click Save
4. Verify success message appears
5. Close and reopen settings
6. Verify "Configured" badge shows
7. Click Remove
8. Verify "Not configured" badge shows

## Test 10: Settings Persistence

1. Make changes in each tab:
   - Transcription: Change model to "medium"
   - Summary: Change verbosity to "concise"
   - Storage: Toggle "Keep audio files"
   - Interface: Change font size to "large"
2. Close settings panel
3. Close the app (Cmd+Q)
4. Restart with `npm run dev`
5. Open settings
6. Verify all changes persisted

## Results Summary

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| 1. Settings API Available | | | |
| 2. Get Settings | | | |
| 3. Get API Key Status | | | |
| 4. Valid API Key | | | |
| 5. Invalid API Key | | | |
| 6. Update Category | | | |
| 7. Reset to Defaults | | | |
| 8. Settings Panel UI | | | |
| 9. API Key Save/Remove | | | |
| 10. Settings Persistence | | | |

## Bugs Found

| # | Test | Description | Severity |
|---|------|-------------|----------|
| | | | |
