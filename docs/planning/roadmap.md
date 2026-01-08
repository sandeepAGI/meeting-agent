# Development Roadmap

**Project**: Meeting Agent
**Version**: 0.6.3.0
**Last Updated**: 2026-01-07

---

## 📍 Current Status

**Phase**: 6 (Configuration & Settings) - ✅ Complete
**Progress**: All Batches (1-6) ✅ Complete
**Production Ready**: YES
**What Works**: Audio capture + transcription + diarization + M365 integration + LLM summaries + email distribution + meeting metadata editing + fully functional settings
**Latest**: Phase 6 complete - All settings wired and functional, 2 critical bugs fixed with TDD

---

## 🎯 Next Up: Phase 7 - Storage Management

**Current Work**: Planning Phase 7 implementation
**Priority**: HIGH - Critical retention policies not enforced (user has 30-day retention set but not active)
**Estimated**: 3-4 hours

**Tasks**:
- [ ] Implement transcript retention policy (automatic cleanup after N days)
- [ ] Implement summary retention policy (automatic cleanup after N days)
- [ ] Implement audio storage quota enforcement (delete oldest when quota exceeded)
- [ ] Add background job scheduler for retention cleanup
- [ ] Add storage usage dashboard in settings

**See**: `docs/planning/phase7-plan.md` for detailed implementation plan

**Then**: Phase 8 - Performance Optimization OR Phase 10 - Packaging & Distribution

---

## 🗺️ All Phases Overview

### Completed Phases

| Phase | Name | Status | Date | Summary |
|-------|------|--------|------|---------|
| 0 | Foundation Setup | ✅ | Oct 7, 2025 | Electron + React + TypeScript |
| 1.1 | Audio Capture | ✅ | Oct 9, 2025 | System audio + mic with electron-audio-loopback |
| 1.2 | Transcription | ✅ | Oct 13, 2025 | Local whisper.cpp with Metal GPU |
| 1.3 | Diarization | ✅ | Oct 13, 2025 | pyannote.audio speaker identification |
| 1.4 | Recording Announcement | ✅ | Oct 13, 2025 | Text-to-speech notification |
| 1.5 | Chunked Recording | ✅ | Oct 13, 2025 | 5-min auto-save prevents data loss |
| 1.6 | GPU Acceleration | ✅ | Oct 13, 2025 | Metal GPU for transcription + diarization |
| 2.1 | M365 Authentication | ✅ | Oct 13, 2025 | OAuth2 with keychain token storage |
| 2.2 | Calendar Integration | ✅ | Oct 14, 2025 | Fetch today's meetings via Graph API |
| 2.3-3 | LLM Intelligence | ✅ | Oct 21, 2025 | Two-pass Claude Batch API summarization |
| 2.3-4 | Meeting-Recording Link | ✅ | Oct 21, 2025 | Associate recordings with calendar meetings |
| 4a | Browse Mode + Branding | ✅ | Oct 21, 2025 | View past transcripts, Aileron design |
| 4b | Summary Editor | ✅ | Jan 23, 2026 | Inline editing, recipient selector |
| 4c | Metadata Editing | ✅ | Jan 7, 2026 | Edit meeting title/datetime, delete participants |
| 5 | Email Distribution | ✅ | Jan 27, 2026 | Send via Microsoft Graph API |
| 5.5 | Email Customization | ✅ | Oct 30, 2025 | Section toggles, custom intro, disclaimer |
| 6 (Batch 1) | Settings - API Keys | ✅ | Dec 4, 2025 | Settings UI + keychain integration |
| 6 (Batches 2-6) | Settings - Wire All | ✅ | Jan 7, 2026 | All settings functional + 2 bug fixes |

**Refactor Sprints**:
- R1: Critical bug fixes (chunked recording, WAV headers) ✅
- R2: Architecture improvements (modularization, O(n log m) merge) ✅

### In Progress

| Phase | Name | Status | Summary |
|-------|------|--------|---------|
| 7 | Data Management & Storage | 📋 Planning | Retention policies, quota enforcement, auto-cleanup |

### Planned

| Phase | Name | Priority | Summary |
|-------|------|----------|---------|
| 8 | Performance Optimization | MEDIUM | Streaming, parallel processing, large meeting support |
| 9 | Error Handling & Logging | MEDIUM | Retry mechanisms, user-friendly errors, diagnostics |
| 10 | Packaging & Distribution | HIGH | Auto-updates, code signing, DMG installer |

---

## 📚 Completed Phases (Details)

### Phase 6: Configuration & Settings (Complete) ✅

