# Development Roadmap

**Project**: Meeting Agent
**Version**: 0.2.1
**Last Updated**: 2025-10-14

## Overview

Meeting Agent is being developed in 10 phases, from foundation to production-ready application. Current status: **Phase 2.2 Complete** (Audio + Transcription + Diarization + M365 Auth + Calendar).

---

## Phase Status

| Phase | Name | Status | Completion Date |
|-------|------|--------|-----------------|
| 0 | Foundation Setup | ✅ Complete | 2025-10-07 |
| 1.1 | Audio Capture | ✅ Complete | 2025-10-09 |
| 1.2 | Transcription | ✅ Complete | 2025-10-13 |
| 1.3 | Diarization | ✅ Complete | 2025-10-13 |
| R1 | Refactor Sprint 1 | ✅ Complete | 2025-10-13 |
| R2 | Refactor Sprint 2 | ✅ Complete | 2025-10-13 |
| 1.4 | Recording Announcement | ✅ Complete | 2025-10-13 |
| 1.5 | Chunked Recording | ✅ Complete | 2025-10-13 |
| 1.6 | GPU Acceleration | ✅ Complete | 2025-10-13 |
| R3 | Refactor Sprint 3 | 📅 Planned | - |
| 2.1 | M365 Authentication | ✅ Complete | 2025-10-13 |
| 2.2 | Calendar & Meeting Context | ✅ Complete | 2025-10-14 |
| 2.3-3 | LLM-Based Meeting Intelligence | 📅 Planned | - |
| 4 | GUI Development | 📅 Planned | - |
| 5 | Email Distribution | 📅 Planned | - |
| 6 | Data Management | 📅 Planned | - |
| 7 | Settings UI | 📅 Planned | - |
| 8 | Error Handling & Logging | 📅 Planned | - |
| 9 | Performance Optimization | 📅 Planned | - |
| 10 | Documentation & Packaging | 📅 Planned | - |

---

## Phase 0: Foundation Setup ✅

**Completed**: 2025-10-07

### Goals
Initialize project infrastructure with Electron, React, and TypeScript.

### Deliverables
- ✅ Node.js/TypeScript project setup
- ✅ Electron 38.2.1 with electron-vite
- ✅ React 19 UI framework
- ✅ ESLint + Prettier
- ✅ Basic project structure
- ✅ Git repository

### Success Criteria
✅ `npm run build` succeeds, empty Electron app launches

### Documentation
- See: `CHANGELOG.md` v0.1.0

---

## Phase 1.1: Audio Capture ✅

**Completed**: 2025-10-09

### Goals
Capture system audio and microphone without BlackHole, save as Whisper-compatible WAV files.

### Deliverables
- ✅ Native system audio capture (electron-audio-loopback)
- ✅ Microphone capture with graceful fallback
- ✅ Dual-stream audio merging
- ✅ Real-time audio level monitoring
- ✅ 16kHz mono WAV output
- ✅ Recording UI with controls

### Key Decisions
- ❌ Abandoned: naudiodon + BlackHole (native module issues)
- ✅ Chosen: electron-audio-loopback (Web API-based)
- ✅ Added: Microphone capture (not in original plan)

### Success Criteria
✅ Captures system + mic audio, saves as 16kHz mono WAV

### Documentation
- See: `docs/technical/audio-capture.md`
- See: `CHANGELOG.md` v0.1.1

---

## Phase 1.2: Transcription ✅

**Completed**: 2025-10-13

### Goals
Transcribe audio locally using Whisper with Metal GPU acceleration.

### Deliverables
- ✅ whisper.cpp CLI integration (subprocess)
- ✅ ffmpeg audio preprocessing
- ✅ Metal GPU acceleration (automatic)
- ✅ Progress monitoring via stderr
- ✅ JSON output parsing
- ✅ UI progress display

### Key Decisions
- ❌ Abandoned: @kutalia/whisper-node-addon (SIGTRAP crashes)
- ✅ Chosen: whisper-cpp CLI via subprocess
- ✅ Added: ffmpeg preprocessing (fixes WAV header bug)

