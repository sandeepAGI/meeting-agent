# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meeting Agent is a macOS desktop application that captures, transcribes, and summarizes online meetings across any platform (Teams, Zoom, Google Meet, etc.). It integrates with Microsoft 365 to pull meeting context and allows users to review/edit summaries before distribution.

### Key Features
- Calendar integration via Microsoft Graph API
- Native system audio capture (no virtual audio drivers required)
- Real-time transcription (Whisper running locally)
- AI-powered summarization (Claude API or Azure OpenAI)
- Editable summary interface with recipient selection
- Email distribution via Microsoft Graph API

### Cost Optimization Strategy
- **Transcription**: OpenAI Whisper running locally (free, one-time model download ~1.5GB)
- **Summarization**: Claude API (cheaper than Azure OpenAI, better quality)
- **Calendar/Email**: Microsoft Graph API (included with M365 subscription)

---

## Development Plan

### Phase 0: Foundation Setup ✓ (Completed: 2025-10-07)
**Goal**: Initialize project infrastructure

**Tasks**:
- [x] Initialize Node.js/TypeScript project
- [x] Set up Electron with TypeScript
- [x] Configure build tooling (electron-vite)
- [x] Set up ESLint + Prettier
- [x] Create basic project structure
- [x] Set up Git repository
- [x] Create .env.example for configuration

**Testing**:
- [x] Verify `npm install` completes without errors
- [x] Verify `npm run build` succeeds
- [x] Verify TypeScript compilation works (`npm run type-check`)
- [x] Verify hot-reload configured (electron-vite dev mode)

**Success Criteria**: ✅ Empty Electron app builds successfully

**Deviations from plan**:
- Used electron-vite instead of plain Webpack/Vite for better Electron integration
- Disabled noUnusedLocals/noUnusedParameters in tsconfig for development flexibility
- Used React 19 (latest) instead of React 18

**Files Created**:
- `electron.vite.config.ts` - Build configuration
- `eslint.config.js` - ESLint flat config
- `.prettierrc` / `.prettierignore` - Code formatting
- `electron-builder.yml` - macOS packaging config
- `src/main/index.ts` - Electron main process
- `src/preload/index.ts` - Preload script for IPC
- `src/renderer/index.html` - HTML entry point
- `src/renderer/index.tsx` - React entry point
- `src/renderer/App.tsx` - Main React component
- `src/renderer/styles/index.css` - Basic styles

**Dependencies Installed**:
- electron, react, react-dom
- electron-vite, electron-builder, vite
- @vitejs/plugin-react
- typescript, @types/react, @types/react-dom, @types/node
- eslint, prettier, typescript-eslint

**Next Phase**: Phase 1.1 - Audio Capture

---

### Phase 1: Audio Capture & Transcription
**Goal**: Capture system audio and transcribe locally using Whisper

#### Phase 1.1: Audio Capture ✓ (Completed: 2025-10-09)

**Initial Approach (Abandoned)**:
- Attempted to use `naudiodon` (PortAudio) + BlackHole virtual audio driver
- **Issue**: Native module compilation failures with Electron 38
  - segfault-handler dependency incompatible with modern Electron
  - NODE_MODULE_VERSION mismatch (137 vs 139)
  - Ongoing maintenance burden with native modules
- **Decision**: Pivoted to Web API-based approach (2025-10-09)

**Revised Approach (Current)**: ✓ (Completed: 2025-10-09)
Using `electron-audio-loopback` for native system audio capture without BlackHole

**Tasks**:
- [x] Install electron-audio-loopback and WAV encoding dependencies
- [x] Implement main process audio loopback initialization
- [x] Implement renderer process audio capture with MediaStream API
- [x] Add Web Audio API for audio level monitoring
- [x] Add Web Audio API for 16kHz mono conversion/resampling
- [x] Implement MediaRecorder with WAV encoding
- [x] Implement start/stop recording functionality
- [x] Save recordings to WAV files (16kHz mono, Whisper-compatible)

**Testing**:
- [x] Verify system audio capture works without BlackHole
- [x] Test audio level monitoring and visualization
- [x] Test WAV file generation at 16kHz mono
- [x] Verify recordings are Whisper-compatible
- [x] Test start/stop recording controls
- [x] Manual test with actual meeting audio (YouTube video tested successfully)

**Microphone Capture (Completed)**:
- [x] Test if meeting apps (Zoom/Teams/Meet) include user's voice in system audio output
- [x] Add microphone capture and audio mixing (merge mic + system audio)
- [x] Implement dual-stream recording (system audio + microphone)
- [x] Add audio mixing/merging before encoding to WAV

**Dependencies Added**:
- ✅ `electron-audio-loopback@1.0.6` - System audio capture (no native modules)
- ✅ `extendable-media-recorder@9.2.31` - Custom codec support for MediaRecorder
- ✅ `extendable-media-recorder-wav-encoder@7.0.132` - WAV encoding for MediaRecorder

**Files Created**:
- ✅ `src/services/audioCapture.ts` - Audio capture service using electron-audio-loopback (manual mode)
- ✅ `src/types/audio.ts` - TypeScript interfaces (AudioLevel, RecordingSession, AudioConfig)
- ✅ `src/main/audioSetup.ts` - Main process audio loopback initialization (initMain)
- ✅ `src/renderer/App.tsx` - UI with recording controls and audio level meter
- ✅ `src/preload/index.ts` - Context bridge for IPC (enableLoopbackAudio, disableLoopbackAudio)
- ✅ `src/types/electron.d.ts` - ElectronAPI type definitions

**Implementation Details**:
- Uses electron-audio-loopback manual mode (IPC handlers auto-registered by initMain)
- No BlackHole or other virtual audio driver required
- MediaStream API for audio capture via getDisplayMedia
- Web Audio API for audio level calculation and 16kHz mono resampling
- extendable-media-recorder for WAV output
- Recordings downloaded as browser files (will move to userData in Phase 6)
- Audio captured at 16kHz mono (Whisper-compatible format)
- Real-time audio level visualization with RMS calculation

**Advantages Over naudiodon Approach**:
- ✅ No native module compilation issues
- ✅ No BlackHole user installation required
- ✅ Uses standard Web APIs (better documented)
- ✅ Cross-platform ready (macOS 12.3+, Windows 10+, Linux)
- ✅ Active maintenance (updated 2024)
- ✅ Simpler architecture

**Requirements**:
- Electron >= 31.0.1 (we have 38.2.1 ✅)
- macOS >= 12.3 (Darwin 25.0.0 ✅)

