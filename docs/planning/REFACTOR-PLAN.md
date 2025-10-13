# Refactor Plan

**Created**: 2025-10-13
**Based on**: REFACTOR-CODEX.md (code review findings)
**Target Completion**: Before Phase 2.1 (M365 Authentication)

---

## Overview

This document outlines systematic refactoring work identified during Phase 1.3 completion. The refactors are organized into three sprints, each with specific goals and success criteria. These changes address technical debt, improve maintainability, and prepare the codebase for upcoming features.

**Key Principle**: Fix critical bugs first, then improve architecture, then optimize performance.

---

## Sprint Summary

| Sprint | Focus | Duration | Priority | Before Phase |
|--------|-------|----------|----------|--------------|
| Sprint 1 | Critical Bug Fixes | ~3.5 hrs | ⚠️ Critical | 1.4 |
| Sprint 2 | Architecture Improvements | ~7.5 hrs | 🔥 High | 1.5 |
| Sprint 3 | Performance & Portability | ~16 hrs | 📦 Medium | 2.1+ |

---

## Sprint 1: Critical Bug Fixes ⚠️

**Target**: Complete before Phase 1.4 (Recording Announcement)
**Duration**: ~3.5 hours
**Priority**: Critical - These bugs will worsen with usage

### Why These Matter
- Memory leaks compound over time
- User controls don't work as expected
- Disk space issues on long-term usage
- Permission prompts confuse users

---

### Task 1.1: Fix IPC Listener Leaks

**Issue**: `src/preload/index.ts:18`, `src/renderer/App.tsx:32`

**Problem**:
- `onTranscriptionProgress` and `onDiarizationProgress` only add listeners
- No cleanup mechanism provided
- Hot reloads in dev mode accumulate duplicate listeners
- Production: Multiple progress bars if user navigates away/back

**Solution**:
```typescript
// src/preload/index.ts
const electronAPI = {
  // ... existing methods ...
  onTranscriptionProgress: (callback: ProgressCallback) => {
    const handler = (_event: any, progress: TranscriptionProgress) => callback(progress)
    ipcRenderer.on('transcription-progress', handler)

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('transcription-progress', handler)
    }
  },
  onDiarizationProgress: (callback: ProgressCallback) => {
    const handler = (_event: any, progress: DiarizationProgress) => callback(progress)
    ipcRenderer.on('diarization-progress', handler)

    return () => {
      ipcRenderer.removeListener('diarization-progress', handler)
    }
  }
}

// src/renderer/App.tsx
useEffect(() => {
  const unsubscribeTranscription = window.electronAPI.onTranscriptionProgress((progress) => {
    setTranscriptionProgress(progress)
  })

  const unsubscribeDiarization = window.electronAPI.onDiarizationProgress((progress) => {
    setDiarizationProgress(progress)
  })

  return () => {
    unsubscribeTranscription()
    unsubscribeDiarization()
  }
}, [])
```

**Files to Update**:
- `src/preload/index.ts` (add return statements)
- `src/types/electron.d.ts` (update `ElectronAPI` interface)
- `src/renderer/App.tsx` (call cleanup in `useEffect`)

**Testing**:
- Hot-reload 10 times, verify no duplicate progress bars
- Start transcription, navigate away (close component), verify no memory leak
- Check Chrome DevTools > Memory > Take heap snapshot

**Estimated Time**: 30 minutes

---

### Task 1.2: Ensure Loopback Teardown

**Issue**: `src/services/audioCapture.ts:227`

**Problem**:
- `stopCapture()` stops streams but never calls `disableLoopbackAudio()`
- Core Audio tap remains active
- Lingering permissions prompts on next capture
- macOS shows "App is using microphone" indicator indefinitely

**Solution**:
```typescript
// src/services/audioCapture.ts
async stopCapture(): Promise<void> {
  // ... existing cleanup code ...

  // NEW: Disable loopback audio tap
  if (window.electronAPI && window.electronAPI.disableLoopbackAudio) {
    try {
      await window.electronAPI.disableLoopbackAudio()
      console.log('[AudioCapture] Loopback audio disabled')
    } catch (error) {
      console.error('[AudioCapture] Failed to disable loopback:', error)
    }
  }
}
```

