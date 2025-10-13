# Changelog

All notable changes to Meeting Agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Phase 2: Microsoft Graph Integration (M365 authentication, calendar, email)
- Phase 3: AI Summarization (Claude API integration)
- Phase 4: GUI Development (meeting list, summary editor)
- Phase 5: Email Distribution (send summaries via M365)
- Phase 6: Data Management (SQLite, storage quotas)
- Phase 7: Settings UI (configuration panel)
- Phase 8: Error Handling & Logging
- Phase 9: Performance Optimization
- Phase 10: Documentation & Packaging

---

## [0.1.3] - 2025-10-13

### Phase 1.3: Speaker Diarization

#### Added
- **Speaker Diarization Service** (`src/services/diarization.ts`)
  - Identifies "who spoke when" using pyannote.audio 3.1
  - Python subprocess integration (venv/bin/python3)
  - Progress monitoring via stderr parsing
  - Speaker statistics (count, duration, segments)

- **Python Diarization Script** (`scripts/diarize_audio.py`)
  - Uses pyannote.audio Pipeline
  - Outputs speaker segments with timestamps (JSON format)
  - Requires Hugging Face token (HUGGINGFACE_TOKEN env var)

- **Transcript Merge Algorithm** (`src/utils/mergeDiarization.ts`)
  - Temporal intersection matching
  - Aligns speaker segments with transcript words
  - Generates speaker-labeled transcript
  - Handles timestamp format conversion (ms → seconds)

- **Two-Button UI Approach**
  - "Transcribe + Diarize" (accurate, ~90s for 30s audio)
  - "Transcribe Only" (fast, ~30s for 30s audio, 3x faster)
  - Speaker count display in transcript stats

- **Dependencies**
  - pyannote.audio (pip, Python 3.13 venv)
  - torch, torchaudio (PyTorch dependencies)
  - dotenv (environment variable support)

#### Changed
- IPC handler `transcribe-and-diarize` now runs both services
- Progress events include `stage: 'diarizing'` for speaker analysis
- Transcript display shows speaker labels: `[SPEAKER_00]: text`

#### Performance
- Diarization: ~1:1 ratio (30s audio in ~30s, CPU-only)
- Total with transcription: ~90s for 30s audio
- Memory usage: <500MB during processing

#### Known Issues
- Generic speaker labels ("SPEAKER_00", not names) - Phase 2 will add LLM-based attribution
- CPU-only (no Metal GPU) - deferred to Phase 2+ for optional GPU acceleration
- Overlapping speech may cause partial information loss

#### Documentation
- Added `docs/technical/diarization.md` (19KB)
- Updated `.env.example` with HUGGINGFACE_TOKEN

---

## [0.1.2] - 2025-10-13

### Phase 1.2: Local Whisper Transcription

#### Added
- **Transcription Service** (`src/services/transcription.ts`)
  - Local audio transcription using whisper.cpp CLI
  - Metal GPU acceleration (automatic on macOS)
  - Progress monitoring via stderr stream
  - JSON output parsing with word-level timestamps

- **ffmpeg Audio Preprocessing**
  - Fixes WAV header corruption (0xFFFFFFFF placeholder)
  - Forces mono output (resolves ChannelMerger bug)
  - Converts to Whisper-compatible format (16kHz, 1 channel, 16-bit PCM)

- **IPC Handlers**
  - `transcribe-audio`: Transcription only (fast)
  - `transcribe-and-diarize`: Combined workflow (Phase 1.3)
  - `transcription-progress`: Real-time progress updates

- **UI Components**
  - Progress bar with stage indicators
  - Transcript display with stats (duration, processing time, language)
  - Error handling and user feedback

#### Changed
- Audio capture now saves to `userData/recordings/`
- Recording sessions include metadata (id, duration, timestamp)

#### Fixed
- **Critical**: WAV header corruption causing 14x slowdown (257s → 20s for 17.9s audio)
- **Critical**: Stereo audio despite mono configuration (now forced via ffmpeg)
- **Medium**: Duration calculation used stereo file (now uses mono)
- Thread count optimized for M3 Pro (8 threads, leaving 3 for OS/Electron)

#### Performance
- Transcription: ~1-2x realtime (17.9s audio in ~20-30s)
- Memory usage: <200MB during transcription
- Metal GPU acceleration working (verified in logs)