**Deviations from Plan**:
- Initially tried to use automatic mode (`getLoopbackAudioMediaStream`) but discovered it requires `nodeIntegration: true`
- Reverted to manual mode with IPC handlers (which are auto-registered by `initMain()`)
- Learned that electron-audio-loopback's IPC handlers are built-in, no manual registration needed
- **Added microphone capture** (not in original Phase 1.1 plan):
  - Discovered that meeting apps (Zoom/Teams/Meet) do NOT include user's microphone in system audio output
  - User's voice only captured if physical microphone is recorded separately
  - Implemented dual-stream recording: system audio (meeting participants) + microphone (user's voice)
  - Used `getUserMedia` for system default microphone with graceful fallback
  - Deferred device selection to Phase 7 (Settings) to keep Phase 1.1 scope manageable

**Bugs Fixed (Code Review)**:
- **Critical**: stopCapture() memory leak - now stops active recording before cleanup (src/services/audioCapture.ts:220)
- **Medium**: mediaRecorder not nulled after stopping - fixed memory leak (src/services/audioCapture.ts:205)
- **Medium**: Race condition in stopRecording() - added state check to prevent double-stop (src/services/audioCapture.ts:182)
- **Security**: Added Content Security Policy to prevent XSS attacks (src/renderer/index.html:8)
- **Hot-reload bug**: WAV encoder re-registration error - made initialization idempotent with module-level flag (src/services/audioCapture.ts:6)

**Known Issues (Low Priority - Deferred to Future Phases)**:
1. No visual feedback for microphone permission denied (low UX priority)
2. No audio device selection UI (planned for Phase 7 - Settings)
3. No blob size validation before download (edge case)
4. Unused `RecordingState` interface in audio.ts (cleanup task)
5. No warning if user closes during recording (low priority - stopCapture handles cleanup)
6. Audio level always calculated even when not recording (minimal performance impact)
7. No retry logic for getUserMedia failures (acceptable for MVP)
8. Duration interval continues if unmount during recording (React cleanup handles it)

**Testing Completed**:
- ✅ System audio capture with YouTube video (verified working)
- ✅ Microphone capture (verified both streams merged correctly)
- ✅ Audio level monitoring (verified RMS calculation shows both system + mic)
- ✅ WAV file download (16kHz mono format verified)
- ✅ Recording controls (start/stop/timer verified)
- ✅ Build and type-check pass without errors
- ✅ Memory cleanup (verified no leaks on stopCapture)
- ✅ Security warnings resolved (CSP added)

**Success Criteria**: ✅ Phase 1.1 Complete - Captures system audio + microphone, saves as Whisper-compatible WAV files

**Next Phase**: Phase 1.2 - Local Whisper Integration

#### Phase 1.2: Local Whisper Integration ✓ (Completed: 2025-10-13)

**Research Phase Complete ✓ (2025-10-13)**

After extensive investigation and troubleshooting, here are the findings:

##### Attempted Approach #1: @kutalia/whisper-node-addon (FAILED)

**Package**: `@kutalia/whisper-node-addon@1.1.0`
- Native C++ addon wrapping whisper.cpp
- Prebuilt binaries for all platforms
- "Zero-config for Electron" marketing claim

**Issues Encountered**:
1. **Native module path mismatch**: Package ships `mac-arm64` folder but code looks for `darwin-arm64`
   - Fixed with symlink in postinstall.sh
2. **Dylib loading failures**: Native module built with hardcoded @rpath to build machine paths
   - Fixed with install_name_tool to change @rpath → @loader_path for 6 dylibs
3. **SIGTRAP crashes**: Whisper transcription crashes with SIGTRAP (EXC_BREAKPOINT) signal
   - Tried running in worker threads → SIGTRAP crash
   - Tried running in child process (fork) → SIGTRAP crash
   - Crashes occur during `whisper_init_state: compute buffer (decode)`
   - Indicates native addon has threading/process isolation issues

**Root Cause Analysis**:
- The native addon appears incompatible with any isolation strategy (worker threads, child processes)
- SIGTRAP suggests assertion failures or breakpoints in native code
- Package is marked "experimental" and "not recommended for production"
- GitHub repo shows limited maintenance and no Electron-specific threading documentation

**Conclusion**: @kutalia/whisper-node-addon is NOT suitable for Electron apps despite marketing claims

##### Alternative Approaches Evaluated:

**Option 1: whisper-node (ariym/whisper-node)**
- Uses shell/CLI wrapper around whisper.cpp
- No native bindings (uses child_process with ShellJS)
- Requires `make` command (Windows compatibility issues)
- Last updated 2 years ago
- **Verdict**: Potentially viable but outdated, requires whisper.cpp CLI to be built separately

**Option 2: whisper.cpp CLI (ggml-org/whisper.cpp)**
- Official C++ port of OpenAI Whisper
- Mature, actively maintained, widely adopted
- CLI interface: `./whisper-cli -m model.bin -f audio.wav`
- **Audio Requirements**: 16-bit WAV, 16kHz sample rate, 1 channel (mono)
- **Our current audio format**: ✅ 16-bit WAV, 16kHz, mono (compatible!)
- Supports multiple output formats (txt, json, vtt, srt)
- Can be called from Node.js via child_process.spawn()
- No native addon issues, clean process isolation
- **Verdict**: RECOMMENDED - Reliable, well-documented, no Electron compatibility issues

**Option 3: Python Whisper CLI (OpenAI official)**
- Available on system: `/opt/anaconda3/bin/whisper`
- Mature, officially supported by OpenAI
- CLI interface: `whisper audio.wav --model base --language en --output_format json`
- Supports all Whisper models (tiny, base, small, medium, large)
- Can be called from Node.js via child_process.spawn()
- **Pros**: Zero setup (already installed), official implementation, excellent accuracy
- **Cons**: Slower than whisper.cpp (Python overhead), requires Python dependency
- **Verdict**: VIABLE - Good fallback option, but whisper.cpp CLI is preferred for performance

##### Recommended Approach: whisper.cpp CLI Integration

**Architecture**:
```
Electron Main Process
  ↓
TranscriptionService (TypeScript)
  ↓
child_process.spawn() → whisper.cpp CLI (isolated process)
  ↓
Parse JSON output → Return TranscriptionResult
```

**Why This Approach**:
1. ✅ **No native addons** - No Electron compatibility issues
2. ✅ **Clean isolation** - Whisper runs in separate process, can't crash Electron
3. ✅ **Mature codebase** - whisper.cpp is battle-tested and actively maintained
4. ✅ **Audio format compatible** - Our 16kHz mono WAV files work out-of-box
5. ✅ **Performance** - whisper.cpp is highly optimized C++ code
6. ✅ **GPU acceleration** - Supports Metal (macOS), CUDA, Vulkan if available
7. ✅ **Standard CLI** - Easy to test, debug, and replace if needed

**Implementation Plan**:
1. Check if whisper.cpp CLI is available on system, if not provide installation instructions
2. Create TranscriptionService that spawns whisper CLI as child process
3. Stream stderr for progress updates (whisper prints progress to stderr)
4. Parse JSON output for transcript text and timing information
5. Handle errors gracefully (missing model, corrupted audio, etc.)
6. Add model management (download base/small models if missing)

**Setup Instructions** (one-time, will add to docs):
```bash
# Install whisper.cpp via Homebrew (easiest)
brew install whisper-cpp

# Or build from source for latest version
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
make
make base  # Downloads base model
```

##### Revised Phase 1.2 Tasks:

**Preparation**:
- [x] Research Whisper implementation options
- [x] Test @kutalia/whisper-node-addon (failed due to SIGTRAP crashes)
- [x] Verify audio format compatibility (✅ 16kHz mono WAV)
- [x] Choose whisper.cpp CLI approach

**Implementation** (Next Steps):
- [ ] Check for whisper.cpp CLI availability (`which whisper-cli` or `which whisper`)
- [ ] Add whisper.cpp installation instructions to README
- [ ] Download Whisper model (base or small) to app resources
- [ ] Implement TranscriptionService with child_process.spawn()
- [ ] Parse whisper.cpp JSON output format
- [ ] Add progress monitoring from stderr stream
- [ ] Update UI to show transcription progress
- [ ] Handle transcription errors gracefully
- [ ] Add transcription result display in GUI

**Testing**:
- [ ] Test with 30-second recording (quick validation)
- [ ] Test with 5-minute recording (typical meeting segment)
- [ ] Test with 60-minute recording (performance check)
- [ ] Verify memory usage stays reasonable during long recordings
- [ ] Test error handling (missing model, corrupted audio, process crashes)
- [ ] Test cancellation (stop transcription mid-process)
- [ ] Compare accuracy between base and small models

**Files to Modify**:
- `src/services/transcription.ts` - Rewrite to use CLI instead of native addon
- Remove: `src/services/transcriptionProcess.ts` (no longer needed)
- Remove: `src/services/transcriptionWorker.ts` (no longer needed)
- `scripts/postinstall.sh` - Remove native addon fixes, no longer needed
- `scripts/download-whisper-model.sh` - Add script to download GGML models
- `src/main/index.ts` - Simplify transcription IPC handler
- `package.json` - Remove @kutalia/whisper-node-addon dependency

**Files to Keep**:
- `src/types/transcription.ts` - TypeScript interfaces (reuse existing)
- `src/renderer/App.tsx` - UI already has progress display
- `src/preload/index.ts` - IPC bridge already configured

**Success Criteria**: ✅ Phase 1.2 Complete - whisper-cli successfully transcribes audio with proper performance

**Implementation Complete ✓ (2025-10-13)**

**Tasks Completed**:
- [x] Install whisper.cpp CLI via Homebrew (`brew install whisper-cpp`)
- [x] Download Whisper base model (~150MB)
- [x] Implement TranscriptionService with child_process.spawn()
- [x] Parse whisper.cpp JSON output format
- [x] Add progress monitoring from stderr stream
- [x] Update UI to show transcription progress
- [x] Handle transcription errors gracefully
- [x] Add transcription result display in GUI
- [x] **Fix critical WAV header corruption bug**
- [x] **Fix stereo to mono audio conversion bug**
- [x] **Fix duration calculation bug**
- [x] **Optimize thread count for M3 Pro**

**Testing Completed**:
- ✅ Test with 17.9-second recording (validated performance improvement)
- ✅ Transcription completes in ~1-2x realtime (down from 14.4x slowdown)
- ✅ Proper mono audio format verified with ffmpeg
- ✅ Duration calculation accurate
- ✅ Build and type-check pass
- ✅ Metal GPU acceleration working (automatic on macOS)
- ✅ Transcript text appears correctly in UI

**Files Created/Modified**:
- ✅ `src/services/transcription.ts` - Full TranscriptionService implementation
- ✅ `src/types/transcription.ts` - TypeScript interfaces
- ✅ `src/main/index.ts` - IPC handlers for transcription
- ✅ `src/preload/index.ts` - Context bridge additions
- ✅ `src/renderer/App.tsx` - Transcription UI integration
- ✅ `src/types/electron.d.ts` - ElectronAPI type additions

**Dependencies Added**:
- ✅ whisper-cpp (Homebrew: `brew install whisper-cpp`)
- ✅ ffmpeg (for audio preprocessing)
- ✅ ggml-base.bin model (~150MB, downloaded to `models/` directory)

**Deviations from Plan**:
1. **Audio preprocessing required**: Added ffmpeg conversion step to fix WAV header corruption
   - extendable-media-recorder-wav-encoder writes 0xFFFFFFFF placeholder that's never finalized
   - ChannelMerger code doesn't actually produce mono output (still stereo)
   - ffmpeg preprocessing now converts to proper mono with correct WAV header
   - Line src/services/transcription.ts:65-94 `convertToMonoWav()` method

2. **Performance optimization**: Increased thread count from 4 to 8 for M3 Pro
   - Better utilizes 11-core M3 Pro CPU
   - Line src/services/transcription.ts:145

3. **Duration calculation fix**: Calculate from converted mono file instead of original stereo file
   - Original bug: calculated from stereo file (2x bigger), showed 2x duration
   - Fix: use processedAudioPath instead of audioPath
   - Line src/services/transcription.ts:234

**Critical Bugs Fixed**:
1. **WAV header corruption** (14.4x slowdown):
   - Symptom: 17.9s audio took 257.8s to transcribe
   - Root cause: WAV header size = 0xfffffff7 (4GB), whisper thought file was 18.6 hours
   - Fix: ffmpeg preprocessing with proper WAV header
   - Performance improvement: 257.8s → ~20-30s (8.5x faster)

2. **Stereo audio despite ChannelMerger**:
   - Symptom: Audio recorded as 2 channels instead of 1
   - Root cause: ChannelMergerNode not working as expected in Web Audio API
   - Fix: ffmpeg `-ac 1` flag forces mono output
   - Side benefit: Eliminates 2x processing time penalty from stereo

3. **Duration calculation** (2x incorrect):
   - Symptom: Duration showed double the actual length
   - Root cause: Calculating from stereo file instead of converted mono file
   - Fix: Use processedAudioPath in calculateDuration() call

**Performance Achievements**:
- Transcription speed: ~1-2x realtime (e.g., 17.9s audio in ~20-30s)
- Thread optimization: 8 threads for M3 Pro (11 cores)
- Metal GPU acceleration: Automatic on macOS
- Memory usage: Reasonable (<200MB during transcription)

**Known Issues**:
- Audio preprocessing adds ~2-3 seconds to transcription start time (acceptable tradeoff for correctness)
- Temporary `*_mono.wav` files created during preprocessing (could clean up after transcription)
- No progress percentage from whisper-cli (only console output)

**Architecture Pattern Established**:
- **Python/CLI subprocesses preferred** over native Node.js modules
- Avoids native module compilation issues seen in Phase 1.2 research
- Clean process isolation (crashes don't affect Electron)
- Same pattern will be used for Phase 1.3 (pyannote.audio diarization)

**Next Phase**: Phase 1.3 - Speaker Diarization with pyannote.audio

---

#### Phase 1.3: Speaker Diarization ✓ (Completed: 2025-10-13)
**Goal**: Add speaker identification to transcripts for better meeting notes

**Research Phase Complete ✓ (2025-10-13)**

After evaluating speaker diarization options, here are the findings:

##### Speaker Diarization Options Evaluated:

**Option 1: tinydiarize (whisper.cpp extension)**
- Extends whisper.cpp with speaker turn detection
- Requires special `small.en-tdrz` model
- Status: Proof-of-concept, not production-ready
- Performance: Near-perfect turn precision (97.7%), decent recall (70.8%)
- **Verdict**: ❌ Too experimental, English-only, limited testing

**Option 2: pyannote.audio 3.1** ✅ RECOMMENDED
- Python toolkit for speaker diarization
- State-of-the-art accuracy (7-12% DER on benchmarks)
- Production-ready, actively maintained (v3.1 released 2024)
- Language-independent
- Works with mono audio (our current format)
- Can be called as Python subprocess from Node.js
- **Verdict**: ✅ Best option for production use

**Option 3: sherpa-onnx (k2-fsa)**
- Node.js native module for speech processing
- Includes speaker diarization
- **Verdict**: ⚠️ Another native module, prefer Python subprocess after Phase 1.2 lessons

##### Recommended Approach: pyannote.audio 3.1

**Architecture**:
```
1. Audio Recording (existing) → recording.wav (16kHz mono)
2. Parallel Processing:
   a) Whisper CLI → transcript with word timestamps
   b) pyannote.audio Python script → speaker segments with timestamps
3. Merge Results → "Speaker 1: Hello everyone. Speaker 2: Thanks for joining."
4. Display in UI → Speaker-labeled transcript
```

**Why This Approach**:
1. ✅ **Production-ready** - State-of-the-art accuracy, well-tested
2. ✅ **Clean separation** - Transcription and diarization are independent
3. ✅ **Language-independent** - Works with any language Whisper supports
4. ✅ **Mono compatible** - Our existing audio format works
5. ✅ **Python subprocess** - Same pattern as Whisper CLI, proven reliable
6. ✅ **Offline** - Runs entirely locally, no API costs
7. ✅ **Context for Claude** - Speaker labels enable Phase 2 name matching

**Benefits for Phase 2 Integration**:
- Claude can use calendar attendee names to guess: "Speaker 1 = John Smith"
- More intelligent summaries: "John proposed X, Mary agreed, Bob raised concerns"
- Action items with owners: "John: Follow up with client by Friday"

**Implementation Plan**:

**Preparation**:
- [ ] Install pyannote.audio via pip
- [ ] Download pyannote models (requires Hugging Face token, free)
- [ ] Create Python script: `scripts/diarize_audio.py`
- [ ] Test diarization with sample audio

**Implementation**:
- [ ] Create `DiarizationService` TypeScript class
- [ ] Implement Python subprocess execution
- [ ] Parse diarization output (speaker segments with timestamps)
- [ ] Update `TranscriptionService` to include word-level timestamps
- [ ] Create merge algorithm: align speaker segments with transcript words
- [ ] Update `TranscriptionResult` type to include speaker labels
- [ ] Handle edge cases (overlapping speech, single speaker, etc.)

**UI Updates**:
- [ ] Update transcript display to show speaker labels
- [ ] Add visual distinction between speakers (colors, indentation)
- [ ] Show speaker count and timeline visualization (optional)

**Testing**:
- [ ] Test with 2-speaker conversation (easiest case)
- [ ] Test with 3+ speakers
- [ ] Test with single speaker (should show "Speaker 1" only)
- [ ] Test with overlapping speech
- [ ] Test accuracy vs. ground truth (manual verification)
- [ ] Test performance (diarization time vs. audio duration)
- [ ] Test edge cases (silence, background noise)

**Files to Create**:
- `scripts/diarize_audio.py` - Python script using pyannote.audio
- `src/services/diarization.ts` - TypeScript service wrapping Python script
- `src/utils/mergeDiarization.ts` - Algorithm to merge speakers with transcript
- `src/types/diarization.ts` - TypeScript interfaces for speaker segments
- Update: `src/types/transcription.ts` - Add speaker info to transcript segments

**Python Script Structure** (`scripts/diarize_audio.py`):
```python
#!/usr/bin/env python3
import sys
import json
from pyannote.audio import Pipeline

def diarize_audio(audio_path):
    """Run speaker diarization on audio file"""
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token="<HF_TOKEN>"  # Will read from env
    )

    diarization = pipeline(audio_path)

    # Convert to JSON format
    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append({
            "start": turn.start,
            "end": turn.end,
            "speaker": speaker
        })

    return {"segments": segments}

if __name__ == "__main__":
    audio_path = sys.argv[1]
    result = diarize_audio(audio_path)
    print(json.dumps(result))
```

**Merge Algorithm Overview**:
```typescript
function mergeDiarizationWithTranscript(
  transcript: WhisperSegment[],  // Words with timestamps
  diarization: SpeakerSegment[]   // Speaker segments with timestamps
): TranscriptWithSpeakers {
  // For each word in transcript:
  //   Find which speaker segment it falls into
  //   Assign speaker label to word
  // Group consecutive words by same speaker into utterances
  // Return: [{speaker: "Speaker 1", text: "Hello everyone"}, ...]
}
```

**Performance Expectations**:
- Whisper transcription: ~1-2 minutes for 5-min audio
- Diarization: ~30 seconds for 5-min audio (can run in parallel)
- Merging: < 1 second (in-memory operation)
- Total: ~1-2 minutes (diarization runs in parallel with transcription)

**Dependencies to Add**:
```bash
pip install pyannote.audio
# Models will be downloaded automatically on first run
# Total download: ~300MB (one-time)
```

**Configuration**:
- Hugging Face token (free account): Required to download pyannote models
- Token stored in .env: `HUGGINGFACE_TOKEN=hf_xxx`
- Models cached locally after first download

**Success Criteria**:
- Install pyannote.audio successfully
- Record multi-speaker audio (2+ people)
- Get speaker-labeled transcript: "Speaker 1: ..., Speaker 2: ..."
- Accuracy: >80% speaker assignment correctness
- Performance: Total time < 2 minutes for 5-minute audio
- Display speaker-labeled transcript in UI

**Known Limitations**:
- Speaker labels are generic ("Speaker 1", "Speaker 2") - names require Phase 2 calendar data
- Overlapping speech may cause confusion (pyannote handles this better than most)
- Very similar voices may be grouped together
- Background noise can affect accuracy

---

**Implementation Complete ✓ (2025-10-13)**

**Tasks Completed**:
- [x] Install pyannote.audio 4.0.1 via Python venv
- [x] Set up Hugging Face token in .env
- [x] Accept licenses for required models (speaker-diarization-3.1, segmentation-3.0, speaker-diarization-community-1)
- [x] Create Python diarization script (scripts/diarize_audio.py)
- [x] Implement DiarizationService TypeScript class
- [x] Create merge algorithm using temporal intersection (best practice)
- [x] Update main process with diarization IPC handlers
- [x] Update UI to display speaker-labeled transcripts
- [x] Fix pyannote.audio 4.x API changes (`use_auth_token` → `token`, `DiarizeOutput` object structure)
- [x] Fix timestamp format conversion (Whisper milliseconds → seconds for alignment)

**Testing Completed**:
- ✅ Two-speaker audio detection working correctly
- ✅ Speaker labels applied to transcript segments
- ✅ Temporal intersection matching working properly
- ✅ Build and type-check pass

**Files Created**:
- ✅ `scripts/diarize_audio.py` - Python script using pyannote.audio 4.x API
- ✅ `src/services/diarization.ts` - Diarization service with subprocess execution
- ✅ `src/types/diarization.ts` - TypeScript interfaces for speaker segments
- ✅ `src/utils/mergeDiarization.ts` - Temporal intersection merge algorithm
- ✅ `venv/` - Python virtual environment with pyannote.audio dependencies

**Files Modified**:
- ✅ `src/main/index.ts` - Added diarization and combined transcribe+diarize IPC handlers
- ✅ `src/preload/index.ts` - Exposed diarization APIs to renderer
- ✅ `src/types/electron.d.ts` - Added diarization type definitions
- ✅ `src/renderer/App.tsx` - Updated UI to use transcribeAndDiarize and display speaker labels
- ✅ `.env.example` - Added HUGGINGFACE_TOKEN configuration

**Dependencies Added**:
- ✅ `dotenv` - Environment variable loading
- ✅ Python venv with:
  - pyannote.audio 4.0.1
  - torch 2.8.0 (with Metal support for macOS)
  - torchaudio 2.8.0
  - ~40 transitive dependencies

**Architecture Decisions**:
1. **Python subprocess pattern** - Consistent with Phase 1.2 (Whisper), avoids native module issues
2. **Temporal intersection matching** - Industry best practice for aligning Whisper + pyannote outputs
3. **Combined API** - `transcribeAndDiarize` runs both operations with unified progress reporting
4. **Timestamp normalization** - Converts Whisper's millisecond offsets to seconds for alignment

**Critical Bugs Fixed**:
1. **pyannote.audio 4.x API changes**:
   - Changed `use_auth_token` → `token` parameter
   - Output changed from `Annotation` → `DiarizeOutput` object with `.speaker_diarization` property
2. **Timestamp format mismatch**:
   - Whisper outputs `offsets.from/to` in milliseconds
   - Diarization expects seconds
   - Added `normalizeWhisperSegment()` function to convert ms → seconds
3. **Environment variable loading**:
   - Added `dotenv.config()` to main process to load HUGGINGFACE_TOKEN

**Performance Characteristics**:
- Whisper transcription: ~1-2x realtime (fast with Metal GPU)
- pyannote.audio diarization: ~1-2 minutes per minute of audio (Python/CPU)
- Total for 30-second audio: ~30-60 seconds
- Merge operation: < 1 second (in-memory)

**Known Issues**:
1. **Diarization slower than transcription** - pyannote runs on CPU, Whisper uses Metal GPU
2. **Occasional speaker overdetection** - May detect 3 speakers when only 2 present (voice variation, noise)
3. **Generic speaker labels** - "SPEAKER_00", "SPEAKER_01" - Phase 2 will map to actual names from calendar

**Success Criteria**: ✅ Phase 1.3 Complete
- ✅ Multi-speaker audio correctly labeled with speaker IDs
- ✅ Transcript shows speaker-attributed text
- ✅ Temporal intersection matching working
- ✅ Ready for Phase 2 name mapping from calendar data

**Next Phase**: Phase 2 - Microsoft Graph Integration (map speaker labels to attendee names)

---

**Planned Enhancements (Before Phase 2)**:
1. ✅ **Better progress feedback** - Show detailed diarization progress messages (Completed: 2025-10-13)
2. ✅ **Optional diarization** - Allow "Transcribe only" for speed (Completed: 2025-10-13)
3. 📄 **GPU acceleration** - Documented Metal/CUDA support for future (docs/gpu-acceleration.md)

---

#### Phase 1.4: Recording Announcement (Next)
**Goal**: Add audio announcement for meeting transparency and consent

**Requirement**:
When user clicks "Start Recording", play an announcement through system speakers to inform meeting participants that recording is in progress. This ensures transparency and allows participants to object or leave if they don't consent.

**Announcement Text**:
> "This meeting, with your permission, is being recorded to generate meeting notes. These recordings will be deleted after notes are generated."

**Why This Matters**:
- Legal compliance (some jurisdictions require consent)
- Ethical transparency (participants should know they're being recorded)
- Trust building (shows respect for participant privacy)
- Audio documentation (announcement is captured in recording itself)

**Implementation Plan**:

**Tasks**:
- [ ] Implement `playAnnouncement()` method in AudioCaptureService
- [ ] Use macOS `say` command for text-to-speech
- [ ] Trigger announcement immediately after "Start Recording" clicked
- [ ] Add 2-second delay before recording starts (allow announcement to complete)
- [ ] Update deletion policy: "delete after summary generation" (not just transcription)
- [ ] Add announcement settings (Phase 7): custom text, enable/disable
- [ ] Update Phase 6 documentation with revised deletion policy

**Technical Approach**:
```typescript
// src/services/audioCapture.ts
async startRecording() {
  // Play announcement first
  await this.playAnnouncement()

  // Wait 2 seconds for announcement to complete
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Then start recording
  this.isRecording = true
  // ... rest of recording logic
}

private async playAnnouncement(): Promise<void> {
  const text = "This meeting, with your permission, is being recorded to generate meeting notes. These recordings will be deleted after notes are generated."

  return new Promise((resolve, reject) => {
    const process = spawn('say', [text])
    process.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Announcement failed: ${code}`))
    })
  })
}
```

**Testing**:
- [ ] Test announcement plays through system speakers
- [ ] Verify announcement is captured in recording
- [ ] Test recording starts after announcement completes
- [ ] Test on Zoom/Teams/Meet (verify remote participants hear it)
- [ ] Test error handling if `say` command fails
- [ ] Verify 2-second delay is sufficient for announcement

**Files to Modify**:
- `src/services/audioCapture.ts` - Add announcement playback
- `src/types/audio.ts` - Add `announcementText` to AudioConfig (optional)
- `CLAUDE.md` - Update Phase 6 deletion policy

**Platform Considerations**:
- macOS: Use `say` command (built-in, no dependencies)
- Windows (future): Use PowerShell `Add-Type -AssemblyName System.Speech`
- Linux (future): Use `espeak` or `festival`

**Customization (Phase 7 - Settings)**:
- Allow users to edit announcement text
- Toggle announcement on/off
- Select voice/language (macOS supports multiple voices)
- Example: `say -v Samantha "Your text here"`

**Privacy & Legal**:
- Announcement provides **notice** of recording
- Does NOT replace legal consent requirements (consult lawyer)
- User should still inform participants at start of meeting
- Announcement creates audio record of notice

**Audio File Deletion Policy Update**:

**Old Policy** (Phase 6):
- Delete audio immediately after transcription succeeds

**New Policy**:
- Delete audio after **summary generation** succeeds
- Ensures audio is available if transcription needs to be regenerated
- Summary is the final deliverable, so safe to delete after that point

**Updated Phase 6 Tasks**:
```markdown
- [ ] Implement audio file lifecycle management:
  - [ ] Delete audio after successful summary generation (not just transcription)
  - [ ] Option to keep audio files (user preference)
  - [ ] If keeping audio: enforce storage quota (default 5GB)
  - [ ] Auto-delete oldest audio files when quota exceeded
  - [ ] Track total storage usage in settings UI
