# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Meeting Agent** is a macOS desktop application that captures, transcribes, and summarizes online meetings across any platform (Teams, Zoom, Google Meet, etc.). It runs **100% locally** for transcription and speaker identification, with optional cloud services for summarization and M365 integration.

### Current Status

**Version**: 0.6.1 (Phase 5: Email Distribution Complete ✅) **PRODUCTION-READY**
**Last Updated**: 2025-01-27

**What Works Now**:
- ✅ Native system audio + microphone capture (no virtual drivers)
- ✅ Local transcription using whisper.cpp (Metal GPU acceleration)
- ✅ Speaker diarization using pyannote.audio (Metal GPU acceleration)
- ✅ Speaker-labeled transcripts: `[SPEAKER_00]: text`
- ✅ Recording announcement for transparency and consent
- ✅ Chunked recording with auto-save (prevents data loss, memory exhaustion)
- ✅ Metal GPU acceleration for both transcription AND diarization (3-10x speedup)
- ✅ Microsoft 365 authentication with OAuth2 and secure token storage
- ✅ Today's calendar meetings display with attendees and meeting details
- ✅ Meeting intelligence backend (two-pass LLM workflow, database, batch processing)
- ✅ Meeting intelligence UI (recording browser, summary display, export functionality)
- ✅ Standalone recording support (no calendar meeting required)
- ✅ Stop audio capture button (free system resources when done)
- ✅ Meeting-recording association (Option C: link during summary generation)
- ✅ Two-tab interface: Standalone Recordings | Calendar Meetings
- ✅ Date range filters (Today, Last 7 Days, Last 30 Days, All)
- ✅ Search by meeting title
- ✅ Auto-sync from M365 when opening calendar tab
- ✅ "Back to Selection" navigation button
- ✅ **Browse Mode**: View past transcripts and summaries
- ✅ **Transcript Viewer**: Display speaker-labeled transcripts with metadata
- ✅ **Mode Toggle**: Switch between Browse and Generate modes
- ✅ **Aileron Branding**: Logo, colors, and Montserrat font integrated
- ✅ **Inline Editing**: Edit summary text, action items, key decisions, speaker mappings
- ✅ **Recipient Selector**: Choose email recipients from meeting attendees
- ✅ **Email Preview**: Preview formatted email with Aileron branding before sending
- ✅ **Subject Line Editor**: Customize email subject line
- ✅ **Email Distribution**: Send emails via Microsoft Graph API with Aileron branding
- ✅ **Email Tracking**: Database tracks sent emails with timestamp and recipients

**Next Phase**: Phase 6 - Data Management & Persistence (storage quotas, auto-deletion, advanced search)

### Recent Updates

**Phase 5: Email Distribution (January 27, 2025) ✅**:
- ✅ **Send Emails via Microsoft Graph API**: One-click email distribution through `/me/sendMail` endpoint
- ✅ **Email Generation Utility**: `emailGenerator.ts` with HTML and plain text generation
- ✅ **Aileron Logo in Emails**: Base64-embedded PNG (1KB) displays in email header
- ✅ **Table-based Email Layout**: Ensures compatibility across all email clients (Outlook, Gmail, etc.)
- ✅ **Database Email Tracking**: New columns `sent_at` and `sent_to_json` track sent emails
- ✅ **UI Components**: Loading states (Sending.../Sent!), error handling, success messages
- ✅ **IPC Layer**: Complete backend-to-frontend communication for email sending
- ✅ **TypeScript Type Safety**: Full type coverage with `SendEmailOptions` interface
- ✅ **Complete Email Content**: All summary sections included (participants, actions, decisions, discussion, quotes, questions, parking lot)
- ✅ **Error Handling**: User-friendly messages for auth (401) and permission (403) errors
- ✅ **Non-blocking Database**: Email sent successfully even if database update fails
- **Duration**: ~8 hours (initial implementation + branding enhancement)
- **Status**: Production-ready, fully tested (UAT passed)
- **Cost**: $0.00/email (included in M365 subscription)