**Completed**: January 7, 2026
**Duration**: Batch 1 (Dec 4, 2025) + Batches 2-6 (Jan 7, 2026)
**Deliverables**:
- Settings panel UI with 6 tabs (API Keys, Transcription, Summary, Storage, Interface, Audio)
- Keychain integration for API keys (Anthropic, HuggingFace, Azure)
- JSON file for non-sensitive settings (28 total settings)
- Auto-migration from .env on first launch
- 8 new IPC handlers for settings operations
- React hook (useSettings) for state management
- **All settings wired and functional**

**Settings Wired** (Batches 2-6):
- ✅ **Batch 2**: Transcription (CPU threads, language)
- ✅ **Batch 3**: Summary (verbosity, custom disclaimer)
- ✅ **Batch 4**: Audio (microphone toggle, announcement text)
- ✅ **Batch 5**: UI (default view, font size, recording announcement)
- ✅ **Batch 6**: Storage (delete audio after transcription)

**Bug Fixes** (TDD):
- ✅ Meeting Intelligence Error Recovery UI (retry, cancel, go back)
- ✅ Recording Database Insertion (save immediately after stop)

**Deferred to Phase 7**:
- Transcript retention policy (auto-cleanup after N days)
- Summary retention policy (auto-cleanup after N days)
- Audio storage quota enforcement

**Archive**: `docs/archive/phase6/`

---

### Phase 5.5: Enhanced Email Customization ✅

**Completed**: October 30, 2025
**Duration**: 1 day
**Deliverables**:
- 8 toggleable email sections (summary, participants, actions, decisions, etc.)
- Inline editing for detailed notes (quotes, questions, parking lot)
- Custom introduction field (500 chars)
- Automatic AI disclaimer (cannot be disabled)
- Database persistence for all customizations

**Bug Fixes** (v0.6.2.1-0.6.2.5):
- Fixed save button not working
- Fixed XSS vulnerability in quote rendering
- Fixed infinite loop in email generation
- Fixed section toggle checkboxes
- Fixed Whisper initialization failure (settings.json regression)

**Archive**: `docs/archive/phase5.5/` (when created)

---

### Phase 5: Email Distribution ✅

**Completed**: January 27, 2026
**Duration**: 1 day
**Deliverables**:
- One-click email sending via Microsoft Graph API
- HTML email generation with Aileron branding
- Base64-embedded logo (1KB PNG)
- Database email tracking (sent_at, sent_to_json columns)
- Complete email content (all summary sections)
- Error handling for auth and permission errors

**Cost**: $0.00/email (included in M365 subscription)

**Archive**: `docs/archive/phase5/` (when created)

---

### Phase 4b: Summary Editor & Email Preview ✅

**Completed**: January 23, 2026
**Duration**: 1 day
**Deliverables**:
- Complete inline editing UI (summary, actions, decisions, speaker mappings)
- RecipientSelector component with attendee auto-load
- EmailPreview with professional Aileron branding
- Database schema updates (3 new columns)
- Complete IPC layer for email features

**Archive**: `docs/archive/phase4/` (when created)

---

### Phase 4c: Meeting Metadata Editing & Participant Deletion ✅

**Completed**: January 7, 2026
**Duration**: 1 day
**Approach**: Test-Driven Development (TDD)
**Deliverables**:
- Meeting title editing with validation (empty check, 200 char limit)
- Meeting date/time editing with validation (end > start)
- Participant deletion with confirmation dialog
- Database layer: 3 new methods (`updateMeetingSubject`, `updateMeetingDateTime`, `deleteMeetingAttendee`)
- IPC layer: 3 new handlers with error propagation
- UI components: `MeetingMetadataEditor` (new), `RecipientSelector` (enhanced)
- Organizer protection: cannot delete meeting organizer
- Complete test coverage: 95 tests (19 database + 14 IPC + 13 UI + 10 UI + 18 integration + 31 existing)

**Features**:
- ✅ Edit meeting title for calendar meetings and standalone recordings
- ✅ Edit meeting start/end times with date picker
- ✅ Delete attendees from meeting with confirmation dialog
- ✅ Automatic removal of deleted attendees from recipient selection
- ✅ Validation: empty title, end time before start time
- ✅ Organizer badge display
- ✅ Case-insensitive email matching
- ✅ Real-time UI updates after deletion

**Testing**: TDD-first approach with RED → GREEN → REFACTOR cycle
- Database tests → Implementation → IPC tests → Implementation → UI tests → Implementation → Integration tests
- 100% test coverage for new features
- Manual testing checklist: 60+ test scenarios