**Files to Update**:
- `src/services/audioCapture.ts:227` (add `disableLoopbackAudio()` call)

**Testing**:
- Start recording, stop recording
- Verify macOS menu bar no longer shows "using microphone" indicator
- Start recording again, verify no duplicate permission prompts

**Estimated Time**: 15 minutes

---

### Task 1.3: Manage Temp File Cleanup

**Issue**: `src/services/transcription.ts:65`

**Problem**:
- `convertToMonoWav()` writes `*_mono.wav` beside source file
- Cleanup is best-effort, fails if exception thrown
- Temp files accumulate in `userData/recordings/`
- Disk space issues on long-term usage

**Solution**:
```typescript
// src/services/transcription.ts
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'

private async convertToMonoWav(inputPath: string): Promise<string> {
  // Create temp file in system temp directory
  const tempId = randomBytes(16).toString('hex')
  const outputPath = join(tmpdir(), `whisper_mono_${tempId}.wav`)

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      '-y',
      outputPath
    ])

    let stderr = ''
    ffmpeg.stderr.on('data', (data) => { stderr += data })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath)
      } else {
        reject(new Error(`ffmpeg failed: ${stderr}`))
      }
    })
  })
}

async transcribe(filePath: string, options: TranscriptionOptions): Promise<TranscriptionResult> {
  let monoFilePath: string | null = null

  try {
    monoFilePath = await this.convertToMonoWav(filePath)
    const result = await this.runWhisper(monoFilePath, options)
    return result
  } finally {
    // Guaranteed cleanup
    if (monoFilePath && existsSync(monoFilePath)) {
      try {
        unlinkSync(monoFilePath)
        console.log('[Transcription] Cleaned up temp file:', monoFilePath)
      } catch (error) {
        console.error('[Transcription] Failed to clean temp file:', error)
      }
    }
  }
}
```

**Files to Update**:
- `src/services/transcription.ts:65` (use `os.tmpdir()`)
- `src/services/transcription.ts:88` (add `finally` block)

**Testing**:
- Transcribe 5 audio files
- Check `os.tmpdir()` for leftover `whisper_mono_*.wav` files
- Force an error during transcription, verify temp file still deleted
- Verify original recordings in `userData/recordings/` are untouched

**Estimated Time**: 30 minutes

---

### Task 1.4: Propagate Transcription Options

**Issue**: `src/services/transcription.ts:24`

**Problem**:
- Constructor accepts `options.model`, `options.threads`, `options.whisperPath`
- All options are **ignored** - service uses hardcoded values
- Documentation promises these features work
- Users cannot select different Whisper models

**Solution**:
```typescript
// src/services/transcription.ts
class TranscriptionService {
  private whisperPath: string
  private modelName: string
  private threadCount: number

  constructor(options: TranscriptionOptions = {}) {
    this.whisperPath = options.whisperPath || 'whisper-cli'
    this.modelName = options.model || 'base'
    this.threadCount = options.threads || Math.max(1, os.cpus().length - 3)
  }

  private async runWhisper(filePath: string, options: TranscriptionOptions): Promise<TranscriptionResult> {
    const modelPath = join(app.getPath('userData'), 'models', `ggml-${this.modelName}.bin`)

    const args = [
      '-m', modelPath,
      '-f', filePath,
      '-t', String(options.threads || this.threadCount),
      '-oj',  // JSON output
      '--print-progress'
    ]

    const process = spawn(this.whisperPath, args)
    // ... rest of implementation
  }
}
```

**Files to Update**:
- `src/services/transcription.ts:24` (use constructor options)
- `src/services/transcription.ts:142` (use `this.threadCount`)
- `src/types/transcription.ts` (ensure interface matches)

