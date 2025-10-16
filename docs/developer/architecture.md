# Architecture Overview

**Last Updated**: 2025-10-13
**Current Version**: 0.1.3 (Phase 1.3 Complete)

## System Architecture

Meeting Agent is a macOS desktop application built with Electron that captures, transcribes, and diarizes meeting audio entirely locally. The system follows a **local-first, privacy-focused** architecture with subprocess isolation for ML models.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron App                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Renderer  │◄───┤   Preload   │◄───┤    Main     │     │
│  │  (React UI) │    │ (IPC Bridge)│    │  (Node.js)  │     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘     │
│                                                 │            │
└─────────────────────────────────────────────────┼────────────┘
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          │                       │                       │
                          ▼                       ▼                       ▼
                  ┌───────────────┐     ┌────────────────┐    ┌──────────────────┐
                  │ whisper-cli   │     │ Python Process │    │ System Audio API │
                  │ (subprocess)  │     │ (diarization)  │    │ (loopback)       │
                  └───────────────┘     └────────────────┘    └──────────────────┘
                          │                       │
                          │                       │
                          ▼                       ▼
                  ┌───────────────┐     ┌────────────────┐
                  │  Whisper      │     │ pyannote.audio │
                  │  Base Model   │     │  Models        │
                  │  (ggml-base)  │     │  (via HF)      │
                  └───────────────┘     └────────────────┘
```

---

## Core Components

### 1. Renderer Process (React UI)

**Location**: `src/renderer/`

**Responsibilities**:
- User interface rendering
- User input handling
- Display audio levels, transcripts, speaker labels
- Communicate with main process via IPC

**Key Files**:
- `App.tsx` - Main React component
- `index.tsx` - React entry point
- `styles/index.css` - UI styling

**State Management**: React hooks (useState, useEffect, useRef)

**IPC Communication**: Via `window.electronAPI` (exposed by preload)

---

### 2. Preload Script (IPC Bridge)

**Location**: `src/preload/index.ts`

**Responsibilities**:
- Expose safe IPC APIs to renderer
- Type-safe context bridge
- Security boundary between renderer and main

**Exposed APIs**:
```typescript
window.electronAPI = {
  // Audio
  enableLoopbackAudio(windowId: number): Promise<void>
  disableLoopbackAudio(): Promise<void>
  saveAudioFile(arrayBuffer: ArrayBuffer, filename: string): Promise<SaveResult>

  // Transcription
  transcribeAudio(audioPath: string, options: TranscriptionOptions): Promise<Result>
  transcribeAndDiarize(audioPath: string, options: TranscriptionOptions): Promise<Result>
  onTranscriptionProgress(callback: (progress: TranscriptionProgress) => void): void
}
```

**Security**: Uses `contextBridge.exposeInMainWorld` for sandboxing

---

### 3. Main Process (Node.js)

**Location**: `src/main/index.ts`

**Responsibilities**:
- Application lifecycle management
- Window creation and management
- IPC handler registration
- Service orchestration

**Key Handlers**:
- `save-audio-file` - Saves recorded audio to disk
- `transcribe-audio` - Transcription only (fast)
- `transcribe-and-diarize` - Combined workflow
- `enable-audio-loopback` / `disable-audio-loopback` - Audio capture

**Service Integration**:
```typescript
// Singleton instances
const transcriptionService = new TranscriptionService()
const diarizationService = new DiarizationService()
```

---

### 4. Audio Capture Service

**Location**: `src/services/audioCapture.ts`

**Technology**:
- electron-audio-loopback (system audio)
- getUserMedia API (microphone)
- Web Audio API (mixing, resampling)
- MediaRecorder + WAV encoder (recording)

**Architecture Pattern**: Service class with event callbacks

**Data Flow**:
```
System Audio ──┐
               ├──> AudioContext ──> Merge ──> Resample (16kHz) ──> MediaRecorder ──> WAV Blob
Microphone ────┘                                                                            │
                                                                                            ▼
                                                                                      File System
```

**Audio Format**: 16kHz mono WAV (Whisper-compatible)

**See**: `docs/technical/audio-capture.md` for implementation details

---

### 5. Transcription Service

**Location**: `src/services/transcription.ts`

**Technology**:
- whisper-cpp CLI (subprocess)
- ffmpeg (audio preprocessing)
- Metal GPU (automatic acceleration)

**Architecture Pattern**: Subprocess wrapper with stream parsing

**Data Flow**:
```
WAV File ──> ffmpeg (fix header) ──> whisper-cli (subprocess) ──> JSON Output ──> Parse ──> TranscriptionResult
                                            │
                                            ▼ (stderr)
                                      Progress Events