**Archive**: `docs/planning/meeting-metadata-editing-tdd-plan.md`, `docs/planning/meeting-metadata-editing-manual-testing.md`

---

### Phase 4a: Browse Mode & Branding ✅

**Completed**: October 21, 2025
**Duration**: 1 day
**Deliverables**:
- Browse/Generate mode toggle
- TranscriptViewer component for past recordings
- Aileron branding (logo, colors, typography)
- Database methods for browsing (3 new methods)
- Smart navigation based on recording status

**Archive**: `docs/archive/phase4/` (when created)

---

### Phase 2.3-4: Meeting-Recording Association ✅

**Completed**: October 21, 2025
**Duration**: 1 day
**Deliverables**:
- Two-tab interface (Standalone Recordings | Calendar Meetings)
- MeetingPicker dialog for linking recordings
- Date range filters (Today, Last 7 Days, Last 30 Days, All)
- Search functionality by meeting title
- Auto-sync from M365 for selected date range
- 5 new database methods

**Archive**: `docs/archive/phase2/` (when created)

---

### Phase 2.3-3: LLM Meeting Intelligence ✅

**Completed**: October 21, 2025
**Duration**: 3 days
**Deliverables**:
- Complete backend infrastructure (DatabaseService, ClaudeBatchService, MeetingIntelligenceService)
- Two-pass workflow (Pass 1: speaker ID + summary, Pass 2: validation)
- SQLite database with 7 tables
- Anthropic Batch API integration with adaptive polling
- Prompt templates and loader utility
- 7 IPC handlers for intelligence features
- Background processing with database persistence

**Cost**: $0.09 per 60-min meeting (96% savings vs cloud alternatives)

**Note**: Email context feature deprecated after testing showed no value

**Archive**: `docs/archive/phase2/` (when created)

---

### Phase 2.2: Calendar Integration ✅

**Completed**: October 14, 2025
**Summary**: Fetch today's meetings via `/me/calendarview`, display with time/location/attendees, timezone handling, MSAL cache persistence

**Archive**: `docs/archive/phase2/` (when created)

---

### Phase 2.1: M365 Authentication ✅

**Completed**: October 13, 2025
**Summary**: OAuth2 with MSAL Node, secure keychain token storage, interactive browser login, automatic token refresh

**Archive**: `docs/archive/phase2/` (when created)

---

### Phase 1.6: GPU Acceleration ✅

**Completed**: October 13, 2025
**Summary**: Metal GPU for diarization (pyannote.audio), automatic device detection with fallback, 3-10x speedup on Apple Silicon

**Archive**: `docs/archive/phase1/` (when created)

---

### Phase 1.5: Chunked Recording ✅

**Completed**: October 13, 2025
**Summary**: Auto-save chunks every 5 minutes, constant memory usage, FFmpeg seamless merge, chunk cleanup after merge

**Archive**: `docs/archive/phase1/` (when created)

---

### Phase 1.4: Recording Announcement ✅

**Completed**: October 13, 2025
**Summary**: Text-to-speech announcement via macOS `say` command, automatic on recording start, non-blocking capture

**Archive**: `docs/archive/phase1/` (when created)

---

### Phase 1.3: Speaker Diarization ✅

**Completed**: October 13, 2025
**Summary**: pyannote.audio speaker identification, temporal intersection matching, speaker-labeled transcripts

**Archive**: `docs/archive/phase1/` (when created)

---

### Phase 1.2: Transcription ✅

**Completed**: October 13, 2025
**Summary**: Local whisper.cpp with Metal GPU, subprocess pattern, ffmpeg preprocessing, 50x realtime on M3 Pro

**Archive**: `docs/archive/phase1/` (when created)

---

### Phase 1.1: Audio Capture ✅

**Completed**: October 9, 2025
**Summary**: System audio + microphone with electron-audio-loopback, Web Audio API mixing, 16kHz mono WAV output

**Archive**: `docs/archive/phase1/` (when created)

---

### Phase 0: Foundation Setup ✅

**Completed**: October 7, 2025
**Summary**: Electron 38.2.1 + React 19 + TypeScript, electron-vite build system, ESLint + Prettier

**Archive**: `docs/archive/phase0/` (when created)

---

## 📋 Upcoming Phases (Detailed)

### Phase 7: Data Management & Storage

**Priority**: HIGH (after Phase 6)
**Estimated**: ~6 hours
**Reason**: User has retention settings configured but not enforced