**Testing**:
- Set `WHISPER_MODEL=tiny` in `.env`, verify uses `ggml-tiny.bin`
- Set `WHISPER_MODEL=small`, verify uses `ggml-small.bin`
- Override threads in `transcribe()` call, verify uses override
- Check whisper process args: `ps aux | grep whisper-cli`

**Estimated Time**: 1 hour

---

### Task 1.5: Respect Microphone Toggle

**Issue**: `src/renderer/App.tsx:75`

**Problem**:
- Microphone toggle checkbox only affects **initialization**
- Toggling checkbox after initialization does nothing
- User thinks mic is off but it's still recording
- **Privacy risk**: Violates "user controls all data" promise

**Solution**:
```typescript
// src/renderer/App.tsx
const [captureMicrophone, setCaptureMicrophone] = useState(true)
const [isInitialized, setIsInitialized] = useState(false)

const handleMicrophoneToggle = async (enabled: boolean) => {
  setCaptureMicrophone(enabled)

  // If already initialized, re-initialize with new setting
  if (isInitialized) {
    try {
      await audioService.stopCapture()
      await audioService.initialize({ includeMicrophone: enabled })
      setStatus('initialized')
    } catch (error) {
      setError(`Failed to update microphone: ${error.message}`)
      setStatus('idle')
    }
  }
}

return (
  <div>
    <label>
      <input
        type="checkbox"
        checked={captureMicrophone}
        onChange={(e) => handleMicrophoneToggle(e.target.checked)}
        disabled={isRecording}
      />
      Include Microphone
    </label>
    {/* ... rest of UI ... */}
  </div>
)
```

**Files to Update**:
- `src/renderer/App.tsx:75` (add `handleMicrophoneToggle`)
- `src/renderer/App.tsx:155` (disable toggle while recording)

**Testing**:
- Initialize capture with mic ON
- Toggle mic OFF, start recording, verify no mic input
- Stop recording, toggle mic ON, start recording, verify mic input
- Try toggling during recording, verify control is disabled

**Estimated Time**: 1 hour

---

## Sprint 1 Success Criteria

- ✅ Hot-reload 10 times, no duplicate progress bars
- ✅ macOS menu bar shows "using microphone" only while recording
- ✅ No `*_mono.wav` files accumulate in temp directory
- ✅ Changing Whisper model in `.env` takes effect
- ✅ Microphone toggle works before, during, and after initialization
- ✅ All builds pass: `npm run build && npm run type-check`

---

## Sprint 2: Architecture Improvements 🔥

**Target**: Complete during Phase 1.4-1.5
**Duration**: ~7.5 hours
**Priority**: High - Blocks future feature work

### Why These Matter
- 440-line `App.tsx` blocks Phase 1.4 UI work
- O(n²) merge kills performance on long meetings
- Type safety prevents runtime bugs
- Dead code confuses new contributors

---

### Task 2.1: Modularize App.tsx

**Issue**: `src/renderer/App.tsx:7`

**Problem**:
- Single 440-line component handles:
  - Audio capture state
  - Recording controls
  - Transcription workflow
  - Diarization workflow
  - Progress monitoring
  - Error handling
  - File persistence
  - UI rendering
- Difficult to:
  - Add Phase 1.4 announcement UI
  - Add Phase 2 calendar sync
  - Test individual features
  - Reason about state changes

**Solution**:

Extract custom hooks and presentational components.

**New Files**:

```
src/renderer/
├── hooks/
│   ├── useAudioCapture.ts      # Audio capture state & controls
│   ├── useTranscription.ts     # Transcription workflow
│   ├── useDiarization.ts       # Diarization workflow
│   └── useRecordingFiles.ts    # File persistence
└── components/
    ├── RecordingControls.tsx   # Initialize/Start/Stop buttons
    ├── AudioLevelMeter.tsx     # Real-time level visualization
    ├── ProgressDisplay.tsx     # Transcription/diarization progress
    ├── TranscriptView.tsx      # Transcript display with stats
    └── ErrorBanner.tsx         # Error message display
```

