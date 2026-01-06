# Phase 6 Completion Plan - Batches 2-6

**Status**: In Progress (Batch 1 Complete)
**Started**: December 4, 2025
**Estimated Remaining**: ~4 hours
**Last Updated**: January 5, 2026

---

## Overview

Phase 6 Batch 1 (API Keys) is complete and working. This plan covers the remaining batches to wire up all settings so they're actually used by the application.

**Current State**:
- ✅ Settings UI fully functional (all 6 tabs work)
- ✅ Settings persist to JSON file and keychain
- ✅ Batch 1 settings (API keys) fully wired and tested
- ❌ Batches 2-6 settings saved but NOT used by application

**Goal**: Make all settings functional so users' configuration choices are respected.

---

## Batch 2: Transcription Settings

**Estimated**: 35 minutes

### Task 2.1: Wire CPU Threads Setting
**Estimated**: 20 min | **Priority**: MEDIUM

**Current State**:
- Setting saved: `transcription.threads` (0 = auto)
- Method exists: `TranscriptionService.setThreads()` (line 125)
- Problem: Never called from main process

**Implementation**:
- [ ] In `src/main/index.ts` `initializeServicesFromSettings()` function
- [ ] Read `settings.transcription.threads`
- [ ] Call `transcriptionService.setThreads(threads)` if threads > 0
- [ ] Test: Change setting in UI, restart app, verify console shows correct thread count

**Files to modify**:
- `src/main/index.ts` (add to initializeServicesFromSettings, around line 112)

**Test**:
```bash
# 1. Set threads to 4 in UI
# 2. Restart app
# 3. Check console for: "[Transcription] Using 4 threads"
```

---

### Task 2.2: Wire Language Setting
**Estimated**: 15 min | **Priority**: MEDIUM

**Current State**:
- Setting saved: `transcription.language` (default: 'en')
- Problem: Language not read from settings in transcription calls

**Implementation**:
- [ ] In `src/renderer/hooks/useTranscription.ts`
- [ ] Read language from settings via IPC on mount
- [ ] Pass as default in transcribe options
- [ ] Allow UI override if needed

**Files to modify**:
- `src/renderer/hooks/useTranscription.ts`

**Alternative** (simpler):
- [ ] In transcription IPC handler (`src/main/index.ts` line ~460)
- [ ] Read language from settings if not provided in options
- [ ] Pass to transcribe call

**Test**:
```bash
# 1. Set language to 'es' in UI
# 2. Transcribe a recording
# 3. Verify whisper called with --language es flag
```

---

## Batch 3: Summary Settings

**Estimated**: 1 hour

### Task 3.1: Wire Verbosity Setting
**Estimated**: 45 min | **Priority**: MEDIUM

**Current State**:
- Setting saved: `summary.verbosity` ('concise' | 'detailed' | 'comprehensive')
- Problem: No verbosity logic in prompt generation

**Implementation**:
- [ ] In `src/services/meetingIntelligence.ts`
- [ ] Read verbosity setting in `generateSummary()` method
- [ ] Add instruction prefix to prompt based on verbosity:
  - `concise`: "Provide a brief, concise summary focusing only on key points."
  - `detailed`: "Provide a comprehensive summary with context and details."
  - `comprehensive`: "Provide an exhaustive summary capturing all discussion points, nuances, and context."
- [ ] Prepend instruction to existing prompt template

**Files to modify**:
- `src/services/meetingIntelligence.ts`

**Test**:
```bash
# 1. Generate summary with verbosity = 'concise'
# 2. Generate summary with verbosity = 'comprehensive'
# 3. Compare output lengths and detail levels
```

---

### Task 3.2: Wire Custom Disclaimer Setting
**Estimated**: 20 min | **Priority**: MEDIUM

**Current State**:
- Setting saved: `summary.customDisclaimer` (null = use default)
- Problem: `emailGenerator.ts` uses hardcoded disclaimer

**Implementation**:
- [ ] In `src/utils/emailGenerator.ts`
- [ ] Add `disclaimer?: string` parameter to `generateEmailHtml()` function
- [ ] Use custom disclaimer if provided, else use default
- [ ] In caller (`src/renderer/components/EmailPreview.tsx`)
- [ ] Read custom disclaimer from settings
- [ ] Pass to email generator

**Files to modify**:
- `src/utils/emailGenerator.ts`
- `src/renderer/components/EmailPreview.tsx`

**Test**:
```bash
# 1. Set custom disclaimer in UI
# 2. Generate email preview
# 3. Verify custom disclaimer appears at bottom
# 4. Clear custom disclaimer
# 5. Verify default disclaimer appears
```

---