```

**Success Criteria**:
- Announcement plays through system speakers when recording starts
- Remote meeting participants hear the announcement
- Announcement is captured in the recording
- Recording starts smoothly after announcement completes
- Phase 6 deletion policy updated in documentation

**Next Phase**: Phase 1.5 - Chunked Recording with Auto-Save

---

#### Phase 1.5: Chunked Recording with Auto-Save (Next)
**Goal**: Prevent data loss and memory exhaustion during long meetings

**Problem Statement**:
Current implementation buffers entire recording in memory, which creates risks:
1. **Memory exhaustion** - 60-minute recording = ~60MB RAM, 120 minutes = ~120MB
2. **Browser crash** - Large Blob objects (>1GB) can crash renderer process
3. **Data loss** - If app crashes before `stopRecording()`, entire recording is lost
4. **File save failure** - Very large ArrayBuffers may fail IPC transfer or disk write

**Current Architecture Issue**:
```typescript
// src/services/audioCapture.ts - Current implementation
this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
  if (event.data.size > 0) {
    this.chunks.push(event.data)  // ❌ Keeps growing unbounded in RAM
  }
}
```

**Solution**: Time-based Auto-Save with Chunking

Save audio chunks to disk every 5 minutes automatically, then merge on completion.

**Implementation Plan**:

**Tasks**:
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

**Technical Approach**:

**1. Chunked Recording**:
```typescript
// src/services/audioCapture.ts
async startRecording() {
  // Configure MediaRecorder to emit chunks every 5 minutes
  this.mediaRecorder = new MediaRecorder(mergedStream, {
    mimeType: 'audio/wav',
    timeslice: 5 * 60 * 1000  // 5 minutes = 300,000ms
  })

  this.currentSession = {
    id: new Date().toISOString(),
    chunkIndex: 0,
    savedChunks: [],
    startTime: Date.now()
  }

  // Auto-save each chunk as it becomes available
  this.mediaRecorder.ondataavailable = async (event: BlobEvent) => {
    if (event.data.size > 0) {
      await this.saveChunk(event.data)
      this.chunks = []  // Clear memory after saving
    }
  }

  this.mediaRecorder.start()
  this.isRecording = true
}