**Implementation**:

```typescript
// src/renderer/hooks/useAudioCapture.ts
export function useAudioCapture() {
  const [status, setStatus] = useState<CaptureStatus>('idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const initialize = async (options: AudioOptions) => {
    try {
      await audioService.initialize(options)
      setStatus('initialized')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  const startRecording = async () => {
    try {
      await audioService.startRecording()
      setStatus('recording')
    } catch (err) {
      setError(err.message)
    }
  }

  const stopRecording = async () => {
    try {
      const result = await audioService.stopRecording()
      setStatus('idle')
      return result
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  useEffect(() => {
    audioService.on('audioLevel', setAudioLevel)
    audioService.on('duration', setDuration)
    return () => {
      audioService.off('audioLevel', setAudioLevel)
      audioService.off('duration', setDuration)
    }
  }, [])

  return {
    status,
    audioLevel,
    duration,
    error,
    initialize,
    startRecording,
    stopRecording
  }
}

// src/renderer/App.tsx (refactored)
export function App() {
  const capture = useAudioCapture()
  const transcription = useTranscription()
  const [captureMicrophone, setCaptureMicrophone] = useState(true)

  const handleStartRecording = async () => {
    try {
      await capture.startRecording()
    } catch (error) {
      console.error('Recording failed:', error)
    }
  }

  const handleStopAndTranscribe = async () => {
    try {
      const result = await capture.stopRecording()
      await transcription.transcribe(result.filePath)
    } catch (error) {
      console.error('Transcription failed:', error)
    }
  }

  return (
    <div className="app">
      <ErrorBanner error={capture.error || transcription.error} />

      <RecordingControls
        status={capture.status}
        captureMicrophone={captureMicrophone}
        onToggleMicrophone={setCaptureMicrophone}
        onInitialize={() => capture.initialize({ includeMicrophone: captureMicrophone })}
        onStart={handleStartRecording}
        onStop={handleStopAndTranscribe}
      />

      <AudioLevelMeter level={capture.audioLevel} duration={capture.duration} />

      <ProgressDisplay progress={transcription.progress} />

      <TranscriptView transcript={transcription.result} />
    </div>
  )
}
```

**Files to Create**:
- `src/renderer/hooks/useAudioCapture.ts`
- `src/renderer/hooks/useTranscription.ts`
- `src/renderer/hooks/useDiarization.ts`
- `src/renderer/hooks/useRecordingFiles.ts`
- `src/renderer/components/RecordingControls.tsx`
- `src/renderer/components/AudioLevelMeter.tsx`
- `src/renderer/components/ProgressDisplay.tsx`
- `src/renderer/components/TranscriptView.tsx`
- `src/renderer/components/ErrorBanner.tsx`

**Files to Update**:
- `src/renderer/App.tsx` (reduce from 440 lines to ~100 lines)

**Testing**:
- All existing functionality works identically
- Hot-reload works for individual components
- Error states display correctly
- Progress updates work in real-time

**Estimated Time**: 4 hours

---

### Task 2.2: Optimize Merge Algorithm

**Issue**: `src/utils/mergeDiarization.ts:59`

**Problem**:
- Current: O(n²) nested loop comparing every transcript segment to every speaker segment
- 30s audio: ~100 segments → ~10,000 comparisons (~instant)
- 60-min audio: ~2,000 segments → **4 million comparisons** (~30-60s merge time)
- `findSpeakerAtTime()` utility exists but is unused (dead code)

**Current Implementation**:
```typescript
// O(n²) - BAD
for (const transcriptSegment of transcript) {
  for (const diarizationSegment of diarization) {
    if (overlaps(transcriptSegment, diarizationSegment)) {
      // assign speaker
    }
  }
}
```