**Phase 4a: Browse Mode & Branding (October 21, 2025) ✅**:
- ✅ **Browse/Generate Mode Toggle**: Switch between viewing past recordings and generating new summaries
- ✅ **Unified Recording List**: Shows all recordings with status badges (✅ Summary | 📝 Transcript)
- ✅ **TranscriptViewer Component**: Full viewer for past transcripts with speaker labels
- ✅ **Smart Navigation**: Click to view transcript or summary based on recording status
- ✅ **Database Methods**: 3 new methods (getTranscriptByRecordingId, getSummaryByRecordingId, getRecordingsWithSummaries)
- ✅ **IPC Handlers**: 3 new handlers for browse mode functionality
- ✅ **State Management**: Proper state clearing when switching modes
- ✅ **Deduplication Logic**: Prevents duplicate keys from stale React state
- ✅ **Aileron Branding**: Complete design system with purple (#2D2042) and blue (#60B5E5) colors
- ✅ **Logo Integration**: Aileron logo in app header with proper Vite asset handling
- ✅ **Typography**: Montserrat font family via Google Fonts
- **Duration**: ~8 hours (2 commits: branding + browse mode)
- **Status**: Production-ready

**Phase 4b: Summary Editor & Email (January 23, 2025) ✅**:
- ✅ **Complete Inline Editing UI**: All summary components now editable
  - Summary text editor (existed from Phase 4a, verified working)
  - Action items editor with add/edit/delete, assignee, priority, due date
  - Key decisions editor with add/edit/delete
  - Speaker mappings editor with name, email, confidence, reasoning fields
- ✅ **RecipientSelector Component**: Full-featured email recipient selection
  - Auto-loads meeting attendees from database
  - Always includes meeting organizer as first recipient
  - Select All / Deselect All functionality
  - Custom recipient input with email validation
  - Graceful handling of standalone recordings (no meeting)
- ✅ **EmailPreview Component**: Professional email preview with Aileron branding
  - HTML email template with gradient header (Purple → Blue)
  - **Complete email content**: summary, participants, action items, decisions, discussion by topic, notable quotes, open questions, parking lot
  - Participant formatting: "Name, Organization" (extracted from email domain)
  - Subject line uses meeting title (not UUID)
  - Ready for Graph API `sendMail` integration (Phase 5)
- ✅ **Database Schema**: 3 new columns added with migration support
  - `final_recipients_json` - stores selected recipients
  - `final_subject_line` - custom email subject
  - `edited_by_user` - tracks if user edited the summary
- ✅ **Backend Support**: Complete IPC layer for email features
  - `db-get-meeting-by-id` handler
  - `getSummary()` JOINs with meetings table for subject
  - `getRecordingsWithTranscripts()` prioritizes complete summaries
  - Updated `updateSummaryFinal()` to persist email settings
- ✅ **Post-UAT Fixes** (6 critical improvements):
  - Browse Mode: prioritize complete summaries over any summary
  - UX consistency: summary badges in Generate mode
  - Email subject: use meeting title instead of UUID
  - Participant display: clean formatting without speaker labels
  - Complete content: all detailed notes sections in email
  - Organizer inclusion: meeting owner always in recipient list
- **Duration**: ~12 hours (initial implementation + UAT fixes)
- **Status**: Production-ready, manually tested end-to-end, email sending ready for Phase 5
- **User Feedback**: Additional UI/UX improvements deferred to future phase

**Phase 2.3-4 Complete: Meeting-Recording Association (October 21, 2025) ✅**:
- ✅ **Complete Option C Implementation**: Link recordings to meetings during summary generation
- ✅ **Two-Tab Interface**: "Standalone Recordings" | "Calendar Meetings"
- ✅ **MeetingPicker Dialog**: Select meeting or "Standalone Recording" option
- ✅ **Date Range Filters**: Today, Last 7 Days, Last 30 Days, All
- ✅ **Search Functionality**: Filter meetings by title (with null-safety)
- ✅ **Auto-Sync from M365**: Automatic meeting sync for selected date range
- ✅ **Recording Status Badges**: "🎙️ Recorded" | "❌ No Recording"
- ✅ **Back to Selection Button**: Navigate back from summary view
- ✅ **Database Methods**: 5 new methods (getMeetingsByDateRange, searchMeetingsByTitle, getRecordingsByMeetingId, updateSummaryMeetingId, updateRecordingMeetingId)
- ✅ **Graph API Enhancement**: getMeetingsInDateRange with auto-save to database
- ✅ **Bug Fixes**: Search safety, M365 persistence, auto-sync date ranges, UI refresh
- ✅ **User Tested**: Complete flow verified working end-to-end
- **Duration**: ~6 hours (including bug fixes)
- **Commits**: 6 (implementation + fixes + documentation)

**Phase 2.3-3 Complete (October 2025) ✅**:
- ✅ **MeetingSelector**: Visual recording browser with transcript previews
- ✅ **SummaryProcessing**: Real-time status display during batch processing
- ✅ **SummaryDisplay**: Complete summary view with speaker mappings, action items, decisions
- ✅ **Export Feature**: Permanent button that downloads markdown + copies to clipboard
- ✅ **Stop Audio Capture**: Deinitialize button to free system resources
- ✅ **App Restructuring**: Meeting Intelligence accessible without audio initialization
- ✅ **Standalone Recordings**: Support for recordings without calendar meeting
- ✅ **Bug Fixes**: API key authentication, TypeScript errors, database schema updates
- **Known Limitations**: Meeting association missing (addressed in Phase 2.3-4)

**Phase 2.3-3 Backend Implementation (January 2025)**:
- ✅ **Complete backend infrastructure** for intelligent meeting summarization
- ✅ **DatabaseService**: SQLite with 7 tables (meetings, recordings, transcripts, diarization_results, meeting_summaries, batch_jobs, email_context_cache)
- ✅ **ClaudeBatchService**: Anthropic Batch API integration with adaptive polling (5min → 30sec)
- ✅ **MeetingIntelligenceService**: Two-pass orchestrator (Pass 1: speaker ID + summary, Pass 2: validation)
- ✅ **PromptLoader**: Template loading and variable substitution utility
- ✅ **Prompt Templates**: Pass 1 (initial summary) and Pass 2 (validation) templates
- ✅ **7 IPC Handlers**: Complete main ↔ renderer communication layer
- ✅ **Background Processing**: Non-blocking async workflow with database persistence
- ✅ **Cost**: $0.09 per 60-min meeting (96% savings vs cloud alternatives)
- ⚠️ **Email Context Removed**: Testing showed no value for speaker identification; feature deprecated (see `docs/archive/email-context-deprecation.md`)

**Phase 2.2 (Calendar & Meeting Context)**:
- ✅ Microsoft Graph API service for calendar operations
- ✅ Fetch today's meetings with `/me/calendarview` endpoint
- ✅ Display meetings with time, location, attendees, and join links
- ✅ Proper timezone handling (UTC to local conversion)
- ✅ Visual indicators for active/upcoming meetings
- ✅ MSAL cache persistence for automatic token refresh
- ✅ Calendar section with refresh functionality

**Phase 2.1 (M365 Authentication)**:
- ✅ OAuth2 authentication with MSAL Node
- ✅ Secure token storage in system keychain (keytar)
- ✅ Interactive browser login flow
- ✅ Automatic token refresh with MSAL cache persistence
- ✅ Login/logout UI with user profile display
- ✅ Azure AD setup documentation

**Phase 1.6 (GPU Acceleration)**:
- ✅ Metal GPU acceleration for diarization (pyannote.audio)
- ✅ Automatic device detection (Metal → CUDA → CPU fallback)
- ✅ Expected 3-10x speedup on Apple Silicon
- ✅ Graceful fallback to CPU if GPU unavailable
- ✅ Progress messages show device used

**Phase 1.5 (Chunked Recording)**:
- ✅ Auto-save chunks every 5 minutes during recording
- ✅ Memory stays constant (~5MB) regardless of duration
- ✅ FFmpeg merges chunks seamlessly on stop
- ✅ UI shows "Last saved: X minutes ago" indicator
- ✅ Chunk cleanup after successful merge

**Sprint 2 (Refactoring)**:
- ✅ App.tsx modularization: 500 lines → 93 lines (6 components + 2 hooks)
- ✅ Merge algorithm optimization: O(n²) → O(n log m) using binary search
- ✅ Type safety: Fixed RecordingSession types with proper interfaces
- ✅ Cleanup: Removed whisper-node-addon remnants

**Phase 1.4 (Recording Announcement)**:
- ✅ Announcement plays automatically when recording starts
- ✅ Uses macOS `say` command for text-to-speech
- ✅ Non-blocking announcement captured in recording
- ✅ UI shows "📢 Playing announcement..." status

### Key Features
- **Local-first**: All transcription and diarization happen on-device ($0.00/meeting)
- **Privacy-focused**: User controls all data, no cloud dependencies for core features
- **Cross-platform ready**: macOS 12.3+ (Windows/Linux support via electron-audio-loopback)
- **Metal GPU acceleration**: Fast transcription AND diarization on Apple Silicon
- **Subprocess pattern**: No native Node.js modules, clean process isolation

---

## Documentation Structure

**DO NOT duplicate information in this file.** Reference the appropriate documentation:

### For Development Details
- **Project Roadmap**: `docs/planning/roadmap.md` - All phases, tasks, and timelines
- **Architecture**: `docs/developer/architecture.md` - System design, patterns, data flow
- **Technical Docs**: `docs/technical/` - Implementation details for each phase:
  - `audio-capture.md` - Phase 1.1 (electron-audio-loopback, Web Audio API)
  - `transcription.md` - Phase 1.2 (whisper-cpp CLI, ffmpeg preprocessing)
  - `diarization.md` - Phase 1.3 (pyannote.audio, temporal intersection matching)

### For Version History
- **CHANGELOG.md**: Version history with completion dates and major changes

### For Users
- **README.md**: Installation, setup, usage, troubleshooting

---

## Documentation Update Protocol

**IMPORTANT**: When making code changes, update documentation systematically to prevent drift.

### When to Update Documentation

Documentation updates should happen **as part of the same commit** that makes the code change. Never commit code without updating the relevant documentation.

**Timing Guidelines:**

1. **Phase completion** → Update ALL of these BEFORE committing:
   - `CHANGELOG.md` - Add new version entry with all changes
   - `docs/planning/roadmap.md` - Mark phase as complete, update dates
   - `README.md` - Update "What Works Now" section
   - `CLAUDE.md` - Update "Current Status" and "Recent Updates" sections
   - **Git commit message**: Include reference to phase completion

2. **Bug fixes** → Update technical docs with root cause and fix, add to CHANGELOG.md
3. **Architecture changes** → Update architecture.md BEFORE committing
4. **New dependencies** → Update technical docs and README.md (setup section) BEFORE committing
5. **Performance improvements** → Update technical docs with benchmarks BEFORE committing
6. **API changes** → Update architecture.md (IPC patterns) BEFORE committing
7. **Configuration changes** → Update README.md (environment variables) BEFORE committing

**CHANGELOG.md Update Policy:**
- **MUST update** for: Phase completion, new features, bug fixes, breaking changes
- **SHOULD update** for: Performance improvements, new dependencies
- **CAN skip** for: Documentation-only changes, refactoring with no behavioral changes
- **Format**: Follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format
- **Versioning**: Follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
  - Major (X.0.0): Breaking changes
  - Minor (0.X.0): New features (Phase completions)
  - Patch (0.0.X): Bug fixes

### What to Update

| Change Type | Files to Update |
|-------------|-----------------|
| Phase complete | `CHANGELOG.md` (new version), `docs/planning/roadmap.md`, `README.md` (status), `CLAUDE.md` (status) |
| Critical bug fix | `CHANGELOG.md` (patch version), `docs/technical/{phase}.md` (Known Issues section) |
| New service/feature | `CHANGELOG.md` (minor version), `docs/developer/architecture.md`, `docs/technical/{phase}.md` |
| Dependency added | `CHANGELOG.md`, `docs/technical/{phase}.md` (Dependencies section), `README.md` (Installation) |
| Performance change | `CHANGELOG.md`, `docs/technical/{phase}.md` (Performance section), `README.md` (Performance) |
| New IPC handler | `CHANGELOG.md`, `docs/developer/architecture.md` (IPC Handler Pattern) |

### How to Verify

Before committing documentation changes:

1. **Cross-reference with code**: Ensure all claims match actual implementation
   ```bash
   # Verify dependencies
   cat package.json | jq '.dependencies'

   # Verify service files exist
   ls -la src/services/

   # Verify IPC handlers
   grep -n "ipcMain.handle" src/main/index.ts
   ```

2. **Check for outdated references**: Search for deprecated terms
   ```bash
   # Example: After removing BlackHole
   grep -r "BlackHole" docs/ README.md
   ```

3. **Ensure consistency**: Version numbers, phase statuses, dates should match across files
   ```bash
   # Check version consistency
   grep -E "(Version|version|Phase|0\.[0-9]\.[0-9])" README.md CHANGELOG.md CLAUDE.md
   ```

4. **Build and test**: Documentation changes should not break builds
   ```bash
   npm run build
   npm run type-check
   ```

---

## Testing Protocol

**CRITICAL**: Never claim a feature is "complete" without following this protocol.

### Why Testing Matters

**Past Issues**: Features claimed "complete" with only type-check/build verification have failed in UAT:
- Empty blob saved (invalid WAV file)
- FFmpeg concat with wrong path format
- Silent chunk save failures
- Missing state cleanup

**Root Cause**: Type-checking and building only verify code compiles, not that it works correctly.

### Mandatory Testing Levels

**BEFORE claiming any feature is complete, you MUST complete Level 1 + 2 + 3:**

#### **Level 1: Static Analysis (30 seconds)**
```bash
npm run type-check  # Type safety
npm run build       # Compilation
```
✅ Verifies: Code compiles without errors
❌ Does NOT verify: Runtime behavior, logic correctness

#### **Level 2: Logic Review (2-5 minutes)**

**Ask yourself these questions:**
1. What could go wrong with this code?
2. What happens if the IPC call fails?
3. What happens if the file doesn't exist?
4. What happens if the process crashes mid-operation?
5. Did I clean up all state properly?
6. Are there race conditions?
7. Did I test error handling paths?

**Check these areas:**
- ✓ Error handling for all async operations
- ✓ State cleanup in all exit paths
- ✓ Edge cases (empty input, null values, concurrent calls)
- ✓ Resource cleanup (file handles, intervals, listeners)

#### **Level 3: Manual Testing (5-10 minutes)**

**MANDATORY before claiming "complete":**

```bash
# Start the application
npm run dev
```

**Happy Path Testing:**
1. Test the primary user flow
2. Verify outputs are created
3. Validate file/data integrity
4. Test the feature end-to-end

**Edge Case Testing:**
3. Test with minimal input (1 second recording)
4. Test stop immediately after start
5. Test operation without prerequisites
6. Test re-initialization/restart flows

**File Output Validation (if applicable):**
```bash
# For audio files
ffmpeg -v error -i <file> -f null -
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 <file>

# For WAV files specifically
file <file>  # Should show "RIFF (little-endian) data, WAVE audio"

# Play file to verify audio is valid
afplay <file>  # macOS
```

### Feature-Specific Test Checklists

#### **Audio Recording Features:**
- [ ] Initialize audio → Succeeds without errors
- [ ] Start recording → Recording indicator shows
- [ ] Stop recording → File created in expected location
- [ ] Verify file with `file <path>` → Shows valid WAV
- [ ] Verify file with `ffmpeg -i <path>` → No errors
- [ ] Play file with `afplay <path>` → Audio plays correctly
- [ ] Check file size → Not 0 bytes, reasonable for duration

#### **Chunked Recording (Phase 1.5):**
- [ ] Record >5 minutes → Chunks created in session dir
- [ ] Stop recording → merged.wav created
- [ ] Verify merged file size ≈ sum of chunk sizes
- [ ] Verify individual chunks deleted after merge
- [ ] Transcribe merged file → Works correctly
- [ ] Check session directory → Only merged.wav remains

#### **Transcription Features:**
- [ ] Transcribe audio → Progress updates show
- [ ] Transcription completes → Transcript returned
- [ ] Verify transcript not empty
- [ ] Check timing → Within expected range (1-2x realtime)

#### **IPC Features:**
- [ ] Call IPC handler → Returns result
- [ ] Verify result structure → Has expected fields
- [ ] Test error case → Returns error message
- [ ] Check console logs → No unexpected errors


### When to Skip Manual Testing

**Only skip Level 3 if:**
- Pure refactoring with no behavior changes
- Documentation-only changes
- Type definition changes
- Configuration changes with no runtime impact

**When in doubt, always do Level 3.**

### Reporting Test Results

**Before committing, always report:**

```
Testing:
✅ Level 1: npm run type-check passes
✅ Level 1: npm run build succeeds
✅ Level 2: Logic review - error handling verified, state cleanup verified
✅ Level 3: Manual testing complete
  - Happy path: Record 10s → Stop → File valid → Transcription works
  - Edge case: Stop immediately → Graceful handling
  - File validation: ffmpeg verified, audio plays correctly
⏸️ Level 3: Manual testing required but not completed (ONLY if impossible to test)
```

**Never say "tests pass" if you only ran Level 1.**

---

## Critical Development Patterns

### 1. Subprocess Pattern (Preferred for ML Models)

**Why**: Native Node.js modules cause Electron compatibility issues.

**Pattern**:
```typescript
class MLService {
  private executablePath: string

  async process(input: string): Promise<Result> {
    const process = spawn(this.executablePath, [args...])

    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (data) => { stdout += data })
    process.stderr.on('data', (data) => {
      stderr += data
      this.parseProgress(data)  // Extract progress from stderr
    })

    return new Promise((resolve, reject) => {
      process.on('close', (code) => {
        if (code === 0) resolve(JSON.parse(stdout))
        else reject(new Error(stderr))
      })
    })
  }
}
```

**Examples**:
- `TranscriptionService` → `whisper-cli` (Phase 1.2)
- `DiarizationService` → Python script (Phase 1.3)

### 2. IPC Handler Pattern

**Pattern**:
```typescript
// Main Process
ipcMain.handle('operation-name', async (_event, ...args) => {
  try {
    const result = await service.doWork(...args)
    return { success: true, result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Preload
const electronAPI = {
  operationName: (...args) => ipcRenderer.invoke('operation-name', ...args)
}
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Renderer
const result = await window.electronAPI.operationName(...args)
if (!result.success) {
  setError(result.error)
}
```

### 3. Progress Callback Pattern

**Pattern**:
```typescript
// Main Process
ipcMain.handle('long-operation', async (_event, input) => {
  const result = await service.processWithProgress(
    input,
    (progress) => {
      mainWindow?.webContents.send('operation-progress', progress)
    }
  )
  return { success: true, result }
})

// Preload
const electronAPI = {
  longOperation: (input) => ipcRenderer.invoke('long-operation', input),
  onProgress: (callback) => {
    ipcRenderer.on('operation-progress', (_event, progress) => callback(progress))
  }
}

// Renderer
useEffect(() => {
  window.electronAPI.onProgress((progress) => {
    setProgressState(progress)
  })
}, [])
```

### 4. Audio Format Preprocessing

**Critical Learning**: Web Audio API ChannelMerger doesn't always produce proper mono output.

**Pattern**:
```typescript
// Always preprocess audio with ffmpeg before transcription
async convertToMonoWav(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace('.wav', '_mono.wav')

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-ac', '1',           // Force mono
      '-ar', '16000',       // 16kHz sample rate
      '-c:a', 'pcm_s16le',  // 16-bit PCM
      '-y',                 // Overwrite
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(outputPath)
      else reject(new Error('ffmpeg failed'))
    })
  })
}
```

**Why**: Fixes WAV header corruption and ensures proper mono output for Whisper.

### 5. Timestamp Normalization

**Critical Learning**: Whisper outputs timestamps in milliseconds, pyannote.audio expects seconds.

**Pattern**:
```typescript
function normalizeWhisperSegment(segment: WhisperSegment): NormalizedSegment {
  return {
    text: segment.text.trim(),
    start: segment.offsets.from / 1000,  // Convert ms → seconds
    end: segment.offsets.to / 1000
  }
}
```

---

## Development Commands

```bash
# Development mode (hot-reload)
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

---

## Tech Stack

### Core
- **Electron** 38.2.1 + **React** 19 + **TypeScript** 5
- **electron-vite** (build system with hot-reload)

### Audio
- **electron-audio-loopback** 1.0.6 (native system audio)
- **extendable-media-recorder** + **wav-encoder** (recording)
- **Web Audio API** (mixing, resampling, level monitoring)

### ML Stack (100% Local)
- **whisper.cpp** (Homebrew) - Speech-to-text with Metal GPU
- **ffmpeg** (Homebrew) - Audio preprocessing
- **pyannote.audio** 3.1/4.x (pip) - Speaker diarization
- **PyTorch** (Metal backend for macOS)

### Cloud Services
- **Microsoft Graph API** (M365 calendar, Phase 2.1+)
  - **@azure/msal-node** 3.8.0 - OAuth2 authentication
  - **@microsoft/microsoft-graph-client** 3.0.7 - Graph API client
  - **keytar** 7.9.0 - Secure token storage (system keychain)
- **Anthropic Claude API** (summarization, Phase 2.3-3)
  - **@anthropic-ai/sdk** ^0.65.0 - Batch API client
- **Database**
  - **better-sqlite3** ^12.4.1 - SQLite bindings

---

## Project Structure

```
meeting-agent/
├── src/
│   ├── main/            # Electron main process
│   ├── preload/         # IPC bridge
│   ├── renderer/        # React UI
│   ├── services/        # Business logic (audio, transcription, diarization)
│   ├── utils/           # Helper functions (mergeDiarization)
│   └── types/           # TypeScript types
├── scripts/             # Python scripts (diarize_audio.py)
├── models/              # Whisper models (ggml-base.bin)
├── venv/                # Python virtual environment
├── docs/                # Documentation
│   ├── planning/        # roadmap.md
│   ├── developer/       # architecture.md
│   └── technical/       # Phase implementation details
├── CHANGELOG.md         # Version history
├── README.md            # User-facing documentation
└── CLAUDE.md            # This file (AI assistant guidance)
```

---

## Environment Variables

Required in `.env`:

```bash
# Phase 1.3: Speaker Diarization
HUGGINGFACE_TOKEN=hf_xxx  # Required for pyannote.audio models

# Phase 2.1: M365 Integration
AZURE_CLIENT_ID=your_app_client_id
AZURE_TENANT_ID=your_tenant_id

# Phase 2.3-3: Meeting Intelligence
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

---

## Known Limitations

1. **macOS 12.3+ only** (for now) - Windows/Linux support available via electron-audio-loopback but not tested
2. **Batch processing latency** - Summaries take 30-60 minutes to generate (tradeoff for 50% cost savings)
3. **Manual testing pending** - End-to-end workflow needs user testing and validation

---

## Cost Analysis

### Current (Phases 0-1.3)
- **Transcription**: $0.00 (local whisper.cpp)
- **Diarization**: $0.00 (local pyannote.audio)
- **Total**: **$0.00 per meeting** 🎉

### After Phase 2.3-3 (LLM Intelligence)
- **Transcription**: $0.00 (local whisper.cpp)
- **Diarization**: $0.00 (local pyannote.audio)
- **Summarization (Two-Pass)**: ~$0.09 per 60-min meeting (Claude Batch API)
  - Pass 1: $0.045 (speaker ID + initial summary)
  - Pass 2: $0.048 (validation + refinement)
- **Microsoft Graph API**: $0.00 (included with M365 subscription)
- **Estimated Monthly** (20 meetings): ~$1.86

### Comparison
- **Cloud-only alternative**: Azure Speech + GPT-4 = ~$2.50/meeting = $50/month
- **Meeting Agent**: ~$0.09/meeting = $1.86/month
- **Savings**: 96% 💰

---

## Performance Benchmarks (M3 Pro, 11 cores, 18GB RAM)

| Operation | Time | Ratio | Memory |
|-----------|------|-------|--------|
| Audio Capture | Real-time | 1:1 | ~100MB |
| Transcription (Metal GPU) | 5.7s for 5min | ~50x | ~200MB |
| Diarization (CPU) | 16s for 30s | 0.53x | ~500MB |
| Diarization (Metal GPU) | 2.8s for 30s | **5.8x faster** | ~500MB |
| **Total (Transcribe + Diarize, GPU)** | **~12s for 5min** | **~25x** | **~700MB peak** |

**Note**: Both transcription and diarization use Metal GPU (automatic on Apple Silicon). Graceful fallback to CPU if GPU unavailable.

**Measured Speedup**: Metal GPU provides **5.8x speedup** for diarization (M3 Pro, 30-second audio).

---

## Contributing

When contributing:

1. **Follow the subprocess pattern** for external tools (avoid native Node.js modules)
2. **Update documentation BEFORE committing** - Never commit code without updating docs (see protocol above)
3. **Update CHANGELOG.md AS PART OF your commit** for:
   - Phase completions (new minor version)
   - New features (minor version)
   - Bug fixes (patch version)
   - Breaking changes (major version)
4. **Add tests** for new functionality (follow Testing Protocol above)
5. **Reference roadmap.md** for planned features (don't duplicate in CLAUDE.md)

---

## License

MIT License - See LICENSE file

---

**Current Status**: Phase 5 Complete ✅ **PRODUCTION-READY** (Audio + Transcription + Diarization + GPU + M365 Auth + Calendar + LLM Intelligence + Meeting Association + Browse Mode + Aileron Branding + Summary Editor + Email Distribution)
**Next Milestone**: Phase 6 - Data Management & Persistence (storage quotas, auto-deletion, advanced search)
**Last Updated**: 2025-01-27
**Built with**: Claude Code (Sonnet 4.5) 🤖

---

## Quick Links

- **Full Roadmap**: `docs/planning/roadmap.md`
- **Architecture Details**: `docs/developer/architecture.md`
- **Version History**: `CHANGELOG.md`
- **User Guide**: `README.md`