**Tasks**:
- Transcript retention cleanup (delete after 30/60/90 days, or keep forever)
- Summary retention cleanup
- Audio storage quota enforcement (delete oldest when quota exceeded)
- Scheduled job that runs on app startup
- Database deletion operations
- User notifications before deletion

**Success Criteria**:
- User sets `transcriptRetentionDays: 30` → transcripts deleted after 30 days
- User sets `audioStorageQuotaGB: 5` → oldest recordings deleted when >5GB
- User sets `keepAudioFiles: false` → audio deleted after successful transcription
- Settings = 0 or "forever" → data kept indefinitely

---

### Phase 8: Performance Optimization

**Priority**: MEDIUM
**Estimated**: ~8 hours

**Tasks**:
- Streaming transcription (real-time partial results)
- Parallel processing (transcription + diarization concurrently)
- Large meeting support (>2 hour recordings)
- Memory optimization for long sessions
- Progress indicators with time estimates

**Success Criteria**:
- 2-hour meeting processed without memory issues
- Transcription shows streaming results during processing
- Total processing time reduced by 30%+

---

### Phase 9: Error Handling & Logging

**Priority**: MEDIUM
**Estimated**: ~6 hours

**Tasks**:
- Retry mechanisms for API failures
- User-friendly error messages (no technical jargon)
- Diagnostic logging for troubleshooting
- Crash recovery (resume interrupted operations)
- Network failure handling

**Success Criteria**:
- API failure auto-retries 3 times before showing error
- User sees actionable error messages ("Check your API key" not "401 Unauthorized")
- App recovers from crashes without data loss

---

### Phase 10: Packaging & Distribution

**Priority**: HIGH (after Phase 7)
**Estimated**: ~12 hours

**Tasks**:
- Code signing with Apple Developer certificate
- Notarization for macOS Gatekeeper
- DMG installer with background image
- Auto-update system (electron-updater)
- Version management and release notes
- User guide and onboarding

**Success Criteria**:
- App installs without "unidentified developer" warning
- Users notified of new versions with one-click update
- First-time users can set up app in <5 minutes

---

## 📖 Documentation Index

**Current Work**:
- Planning: `docs/planning/`
  - `roadmap.md` (this file) - Where we are and what's next
  - `phase6-completion-plan.md` - Current work detailed task list

**Archive** (completed work):
- `docs/archive/` - Organized by phase
  - `phase6/` - Settings implementation details
  - `packaging/` - Production packaging plan (completed Dec 2025)
  - More phases to be archived as documentation cleanup continues

**Technical Details**:
- `docs/technical/` - Implementation deep-dives
  - `audio-capture.md` - Phase 1.1 implementation
  - `transcription.md` - Phase 1.2 implementation
  - `diarization.md` - Phase 1.3 implementation
  - `llm-intelligence.md` - Phase 2.3-3 implementation

**Developer Guides**:
- `docs/developer/architecture.md` - System architecture, patterns, data flow
- `docs/guides/azure-ad-setup.md` - M365 app registration
- `docs/guides/user-guide.md` - End-user documentation

**Project Root**:
- `CLAUDE.md` - AI assistant guidance (development patterns, testing protocol)
- `CHANGELOG.md` - Version history with completion dates
- `README.md` - Installation, setup, usage, troubleshooting

---

## 🎯 Success Metrics

**Current Version (0.6.2.5)**:
- ✅ 100% local transcription and diarization ($0.00/meeting)
- ✅ ~$0.09 per 60-min meeting for LLM summarization
- ✅ Metal GPU acceleration (5-10x faster on Apple Silicon)
- ✅ Complete meeting workflow (record → transcribe → diarize → summarize → email)
- ✅ Settings UI for all configuration
- ⚠️ Settings not all wired (Phase 6 completion in progress)

**After Phase 6 Complete**:
- All user settings functional and respected
- No hardcoded configuration in code

**After Phase 7 Complete**:
- Automated data management (no manual cleanup needed)
- Storage quota prevents disk space issues
- Retention policies ensure compliance

**Production Ready Checklist**:
- [x] Core functionality works (Phases 0-5.5)
- [x] Settings UI exists (Phase 6 Batch 1)
- [ ] All settings functional (Phase 6 Batches 2-6)
- [ ] Data management automated (Phase 7)
- [ ] Performance optimized for large meetings (Phase 8)
- [ ] Error handling production-grade (Phase 9)
- [ ] Packaging and distribution ready (Phase 10)

---

**Full Historical Details**: See `docs/archive/roadmap-full-history.md`