**Solution - Binary Search**:
```typescript
// src/utils/mergeDiarization.ts
interface SpeakerSegment {
  speaker: string
  start: number
  end: number
}

function findSpeakerAtTime(segments: SpeakerSegment[], time: number): string | null {
  // Binary search for segment containing time
  let left = 0
  let right = segments.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const segment = segments[mid]

    if (time >= segment.start && time <= segment.end) {
      return segment.speaker
    } else if (time < segment.start) {
      right = mid - 1
    } else {
      left = mid + 1
    }
  }

  return null
}

export function mergeDiarization(
  transcript: TranscriptSegment[],
  diarization: DiarizationSegment[]
): MergedTranscript {
  // Sort diarization segments by start time (if not already sorted)
  const sortedDiarization = [...diarization].sort((a, b) => a.start - b.start)

  const merged: MergedSegment[] = transcript.map((segment) => {
    // Use midpoint of transcript segment for lookup
    const midpoint = (segment.start + segment.end) / 2
    const speaker = findSpeakerAtTime(sortedDiarization, midpoint) || 'UNKNOWN'

    return {
      text: segment.text,
      start: segment.start,
      end: segment.end,
      speaker
    }
  })

  return {
    segments: merged,
    speakers: extractSpeakerStats(sortedDiarization),
    duration: Math.max(...transcript.map(s => s.end))
  }
}
```

**Complexity**:
- Old: O(n × m) where n = transcript segments, m = diarization segments
- New: O(n log m) with binary search
- For 2,000 transcript segments × 500 speaker segments:
  - Old: 1,000,000 comparisons
  - New: 22,000 comparisons (~45x faster)

**Files to Update**:
- `src/utils/mergeDiarization.ts:59` (replace nested loop with binary search)
- Remove unused code (if `findSpeakerAtTime` already exists)

**Testing**:
- Unit tests with known speaker/transcript data
- Test edge cases: no overlap, multiple speakers per segment, gaps in diarization
- Benchmark: 60-min meeting transcript merge should complete in <1 second
- Verify output matches old algorithm (regression test)

**Estimated Time**: 2 hours

---

### Task 2.3: Fix RecordingSession Types

**Issue**: `src/services/audioCapture.ts:182`, `src/types/audio.ts:12`

**Problem**:
- `stopRecording()` returns `RecordingSession & { blob: Blob }` at runtime
- `RecordingSession` interface doesn't include `blob`
- Downstream code needs unsafe type casts
- TypeScript type safety is broken

**Solution**:
```typescript
// src/types/audio.ts
export interface RecordingSession {
  id: string
  timestamp: Date
  duration: number
  filePath?: string  // Populated after save
}

export interface RecordingResult extends RecordingSession {
  blob: Blob        // Audio data
  arrayBuffer: ArrayBuffer  // For IPC transfer
}

// src/services/audioCapture.ts
async stopRecording(): Promise<RecordingResult> {
  // ... existing code ...

  const blob = await this.recorder.stop()
  const arrayBuffer = await blob.arrayBuffer()

  return {
    id: this.currentSession.id,
    timestamp: this.currentSession.timestamp,
    duration: this.currentSession.duration,
    blob,
    arrayBuffer
  }
}

// src/renderer/App.tsx
const handleStopRecording = async () => {
  const result = await audioService.stopRecording()

  // Save to disk
  const filePath = await window.electronAPI.saveAudioFile(
    result.arrayBuffer,
    `recording_${result.id}.wav`
  )

  // Now transcribe
  await transcribe(filePath)
}
```

**Files to Update**:
- `src/types/audio.ts:12` (add `RecordingResult` interface)
- `src/services/audioCapture.ts:182` (return `RecordingResult`)
- `src/renderer/App.tsx` (update usage sites)

**Testing**:
- `npm run type-check` passes with no errors
- No type casts (`as unknown as`) in calling code
- Recording and saving still works identically

**Estimated Time**: 30 minutes

---

### Task 2.4: Retire whisper-node-addon Remnants

**Issue**: `package.json:10`, `scripts/postinstall.sh:3`, `test-worker.js:12`

**Problem**:
- Project abandoned native `@kutalia/whisper-node-addon` in Phase 1.2
- But `postinstall` script still tries to compile/link it
- `test-worker.js` still loads the addon
- Confuses new contributors
- Wastes time during `npm install`