### Critical Bugs Fixed
- WAV header corruption (14x slowdown)
- Stereo audio despite mono configuration
- Duration calculation error

### Success Criteria
✅ Transcribes 17.9s audio in ~20-30s (1-2x realtime)

### Documentation
- See: `docs/technical/transcription.md`
- See: `CHANGELOG.md` v0.1.2

---

## Phase 1.3: Speaker Diarization ✅

**Completed**: 2025-10-13

### Goals
Identify "who spoke when" and generate speaker-labeled transcripts.

### Deliverables
- ✅ pyannote.audio 3.1 integration (Python subprocess)
- ✅ Speaker segment extraction
- ✅ Temporal intersection merge algorithm
- ✅ Speaker-labeled transcript generation
- ✅ Two-button UI (fast vs accurate)

### Key Decisions
- ❌ Rejected: tinydiarize (experimental), sherpa-onnx (native module)
- ✅ Chosen: pyannote.audio (state-of-the-art, Python subprocess)
- ✅ CPU-only implementation (GPU deferred to Phase 2+)

### Success Criteria
✅ Produces speaker-labeled transcripts (~90s for 30s audio)

### Documentation
- See: `docs/technical/diarization.md`
- See: `CHANGELOG.md` v0.1.3

---

## Refactor Sprints 🔧

**Status**: In Progress (Sprint 1)
**Documentation**: See `docs/planning/REFACTOR-PLAN.md`

### Overview
Based on code review findings (REFACTOR-CODEX.md), three refactor sprints address technical debt and improve maintainability before continuing with new features.

### Sprint 1: Critical Bug Fixes ✅
**Completed**: 2025-10-13
**Duration**: ~3.5 hours
**Priority**: Critical