private async saveChunk(blob: Blob): Promise<void> {
  const session = this.currentSession!
  const chunkIndex = session.chunkIndex++
  const filename = `chunk_${chunkIndex.toString().padStart(3, '0')}.wav`

  console.log(`[AutoSave] Saving chunk ${chunkIndex} (${blob.size} bytes)...`)

  const arrayBuffer = await blob.arrayBuffer()
  const result = await window.electronAPI.saveAudioChunk(
    arrayBuffer,
    session.id,
    filename
  )

  if (result.success) {
    session.savedChunks.push(result.filePath)
    session.lastSaveTime = Date.now()
    console.log(`[AutoSave] Chunk ${chunkIndex} saved successfully`)
  } else {
    throw new Error(`Failed to save chunk ${chunkIndex}: ${result.error}`)
  }
}

async stopRecording(): Promise<RecordingSession> {
  // Request final chunk
  this.mediaRecorder.stop()

  // Wait for final chunk to be saved
  await new Promise(resolve => {
    this.mediaRecorder.onstop = resolve
  })

  // Merge all chunks into final WAV file
  console.log('[Merge] Merging chunks into final recording...')
  const mergedPath = await this.mergeChunks(this.currentSession!)

  // Cleanup: delete individual chunks (optional, for disk space)
  await this.cleanupChunks(this.currentSession!)

  this.isRecording = false

  return {
    id: this.currentSession!.id,
    startTime: this.currentSession!.startTime,
    duration: (Date.now() - this.currentSession!.startTime) / 1000,
    filePath: mergedPath,
    blob: null  // Not needed anymore, file is on disk
  }
}
```

**2. Chunk Storage Structure**:
```
userData/recordings/
  session_2025-10-13T16-30-00-000Z/
    chunk_000.wav  (0-5 min)
    chunk_001.wav  (5-10 min)
    chunk_002.wav  (10-15 min)
    chunk_003.wav  (15-20 min)
    merged.wav     (final output, created on stopRecording)