**Solution**:

Remove all references:

```bash
# Delete files
rm -f scripts/postinstall.sh
rm -f test-worker.js

# Update package.json
# Remove "postinstall": "bash scripts/postinstall.sh" from scripts section
```

**Files to Delete**:
- `scripts/postinstall.sh`
- `test-worker.js`

**Files to Update**:
- `package.json` (remove `postinstall` script)
- `package.json` (remove `@kutalia/whisper-node-addon` from dependencies if present)

**Testing**:
- Delete `node_modules/` and `package-lock.json`
- Run `npm install` → should complete without addon compilation
- Run `npm run build` → should succeed
- Verify transcription still works (uses whisper-cpp CLI)

**Estimated Time**: 1 hour

---

## Sprint 2 Success Criteria

- ✅ `App.tsx` reduced to <150 lines (from 440)
- ✅ Custom hooks exist: `useAudioCapture`, `useTranscription`, `useDiarization`
- ✅ 60-min transcript merge completes in <1 second (benchmark)
- ✅ `npm run type-check` passes with no type errors
- ✅ `npm install` completes without compiling native addons
- ✅ All existing functionality works identically

---

## Sprint 3: Performance & Portability 📦

**Target**: Complete during Phase 2+ (After M365 Integration)
**Duration**: ~16 hours
**Priority**: Medium - Expands user base and improves UX

### Why These Matter
- Windows/Linux support expands user base
- Real-time downmix saves 3-5s per recording
- Warm Python worker reduces CPU/memory spikes

---

### Task 3.1: Generalize Python Env Discovery

**Issue**: `src/services/diarization.ts:20`