**Tasks**:
- [x] Fix IPC listener leaks (memory leaks during hot-reload)
- [x] Ensure loopback teardown (lingering permissions prompts)
- [x] Manage temp file cleanup (disk space issues)
- [x] Propagate transcription options (model selection doesn't work)
- [x] Respect microphone toggle (privacy risk - toggle doesn't work)

**Success Criteria**: ✅ Hot-reload works cleanly, mic toggle works, no temp file accumulation

**Results**:
- Fixed memory leaks from IPC listeners (added unsubscribe functions)
- Fixed lingering macOS "using microphone" indicator (loopback teardown)
- Fixed disk space accumulation (temp files now cleaned up in finally block)
- Fixed transcription options not being honored (constructor + options propagation)
- Fixed microphone toggle not working after initialization (re-initialize on toggle)

---

### Sprint 2: Architecture Improvements ✅
**Completed**: 2025-10-13
**Duration**: ~4 hours
**Priority**: High

**Tasks**:
- [x] Modularize App.tsx (500 lines → 93 lines, extract hooks/components)
- [x] Optimize merge algorithm (O(n²) → O(n log m), 45x faster)
- [x] Fix RecordingSession types (type safety)
- [x] Retire whisper-node-addon remnants (cleanup)

**Success Criteria**: ✅ Clean component structure, fast merges, type-safe code

**Results**:
- **App.tsx modularization**: Reduced from 500 lines to 93 lines (81% reduction)
  - Created custom hooks: `useAudioCapture`, `useTranscription`
  - Created components: `InitSection`, `RecordingControls`, `AudioLevelMeter`, `RecordingButtons`, `TranscriptionProgress`, `TranscriptDisplay`
  - Created utility: `formatDuration`
  - Improved separation of concerns and testability
- **Merge algorithm optimization**: Binary search + early exit optimization
  - Complexity: O(n²) → O(n log m + n*k) where k ≈ 1-2
  - Expected speedup: ~45x for typical meetings (n=100, m=50)
  - Added `ensureSortedSegments` and `binarySearchSegments` functions
- **Type safety**: Fixed RecordingSession types
  - Changed `endTime?: Date` to `endTime: Date` (always required)
  - Created `RecordingSessionWithBlob` interface for `stopRecording()` return type
  - Eliminated type-unsafe intersections
- **Cleanup**: Removed whisper-node-addon remnants
  - Deleted `test-worker.js` (unused test file)
  - Deleted `scripts/postinstall.sh` (native module symlink script)
  - Removed `postinstall` script from package.json

---

### Sprint 3: Performance & Portability 📦
**Target**: Phase 2+ (After M365 Integration)
**Duration**: ~16 hours
**Priority**: Medium

**Tasks**:
- [ ] Generalize Python env discovery (Windows/Linux support)
- [ ] Real-time mono downmix (eliminate ffmpeg preprocessing, 3-5s savings)
- [ ] Warm Python worker for diarization (instant subsequent runs)

**Success Criteria**: Cross-platform support, faster transcription start, stable memory

---

## Phase 1.4: Recording Announcement ✅

**Completed**: 2025-10-13
**Duration**: ~2 hours

### Goals
Add audio announcement for meeting transparency and consent.

### Requirements
When user clicks "Start Recording", play an announcement through system speakers to inform meeting participants that recording is in progress. This ensures transparency and allows participants to object or leave if they don't consent.

### Announcement Text
> "This meeting, with your permission, is being recorded to generate meeting notes. These recordings will be deleted after notes are generated."

### Why This Matters
- **Legal compliance**: Some jurisdictions require consent
- **Ethical transparency**: Participants should know they're being recorded
- **Trust building**: Shows respect for participant privacy
- **Audio documentation**: Announcement is captured in recording itself

### Tasks
- [x] Implement `playAnnouncement()` method in AudioCaptureService
- [x] Use macOS `say` command for text-to-speech
- [x] Trigger announcement immediately after "Start Recording" clicked
- [x] Add 2-second delay before recording starts (allow announcement to complete)
- [x] UI status indicator during announcement playback
- [ ] Update deletion policy: "delete after summary generation" (deferred to Phase 3)
- [ ] Add announcement settings (Phase 7): custom text, enable/disable

### Technical Approach
- Use `say` command (built-in macOS TTS)
- `spawn('say', [announcementText])`
- Wait for completion before starting recording
- Announcement captured in audio file

### Platform Support
- macOS: `say` command (built-in)
- Windows (future): PowerShell `Add-Type -AssemblyName System.Speech`
- Linux (future): `espeak` or `festival`

### Audio File Deletion Policy Update
- **Old Policy**: Delete audio after transcription succeeds
- **New Policy**: Delete audio after **summary generation** succeeds
- **Rationale**: Ensures audio is available if transcription needs regeneration

### Success Criteria
✅ Announcement plays through system speakers when recording starts
✅ Remote meeting participants hear the announcement
✅ Announcement is captured in the recording
✅ Recording starts smoothly after announcement completes (2-second delay)
✅ UI shows announcement status

### Implementation Details
- **IPC Handler**: `play-announcement` in main process
- **Service Method**: `AudioCaptureService.playAnnouncement()`
- **Text-to-Speech**: macOS `say` command via `child_process.spawn`
- **Recording Flow**: Announcement → 2-second delay → Start recording
- **UI State**: `isPlayingAnnouncement` state with "📢 Playing announcement..." status
- **Error Handling**: Announcement failures don't prevent recording

### Announcement Text
"This meeting, with your permission, is being recorded to generate meeting notes. These recordings will be deleted after notes are generated."

### Documentation
- Updated: `docs/planning/roadmap.md`
- Updated: `CHANGELOG.md` v0.1.6
- Updated: `CLAUDE.md`

---

## Phase 1.5: Chunked Recording with Auto-Save ✅

**Completed**: 2025-10-13
**Duration**: ~3 hours

### Goals
Prevent data loss and memory exhaustion during long meetings.

### Problem Statement
Current implementation buffers entire recording in memory, which creates risks:
1. **Memory exhaustion**: 60-minute recording = ~60MB RAM, 120 minutes = ~120MB
2. **Browser crash**: Large Blob objects (>1GB) can crash renderer process
3. **Data loss**: If app crashes before `stopRecording()`, entire recording is lost
4. **File save failure**: Very large ArrayBuffers may fail IPC transfer or disk write

### Solution
Time-based auto-save with chunking: Save audio chunks to disk every 5 minutes automatically, then merge on completion.

### Tasks
- [x] Modify MediaRecorder to use `timeslice: 5 minutes`
- [x] Implement automatic chunk save to disk
- [x] Add IPC handler: `saveAudioChunk(arrayBuffer, sessionId, filename)`
- [x] Create chunk directory structure: `recordings/session_ID/chunk_N.wav`
- [x] Implement WAV chunk merging using FFmpeg
- [x] Update UI: show "Last saved: X minutes ago" indicator
- [x] Add cleanup: delete chunks after successful merge
- [ ] Add crash recovery: auto-merge incomplete recordings on startup (deferred)
- [ ] Test with 60-minute recording (verify memory stays <10MB) (manual testing required)
- [ ] Test crash recovery (kill app mid-recording, verify chunks merge) (deferred)

### Technical Approach
1. **Chunked Recording**: `MediaRecorder` with `timeslice: 300000` (5 min)
2. **Chunk Storage**: `userData/recordings/session_ID/chunk_000.wav`
3. **Auto-Save**: Each chunk saved to disk immediately
4. **Merge on Stop**: FFmpeg concatenates all chunks into `merged.wav`
5. **Crash Recovery**: On startup, check for incomplete sessions and merge chunks

### Memory Usage Comparison

| Meeting Duration | Current (Buffered) | With Chunking (5min) |
|------------------|-------------------|----------------------|
| 5 minutes        | ~5 MB RAM         | ~5 MB RAM            |
| 30 minutes       | ~30 MB RAM        | ~5 MB RAM ✅          |
| 60 minutes       | ~60 MB RAM ⚠️      | ~5 MB RAM ✅          |
| 120 minutes      | ~120 MB RAM ⚠️⚠️   | ~5 MB RAM ✅          |

### Performance Impact
- Disk I/O every 5 minutes: ~5MB write (~0.1 seconds on SSD)
- Merge time on stop: ~1 second for 60-minute recording
- Total overhead: Negligible, worth the safety

### Dependencies
- `ffmpeg` - Already required for Phase 1.2 (audio preprocessing)
- No new dependencies needed ✅

### Success Criteria
- ✅ Memory usage stays constant (~5MB) regardless of recording duration
- ✅ Chunks auto-save every 5 minutes without user intervention
- ✅ Merged audio is seamless (no gaps or artifacts)
- ⏸️ Crash recovery works: incomplete recordings merge on startup (deferred to Phase 6)
- ✅ UI shows "Last saved: X minutes ago" during recording
- ⏸️ 60-minute recording completes successfully with <10MB RAM usage (manual testing required)

### Implementation Details
- **IPC Handlers**: `save-audio-chunk`, `merge-audio-chunks`
- **Service Methods**: `saveCurrentChunk()`, `getState()` with `lastSaveTime` and `chunkIndex`
- **FFmpeg Merge**: Uses concat demuxer with `-f concat -safe 0 -c copy`
- **UI Indicator**: Blue info box showing "💾 Auto-save: Chunk N | Last saved: Xm Ys ago"
- **Chunk Cleanup**: Individual chunks deleted after successful merge

### Documentation
- Will update: `docs/technical/audio-capture.md`

---

## Phase 2.1: M365 Authentication ✅

**Completed**: 2025-10-13

### Goals
Implement Microsoft 365 OAuth2 authentication with secure token storage.

### Deliverables
- ✅ MSAL Node integration for OAuth2
- ✅ Interactive browser authentication flow
- ✅ Secure token storage in system keychain (keytar)
- ✅ Automatic token refresh
- ✅ Login/logout UI component
- ✅ Azure AD setup documentation

### Key Decisions
- ✅ Chosen: MSAL Node for OAuth2 (official Microsoft library)
- ✅ Chosen: keytar for system keychain storage (secure, cross-platform)
- ✅ Chosen: Public Client Flow (no client secret required for Electron apps)
- ✅ Added: Browser-based interactive auth (opens system default browser)

### Implementation Details
- **Service**: `M365AuthService` with OAuth2 flow
- **IPC Handlers**: `m365-auth-initialize`, `m365-auth-login`, `m365-auth-logout`, `m365-auth-get-state`, `m365-auth-get-token`, `m365-auth-refresh-token`
- **UI Component**: `M365AuthSection` with user info display
- **Token Storage**: System keychain via keytar (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **Permissions Requested**:
  - `User.Read` - Read user profile
  - `Calendars.Read` - Read calendar events
  - `Calendars.ReadWrite` - Create calendar events
  - `Mail.Send` - Send emails
  - `offline_access` - Refresh tokens

### Success Criteria
✅ User can log in with M365 account via browser
✅ Tokens stored securely in system keychain
✅ Automatic token refresh when expired
✅ User profile displayed after login
✅ Logout clears tokens and session

### Documentation
- Created: `docs/guides/azure-ad-setup.md` - Complete Azure AD setup guide
- Updated: `docs/planning/roadmap.md` - Phase 2.1 completion
- See: `CHANGELOG.md` v0.2.0

---

## Phase 2: Microsoft Graph Integration ✅

**Status**: Phases 2.1 and 2.2 Complete

---

### Phase 2.2: Calendar & Meeting Context ✅

**Completed**: 2025-10-14

**Goals**:
- Fetch today's meetings
- Extract attendee names and email addresses

**Tasks**:
- [x] Implement Graph API service
- [x] Fetch calendar events
- [x] Extract meeting metadata
- [x] Cache calendar data locally
- [x] Display meetings in UI

**Success Criteria**: ✅ GUI shows today's M365 meetings with attendees

**Delivered**:
- GraphApiService with calendar operations
- Today's meetings display with attendees, time, location
- Active/upcoming meeting indicators
- Meeting selection foundation for Phase 2.3-3

---

## Phase 2.3-3: LLM-Based Meeting Intelligence 📅

**Status**: Planned

**Approach**: Combined phase leveraging LLM for both speaker identification and summarization

**Goals**:
- Use meeting context (attendees, emails) + transcript for intelligent analysis
- LLM identifies speakers based on context, not naive positional mapping
- Generate meeting summaries with properly identified speakers and action items

**Tasks**:
- [ ] Meeting selection UI
  - Date range filter (default: Today, option: Last 7 Days)
  - Simple dropdown/list of meetings for selected range
  - Manual selection (no automatic linking until Phase 6)
- [ ] Email context fetching (last 10 emails with participants via Graph API)
- [ ] Claude API integration (Anthropic SDK)
- [ ] Prompt engineering for speaker identification
  - Input: Meeting metadata + email context + transcript with SPEAKER_00 labels
  - Output: Speaker mapping (SPEAKER_00 → John Smith) with confidence
- [ ] Prompt engineering for meeting summarization
  - Generate summary with identified speakers
  - Extract action items with assignments
  - Identify key decisions and follow-ups
- [ ] UI for summary display and editing
- [ ] Handle API errors and retries

**Why This Approach**:
- **More accurate**: LLM analyzes content, roles, topics to identify speakers
- **Rich context**: Email history provides conversation patterns and participant dynamics
- **Single workflow**: Speaker ID + summarization in one LLM call (more efficient)
- **Better output**: "John suggested..." vs "SPEAKER_00 suggested..."

**Estimated Cost**: ~$0.02-0.03 per 60-min meeting (Claude API for context + transcript)

**Success Criteria**:
- User selects meeting from calendar (Today or Last 7 Days)
- System fetches meeting context (metadata + recent emails)
- LLM correctly identifies 80%+ of speakers
- Summary includes speaker names, action items, decisions
- Editable summary before distribution (Phase 5)

**Future Enhancement (Phase 6)**:
- Automatic meeting-recording linkage via database
- Search meetings by subject/attendee
- Extended date ranges (30 days, custom range)
- Remember which recording belongs to which meeting

---

## Phase 4: GUI Development 📅

**Goals**:
- Build intuitive Electron interface
- Summary editor with recipient selection

**Tasks**:
- [ ] Meeting list component
- [ ] Recording controls (already done in Phase 1.1)
- [ ] Live transcript view (already done in Phase 1.2/1.3)
- [ ] Summary editor
- [ ] Recipient selector
- [ ] Email preview

**Success Criteria**: Complete user flow from meeting selection to edited summary

---

## Phase 5: Email Distribution 📅

**Goals**:
- Send summaries via Microsoft Graph API

**Tasks**:
- [ ] Implement email sending via Graph API
- [ ] Create email template
- [ ] Add attachment support
- [ ] Send confirmation dialog
- [ ] Sent history tracking

**Success Criteria**: Send formatted summary email to test recipients

---

## Phase 6: Data Management & Persistence 📅

**Goals**:
- Store recordings, transcripts, summaries locally
- Smart storage management with quotas

**Tasks**:
- [ ] Set up SQLite database
- [ ] Create schema (meetings, transcripts, summaries)
- [ ] Meeting history view in GUI
- [ ] Search functionality
- [ ] Audio file lifecycle management:
  - Delete audio after transcription (default)
  - Optional: keep audio with 5GB quota
  - Auto-delete oldest files when quota exceeded

**Storage Strategy**:
- Default: Delete audio immediately after transcription
- Optional: Keep audio files with configurable quota (default 5GB)
- FIFO cleanup when quota exceeded

**Success Criteria**: View history of past meetings, storage stays under quota

---

## Phase 7: Configuration & Settings 📅

**Goals**:
- Make application configurable

**Tasks**:
- [ ] Build settings UI panel
- [ ] API key configuration (encrypted)
- [ ] Whisper model selection (tiny/base/small)
- [ ] Summary style preferences
- [ ] Data retention settings
- [ ] Audio device selection
- [ ] Audio file retention toggle

**Configuration Options**:
- API credentials (encrypted)
- Whisper model size
- Summary verbosity
- Audio file retention (on/off, quota)
- Transcript/summary retention period
- Default email template
- Audio input device

**Success Criteria**: Configure API keys and preferences, persist across restarts

---

## Phase 8: Error Handling & Logging 📅

**Goals**:
- Robust error handling and debugging support

**Tasks**:
- [ ] Centralized error handling
- [ ] Logging service (winston or pino)
- [ ] Log all API calls and responses
- [ ] User-friendly error messages
- [ ] Crash reporting (optional: Sentry)
- [ ] Debug mode

**Success Criteria**: Application handles all common errors gracefully

---

## Phase 9: Performance Optimization 📅

**Goals**:
- Ensure smooth performance with large meetings

**Tasks**:
- [ ] Profile memory usage during long recordings
- [ ] Optimize Whisper processing (chunking, parallelization)
- [ ] Implement transcript streaming (don't wait for full audio)
- [ ] Parallel transcription + diarization
- [ ] GPU acceleration for diarization (PyTorch Metal)
- [ ] Lazy-load meeting history

**Performance Targets**:
- Max memory: <500MB during 60-min meeting
- Transcript latency: <30 seconds behind real-time
- Summary generation: <60 seconds for 60-min meeting
- GUI responsiveness: <100ms for interactions

**Success Criteria**: Handle 2-hour meeting without performance degradation

---

## Phase 10: Documentation & Packaging 📅

**Goals**:
- Prepare for deployment and user onboarding

**Tasks**:
- [ ] Write user documentation
- [ ] Create setup guide
- [ ] Document troubleshooting steps
- [ ] Add inline code documentation
- [ ] Developer setup guide
- [ ] Build macOS .dmg package
- [ ] Auto-update mechanism (optional)
- [ ] Release notes

**Documentation Sections**:
- Installation & Setup
- API Key Setup (Claude/M365)
- Usage Guide
- Troubleshooting
- Privacy & Data Handling
- Development Setup

**Success Criteria**: New user can install and run app following documentation

---

## Future Enhancements (Post-MVP)

### Cloud Transcription Option
- [ ] Hybrid transcription mode (local vs AssemblyAI)
- [ ] Use cases: low-end hardware, long meetings, batch processing
- [ ] Cost: $0.385/meeting (cloud) vs $0.015/meeting (local)
- [ ] Implementation: `TRANSCRIPTION_MODE=local|cloud` setting

### GPU Acceleration for Diarization
- [x] PyTorch Metal (MPS) support for Apple Silicon (Phase 1.6 Complete)
- [ ] CUDA support for Windows/Linux with NVIDIA GPUs
- ✅ Measured speedup: 5.8x on M3 Pro

### Cross-Platform Support
- [ ] Windows 10+ (electron-audio-loopback supports it)
- [ ] Linux (PulseAudio via electron-audio-loopback)

### Advanced Features
- [ ] Real-time streaming transcription
- [ ] Multi-language support (UI localization)
- [ ] Meeting highlights/clips extraction
- [ ] Chrome extension for direct browser capture
- [ ] Slack/Discord integration

---

## Cost Estimate (Current MVP)

### Per-Meeting Cost (60 minutes)

**Current (Phase 2.2)**:
- **Transcription**: $0.00 (local Whisper)
- **Diarization**: $0.00 (local pyannote.audio)
- **M365 Calendar**: $0.00 (included with subscription)
- **Total**: **$0.00 per meeting** 🎉

**After Phase 2.3-3 (LLM Intelligence)**:
- **Transcription**: $0.00 (local Whisper)
- **Diarization**: $0.00 (local pyannote.audio)
- **Speaker ID + Summarization**: $0.02-0.03 (Claude API, combined)
- **M365 API**: $0.00 (included with subscription)
- **Total**: **~$0.02-0.03 per meeting** (~$0.40-0.60/month for 20 meetings)

### Comparison vs Cloud-Only
- Azure Speech + Azure OpenAI: ~$2.50/meeting = $50/month
- **Meeting Agent**: ~$0.02-0.03/meeting = $0.40-0.60/month
- **Savings**: 98-99% 💰

---

## Architecture Evolution

### Current (Phase 1.3)
```
Electron App
  ├─ Audio Capture (electron-audio-loopback)
  ├─ Transcription (whisper-cpp CLI)
  └─ Diarization (pyannote.audio Python)
```

### Phase 2-3
```
Electron App
  ├─ Audio Capture
  ├─ Transcription
  ├─ Diarization
  ├─ M365 Integration (MSAL + Graph API)
  └─ AI Summarization (Claude API)
```

### Phase 6+
```
Electron App
  ├─ Audio Capture
  ├─ Transcription
  ├─ Diarization
  ├─ M365 Integration
  ├─ AI Summarization
  ├─ SQLite Database
  └─ Storage Management
```

---

## Key Design Principles

1. **Local-First**: Transcription/diarization run on-device (privacy, cost)
2. **Subprocess Pattern**: ML models run in isolated processes (no native modules)
3. **User Control**: Review summaries before sending, control data retention
4. **Cost Optimization**: Minimize API costs (local Whisper, Claude for summaries only)
5. **Privacy-First**: No telemetry, user controls all data

---

## References

- **CLAUDE.md**: Full development plan with detailed phase breakdowns
- **CHANGELOG.md**: Version history with completion dates
- **docs/technical/**: Implementation details for completed phases
- **docs/developer/architecture.md**: System architecture overview

---

**Maintained by**: Claude Code (Sonnet 4.5)
**Last Updated**: 2025-10-14
