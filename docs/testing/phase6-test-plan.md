# Phase 6: Settings - Test Plan

## Overview

This document outlines the testing requirements for Phase 6 (Configuration & Settings).

## Test Levels

### Level 1: Static Analysis (Automated)

```bash
npm run type-check  # TypeScript compilation
npm run build       # Production build
```

**Status**: [ ] Pass / [ ] Fail

### Level 2: Unit/Integration Tests (Automated)

```bash
npx ts-node scripts/test-phase6-settings.ts
```

**Test Cases**:
- [ ] Settings service initializes without error
- [ ] getSettings returns valid settings object
- [ ] getCategory returns correct category
- [ ] updateSettings updates and persists settings
- [ ] updateCategory updates single category
- [ ] validateApiKey validates Anthropic key format
- [ ] validateApiKey validates HuggingFace token format
- [ ] getApiKeyStatus returns status object
- [ ] updateSettings preserves unmodified nested settings
- [ ] resetToDefaults restores default settings
- [ ] setApiKey and getApiKey work with keychain

### Level 3: Manual UI Testing

#### Pre-requisites
```bash
npm run dev
```

#### Settings Panel Access
- [ ] ⚙️ Settings button visible in app header
- [ ] Settings button hover state works
- [ ] Click opens settings panel overlay
- [ ] Panel has dark overlay background
- [ ] Panel is centered and properly sized
- [ ] Close (✕) button closes panel
- [ ] ESC key closes panel (if implemented)

#### Tab Navigation
- [ ] All 6 tabs visible: API Keys, Transcription, Summary, Storage, Interface, Audio
- [ ] Clicking tab switches content
- [ ] Active tab is visually highlighted
- [ ] Tab icons display correctly

#### API Keys Tab
- [ ] Anthropic API key input field works
- [ ] Anthropic key shows "Configured" badge when set
- [ ] Anthropic key shows "Not configured" badge when empty
- [ ] Save button validates key format before saving
- [ ] Invalid key shows error message
- [ ] Valid key saves successfully (success message)
- [ ] Remove button clears the key
- [ ] HuggingFace token input works
- [ ] HuggingFace validation works
- [ ] Azure Client ID field saves
- [ ] Azure Tenant ID field saves
- [ ] Anthropic Model field saves

#### Transcription Tab
- [ ] Whisper model dropdown shows all options (tiny/base/small/medium/large)
- [ ] Model selection persists after closing/reopening settings
- [ ] CPU threads input accepts numbers
- [ ] CPU threads 0 shows as "auto-detect"
- [ ] Language dropdown works

#### Summary Tab
- [ ] Verbosity dropdown shows all options
- [ ] Custom disclaimer textarea accepts text
- [ ] Empty disclaimer uses default
- [ ] Email body max length accepts numbers
- [ ] Email context max count accepts numbers

#### Storage Tab
- [ ] "Keep audio files" checkbox toggles
- [ ] Audio storage quota slider/input works (1-10 GB)
- [ ] Quota field only shows when keep audio is enabled
- [ ] Transcript retention dropdown works
- [ ] Summary retention dropdown works

#### Interface Tab
- [ ] Theme dropdown shows options
- [ ] Font size dropdown works
- [ ] Default view dropdown works
- [ ] Recording announcement toggle works

#### Audio Tab
- [ ] Include microphone checkbox works
- [ ] Announcement text textarea accepts input
- [ ] Long announcement text displays correctly

#### Settings Persistence
- [ ] Close settings panel
- [ ] Reopen settings panel
- [ ] All values are preserved
- [ ] Close and restart app (`npm run dev`)
- [ ] Open settings - values still preserved

#### Reset to Defaults
- [ ] Make several changes across tabs
- [ ] Click "Reset to Defaults" button
- [ ] Confirmation dialog appears
- [ ] Confirm resets all settings
- [ ] API keys are NOT reset (stored in keychain)
- [ ] Cancel does not reset

#### Error Handling
- [ ] Invalid API key shows error message
- [ ] Network error shows user-friendly message
- [ ] Save failure keeps editing mode open

### Level 4: Regression Testing

After Phase 6 changes, verify existing features still work:

#### Audio Recording (Phase 1)
- [ ] Initialize Audio button works
- [ ] Start Recording works
- [ ] Audio level meter displays
- [ ] Stop Recording creates file
- [ ] Deinitialize works

#### Transcription (Phase 1.2)
- [ ] Transcribe button works
- [ ] Progress indicator displays
- [ ] Transcript appears after completion
- [ ] Speaker labels shown

#### M365 Auth (Phase 2.1)
- [ ] Login button works
- [ ] Auth popup appears
- [ ] User info displays after login
- [ ] Logout works

#### Calendar (Phase 2.2)
- [ ] Today's meetings load
- [ ] Meeting details display correctly
- [ ] Refresh button works

#### Meeting Intelligence (Phase 2.3)
- [ ] Can select recording for summarization
- [ ] Summary generation starts
- [ ] Summary displays correctly
- [ ] Export works

#### Email Distribution (Phase 5)
- [ ] Recipient selector works
- [ ] Email preview displays
- [ ] Send button works (if authenticated)

#### Browse Mode (Phase 4)
- [ ] Mode toggle works
- [ ] Past recordings list loads
- [ ] Can view transcript
- [ ] Can view summary

## Test Results

### Date: ___________
### Tester: ___________

| Category | Pass | Fail | Notes |
|----------|------|------|-------|
| Level 1: Static Analysis | | | |
| Level 2: Unit Tests | | | |
| Level 3: Settings UI | | | |
| Level 4: Regression | | | |

### Bugs Found

| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

### Sign-off

- [ ] All Level 1 tests pass
- [ ] All Level 2 tests pass
- [ ] All Level 3 tests pass
- [ ] All Level 4 tests pass
- [ ] No critical/high bugs remaining
- [ ] Documentation updated

**Phase 6 Status**: [ ] COMPLETE / [ ] INCOMPLETE