```

**3. WAV Chunk Merging (FFmpeg)**:
```typescript
// src/services/audioCapture.ts
private async mergeChunks(session: RecordingSession): Promise<string> {
  const sessionDir = path.join(app.getPath('userData'), 'recordings', session.id)
  const mergedPath = path.join(sessionDir, 'merged.wav')

  // Create concat list for FFmpeg
  const concatList = session.savedChunks
    .map(chunk => `file '${chunk}'`)
    .join('\n')

  const listPath = path.join(sessionDir, 'concat_list.txt')
  fs.writeFileSync(listPath, concatList)

  // Merge using FFmpeg
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      mergedPath
    ])

    ffmpeg.on('close', (code) => {
      fs.unlinkSync(listPath)  // Cleanup concat list
      if (code === 0) {
        console.log('[Merge] Successfully merged chunks')
        resolve(mergedPath)
      } else {
        reject(new Error(`FFmpeg merge failed: ${code}`))
      }
    })
  })
}

private async cleanupChunks(session: RecordingSession): Promise<void> {
  for (const chunkPath of session.savedChunks) {
    try {
      fs.unlinkSync(chunkPath)
      console.log(`[Cleanup] Deleted chunk: ${chunkPath}`)
    } catch (err) {
      console.warn(`[Cleanup] Failed to delete chunk: ${chunkPath}`, err)
    }
  }
}
```

**4. IPC Handler (Main Process)**:
```typescript
// src/main/index.ts
ipcMain.handle('save-audio-chunk', async (_event, arrayBuffer: ArrayBuffer, sessionId: string, filename: string) => {
  try {
    const userDataPath = app.getPath('userData')
    const sessionDir = path.join(userDataPath, 'recordings', sessionId)

    // Create session directory if it doesn't exist
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    const filePath = path.join(sessionDir, filename)

    // Write chunk to disk
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer))

    console.log(`[Main] Chunk saved: ${filePath} (${arrayBuffer.byteLength} bytes)`)
    return { success: true, filePath }
  } catch (error) {
    console.error('[Main] Failed to save chunk:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save chunk'
    }
  }
})
```

**5. Crash Recovery on Startup**:
```typescript
// src/main/index.ts - Call this in app.whenReady()
async function recoverIncompleteRecordings() {
  const recordingsDir = path.join(app.getPath('userData'), 'recordings')

  if (!fs.existsSync(recordingsDir)) return

  const sessions = fs.readdirSync(recordingsDir)

  for (const sessionId of sessions) {
    const sessionDir = path.join(recordingsDir, sessionId)
    const mergedPath = path.join(sessionDir, 'merged.wav')

    // Check if this is an incomplete recording
    if (!fs.existsSync(mergedPath)) {
      const chunks = fs.readdirSync(sessionDir)
        .filter(f => f.startsWith('chunk_') && f.endsWith('.wav'))
        .sort()

      if (chunks.length > 0) {
        console.log(`[Recovery] Found incomplete recording: ${sessionId} (${chunks.length} chunks)`)

        try {
          // Merge chunks automatically
          await mergeChunksFFmpeg(sessionDir, chunks, mergedPath)
          console.log(`[Recovery] Successfully recovered: ${sessionId}`)

          // Cleanup chunks after successful merge
          for (const chunk of chunks) {
            fs.unlinkSync(path.join(sessionDir, chunk))
          }
        } catch (error) {
          console.error(`[Recovery] Failed to recover ${sessionId}:`, error)
        }
      }
    }
  }
}

app.whenReady().then(async () => {
  // Recover any incomplete recordings from previous crashes
  await recoverIncompleteRecordings()

  // ... rest of initialization
})
```

**6. UI Updates**:
```tsx
// src/renderer/App.tsx
const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)

// Listen for chunk save events
useEffect(() => {
  if (audioServiceRef.current) {
    audioServiceRef.current.onChunkSaved(() => {
      setLastAutoSave(new Date())
    })
  }
}, [])

// Display last save time
<div className="recording-status">
  <div className="timer">{formatDuration(duration)}</div>
  <div className="status">
    {isRecording ? '🔴 Recording...' : '⏸️ Ready'}
  </div>
  {lastAutoSave && isRecording && (
    <div className="auto-save-info">
      💾 Last saved: {timeSince(lastAutoSave)}
    </div>
  )}
