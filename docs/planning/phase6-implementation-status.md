# Phase 6: Settings Implementation Status

## Overview

This document tracks which settings are fully implemented vs placeholders, and what work is needed to complete Phase 6.

**Current State**: Batch 1 (API Keys) implementation complete - awaiting testing.

**Last Updated**: 2025-12-04

---

## 🚨 NEXT STEPS - READ THIS FIRST

### Batch 1 Testing Required

Before proceeding to Batch 2, test and verify Batch 1 implementation:

1. **Run the app**: `npm run dev`
2. **Check console logs** (Cmd+Option+I) for:
   ```
   [Settings] Initialized successfully
   [Settings] Initializing services from settings...
   [Settings] HuggingFace token loaded from settings (or "from environment (fallback)")
   [Settings] M365AuthService initialized from settings (or "not configured")
   [Settings] ClaudeBatchService initialized (model: ...) (or "not configured")
   [Settings] Service initialization complete
   ```
3. **Test saving API keys**:
   - Open Settings (gear icon) → API Keys tab
   - Save an Anthropic API key
   - Restart the app
   - Verify console shows "loaded from settings"
4. **Regression test**: Verify existing features work (transcription, diarization, calendar)

### After Testing Passes
1. Commit Batch 1 changes
2. Push to remote
3. Review Batch 2-6 scope before continuing

---

## Implementation Checklist

### Legend

- ✅ **Complete** - UI works AND setting is used by the app
- ⚠️ **Partial** - UI works but setting not fully wired up
- ❌ **Placeholder** - UI works but setting does nothing

---

## 1. API Keys Tab - ✅ BATCH 1 IMPLEMENTED (Awaiting Testing)

| Setting | UI | Saved | Used | Status | Work Needed |
|---------|-----|-------|------|--------|-------------|
| Anthropic API Key | ✅ | ✅ Keychain | ✅ | ✅ Complete | None - implemented |
| HuggingFace Token | ✅ | ✅ Keychain | ✅ | ✅ Complete | None - implemented |
| Azure Client ID | ✅ | ✅ JSON | ✅ | ✅ Complete | None - implemented |
| Azure Tenant ID | ✅ | ✅ JSON | ✅ | ✅ Complete | None - implemented |
| Anthropic Model | ✅ | ✅ JSON | ✅ | ✅ Complete | None - implemented |

### Implementation Details (Batch 1 - DONE)

**1.1 Anthropic API Key + Model** - ✅ IMPLEMENTED

Code changes:
- `src/main/index.ts`: Added `initializeServicesFromSettings()` function (lines 46-109)
- Reads API key from settings, falls back to process.env
- Reads model from settings, defaults to 'claude-sonnet-4-20250514'

---

**1.2 HuggingFace Token** - ✅ IMPLEMENTED

Code changes:
- `src/services/diarization.ts`: Added `setToken()` and `hasToken()` methods (lines 27-41)
- `src/main/index.ts`: Calls `diarizationService.setToken()` from settings

---

**1.3 Azure Client/Tenant ID** - ✅ IMPLEMENTED

Code changes:
- `src/main/index.ts`: Reads from settings, falls back to process.env
- M365AuthService created inside `initializeServicesFromSettings()` instead of at module load

---

## 2. Transcription Tab

| Setting | UI | Saved | Used | Status | Work Needed |
|---------|-----|-------|------|--------|-------------|
| Whisper Model | ✅ | ✅ JSON | ✅ Startup | ✅ Complete | None (works at startup) |
| CPU Threads | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Pass to TranscriptionService |
| Language | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Pass to transcribe() calls |

### Implementation Details

**2.1 Whisper Model** - ✅ ALREADY WORKING

Code at `src/main/index.ts:1288-1289` reads from settings:
```typescript
const transcriptionSettings = settingsService.getCategory('transcription')
await transcriptionService.initialize(transcriptionSettings.model || 'base')
```

---

**2.2 CPU Threads**

Current: `TranscriptionService` calculates threads in constructor, ignores settings.

