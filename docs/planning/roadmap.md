# Development Roadmap

**Project**: Meeting Agent
**Version**: 0.1.3
**Last Updated**: 2025-10-13

## Overview

Meeting Agent is being developed in 10 phases, from foundation to production-ready application. Current status: **Phase 1.3 Complete** (Audio Capture + Transcription + Diarization).

---

## Phase Status

| Phase | Name | Status | Completion Date |
|-------|------|--------|-----------------|
| 0 | Foundation Setup | ✅ Complete | 2025-10-07 |
| 1.1 | Audio Capture | ✅ Complete | 2025-10-09 |
| 1.2 | Transcription | ✅ Complete | 2025-10-13 |
| 1.3 | Diarization | ✅ Complete | 2025-10-13 |
| R1 | Refactor Sprint 1 | ✅ Complete | 2025-10-13 |
| R2 | Refactor Sprint 2 | 🔜 Next | - |
| 1.4 | Recording Announcement | 📅 Planned | - |
| 1.5 | Chunked Recording | 📅 Planned | - |
| R3 | Refactor Sprint 3 | 📅 Planned | - |
| 2.1 | M365 Authentication | 📅 Planned | - |
| 2.2 | Calendar & Meeting Context | 📅 Planned | - |
| 3 | AI Summarization | 📅 Planned | - |
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

### Sprint 2: Architecture Improvements 🔥
**Target**: During Phase 1.4-1.5
**Duration**: ~7.5 hours
**Priority**: High

**Tasks**:
- [ ] Modularize App.tsx (440 lines → <150 lines, extract hooks/components)
- [ ] Optimize merge algorithm (O(n²) → O(n log m), 45x faster)
- [ ] Fix RecordingSession types (type safety)
- [ ] Retire whisper-node-addon remnants (cleanup)

**Success Criteria**: Clean component structure, fast merges, type-safe code

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

## Phase 1.4: Recording Announcement 🔜

**Status**: Next Up (After Sprint 1)
**Prerequisites**: Complete Sprint 1 (Critical Bug Fixes)

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
- [ ] Implement `playAnnouncement()` method in AudioCaptureService
- [ ] Use macOS `say` command for text-to-speech
- [ ] Trigger announcement immediately after "Start Recording" clicked
- [ ] Add 2-second delay before recording starts (allow announcement to complete)
- [ ] Update deletion policy: "delete after summary generation" (not just transcription)
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
- Announcement plays through system speakers when recording starts
- Remote meeting participants hear the announcement
- Announcement is captured in the recording
- Recording starts smoothly after announcement completes

### Documentation
- Will update: `docs/technical/audio-capture.md`

---

## Phase 1.5: Chunked Recording with Auto-Save 📅

**Status**: Planned

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
- [ ] Modify MediaRecorder to use `timeslice: 5 minutes`
- [ ] Implement automatic chunk save to disk
- [ ] Add IPC handler: `saveAudioChunk(arrayBuffer, filename)`
- [ ] Create chunk directory structure: `recordings/session_ID/chunk_N.wav`
- [ ] Implement WAV chunk merging using FFmpeg
- [ ] Add crash recovery: auto-merge incomplete recordings on startup
- [ ] Update UI: show "Last saved: X minutes ago" indicator
- [ ] Add cleanup: delete chunks after successful merge
- [ ] Test with 60-minute recording (verify memory stays <10MB)
- [ ] Test crash recovery (kill app mid-recording, verify chunks merge)

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
- Memory usage stays constant (~5MB) regardless of recording duration
- Chunks auto-save every 5 minutes without user intervention
- Merged audio is seamless (no gaps or artifacts)
- Crash recovery works: incomplete recordings merge on startup
- UI shows "Last saved: X minutes ago" during recording
- 60-minute recording completes successfully with <10MB RAM usage

### Documentation
- Will update: `docs/technical/audio-capture.md`

---

## Phase 2: Microsoft Graph Integration 📅

**Status**: Planned

### Phase 2.1: Authentication

**Goals**:
- Authenticate with Microsoft 365
- Store and refresh tokens securely

**Tasks**:
- [ ] Register application in Azure AD
- [ ] Configure MSAL for Electron
- [ ] Implement OAuth2 flow
- [ ] Store tokens in system keychain
- [ ] Build login/logout UI

**Success Criteria**: User can log in with M365 account

---

### Phase 2.2: Calendar & Meeting Context

**Goals**:
- Fetch today's meetings
- Extract attendee names and email addresses

**Tasks**:
- [ ] Implement Graph API service
- [ ] Fetch calendar events
- [ ] Extract meeting metadata
- [ ] Cache calendar data locally
- [ ] Display meetings in UI

**Success Criteria**: GUI shows today's M365 meetings with attendees

---

## Phase 3: AI Summarization 📅

**Goals**:
- Generate intelligent meeting summaries using Claude API
- Extract action items and decisions

**Tasks**:
- [ ] Set up Anthropic API client
- [ ] Design summary prompt template
- [ ] Implement summarization service
- [ ] Extract action items
- [ ] Handle API errors and retries

**Estimated Cost**: ~$0.015 per 60-min meeting

**Success Criteria**: Generate coherent summary with action items

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

### LLM-Based Speaker Attribution
- [ ] Use Claude API to match speaker labels with attendee names
- [ ] Input: Generic labels + attendee list
- [ ] Output: "John Smith" instead of "SPEAKER_00"

### GPU Acceleration for Diarization
- [ ] PyTorch Metal (MPS) support for Apple Silicon
- [ ] CUDA support for Windows/Linux with NVIDIA GPUs
- [ ] Expected speedup: 3-10x (30s audio in 3-10s)

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
- **Transcription**: $0.00 (local Whisper)
- **Diarization**: $0.00 (local pyannote.audio)
- **Summarization**: $0.015 (Claude API, Phase 3)
- **M365 API**: $0.00 (included with subscription)

**Total**: ~$0.015 per meeting (~$0.30/month for 20 meetings)

### Comparison vs Cloud-Only
- Azure Speech + Azure OpenAI: ~$2.50/meeting = $50/month
- **Savings**: 99% 🎉

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
**Last Updated**: 2025-10-13