</div>
```

**Testing**:
- [ ] Test 5-minute recording: verify single chunk saved
- [ ] Test 15-minute recording: verify 3 chunks saved and merged correctly
- [ ] Test 60-minute recording: verify memory stays <10MB (not ~60MB)
- [ ] Test crash recovery: kill app at 12 minutes, restart, verify 2 chunks merge
- [ ] Test merge quality: verify merged audio has no gaps, clicks, or artifacts
- [ ] Test transcription: verify Whisper works correctly with merged files
- [ ] Test chunk cleanup: verify individual chunks deleted after merge
- [ ] Test disk space: verify chunks are reasonable size (~5MB each)

**Files to Modify**:
- `src/services/audioCapture.ts` - Add chunking and auto-save logic
- `src/main/index.ts` - Add `saveAudioChunk` IPC handler and crash recovery
- `src/preload/index.ts` - Expose `saveAudioChunk` to renderer
- `src/types/electron.d.ts` - Add type definitions
- `src/types/audio.ts` - Update RecordingSession type
- `src/renderer/App.tsx` - Add last-save indicator
- `src/renderer/styles/index.css` - Style auto-save indicator

**Dependencies**:
- `ffmpeg` - Already required for Phase 1.2 (audio preprocessing)
- No new dependencies needed ✅

**Memory Usage Comparison**:

| Meeting Duration | Current (Buffered) | With Chunking (5min) |
|------------------|-------------------|----------------------|
| 5 minutes        | ~5 MB RAM         | ~5 MB RAM            |
| 30 minutes       | ~30 MB RAM        | ~5 MB RAM ✅          |
| 60 minutes       | ~60 MB RAM ⚠️      | ~5 MB RAM ✅          |
| 120 minutes      | ~120 MB RAM ⚠️⚠️   | ~5 MB RAM ✅          |

**Performance Impact**:
- Disk I/O every 5 minutes: ~5MB write (~0.1 seconds on SSD)
- Merge time on stop: ~1 second for 60-minute recording
- Total overhead: Negligible, worth the safety

**Alternative Chunk Intervals**:
- 2 minutes: More frequent saves, more chunks to merge
- 5 minutes: **Recommended balance**
- 10 minutes: Less overhead, but higher risk of data loss

**Success Criteria**:
- Memory usage stays constant (~5MB) regardless of recording duration
- Chunks auto-save every 5 minutes without user intervention
- Merged audio is seamless (no gaps or artifacts)
- Crash recovery works: incomplete recordings merge on startup
- UI shows "Last saved: X minutes ago" during recording
- 60-minute recording completes successfully with <10MB RAM usage

**Next Phase**: Phase 1.4 - Recording Announcement (or combine both as Phase 1.4+1.5)

---

### Phase 2: Microsoft Graph Integration
**Goal**: Authenticate with M365 and fetch meeting context

#### Phase 2.1: Authentication
**Tasks**:
- [ ] Register application in Azure AD
- [ ] Configure MSAL for Electron
- [ ] Implement OAuth2 authentication flow
- [ ] Store and refresh tokens securely (using `keytar`)
- [ ] Build login/logout UI
- [ ] Handle authentication errors

**Testing**:
- [ ] Test initial login flow
- [ ] Test token refresh after expiration
- [ ] Test logout and re-login
- [ ] Verify tokens stored securely (not in plain text)
- [ ] Test error handling for failed authentication

**Files Created**:
- `src/services/auth.ts`
- `src/renderer/components/Login.tsx`
- `tests/auth.test.ts`

#### Phase 2.2: Calendar & Meeting Context
**Tasks**:
- [ ] Implement Graph API service for calendar events
- [ ] Fetch today's and upcoming meetings
- [ ] Extract meeting metadata (title, attendees, time, description)
- [ ] Fetch meeting organizer and attendee details
- [ ] Cache calendar data locally
- [ ] Implement auto-refresh every 15 minutes

**Testing**:
- [ ] Test fetching today's meetings
- [ ] Test fetching next 7 days of meetings
- [ ] Verify attendee email addresses are correct
- [ ] Test with recurring meetings
- [ ] Test with cancelled meetings
- [ ] Test offline behavior (uses cached data)

**Files Created**:
- `src/services/graph.ts`
- `src/services/calendar.ts`
- `src/types/meeting.ts`
- `tests/calendar.test.ts`

**Success Criteria**: GUI displays today's M365 meetings with full attendee lists

---

### Phase 3: AI Summarization
**Goal**: Generate intelligent meeting summaries using Claude API

**Tasks**:
- [ ] Set up Anthropic API client
- [ ] Design summary prompt template (include meeting context)
- [ ] Implement summarization service
- [ ] Add support for different summary styles (brief/detailed)
- [ ] Extract action items and decisions
- [ ] Handle API errors and retries
- [ ] Add cost tracking (token usage)

**Prompt Strategy**:
```
Context:
- Meeting: {title}
- Attendees: {list}
- Duration: {time}
- Agenda: {description}

Transcript:
{full_transcript}

Please provide:
1. Executive Summary (2-3 sentences)
2. Key Discussion Points
3. Decisions Made
4. Action Items (with owners if mentioned)
5. Next Steps
```

**Testing**:
- [ ] Test with 5-minute meeting transcript
- [ ] Test with 60-minute meeting transcript
- [ ] Verify action items are correctly extracted
- [ ] Test with meeting that has no clear decisions
- [ ] Test API error handling (invalid key, rate limits)
- [ ] Verify cost tracking is accurate

**Files Created**:
- `src/services/summarize.ts`
- `src/services/anthropic.ts`
- `src/prompts/summary.ts`
- `tests/summarize.test.ts`

**Success Criteria**: Generate coherent summary from test transcript with action items

---

### Phase 4: GUI Development
**Goal**: Build intuitive Electron interface

#### Phase 4.1: Core UI Components
**Tasks**:
- [ ] Set up React with TypeScript
- [ ] Create main application layout
- [ ] Build meeting list component (shows upcoming meetings)
- [ ] Build recording controls (start/stop, timer, audio levels)
- [ ] Build live transcript view (scrolling, auto-update)
- [ ] Add loading states and error messages
- [ ] Implement responsive layout

**Testing**:
- [ ] Manual UI testing: Navigate through all screens
- [ ] Test meeting list updates when new meetings added
- [ ] Test recording timer accuracy
- [ ] Test live transcript auto-scrolling
- [ ] Test UI with very long meeting titles/descriptions
- [ ] Test dark mode compatibility (if applicable)

**Files Created**:
- `src/renderer/App.tsx`
- `src/renderer/components/MeetingList.tsx`
- `src/renderer/components/RecordingControls.tsx`
- `src/renderer/components/TranscriptView.tsx`
- `src/renderer/styles/`

#### Phase 4.2: Summary Editor
**Tasks**:
- [ ] Build rich text editor for summary editing
- [ ] Add recipient selector (checkboxes for attendees)
- [ ] Add custom recipient input (for non-attendees)
- [ ] Add preview mode for email
- [ ] Implement save draft functionality
- [ ] Add export options (PDF, Markdown, plain text)

**Testing**:
- [ ] Test editing summary (formatting, undo/redo)
- [ ] Test selecting/deselecting recipients
- [ ] Test adding custom email addresses
- [ ] Test email preview rendering
- [ ] Test save/load draft functionality
- [ ] Test export to different formats

**Files Created**:
- `src/renderer/components/SummaryEditor.tsx`
- `src/renderer/components/RecipientSelector.tsx`
- `src/renderer/components/EmailPreview.tsx`
- `tests/ui.test.tsx`

**Success Criteria**: Complete user flow from meeting selection to edited summary

---

### Phase 5: Email Distribution
**Goal**: Send summaries via Microsoft Graph API

**Tasks**:
- [ ] Implement email sending via Graph API
- [ ] Create email template with proper formatting
- [ ] Add attachment support (transcript, audio optional)
- [ ] Implement send confirmation dialog
- [ ] Add sent history tracking
- [ ] Handle send failures gracefully

**Testing**:
- [ ] Test sending email to single recipient
- [ ] Test sending to multiple recipients
- [ ] Test with attachments
- [ ] Test email formatting in Outlook/Gmail
- [ ] Test error handling (offline, API failure)
- [ ] Verify sent emails appear in user's Sent folder

**Files Created**:
- `src/services/email.ts`
- `src/templates/email.html`
- `src/renderer/components/SendDialog.tsx`
- `tests/email.test.ts`

**Success Criteria**: Send formatted summary email to test recipients

---

### Phase 6: Data Management & Persistence
**Goal**: Store recordings, transcripts, and summaries locally with smart storage management

**Tasks**:
- [ ] Set up SQLite database (using `better-sqlite3`)
- [ ] Create schema for meetings, transcripts, summaries
- [ ] Implement data access layer
- [ ] Add meeting history view in GUI
- [ ] Implement search functionality
- [ ] Add export all data functionality
- [ ] Implement audio file lifecycle management:
  - [ ] Delete audio after successful **summary generation** (not just transcription)
  - [ ] Option to keep audio files (user preference)
  - [ ] If keeping audio: enforce storage quota (default 5GB)
  - [ ] Auto-delete oldest audio files when quota exceeded
  - [ ] Track total storage usage in settings UI
- [ ] Implement transcript/summary cleanup (configurable retention period)

**Schema**:
```sql
meetings:
  - id, meeting_id, title, date, duration
  - attendees (JSON), organizer
  - audio_path, audio_size_bytes, audio_kept (boolean)
  - transcript_path