Fix needed:
- Read `settings.transcription.threads` at startup
- Pass to `TranscriptionService` constructor or add setter
- Value 0 = auto-detect (keep current logic)

**Effort**: 20 min | **Priority**: MEDIUM

---

**2.3 Language**

Current: Language passed in `TranscriptionOptions` from UI, not from settings.

Fix needed:
- In `useTranscription.ts`, read language from settings
- Pass as default in transcribe options
- Allow override from UI if needed

**Effort**: 15 min | **Priority**: MEDIUM

---

## 3. Summary Tab

| Setting | UI | Saved | Used | Status | Work Needed |
|---------|-----|-------|------|--------|-------------|
| Verbosity | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Create prompt variants |
| Custom Disclaimer | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Wire to emailGenerator |
| Email Body Max Length | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Remove or implement |
| Email Context Max Count | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Remove or implement |

### Implementation Details

**3.1 Verbosity**

Current: Single prompt template used regardless of setting.

Options:
1. **Simple**: Add instruction prefix to prompt based on verbosity
2. **Full**: Create 3 separate prompt files

Recommendation: Option 1 - add verbosity instruction to existing prompt.

Fix needed:
- In `MeetingIntelligenceService`, read verbosity setting
- Prepend instruction like "Provide a {verbosity} summary..." to prompt

**Effort**: 45 min | **Priority**: MEDIUM

---

**3.2 Custom Disclaimer**

Current code (`src/utils/emailGenerator.ts`) has hardcoded disclaimer.

Fix needed:
- Accept disclaimer as parameter in `generateEmailHtml()`
- Read from settings in caller
- Fall back to default if null/empty

**Effort**: 20 min | **Priority**: MEDIUM

---

**3.3 Email Body/Context Max Length**

These settings were for the deprecated email context feature.

**Decision needed**: Remove from UI or implement feature?

**Recommendation**: Remove from UI to avoid confusion.

**Effort**: 15 min | **Priority**: LOW

---

## 4. Storage Tab

| Setting | UI | Saved | Used | Status | Work Needed |
|---------|-----|-------|------|--------|-------------|
| Keep Audio Files | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Add cleanup logic |
| Audio Storage Quota | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Add quota enforcement |
| Transcript Retention | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Add scheduled cleanup |
| Summary Retention | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Add scheduled cleanup |

### Implementation Details

**4.1 Keep Audio Files**

Fix needed:
- After transcription completes successfully, check setting
- If `keepAudioFiles === false`, delete the audio file
- Log deletion for debugging

**Effort**: 30 min | **Priority**: MEDIUM

---

**4.2 Audio Storage Quota**

Fix needed:
- Create utility to calculate recordings folder size
- Before saving new recording, check if quota exceeded
- If exceeded, delete oldest files until under quota
- Only applies if `keepAudioFiles === true`

**Effort**: 1 hour | **Priority**: LOW (Phase 7)

---

**4.3 Transcript/Summary Retention**

Fix needed:
- Add scheduled job (run on app startup or daily)
- Query database for records older than retention period
- Delete matching records
- Value 0 = keep forever (skip deletion)

**Effort**: 1.5 hours | **Priority**: LOW (Phase 7)

---

## 5. Interface Tab

| Setting | UI | Saved | Used | Status | Work Needed |
|---------|-----|-------|------|--------|-------------|
| Theme | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Create dark theme CSS |
| Font Size | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Add font size CSS |
| Default View | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Wire to App.tsx |
| Show Announcement | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Wire to UI |

### Implementation Details

**5.1 Theme**

Fix needed:
- Create CSS variables for dark theme
- Apply `data-theme="dark"` to root element
- Read setting on app load and on change
- `system` = use `prefers-color-scheme` media query

**Effort**: 2 hours | **Priority**: LOW (Future)

---

**5.2 Font Size**

Fix needed:
- Define CSS variables: `--font-scale-small: 0.9`, `--font-scale-large: 1.1`
- Apply class to body based on setting
- Update base font sizes to use variables