```

**Performance**: ~1-2x realtime, <200MB memory

**See**: `docs/technical/transcription.md` for implementation details

---

### 6. Diarization Service

**Location**: `src/services/diarization.ts`

**Technology**:
- pyannote.audio (Python package)
- Python 3.13 (virtual environment)
- PyTorch (neural network backend)

**Architecture Pattern**: Python subprocess wrapper with JSON I/O

**Data Flow**:
```
WAV File ──> Python Script ──> pyannote.audio Pipeline ──> JSON Output ──> Parse ──> DiarizationResult
                                        │
                                        ▼ (stderr)
                                  Progress Events
```

**Performance**: ~1:1 ratio (CPU-only), <500MB memory

**See**: `docs/technical/diarization.md` for implementation details

---

### 7. Merge Algorithm

**Location**: `src/utils/mergeDiarization.ts`

**Purpose**: Align speaker segments with transcript words

**Algorithm**: Temporal Intersection Matching

**Input**:
- Transcript segments (words with timestamps in milliseconds)
- Speaker segments (time ranges with speaker labels in seconds)

**Output**:
- Speaker-labeled utterances
- Full formatted transcript: `[SPEAKER_00]: text`

**Key Challenge**: Timestamp format conversion (ms → seconds)

**See**: `docs/technical/diarization.md#merge-algorithm` for details

---

## Design Patterns

### 1. Subprocess Pattern (Preferred for ML Models)

**Rationale**: Native Node.js modules cause compatibility issues with Electron

**Pattern**:
```typescript
class MLService {
  private executablePath: string
  private modelPath: string

  async process(input: string): Promise<Result> {
    const process = spawn(this.executablePath, [args...])

    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (data) => { stdout += data })
    process.stderr.on('data', (data) => {
      stderr += data
      this.parseProgress(data)  // Extract progress
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
- TranscriptionService → whisper-cli
- DiarizationService → Python script

**Benefits**:
- No native module compilation
- Clean process isolation
- Easy to debug
- Crashes don't affect Electron

---

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
if (result.success) {
  // Handle success
} else {
  // Handle error
}
```

**Benefits**:
- Type-safe error handling
- Consistent error format
- Easy to add progress callbacks

---

### 3. Progress Callback Pattern

**Pattern**:
```typescript
// Main Process
ipcMain.handle('long-operation', async (_event, input) => {
  const result = await service.processWithProgress(
    input,
    (progress) => {
      // Send progress to renderer
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

const handleSubmit = async () => {
  const result = await window.electronAPI.longOperation(input)
}
```

**Examples**:
- Transcription progress (stage, percentage, message)
- Diarization progress (status updates)

---

## Data Flow

### Recording to Transcript Flow

```
1. User clicks "Initialize"
   ↓
2. Renderer calls enableLoopbackAudio()
   ↓
3. AudioCaptureService starts system audio + mic capture
   ↓
4. Audio levels displayed in UI (real-time)
   ↓
5. User clicks "Start Recording"
   ↓
6. MediaRecorder starts collecting audio chunks
   ↓
7. User clicks "Stop Recording"
   ↓
8. Blob created from chunks, saved to disk via IPC
   ↓
9. User clicks "Transcribe + Diarize"
   ↓
10. Main process spawns whisper-cli subprocess
    ↓
11. ffmpeg preprocesses audio (fix WAV header)
    ↓
12. whisper-cli transcribes (progress sent to UI)
    ↓
13. Main process spawns Python diarization script
    ↓
14. pyannote.audio identifies speakers (progress sent to UI)
    ↓
15. mergeDiarizationWithTranscript() aligns results
    ↓
16. Speaker-labeled transcript displayed in UI
```

---

## File Structure

```
meeting-agent/
├── src/
│   ├── main/
│   │   ├── index.ts                # Electron main process entry
│   │   └── audioSetup.ts           # electron-audio-loopback init
│   ├── preload/
│   │   └── index.ts                # IPC bridge (context bridge)
│   ├── renderer/
│   │   ├── App.tsx                 # Main React component
│   │   ├── index.tsx               # React entry point
│   │   ├── index.html              # HTML template
│   │   └── styles/index.css        # UI styling
│   ├── services/
│   │   ├── audioCapture.ts         # Audio recording service
│   │   ├── transcription.ts        # Whisper integration
│   │   └── diarization.ts          # pyannote.audio integration
│   ├── utils/
│   │   └── mergeDiarization.ts     # Speaker-transcript merge
│   └── types/
│       ├── audio.ts                # Audio types
│       ├── transcription.ts        # Transcription types
│       ├── diarization.ts          # Diarization types
│       └── electron.d.ts           # ElectronAPI interface
├── scripts/
│   └── diarize_audio.py            # Python diarization script
├── models/
│   └── ggml-base.bin               # Whisper model (150MB)
├── venv/                           # Python virtual environment
├── docs/                           # Documentation
├── electron.vite.config.ts         # Build configuration
├── package.json                    # Node dependencies
└── .env                            # Environment variables
```

---

## Technology Stack

### Core Framework
- **Electron** 38.2.1 - Desktop app framework
- **React** 19.0.0 - UI framework
- **TypeScript** 5.x - Type safety
- **Node.js** 20+ - Runtime environment