### Task 3.3: Remove Deprecated Email Settings
**Estimated**: 15 min | **Priority**: LOW

**Current State**:
- Settings: `emailBodyMaxLength`, `emailContextMaxCount`
- These were for email context feature (deprecated in Oct 2025)

**Implementation**:
- [ ] Remove from `src/types/settings.ts` `AppSettings` interface
- [ ] Remove from `src/services/settings.ts` `DEFAULT_SETTINGS`
- [ ] Remove from `src/renderer/components/SettingsPanel.tsx` Summary tab UI
- [ ] Remove from settings migration logic if present

**Files to modify**:
- `src/types/settings.ts`
- `src/services/settings.ts`
- `src/renderer/components/SettingsPanel.tsx`

**Test**:
```bash
npm run type-check  # Should pass
npm run build       # Should succeed
# Open settings UI - email settings should be gone from Summary tab
```

---

## Batch 4: Audio Settings

**Estimated**: 35 minutes

### Task 4.1: Wire Include Microphone Setting
**Estimated**: 20 min | **Priority**: MEDIUM

**Current State**:
- Setting saved: `audio.includeMicrophone` (default: true)
- Problem: Not read in audio capture initialization

**Implementation**:
- [ ] In `src/renderer/hooks/useAudioCapture.ts`
- [ ] Read `includeMicrophone` setting on mount
- [ ] Store in state
- [ ] Pass to `initialize-audio` IPC call
- [ ] OR: Read in main process IPC handler and use there

**Files to modify**:
- `src/renderer/hooks/useAudioCapture.ts` OR
- `src/main/index.ts` (initialize-audio handler)

**Test**:
```bash
# 1. Set includeMicrophone = false
# 2. Initialize audio
# 3. Verify only system audio captured, not microphone
```

---

### Task 4.2: Wire Announcement Text Setting
**Estimated**: 15 min | **Priority**: MEDIUM

**Current State**:
- Setting saved: `audio.announcementText` (default: hardcoded string)
- Problem: Hardcoded in `play-announcement` IPC handler

**Implementation**:
- [ ] In `src/main/index.ts` `play-announcement` IPC handler
- [ ] Read `settings.audio.announcementText`
- [ ] Pass to `say` command instead of hardcoded text

**Files to modify**:
- `src/main/index.ts` (play-announcement handler, search for "say" command)

**Test**:
```bash
# 1. Set custom announcement text in UI
# 2. Start recording
# 3. Verify custom text is spoken (check console or listen)
```

---

## Batch 5: UI Settings

**Estimated**: 1 hour

### Task 5.1: Wire Default View Setting
**Estimated**: 20 min | **Priority**: MEDIUM

**Current State**:
- Setting saved: `ui.defaultView` ('browse' | 'generate')
- Problem: Not read in App.tsx

**Implementation**:
- [ ] In `src/renderer/App.tsx`
- [ ] On mount, read `ui.defaultView` from settings via IPC
- [ ] Set initial `mode` state based on setting
- [ ] Add IPC handler if needed: `settings-get-category` with category name

**Files to modify**:
- `src/renderer/App.tsx`
- Possibly `src/main/index.ts` (if IPC handler needed)

**Test**:
```bash
# 1. Set defaultView = 'browse'
# 2. Restart app
# 3. Verify app opens in Browse mode
# 4. Set defaultView = 'generate'
# 5. Restart app
# 6. Verify app opens in Generate mode
```

---

### Task 5.2: Wire Font Size Setting
**Estimated**: 30 min | **Priority**: LOW

**Current State**:
- Setting saved: `ui.fontSize` ('small' | 'medium' | 'large')
- Problem: No CSS variable application

**Implementation**:
- [ ] Define CSS variables in `src/renderer/styles/index.css`:
  ```css
  :root {
    --font-scale: 1.0; /* medium (default) */
  }

  :root[data-font-size="small"] {
    --font-scale: 0.9;
  }

  :root[data-font-size="large"] {
    --font-scale: 1.1;
  }
  ```
- [ ] Update base font sizes to use `calc(16px * var(--font-scale))`
- [ ] In `src/renderer/App.tsx`, read setting on mount
- [ ] Apply `data-font-size` attribute to root element

**Files to modify**:
- `src/renderer/styles/index.css`
- `src/renderer/App.tsx`

**Test**:
```bash
# 1. Set fontSize = 'small'
# 2. Verify all text appears smaller
# 3. Set fontSize = 'large'
# 4. Verify all text appears larger
```

---

### Task 5.3: Wire Show Recording Announcement
**Estimated**: 15 min | **Priority**: LOW

**Current State**:
- Setting saved: `ui.showRecordingAnnouncement` (default: true)
- Problem: Announcement status always shown