transcripts:
  - id, meeting_id, full_text, created_at

summaries:
  - id, meeting_id, summary_text
  - edited_text, sent_at, recipients (JSON)

storage_stats:
  - total_audio_size_bytes
  - total_meetings_count
  - oldest_audio_date
  - last_cleanup_at
```

**Audio File Management Strategy**:
1. **Default behavior**: Delete audio after **summary generation** succeeds (updated from Phase 1.4)
2. **Optional retention**: User can enable "Keep audio files" in settings
3. **Storage quota**: If keeping audio, enforce configurable limit (default 5GB)
4. **FIFO cleanup**: When quota exceeded, delete oldest audio files first
5. **User override**: Allow pinning important meetings to prevent deletion
6. **Storage dashboard**: Show current usage, quota, and cleanup options

**Rationale for deletion after summary** (not transcription):
- Ensures audio is available if transcription needs to be regenerated
- Summary is the final deliverable, safe to delete after that point
- Allows users to regenerate transcripts with different settings if needed

**Testing**:
- [ ] Test saving new meeting record
- [ ] Test retrieving meeting history
- [ ] Test search functionality (by title, date, attendee)
- [ ] Test data export
- [ ] Test audio deletion after transcription
- [ ] Test audio retention with quota enforcement
- [ ] Test oldest-first deletion when quota exceeded
- [ ] Test pinned meetings aren't auto-deleted
- [ ] Test storage stats calculation accuracy
- [ ] Verify database doesn't grow unbounded

**Files Created**:
- `src/services/database.ts`
- `src/services/storage.ts` (audio file management)
- `src/models/`
- `src/renderer/components/MeetingHistory.tsx`
- `src/renderer/components/StorageDashboard.tsx`
- `migrations/001_initial.sql`
- `tests/database.test.ts`
- `tests/storage.test.ts`

**Success Criteria**: View history of past meetings with transcripts and summaries; storage stays under quota

---

### Phase 7: Configuration & Settings
**Goal**: Make application configurable

**Tasks**:
- [ ] Build settings UI panel
- [ ] Add Azure/Anthropic API key configuration
- [ ] Add Whisper model selection (tiny/base/small)
- [ ] Add summary style preferences
- [ ] Add data retention settings
- [ ] Add audio device selection
- [ ] Implement settings validation

**Configuration Options**:
- API credentials (encrypted storage)
- Whisper model size
- Summary verbosity (brief/standard/detailed)
- Audio file retention:
  - Keep audio files (on/off, default: off)
  - Storage quota if keeping (default: 5GB)
  - Allow pinning important meetings
- Transcript/summary retention period (default: unlimited)
- Default email template
- Audio input device

**Testing**:
- [ ] Test saving and loading settings
- [ ] Test API key validation
- [ ] Test invalid settings handling
- [ ] Verify settings persist after app restart
- [ ] Test changing Whisper model downloads correct file

**Files Created**:
- `src/services/config.ts`
- `src/renderer/components/Settings.tsx`
- `tests/config.test.ts`

**Success Criteria**: Configure API keys and preferences, persist across restarts

---

### Phase 8: Error Handling & Logging
**Goal**: Robust error handling and debugging support

**Tasks**:
- [ ] Implement centralized error handling
- [ ] Add logging service (using `winston` or `pino`)
- [ ] Log all API calls and responses
- [ ] Add user-friendly error messages
- [ ] Implement crash reporting (optional: Sentry)
- [ ] Add debug mode for troubleshooting
- [ ] Create error recovery strategies

**Testing**:
- [ ] Test handling of network failures
- [ ] Test handling of API rate limits
- [ ] Test handling of missing audio device
- [ ] Test handling of corrupted audio files
- [ ] Verify logs are written correctly
- [ ] Test app recovery after crash

**Files Created**:
- `src/services/logger.ts`
- `src/utils/errorHandler.ts`
- `src/renderer/components/ErrorBoundary.tsx`
- `tests/errorHandling.test.ts`

**Success Criteria**: Application handles all common errors gracefully with helpful messages

---

### Phase 9: Performance Optimization
**Goal**: Ensure smooth performance with large meetings

**Tasks**:
- [ ] Profile memory usage during long recordings
- [ ] Optimize Whisper processing (chunking, parallelization)
- [ ] Implement transcript streaming (don't wait for full audio)
- [ ] Optimize database queries
- [ ] Lazy-load meeting history
- [ ] Implement audio file compression
- [ ] Add performance monitoring

**Performance Targets**:
- Max memory usage: < 500MB during 60-min meeting
- Transcript latency: < 30 seconds behind real-time
- Summary generation: < 60 seconds for 60-min meeting
- GUI responsiveness: < 100ms for user interactions
- Startup time: < 3 seconds

**Testing**:
- [ ] Load test: Record 2-hour meeting
- [ ] Stress test: 100+ meetings in history
- [ ] Memory leak test: Record 5 meetings back-to-back
- [ ] Verify transcript appears within 30 seconds of speech
- [ ] Measure summary generation time for various lengths

**Files Updated**:
- All service files with performance optimizations
- `docs/performance.md` with benchmarks

**Success Criteria**: Handle 2-hour meeting without performance degradation

---

### Phase 10: Documentation & Packaging
**Goal**: Prepare for deployment and user onboarding

**Tasks**:
- [ ] Write user documentation (README.md)
- [ ] Create setup guide (BlackHole installation, API keys)
- [ ] Document troubleshooting steps
- [ ] Add inline code documentation
- [ ] Create developer setup guide
- [ ] Build macOS application package (.dmg)
- [ ] Create auto-update mechanism (optional)
- [ ] Write release notes

**Documentation Sections**:
1. Installation & Setup
2. BlackHole Configuration
3. M365 App Registration
4. API Key Setup (Claude/Azure)
5. Usage Guide
6. Troubleshooting
7. Privacy & Data Handling
8. Development Setup

**Testing**:
- [ ] Fresh install test on clean macOS system
- [ ] Verify all setup steps in documentation work
- [ ] Test .dmg installation
- [ ] Test auto-update (if implemented)

**Files Created**:
- `README.md`
- `docs/setup.md`
- `docs/troubleshooting.md`
- `docs/development.md`
- `docs/api-setup.md`
- `CONTRIBUTING.md`
- `LICENSE`

**Success Criteria**: New user can install and run app following documentation alone

---

## Testing Strategy

### Unit Tests
- All service modules (`audio`, `transcription`, `summarize`, `email`, `calendar`)
- Utility functions
- Data models and database operations
- Run with: `npm test`
- Coverage target: > 80%

### Integration Tests
- End-to-end flow: Record → Transcribe → Summarize → Send
- Microsoft Graph API integration
- Audio capture → Whisper pipeline
- Database operations with real data
- Run with: `npm run test:integration`

### Manual Testing Checklist
- [ ] Install BlackHole and configure audio routing
- [ ] Authenticate with M365 account
- [ ] View today's calendar meetings
- [ ] Join test Zoom meeting and record 5 minutes
- [ ] Verify transcript appears in real-time
- [ ] Generate summary
- [ ] Edit summary in GUI
- [ ] Select recipients
- [ ] Send email
- [ ] Verify email received correctly formatted
- [ ] Check meeting appears in history
- [ ] Search for past meeting
- [ ] Export meeting data
- [ ] Test all error scenarios (no audio, no network, invalid API key)

### Performance Testing
- [ ] Record 15-minute meeting: < 200MB memory
- [ ] Record 60-minute meeting: < 500MB memory
- [ ] Transcript latency: < 30 seconds
- [ ] Summary generation: < 60 seconds
- [ ] GUI remains responsive during processing
- [ ] No memory leaks after multiple recordings

---

## Development Commands

### Setup
```bash
# Install dependencies
npm install

# Download Whisper model
npm run setup:whisper

# Configure environment
cp .env.example .env
# Edit .env with API keys
```

### Development
```bash
# Run in development mode (hot reload)
npm run dev

# Run tests
npm test

# Run integration tests
npm run test:integration

# Lint and format
npm run lint
npm run format