### Build Tools
- **electron-vite** - Build system with hot-reload
- **Vite** - Fast bundler
- **electron-builder** - macOS app packaging

### Audio Stack
- **electron-audio-loopback** 1.0.6 - System audio capture
- **getUserMedia API** - Microphone capture
- **Web Audio API** - Audio processing, mixing, resampling
- **extendable-media-recorder** - Custom codec support
- **extendable-media-recorder-wav-encoder** - WAV encoding

### ML Stack
- **whisper-cpp** (Homebrew) - Local speech-to-text
- **ffmpeg** (Homebrew) - Audio preprocessing
- **pyannote.audio** 3.1/4.x (pip) - Speaker diarization
- **PyTorch** - Neural network backend
- **Metal** - GPU acceleration (automatic on macOS)

### External Services
- **Microsoft Graph API** - M365 calendar (Phase 2, complete)
- **Anthropic Claude API** - Meeting summarization (Phase 2.3-3, complete)

---

## Security Architecture

### Electron Security

**Content Security Policy** (`src/renderer/index.html:8`):
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
```

**Context Isolation**: Enabled by default in Electron 38
- Renderer cannot access Node.js APIs directly
- All IPC must go through preload bridge

**Node Integration**: Disabled in renderer
- Prevents XSS attacks from accessing Node.js

### Data Privacy

**Local-First Architecture**:
- All transcription happens on-device
- No audio sent to cloud (except optional Phase 3 summaries)
- User controls all data retention

**Storage**:
- Audio files: `~/Library/Application Support/meeting-agent/recordings/`
- Models: `./models/` (local directory)
- No telemetry or usage tracking

---

## Performance Characteristics

### Phase 1.1: Audio Capture
- **Latency**: <100ms (real-time)
- **Memory**: ~50-100MB during capture
- **CPU**: ~5-10% (audio processing)
- **Disk**: ~1MB/min (16kHz mono WAV)

### Phase 1.2: Transcription
- **Latency**: ~1-2x realtime (17.9s audio in 20-30s)
- **Memory**: ~200MB during processing
- **CPU**: ~70-80% (8 threads on M3 Pro)
- **GPU**: Metal acceleration automatic
- **Model**: base (150MB on disk)

### Phase 1.3: Diarization
- **Latency**: ~1:1 ratio (30s audio in 30s, CPU-only)
- **Memory**: ~500MB during processing
- **CPU**: ~80-90% (single-threaded)
- **GPU**: Not used (deferred to Phase 2+)
- **Models**: ~300MB (downloaded on first run)

### Combined Workflow (Transcribe + Diarize)
- **Total Time**: ~90s for 30s audio (3:1 ratio)
- **Peak Memory**: ~700MB
- **Can be parallelized**: Yes (future optimization)

---

## Error Handling Strategy

### Service-Level Errors

**Pattern**:
```typescript
async operation(): Promise<Result> {
  try {
    // Validate inputs
    if (!this.isAvailable()) {
      throw new Error('Service not available')
    }

    // Perform operation
    const result = await this.process()

    return result
  } catch (error) {
    // Log error
    console.error('Operation failed:', error)

    // Rethrow with context
    throw new Error(`Failed to process: ${error.message}`)
  }
}
```

### IPC Error Handling

**Pattern**:
```typescript
ipcMain.handle('operation', async (_event, input) => {
  try {
    const result = await service.operation(input)
    return { success: true, result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

### UI Error Display

**Pattern**:
```typescript
const [error, setError] = useState<string | null>(null)

const handleOperation = async () => {
  setError(null)
  try {
    const result = await window.electronAPI.operation()
    if (!result.success) {
      setError(result.error)
    }
  } catch (err) {
    setError(err.message)
  }
}
```

---

## Future Architecture Plans

### Phase 2: M365 Integration (Complete)
- ✅ `src/services/auth.ts` - MSAL authentication (integrated into GraphApiService)
- ✅ `src/services/graphApi.ts` - Microsoft Graph API client
- ✅ Calendar integration for meeting context
- ⚠️ **Email context removed** - Testing showed no value (see `docs/archive/email-context-deprecation.md`)

### Phase 3: AI Summarization
- Add `src/services/summarize.ts` (Claude API integration)
- Add `src/prompts/summary.ts` (prompt templates)

### Phase 6: Data Management
- Add `src/services/database.ts` (SQLite with better-sqlite3)
- Add `src/models/` (database schema and migrations)
- Add `src/services/storage.ts` (audio file lifecycle)

### Phase 7: Settings
- Add `src/services/config.ts` (settings persistence)
- Add settings UI panel

### Phase 9: Performance Optimization
- Parallel transcription + diarization
- Streaming transcription (process while recording)
- GPU acceleration for diarization (PyTorch Metal)

---

## References

- [Electron Architecture](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [React Documentation](https://react.dev/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**Maintained by**: Claude Code (Sonnet 4.5)
**Last Updated**: 2025-10-13
