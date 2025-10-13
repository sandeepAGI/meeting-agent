# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Meeting Agent** is a macOS desktop application that captures, transcribes, and summarizes online meetings across any platform (Teams, Zoom, Google Meet, etc.). It runs **100% locally** for transcription and speaker identification, with optional cloud services for summarization and M365 integration.

### Current Status

**Version**: 0.1.6 (Phase 1.4 Complete ✅)
**Last Updated**: 2025-10-13

**What Works Now**:
- ✅ Native system audio + microphone capture (no virtual drivers)
- ✅ Local transcription using whisper.cpp (Metal GPU acceleration)
- ✅ Speaker diarization using pyannote.audio (identifies "who spoke when")
- ✅ Speaker-labeled transcripts: `[SPEAKER_00]: text`
- ✅ Recording announcement for transparency and consent

**Next Phase**: Phase 1.5 - Chunked Recording (auto-save every 5 min)

### Recent Updates
**Sprint 2 (Refactoring)**:
- ✅ App.tsx modularization: 500 lines → 93 lines (6 components + 2 hooks)
- ✅ Merge algorithm optimization: O(n²) → O(n log m) using binary search
- ✅ Type safety: Fixed RecordingSession types with proper interfaces
- ✅ Cleanup: Removed whisper-node-addon remnants

**Phase 1.4 (Recording Announcement)**:
- ✅ Announcement plays automatically when recording starts
- ✅ Uses macOS `say` command for text-to-speech
- ✅ 2-second delay ensures announcement completes
- ✅ UI shows "📢 Playing announcement..." status

### Key Features
- **Local-first**: All transcription and diarization happen on-device ($0.00/meeting)
- **Privacy-focused**: User controls all data, no cloud dependencies for core features
- **Cross-platform ready**: macOS 12.3+ (Windows/Linux support via electron-audio-loopback)
- **Metal GPU acceleration**: Fast transcription on Apple Silicon
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

Update documentation **immediately after**:

1. **Phase completion** → Update roadmap.md, CHANGELOG.md, README.md (status), CLAUDE.md (status)
2. **Bug fixes** → Update technical docs with root cause and fix
3. **Architecture changes** → Update architecture.md
4. **New dependencies** → Update technical docs and README.md (setup section)
5. **Performance improvements** → Update technical docs with benchmarks
6. **API changes** → Update architecture.md (IPC patterns)
7. **Configuration changes** → Update README.md (environment variables)

### What to Update

| Change Type | Files to Update |
|-------------|-----------------|
| Phase complete | `docs/planning/roadmap.md`, `CHANGELOG.md`, `README.md` (status), `CLAUDE.md` (status) |
| Critical bug fix | `docs/technical/{phase}.md` (Known Issues section), `CHANGELOG.md` |
| New service/feature | `docs/developer/architecture.md`, `docs/technical/{phase}.md` |
| Dependency added | `docs/technical/{phase}.md` (Dependencies section), `README.md` (Installation) |
| Performance change | `docs/technical/{phase}.md` (Performance section), `README.md` (Performance) |
| New IPC handler | `docs/developer/architecture.md` (IPC Handler Pattern) |

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

### Future Services
- **Microsoft Graph API** (M365 calendar/email, Phase 2)
- **Anthropic Claude API** (summarization, Phase 3)

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

# Future Phases
AZURE_CLIENT_ID=your_app_client_id
AZURE_TENANT_ID=your_tenant_id
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## Known Limitations

1. **macOS 12.3+ only** (for now) - Windows/Linux support available via electron-audio-loopback but not tested
2. **Generic speaker labels** - "SPEAKER_00", "SPEAKER_01" (Phase 2 will map to actual names from calendar)
3. **CPU-only diarization** - ~1:1 processing time (GPU acceleration deferred to Phase 2+)
4. **No M365 integration yet** - Calendar and email features coming in Phase 2
5. **No summarization yet** - AI summaries coming in Phase 3

---

## Cost Analysis

### Current (Phases 0-1.3)
- **Transcription**: $0.00 (local whisper.cpp)
- **Diarization**: $0.00 (local pyannote.audio)
- **Total**: **$0.00 per meeting** 🎉

### Future (Phase 3+)
- **Summarization**: ~$0.015 per 60-min meeting (Claude API)
- **Microsoft Graph API**: $0.00 (included with M365 subscription)
- **Estimated Monthly** (20 meetings): ~$0.30

### Comparison
- **Cloud-only alternative**: Azure Speech + Azure OpenAI = ~$2.50/meeting = $50/month
- **Meeting Agent**: ~$0.015/meeting = $0.30/month
- **Savings**: 99% 💰

---

## Performance Benchmarks (M3 Pro, 11 cores, 18GB RAM)

| Operation | Time | Ratio | Memory |
|-----------|------|-------|--------|
| Audio Capture | Real-time | 1:1 | ~100MB |
| Transcription (base model) | 20-30s for 17.9s | 1.1-1.7x | ~200MB |
| Diarization (CPU-only) | 30s for 30s | 1:1 | ~500MB |
| **Total (Transcribe + Diarize)** | **~90s for 30s** | **3:1** | **~700MB peak** |

**Note**: Transcription uses Metal GPU (automatic). Diarization uses CPU (GPU acceleration deferred to Phase 2+).

---

## Contributing

When contributing:

1. **Follow the subprocess pattern** for external tools (avoid native Node.js modules)
2. **Update documentation immediately** after code changes (see protocol above)
3. **Add tests** for new functionality
4. **Reference roadmap.md** for planned features (don't duplicate here)
5. **Update CHANGELOG.md** when completing features or fixing bugs

---

## License

MIT License - See LICENSE file

---

**Current Status**: Phase 1.4 Complete ✅ (Audio + Transcription + Diarization + Announcement)
**Next Milestone**: Phase 1.5 - Chunked Recording (auto-save every 5 min)
**Last Updated**: 2025-10-13
**Built with**: Claude Code (Sonnet 4.5) 🤖

---

## Quick Links

- **Full Roadmap**: `docs/planning/roadmap.md`
- **Architecture Details**: `docs/developer/architecture.md`
- **Version History**: `CHANGELOG.md`
- **User Guide**: `README.md`