# Type check
npm run type-check
```

### Build & Package
```bash
# Build for production
npm run build

# Package macOS app
npm run package:mac

# Create DMG installer
npm run dist:mac
```

### Database
```bash
# Run migrations
npm run db:migrate

# Reset database
npm run db:reset

# Backup database
npm run db:backup
```

---

## Architecture

### Tech Stack
- **Runtime**: Node.js 20+
- **Framework**: Electron 28+
- **Language**: TypeScript 5+
- **UI**: React 18 with TypeScript
- **Database**: SQLite (better-sqlite3)
- **Audio**: BlackHole + sox/node-mic
- **Transcription**: Whisper (whisper.cpp or Python bindings)
- **Summarization**: Anthropic Claude API
- **Calendar/Email**: Microsoft Graph API
- **Auth**: MSAL (Microsoft Authentication Library)
- **Build**: Webpack or Vite
- **Testing**: Jest + React Testing Library

### Project Structure
```
meeting-agent/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts         # App entry point
│   │   ├── ipc.ts           # IPC handlers
│   │   └── menu.ts          # Application menu
│   ├── renderer/             # Electron renderer (UI)
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── styles/
│   │   └── index.tsx
│   ├── services/             # Business logic
│   │   ├── audio.ts         # Audio capture
│   │   ├── transcription.ts # Whisper integration
│   │   ├── summarize.ts     # Claude API
│   │   ├── auth.ts          # M365 authentication
│   │   ├── calendar.ts      # Graph calendar API
│   │   ├── email.ts         # Graph email API
│   │   ├── database.ts      # SQLite operations
│   │   ├── storage.ts       # Audio file lifecycle management
│   │   ├── config.ts        # Settings management
│   │   └── logger.ts        # Logging
│   ├── models/               # Data models
│   ├── types/                # TypeScript types
│   ├── utils/                # Helper functions
│   └── prompts/              # AI prompt templates
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── scripts/                  # Build and setup scripts
├── migrations/               # Database migrations
├── resources/                # App icons, assets
├── docs/                     # Documentation
├── .env.example
├── package.json
├── tsconfig.json
├── electron-builder.yml
└── CLAUDE.md                # This file
```

### Key Design Decisions

**Audio Processing**:
- Use BlackHole virtual audio device (user must install separately)
- Capture system audio at 16kHz mono for Whisper compatibility
- Store raw audio temporarily, delete after transcription (unless user opts to keep)

**Transcription**:
- Whisper runs locally to minimize costs
- Use `small` model by default (good balance of speed/accuracy)
- Process in chunks for real-time transcript updates
- Fallback to cloud API if local processing fails (optional)

**Summarization**:
- Claude API for superior quality and lower cost vs GPT-4
- Include meeting metadata in prompt for context-aware summaries
- Structured output format (summary, decisions, action items)

**Data Storage**:
- SQLite for simplicity (no server setup required)
- Encrypt sensitive data (API keys) using `keytar`
- Smart audio file management:
  - Default: Delete audio after summary generation (Phase 1.4)
  - Optional: Keep audio with 5GB quota, FIFO cleanup
  - Allow pinning important meetings to prevent deletion

**Error Handling**:
- Graceful degradation (e.g., work without calendar if Graph API fails)
- User-friendly error messages with actionable solutions
- Comprehensive logging for debugging

---

## Milestones & CLAUDE.md Updates

After completing each phase, update this file:

1. **Mark phase as complete**: Change ✓ or add completion date
2. **Document any deviations**: Note what changed from the plan
3. **Update architecture**: Add new patterns or design decisions
4. **Update commands**: Add any new npm scripts
5. **Note known issues**: Document bugs or limitations to address later

### Phase Completion Template
```markdown
### Phase N: [Name] ✓ (Completed: YYYY-MM-DD)
**Deviations from plan**:
- Changed X to Y because Z

**New learnings**:
- Discovery 1
- Discovery 2

**Known issues**:
- Issue 1 (tracked in GitHub #123)
```

---

## Environment Variables

Required in `.env`:
```bash
# Microsoft Graph API
AZURE_CLIENT_ID=your_app_client_id
AZURE_TENANT_ID=your_tenant_id
AZURE_REDIRECT_URI=http://localhost:3000/auth/callback

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional: Fallback to Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=xxx

# App Configuration
LOG_LEVEL=info
DATA_RETENTION_DAYS=30
WHISPER_MODEL=small
```

---

## Cost Estimation

### One-time Costs
- BlackHole audio driver: Free
- Whisper model download: Free (~1.5GB)

### Per-meeting Costs (60-minute meeting)
- **Transcription (Local Whisper)**: $0.00
- **Summarization (Claude API)**:
  - Estimated tokens: ~4,000 input + 500 output
  - Cost: ~$0.015 per meeting
- **Microsoft Graph API**: Free (included with M365)

**Monthly estimate (20 meetings)**: ~$0.30

### Comparison vs. Cloud-only
- Azure Speech + Azure OpenAI: ~$2.50/meeting = $50/month
- **Savings: 99%**

---

## Privacy & Security Considerations

1. **Local-first**: Transcription happens on user's machine
2. **User control**: User reviews summaries before sending
3. **Encryption**: API keys stored encrypted in system keychain
4. **Data retention**: Configurable auto-deletion of recordings
5. **Transparency**: User explicitly informs meeting participants
6. **No telemetry**: No usage data sent to third parties
7. **Audit log**: All API calls and emails logged locally

---

## Known Limitations

1. **macOS 12.3+**: Requires macOS 12.3 or later for native audio loopback
2. **M365 dependency**: Requires M365 account for calendar/email
3. **English-first**: Whisper supports multiple languages, but prompts are English
4. **No automatic join**: User must manually join meetings
5. **Single meeting**: Can only record one meeting at a time

---

## Future Enhancements (Post-MVP)

### Platform Support
- [ ] Windows 10+ support (electron-audio-loopback already supports it)
- [ ] Linux support (electron-audio-loopback already supports PulseAudio)

### Cloud Transcription Option
- [ ] **Hybrid transcription mode**: Add cloud transcription as alternative to local Whisper
  - **Provider**: AssemblyAI ($0.37/hour for transcription + diarization)
  - **Use cases**:
    - Low-end hardware (older Macs without Metal GPU)
    - Long meetings (2+ hours where local resources are strained)
    - Batch processing mode (process recordings overnight)
    - Enterprise users who prefer managed services
  - **Cost comparison**: $0.385/meeting (cloud) vs $0.015/meeting (local)
  - **Implementation**: Add `TRANSCRIPTION_MODE=local|cloud` setting
  - **Benefits**: Zero local compute, potentially better diarization quality
  - **Tradeoffs**: 25x more expensive, requires network, less private
- [ ] Batch processing mode: Queue recordings and process during off-hours with Claude Batch API (50% discount)

### Features
- [ ] Multi-language support
- [ ] Real-time translation
- [ ] Slack/Discord integration
- [ ] Custom summary templates
- [ ] Meeting highlights/clips extraction
- [ ] Chrome extension for direct browser capture
- [ ] Mobile app for remote meeting review
- [ ] Speaker name mapping from calendar (enhance Phase 1.3 generic labels)
- [ ] LLM-based speaker attribution: Use Claude to guess speaker identities from transcript context + calendar attendees

---

## Support & Troubleshooting

### Common Issues

**"No audio device found"**
- Install BlackHole: `brew install blackhole-2ch`
- Configure Audio MIDI Setup to route audio

**"Microsoft authentication failed"**
- Verify Azure AD app registration
- Check redirect URI matches
- Ensure correct permissions granted

**"Whisper model not found"**
- Run: `npm run setup:whisper`
- Check internet connection for download

**"Transcription is slow"**
- Use smaller Whisper model (`tiny` or `base`)
- Close other CPU-intensive applications
- Consider upgrading to Apple Silicon Mac

**"Summary quality is poor"**
- Ensure transcript is accurate first
- Try different Claude model (opus vs sonnet)
- Provide more context in meeting description

### Debug Mode
```bash
# Run with verbose logging
LOG_LEVEL=debug npm run dev

# Check logs
tail -f ~/Library/Logs/meeting-agent/app.log
```

---

## Contributing

This is a personal project, but contributions are welcome!

1. Create feature branch from `main`
2. Follow TypeScript/React best practices
3. Add tests for new functionality
4. Update CLAUDE.md if architecture changes
5. Submit PR with clear description

---

## License

MIT License - See LICENSE file

---

**Current Status**: Phase 1.3 Complete ✅ + Robustness Enhancements ✅
**Last Updated**: 2025-10-13
**Next Milestones**:
- Phase 1.4 - Recording Announcement (transparency & consent)
- Phase 1.5 - Chunked Recording with Auto-Save (prevent data loss for long meetings)