#### Dependencies
- whisper-cpp (Homebrew: `brew install whisper-cpp`)
- ffmpeg (Homebrew: `brew install ffmpeg`)
- ggml-base.bin model (~150MB, downloaded to `models/`)

#### Documentation
- Added `docs/technical/transcription.md` (24KB)
- Updated `.env.example` with WHISPER_MODEL

---

## [0.1.1] - 2025-10-09

### Phase 1.1: Audio Capture

#### Added
- **Audio Capture Service** (`src/services/audioCapture.ts`)
  - Native system audio capture (no BlackHole required)
  - Microphone capture with graceful fallback
  - Dual-stream audio merging (system + mic)
  - Real-time audio level monitoring (RMS calculation)
  - 16kHz mono WAV output (Whisper-compatible)

- **electron-audio-loopback Integration** (`src/main/audioSetup.ts`)
  - Manual mode with IPC handlers
  - System audio via `getDisplayMedia` with loopback flag
  - Auto-registers IPC handlers via `initMain()`

- **UI Components** (`src/renderer/App.tsx`)
  - Initialize/Start/Stop recording controls
  - Real-time audio level visualization
  - Duration timer (MM:SS format)
  - Microphone toggle checkbox
  - Recording status indicators

- **IPC Bridge** (`src/preload/index.ts`)
  - `enableLoopbackAudio` / `disableLoopbackAudio`
  - `saveAudioFile` (saves to userData/recordings/)
  - Context bridge with type safety

#### Changed
- **Removed BlackHole dependency** (was in original plan)
- Uses electron-audio-loopback instead of naudiodon
- Web Audio API for mixing/resampling instead of native modules

#### Fixed
- Memory leak in `stopCapture()` (now stops recording before cleanup)
- Race condition in `stopRecording()` (added state check)
- WAV encoder re-registration on hot-reload (idempotent flag)

#### Security
- Added Content Security Policy (CSP) to prevent XSS attacks

#### Performance
- Audio level updates: 60fps (smooth visualization)
- Memory usage: <100MB during 30-min recording

#### Dependencies
- electron-audio-loopback@1.0.6
- extendable-media-recorder@9.2.31
- extendable-media-recorder-wav-encoder@7.0.132

#### Documentation
- Added `docs/technical/audio-capture.md` (20KB)

---

## [0.1.0] - 2025-10-07

### Phase 0: Foundation Setup

#### Added
- **Project Infrastructure**
  - Node.js/TypeScript project setup
  - Electron 38.2.1 with electron-vite build system
  - React 19 UI framework
  - ESLint + Prettier code formatting

- **Build Configuration**
  - `electron.vite.config.ts` - Build tooling
  - `tsconfig.json` - TypeScript strict mode
  - `electron-builder.yml` - macOS packaging
  - Hot-reload in development mode

- **Core Files**
  - `src/main/index.ts` - Electron main process
  - `src/preload/index.ts` - Preload script for IPC
  - `src/renderer/App.tsx` - React UI entry point
  - `src/renderer/index.html` - HTML entry point

- **Documentation**
  - `README.md` - Project overview
  - `CLAUDE.md` - Development plan (10 phases)
  - `.env.example` - Environment configuration template

- **Version Control**
  - Git repository initialized
  - `.gitignore` for Node.js/Electron

#### Dependencies
- electron@38.2.1
- react@19.0.0, react-dom@19.0.0
- typescript@5.x
- electron-vite, vite
- @vitejs/plugin-react
- eslint, prettier, typescript-eslint

#### Testing
- ✅ `npm install` completes without errors
- ✅ `npm run build` succeeds
- ✅ `npm run type-check` passes
- ✅ Hot-reload works in dev mode

#### Documentation
- Created project structure documentation
- Defined 10-phase development plan
- Established coding standards

---

## Release Notes

### Version 0.1.3 (Current)
**Meeting Agent** can now:
- ✅ Capture system audio + microphone (native, no virtual drivers)
- ✅ Transcribe audio locally using Whisper (Metal GPU acceleration)
- ✅ Identify speakers with diarization (pyannote.audio)
- ✅ Generate speaker-labeled transcripts

**What's Next**: Phase 2 will add Microsoft 365 integration for meeting context and email distribution.

### Cost Analysis (Current)
- Transcription: $0.00 (local Whisper)
- Diarization: $0.00 (local pyannote.audio)
- Total: **$0.00 per meeting** 🎉

---

**Maintained by**: Claude Code (Sonnet 4.5)
**Last Updated**: 2025-10-13