**Problem**:
- Hardcoded: `venv/bin/python3` (Unix-style path)
- Doesn't work on Windows: `venv\Scripts\python.exe`
- Breaks cross-platform support promise in docs
- `HUGGINGFACE_TOKEN` cached at startup (doesn't refresh)

**Solution**:
```typescript
// src/services/diarization.ts
import { platform } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'

class DiarizationService {
  private pythonPath: string

  constructor() {
    this.pythonPath = this.findPythonExecutable()
  }

  private findPythonExecutable(): string {
    const venvDir = join(process.cwd(), 'venv')

    // Platform-specific paths
    const candidates = platform() === 'win32'
      ? [
          join(venvDir, 'Scripts', 'python.exe'),
          join(venvDir, 'Scripts', 'python3.exe')
        ]
      : [
          join(venvDir, 'bin', 'python3'),
          join(venvDir, 'bin', 'python')
        ]

    // Find first existing executable
    const pythonPath = candidates.find(path => existsSync(path))

    if (!pythonPath) {
      throw new Error(`Python virtual environment not found. Tried: ${candidates.join(', ')}`)
    }

    return pythonPath
  }

  private async runDiarization(audioPath: string): Promise<DiarizationResult> {
    // Read env var at call time (not constructor)
    const token = process.env.HUGGINGFACE_TOKEN

    if (!token) {
      throw new Error('HUGGINGFACE_TOKEN not set in environment')
    }

    const process = spawn(this.pythonPath, [
      'scripts/diarize_audio.py',
      audioPath
    ], {
      env: {
        ...process.env,
        HUGGINGFACE_TOKEN: token
      }
    })

    // ... rest of implementation
  }
}
```

**Files to Update**:
- `src/services/diarization.ts:20` (platform-specific paths)
- `src/services/diarization.ts:45` (read env var at call time)

**Testing**:
- macOS: Verify uses `venv/bin/python3`
- Windows (if available): Verify uses `venv\Scripts\python.exe`
- Delete venv, verify friendly error message
- Change `HUGGINGFACE_TOKEN` in `.env`, restart app, verify new token used

**Estimated Time**: 2 hours

---

### Task 3.2: Real-Time Mono Downmix

**Issue**: `src/services/audioCapture.ts:111`

**Problem**:
- Web Audio API `ChannelMerger` doesn't reliably produce mono output
- Forces expensive ffmpeg post-processing pass (~3-5s per file)
- Adds latency before transcription can start
- ffmpeg reads entire file, decodes, re-encodes, writes

**Solution**:

Implement custom AudioWorklet processor for true mono mixing.

```typescript
// src/renderer/audioWorklets/monoMixer.worklet.ts
class MonoMixerProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0]
    const output = outputs[0]

    if (!input || input.length === 0) return true

    const numChannels = input.length
    const frameCount = input[0].length

    // Mix all input channels to mono
    for (let frame = 0; frame < frameCount; frame++) {
      let sum = 0
      for (let channel = 0; channel < numChannels; channel++) {
        sum += input[channel][frame]
      }
      // Average and write to output
      output[0][frame] = sum / numChannels
    }

    return true
  }
}

registerProcessor('mono-mixer', MonoMixerProcessor)

// src/services/audioCapture.ts
async setupAudioGraph() {
  // Load custom worklet
  await this.audioContext.audioWorklet.addModule('/audioWorklets/monoMixer.worklet.js')

  // Create mono mixer node
  const monoMixer = new AudioWorkletNode(this.audioContext, 'mono-mixer', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1]  // Force mono output
  })

  // Connect: sources → monoMixer → destination
  systemSource.connect(monoMixer)
  if (micSource) {
    micSource.connect(monoMixer)
  }
  monoMixer.connect(this.audioContext.destination)

  // Record from monoMixer output
  const stream = monoMixer.connect(mediaStreamDestination)
  this.recorder = new MediaRecorder(stream, { mimeType: 'audio/wav' })
}
```

**Benefits**:
- Eliminates ffmpeg preprocessing (~3-5s savings)
- True mono output guaranteed
- Transcription can start immediately after recording
- Lower memory usage (no temp file)

**Files to Create**:
- `src/renderer/audioWorklets/monoMixer.worklet.ts`

**Files to Update**:
- `src/services/audioCapture.ts:111` (use AudioWorklet)
- `src/services/transcription.ts:65` (remove `convertToMonoWav()` call)
- `electron.vite.config.ts` (bundle worklet file)

**Testing**:
- Record 30s of audio, verify output is mono (1 channel)
- Verify ffmpeg is no longer called before transcription
- Compare audio quality before/after (should be identical)
- Benchmark: Transcription should start 3-5s faster

**Estimated Time**: 6 hours

---

### Task 3.3: Warm Python Worker for Diarization

**Issue**: `scripts/diarize_audio.py`

**Problem**:
- Python script reloads pyannote pipeline on **every** invocation
- Pipeline loading: ~10-15s (downloads models, initializes PyTorch)
- Creates CPU/memory spikes for each diarization request
- Sequential recordings cause repeated loading

**Solution**:

Create persistent Python worker process with IPC protocol.

```python
# scripts/diarization_worker.py
import sys
import json
from pyannote.audio import Pipeline

# Load pipeline once at startup
print("Loading diarization pipeline...", file=sys.stderr)
pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=os.environ["HUGGINGFACE_TOKEN"]
)
print("Pipeline ready", file=sys.stderr)

# Listen for requests on stdin
for line in sys.stdin:
    try:
        request = json.loads(line)
        audio_path = request["audio_path"]

        # Run diarization
        diarization = pipeline(audio_path)

        # Send response on stdout
        response = {
            "status": "success",
            "segments": [
                {"start": turn.start, "end": turn.end, "speaker": speaker}
                for turn, _, speaker in diarization.itertracks(yield_label=True)
            ]
        }
        print(json.dumps(response), flush=True)

    except Exception as e:
        error_response = {"status": "error", "message": str(e)}
        print(json.dumps(error_response), flush=True)
```

```typescript
// src/services/diarization.ts
class DiarizationService {
  private worker: ChildProcess | null = null

  async initialize() {
    if (this.worker) return  // Already initialized

    this.worker = spawn(this.pythonPath, ['scripts/diarization_worker.py'], {
      env: { ...process.env, HUGGINGFACE_TOKEN: process.env.HUGGINGFACE_TOKEN },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Wait for "Pipeline ready" message
    await new Promise((resolve) => {
      this.worker.stderr.on('data', (data) => {
        if (data.toString().includes('Pipeline ready')) {
          resolve(true)
        }
      })
    })
  }

  async diarize(audioPath: string): Promise<DiarizationResult> {
    await this.initialize()

    // Send request
    const request = { audio_path: audioPath }
    this.worker.stdin.write(JSON.stringify(request) + '\n')

    // Read response
    return new Promise((resolve, reject) => {
      this.worker.stdout.once('data', (data) => {
        const response = JSON.parse(data.toString())
        if (response.status === 'success') {
          resolve(response.segments)
        } else {
          reject(new Error(response.message))
        }
      })
    })
  }

  async shutdown() {
    if (this.worker) {
      this.worker.kill()
      this.worker = null
    }
  }
}
```

**Benefits**:
- Pipeline loaded **once** at app startup (~10-15s)
- Subsequent diarizations: instant start (no loading overhead)
- Lower CPU/memory spikes
- Better UX for multiple recordings in same session

**Tradeoffs**:
- Higher memory baseline (~500MB while worker idle)
- Worker must be restarted if crashes

**Files to Create**:
- `scripts/diarization_worker.py`

**Files to Update**:
- `src/services/diarization.ts` (persistent worker pattern)
- `src/main/index.ts` (call `diarizationService.shutdown()` on app quit)

**Testing**:
- Start app, wait for "Pipeline ready" message
- Diarize 5 audio files in sequence
- First: includes loading time (~10-15s)
- Subsequent: starts immediately (~0s loading)
- Kill worker mid-request, verify graceful error handling
- Verify memory usage stays stable after multiple requests

**Estimated Time**: 8 hours

---

## Sprint 3 Success Criteria

- ✅ App runs on Windows and Linux (test via VM or CI)
- ✅ Python venv detected automatically on all platforms
- ✅ Transcription starts 3-5s faster (no ffmpeg preprocessing)
- ✅ Mono audio output verified via `ffprobe -i recording.wav`
- ✅ Second diarization request starts instantly (no pipeline reload)
- ✅ Memory usage stable across 10 sequential recordings

---

## Documentation Update Protocol

Following CLAUDE.md guidelines, update documentation immediately after completing each sprint:

### After Sprint 1 (Critical Fixes)
- Update `docs/technical/audio-capture.md` (loopback teardown)
- Update `docs/technical/transcription.md` (temp file cleanup, options)
- Update `CHANGELOG.md` (bug fix section)

### After Sprint 2 (Architecture)
- Update `docs/developer/architecture.md` (new hooks, component structure)
- Update `docs/technical/diarization.md` (merge algorithm)
- Update `CHANGELOG.md` (refactor section)

### After Sprint 3 (Performance)
- Update `docs/technical/audio-capture.md` (AudioWorklet pattern)
- Update `docs/technical/diarization.md` (worker pattern)
- Update `README.md` (cross-platform support)
- Update `CHANGELOG.md` (performance improvements)

---

## Verification Checklist

Before marking a sprint complete:

- [ ] All tasks completed and tested
- [ ] `npm run build` succeeds
- [ ] `npm run type-check` passes
- [ ] Documentation updated per protocol
- [ ] Manual testing of affected features
- [ ] No regressions in existing functionality

---

## Notes

1. **Sprint 1 is mandatory** before Phase 1.4 - these are critical bugs
2. **Task 2.1 (Modularize App.tsx)** should be done **first** in Sprint 2, as it blocks Phase 1.4 UI work
3. **Sprint 3 can be deferred** until after Phase 2 if time is limited
4. Each sprint can be broken into multiple pull requests for easier review

---

**Maintained by**: Claude Code (Sonnet 4.5)
**Last Updated**: 2025-10-13