**Effort**: 30 min | **Priority**: LOW

---

**5.3 Default View**

Fix needed:
- In `App.tsx`, read setting via IPC on mount
- Set initial mode state based on setting
- Add IPC handler to get UI settings

**Effort**: 20 min | **Priority**: MEDIUM

---

**5.4 Show Recording Announcement**

Fix needed:
- Conditionally render announcement status in `RecordingControls`
- Read setting from context or IPC

**Effort**: 15 min | **Priority**: LOW

---

## 6. Audio Tab

| Setting | UI | Saved | Used | Status | Work Needed |
|---------|-----|-------|------|--------|-------------|
| Include Microphone | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Wire to useAudioCapture |
| Announcement Text | ✅ | ✅ JSON | ❌ | ❌ Placeholder | Wire to play-announcement |

### Implementation Details

**6.1 Include Microphone**

Fix needed:
- In `useAudioCapture`, read initial value from settings
- Or expose IPC to get audio settings

**Effort**: 20 min | **Priority**: MEDIUM

---

**6.2 Announcement Text**

Current: Hardcoded in `play-announcement` IPC handler or caller.

Fix needed:
- Read from settings when playing announcement
- Pass to `say` command

**Effort**: 15 min | **Priority**: MEDIUM

---

## Summary: Phase 6 Scope

### Must Complete for Phase 6 (Total: ~6 hours)

| # | Setting | Effort | Priority |
|---|---------|--------|----------|
| 1 | Anthropic API Key + Model | 30 min | HIGH |
| 2 | HuggingFace Token | 30 min | HIGH |
| 3 | Azure Client/Tenant ID | 15 min | HIGH |
| 4 | CPU Threads | 20 min | MEDIUM |
| 5 | Language | 15 min | MEDIUM |
| 6 | Verbosity | 45 min | MEDIUM |
| 7 | Custom Disclaimer | 20 min | MEDIUM |
| 8 | Keep Audio Files | 30 min | MEDIUM |
| 9 | Default View | 20 min | MEDIUM |
| 10 | Include Microphone | 20 min | MEDIUM |
| 11 | Announcement Text | 15 min | MEDIUM |
| 12 | Font Size | 30 min | LOW |
| 13 | Show Announcement Status | 15 min | LOW |
| 14 | Remove Email Max Length settings | 15 min | LOW |

**Total estimated: ~6 hours**

### Defer to Phase 7 (Storage Management)

- Audio Storage Quota enforcement
- Transcript/Summary Retention cleanup

### Defer to Future

- Dark Theme (requires significant CSS work)

---

## Implementation Order

**Batch 1: Critical API Keys** - ✅ IMPLEMENTED (Awaiting Testing)
1. ✅ Anthropic API Key + Model
2. ✅ HuggingFace Token
3. ✅ Azure Client/Tenant ID

**Batch 2: Transcription Settings (35 min)** - ⏳ PENDING
4. CPU Threads
5. Language

**Batch 3: Summary Settings (1 hour)** - ⏳ PENDING
6. Verbosity
7. Custom Disclaimer
8. Remove deprecated Email settings

**Batch 4: Audio Settings (35 min)** - ⏳ PENDING
9. Include Microphone
10. Announcement Text

**Batch 5: UI Settings (1 hour)** - ⏳ PENDING
11. Default View
12. Font Size
13. Show Announcement Status

**Batch 6: Storage Settings (30 min)** - ⏳ PENDING
14. Keep Audio Files (delete after transcription)

---

## Verification After Each Batch

After completing each batch:
1. Run `npm run type-check`
2. Run `npm run build`
3. Run `npm run dev` and test each setting
4. Document results in test checklist
5. **Commit and push** before starting next batch

---

## Files Modified (Batch 1)

- `src/main/index.ts` - Added `initializeServicesFromSettings()`, refactored service initialization
- `src/services/diarization.ts` - Added `setToken()` and `hasToken()` methods