**Implementation**:
- [ ] In `src/renderer/components/RecordingControls.tsx` (or wherever announcement status shown)
- [ ] Read `ui.showRecordingAnnouncement` setting
- [ ] Conditionally render announcement status message

**Files to modify**:
- `src/renderer/components/RecordingControls.tsx` (or relevant component)

**Test**:
```bash
# 1. Set showRecordingAnnouncement = false
# 2. Start recording
# 3. Verify "Playing announcement..." message NOT shown
# 4. Set showRecordingAnnouncement = true
# 5. Verify message IS shown
```

---

## Batch 6: Storage Settings

**Estimated**: 30 minutes

### Task 6.1: Wire Keep Audio Files Setting
**Estimated**: 30 min | **Priority**: MEDIUM

**Current State**:
- Setting saved: `dataRetention.keepAudioFiles` (default: false)
- User expects: Audio files deleted after transcription if false
- Reality: Audio files never deleted

**Implementation**:
- [ ] In `src/main/index.ts` after transcription completes successfully
- [ ] Find the `transcribe-and-diarize` IPC handler success path
- [ ] Read `settings.dataRetention.keepAudioFiles`
- [ ] If `false`, delete the audio file:
  ```typescript
  const keepAudioFiles = settingsService.getCategory('dataRetention').keepAudioFiles
  if (!keepAudioFiles) {
    fs.unlinkSync(audioPath)
    console.log('[Cleanup] Deleted audio file:', audioPath)
  }
  ```

**Files to modify**:
- `src/main/index.ts` (transcribe-and-diarize handler)

**Test**:
```bash
# 1. Set keepAudioFiles = false
# 2. Record and transcribe a meeting
# 3. Verify audio file is deleted after successful transcription
# 4. Set keepAudioFiles = true
# 5. Record and transcribe
# 6. Verify audio file is kept
```

---

## Deferred to Phase 7 (Storage Management)

These settings are defined but require more complex implementation:

- **Audio Storage Quota** (`dataRetention.audioStorageQuotaGB`)
  - Requires: Quota calculation, oldest-first deletion logic
  - Estimated: 1 hour

- **Transcript Retention** (`dataRetention.transcriptRetentionDays`)
  - Requires: Scheduled cleanup job, database deletion
  - Estimated: 1 hour
  - **CRITICAL**: User has this set to 30 days but it's not enforced!

- **Summary Retention** (`dataRetention.summaryRetentionDays`)
  - Requires: Scheduled cleanup job, database deletion
  - Estimated: 30 min

**Decision**: Implement these in Phase 7 with proper job scheduling and database cleanup logic.

---

## Theme Settings - Deferred to Future

- **Theme** (`ui.theme`)
  - Requires: Complete dark theme CSS (significant work)
  - Estimated: 2+ hours
  - Priority: LOW

**Decision**: Not part of Phase 6 completion. Add to backlog for future enhancement.

---

## Testing Checklist

After implementing each batch:

- [ ] **Batch 2**: CPU threads and language settings work
- [ ] **Batch 3**: Verbosity affects summary, custom disclaimer appears
- [ ] **Batch 4**: Microphone toggle works, custom announcement plays
- [ ] **Batch 5**: Default view respected, font size changes work
- [ ] **Batch 6**: Audio files deleted when keepAudioFiles = false

**Final verification**:
- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] Settings UI still works (no regressions)
- [ ] All wired settings work as expected in manual testing

---

## Progress Tracking

### Batch 2: Transcription Settings
- [ ] Task 2.1: Wire CPU Threads (20 min)
- [ ] Task 2.2: Wire Language (15 min)

### Batch 3: Summary Settings
- [ ] Task 3.1: Wire Verbosity (45 min)
- [ ] Task 3.2: Wire Custom Disclaimer (20 min)
- [ ] Task 3.3: Remove Deprecated Email Settings (15 min)

### Batch 4: Audio Settings
- [ ] Task 4.1: Wire Include Microphone (20 min)
- [ ] Task 4.2: Wire Announcement Text (15 min)

### Batch 5: UI Settings
- [ ] Task 5.1: Wire Default View (20 min)
- [ ] Task 5.2: Wire Font Size (30 min)
- [ ] Task 5.3: Wire Show Recording Announcement (15 min)

### Batch 6: Storage Settings
- [ ] Task 6.1: Wire Keep Audio Files (30 min)

**Total**: ~4 hours

---

## Notes

- Batch 1 (API Keys) already complete - no action needed
- After completion, move this file to `docs/archive/phase6/`
- Create `docs/planning/phase7-plan.md` for storage management
- Update `docs/planning/roadmap.md` to reflect Phase 6 complete, Phase 7 next
