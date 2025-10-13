# Phase 1.3: Speaker Diarization

**Status**: ✅ Complete (2025-10-13)
**Implementation**: `src/services/diarization.ts`, `src/utils/mergeDiarization.ts`, `scripts/diarize_audio.py`

## Overview

Phase 1.3 implements speaker diarization using pyannote.audio to identify "who spoke when" in meeting recordings. The system runs entirely locally via Python subprocess, matching speaker segments with transcription text to produce speaker-labeled transcripts.

## What is Speaker Diarization?

**Diarization**: Process of partitioning audio into segments by speaker identity

**Input**: Audio file (WAV, 16kHz mono)
**Output**: Timeline of speaker segments with labels

```
[0.0s - 3.5s]: SPEAKER_00
[3.5s - 7.2s]: SPEAKER_01
[7.2s - 12.8s]: SPEAKER_00
...
```

**NOT Name Recognition**: Speakers labeled generically ("SPEAKER_00", "SPEAKER_01")
**Phase 2 Enhancement**: Match labels with calendar attendee names using LLM

---

## Technology Stack

- **pyannote.audio** 3.1/4.x: State-of-the-art speaker diarization
- **Python 3.13**: Runtime environment (virtual environment)
- **torch**: PyTorch for neural network models
- **Hugging Face**: Model hosting and authentication
- **child_process**: Node.js subprocess for Python execution

### Why pyannote.audio?

**Alternatives Evaluated**:
1. **tinydiarize** (whisper.cpp extension)
   - ❌ Proof-of-concept, not production-ready
   - ❌ English-only
   - ❌ Requires special `small.en-tdrz` model

2. **sherpa-onnx** (k2-fsa)
   - ❌ Native Node.js module (avoid after Phase 1.2 lessons)
   - ❌ Less mature than pyannote.audio

3. **pyannote.audio** ✅ CHOSEN
   - ✅ State-of-the-art accuracy (7-12% DER)
   - ✅ Production-ready, actively maintained
   - ✅ Language-independent
   - ✅ Python subprocess (proven reliable in Phase 1.2)

**Source**: `CLAUDE.md` Phase 1.3 Research

---

## Installation

### Create Python Virtual Environment

```bash
# Create venv
python3 -m venv venv

# Activate venv
source venv/bin/activate

# Install dependencies
pip install pyannote.audio torch torchaudio dotenv
```

### Get Hugging Face Token

1. Create free account: https://huggingface.co/join
2. Generate access token: https://huggingface.co/settings/tokens
3. Accept model license: https://huggingface.co/pyannote/speaker-diarization-3.1

### Configure Environment

```bash
# Add to .env
HUGGINGFACE_TOKEN=hf_xxx
```

### Verify Installation

```bash
source venv/bin/activate
python3 -c "from pyannote.audio import Pipeline; print('OK')"
# Output: OK
```

---

## Implementation

### DiarizationService Class

**Location**: `src/services/diarization.ts:13`

```typescript
export class DiarizationService {
  private pythonPath: string = 'venv/bin/python3'
  private scriptPath: string = 'scripts/diarize_audio.py'
  private hfToken: string | undefined = process.env.HUGGINGFACE_TOKEN

  // Public API
  async diarize(audioPath: string, onProgress?: (progress: DiarizationProgress) => void): Promise<DiarizationResult>
  async isAvailable(): Promise<boolean>
  getSpeakerCount(result: DiarizationResult): number
  getSpeakerDuration(result: DiarizationResult, speaker: string): number
  getStatistics(result: DiarizationResult): SpeakerStats
}
```

### Key Methods

#### diarize()

**Purpose**: Run speaker diarization on audio file

**Implementation**:
```typescript
async diarize(
  audioPath: string,
  onProgress?: (progress: DiarizationProgress) => void
): Promise<DiarizationResult> {
  // Step 1: Check availability
  if (!(await this.isAvailable())) {
    throw new Error('Diarization not available')
  }

  // Step 2: Spawn Python subprocess
  const args = [this.scriptPath, audioPath, '--token', this.hfToken!]
  const process = spawn(this.pythonPath, args)

  let stdoutData = ''  // JSON result
  let stderrData = ''  // Progress messages

  // Step 3: Capture stdout (JSON)
  process.stdout.on('data', (data) => {
    stdoutData += data.toString()
  })

  // Step 4: Capture stderr (progress)
  process.stderr.on('data', (data) => {
    const message = data.toString().trim()
    stderrData += message + '\n'

    // Parse [PROGRESS] messages
    if (message.includes('[PROGRESS]')) {
      const progressMessage = message.replace(/\[PROGRESS\]\s*/g, '').trim()
      onProgress?.({ message: progressMessage })
    }
  })

  // Step 5: Wait for completion
  return new Promise((resolve, reject) => {
    process.on('close', (code) => {
      if (code === 0) {
        const result: DiarizationResult = JSON.parse(stdoutData)
        onProgress?.({ message: 'Diarization complete', progress: 100 })
        resolve(result)
      } else {
        reject(new Error(`Diarization failed: ${stderrData}`))
      }
    })
  })
}
```

**Source**: `src/services/diarization.ts:59`

**Performance**: ~30 seconds for 30-second audio (1:1 ratio on CPU)

---

### Python Diarization Script

**Location**: `scripts/diarize_audio.py`

```python
#!/usr/bin/env python3
import sys
import json
from pyannote.audio import Pipeline

def diarize_audio(audio_path: str, hf_token: str):
    # Load pipeline
    print("[PROGRESS] Loading pyannote.audio models...", file=sys.stderr, flush=True)
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        token=hf_token
    )

    # Run diarization
    print("[PROGRESS] Analyzing audio for speaker changes...", file=sys.stderr, flush=True)
    output = pipeline(audio_path)

    # Extract speaker segments
    print("[PROGRESS] Generating speaker segments...", file=sys.stderr, flush=True)
    diarization = output.speaker_diarization

    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append({
            "start": float(turn.start),  # Seconds
            "end": float(turn.end),      # Seconds
            "speaker": speaker           # "SPEAKER_00", "SPEAKER_01", etc.
        })

    return {"segments": segments}

if __name__ == "__main__":
    audio_path = sys.argv[1]
    hf_token = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("HUGGINGFACE_TOKEN")

    result = diarize_audio(audio_path, hf_token)
    print(json.dumps(result, indent=2))  # JSON to stdout
```

**Source**: `scripts/diarize_audio.py:28`

**Output Format**:
```json
{
  "segments": [
    {"start": 0.5, "end": 3.2, "speaker": "SPEAKER_00"},
    {"start": 3.5, "end": 7.1, "speaker": "SPEAKER_01"},
    {"start": 7.3, "end": 12.8, "speaker": "SPEAKER_00"}
  ]
}
```

---

### Merge Algorithm

**Purpose**: Align speaker segments with transcript words

**Location**: `src/utils/mergeDiarization.ts`

#### Key Functions

**normalizeWhisperSegment()**

```typescript
function normalizeWhisperSegment(segment: WhisperSegment): NormalizedSegment {
  return {
    text: segment.text.trim(),
    start: segment.start / 1000,  // Convert ms → seconds
    end: segment.end / 1000
  }
}
```

**Critical Bug Fix**: Whisper outputs milliseconds, pyannote outputs seconds
**Source**: `src/utils/mergeDiarization.ts:33`

---

**findMostOverlappingSpeaker()**

```typescript
function findMostOverlappingSpeaker(
  wordStart: number,
  wordEnd: number,
  diarizationSegments: SpeakerSegment[]
): string {
  let maxOverlap = 0
  let bestSpeaker = 'SPEAKER_UNKNOWN'

  for (const segment of diarizationSegments) {
    // Calculate temporal overlap
    const overlapStart = Math.max(wordStart, segment.start)
    const overlapEnd = Math.min(wordEnd, segment.end)
    const overlap = Math.max(0, overlapEnd - overlapStart)

    if (overlap > maxOverlap) {
      maxOverlap = overlap
      bestSpeaker = segment.speaker
    }
  }

  return bestSpeaker
}
```

**Algorithm**: Temporal Intersection Matching
**Source**: `src/utils/mergeDiarization.ts:45`

---

**mergeDiarizationWithTranscript()**

```typescript
export function mergeDiarizationWithTranscript(
  transcriptSegments: WhisperSegment[],
  diarizationSegments: SpeakerSegment[]
): MergedTranscript {
  // Step 1: Normalize timestamps (ms → seconds)
  const normalizedSegments = transcriptSegments.map(normalizeWhisperSegment)

  // Step 2: Assign speaker to each word
  const wordsWithSpeakers = normalizedSegments.map(word => ({
    ...word,
    speaker: findMostOverlappingSpeaker(word.start, word.end, diarizationSegments)
  }))

  // Step 3: Group consecutive words by same speaker
  const utterances: SpeakerUtterance[] = []
  let currentSpeaker = wordsWithSpeakers[0].speaker
  let currentText = wordsWithSpeakers[0].text

  for (let i = 1; i < wordsWithSpeakers.length; i++) {
    const word = wordsWithSpeakers[i]

    if (word.speaker === currentSpeaker) {
      currentText += ' ' + word.text
    } else {
      utterances.push({ speaker: currentSpeaker, text: currentText.trim() })
      currentSpeaker = word.speaker
      currentText = word.text
    }
  }

  // Add last utterance
  utterances.push({ speaker: currentSpeaker, text: currentText.trim() })

  // Step 4: Generate formatted transcript
  const fullText = utterances
    .map(u => `[${u.speaker}]: ${u.text}`)
    .join('\n\n')

  // Step 5: Count unique speakers
  const speakers = new Set(utterances.map(u => u.speaker))

  return {
    utterances,
    fullText,
    speakerCount: speakers.size
  }
}
```

**Source**: `src/utils/mergeDiarization.ts:76`

**Output Example**:
```
[SPEAKER_00]: Hello everyone, welcome to the meeting.

[SPEAKER_01]: Thanks for having me. Let's start with the Q4 roadmap.

[SPEAKER_00]: Great idea. I'll share my screen.

[SPEAKER_01]: Looks good. I have a few questions about the timeline.
```

---

## IPC Integration

### Main Process Handler

**Location**: `src/main/index.ts:168`

```typescript
ipcMain.handle('transcribe-and-diarize', async (_event, audioPath, options) => {
  try {
    // Step 1: Transcribe (get word timestamps)
    const transcriptResult = await transcriptionService.transcribeWithProgress(
      audioPath,
      options,
      (progress) => {
        mainWindow?.webContents.send('transcription-progress', {
          stage: 'transcribing',
          ...progress
        })
      }
    )

    // Step 2: Diarize (get speaker segments)
    mainWindow?.webContents.send('transcription-progress', {
      stage: 'diarizing',
      progress: 50,
      message: 'Analyzing speakers...'
    })

    const diarizationResult = await diarizationService.diarize(
      audioPath,
      (progress) => {
        mainWindow?.webContents.send('transcription-progress', {
          stage: 'diarizing',
          ...progress
        })
      }
    )

    // Step 3: Merge results
    const merged = mergeDiarizationWithTranscript(
      transcriptResult.segments,
      diarizationResult.segments
    )

    return {
      success: true,
      result: {
        ...transcriptResult,
        merged
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

### Preload Bridge

**Location**: `src/preload/index.ts:31`

```typescript
const electronAPI = {
  transcribeAndDiarize: (audioPath: string, options: TranscriptionOptions) =>
    ipcRenderer.invoke('transcribe-and-diarize', audioPath, options),

  onTranscriptionProgress: (callback: (progress: TranscriptionProgress) => void) => {
    ipcRenderer.on('transcription-progress', (_event, progress) => callback(progress))
  }
}
```

---

## UI Integration

### Two-Button Approach

**Component**: `src/renderer/App.tsx:343`

```typescript
{savedAudioPath && !isRecording && (
  <>
    <button
      onClick={handleTranscribe}
      className="btn btn-transcribe"
      disabled={isTranscribing}
    >
      {isTranscribing ? '⏳ Processing...' : '📝 Transcribe + Diarize'}
    </button>
    <button
      onClick={handleTranscribeOnly}
      className="btn btn-transcribe-only"
      disabled={isTranscribing}
    >
      ⚡ Transcribe Only (Fast)
    </button>
  </>
)}
```

**Rationale**:
- **Transcribe + Diarize**: Full speaker labels (~90s for 30s audio)
- **Transcribe Only**: No speaker labels (~30s for 30s audio, 3x faster)

### Progress Display

```typescript
{isTranscribing && transcriptionProgress && (
  <div className="transcription-section">
    <h3>
      {transcriptionProgress.stage === 'diarizing'
        ? 'Analyzing Speakers...'
        : 'Transcribing...'}
    </h3>
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${transcriptionProgress.progress}%` }} />
    </div>
    <p>{transcriptionProgress.message}</p>
  </div>
)}
```

### Speaker-Labeled Transcript Display

```typescript
{transcript && transcript.merged && (
  <div className="transcript-section">
    <h3>Transcript</h3>
    <div className="transcript-stats">
      <span>Speakers: {transcript.merged.speakerCount}</span>
    </div>
    <div className="transcript-text">
      {transcript.merged.fullText}
    </div>
    <div className="info">
      <p><strong>Speaker Diarization:</strong></p>
      <p>✅ {transcript.merged.speakerCount} speaker(s) detected</p>
      <p style={{ fontSize: '0.9em', color: '#666' }}>
        Phase 2 will match speaker labels with calendar attendee names.
      </p>
    </div>
  </div>
)}
```

**Source**: `src/renderer/App.tsx:401`

---

## Performance

### Benchmarks (CPU-only, M3 Pro)

| Audio Duration | Diarization Time | Ratio | Hardware |
|----------------|------------------|-------|----------|
| 30s | ~30s | 1:1 | M3 Pro (CPU) |
| 5min (est) | ~5min | 1:1 | M3 Pro (CPU) |
| 60min (est) | ~60min | 1:1 | M3 Pro (CPU) |

**Comparison with Transcription**:
- Whisper transcription: ~1-2x realtime (Metal GPU)
- pyannote diarization: ~1:1 ratio (CPU-only)

### GPU Acceleration (Deferred to Phase 2+)

**Option**: PyTorch Metal (MPS) backend

**Expected Speedup**: 3-10x faster (30s → 3-10s for 30s audio)

**See**: `docs/gpu-acceleration.md` for details

---

## Known Issues & Limitations

### 1. Generic Speaker Labels

**Issue**: Speakers labeled as "SPEAKER_00", "SPEAKER_01", etc.

**Impact**: No automatic name recognition

**Workaround**: Phase 2 will use Claude API + calendar data to guess names

**Example**:
```
Before: [SPEAKER_00]: I agree with that approach.
After:  [John Smith]: I agree with that approach.
```

### 2. CPU-Only Performance

**Issue**: pyannote.audio runs on CPU (no Metal GPU)

**Impact**: 1:1 processing time (slow for long meetings)

**Workaround**: Deferred to Phase 2+ (optional GPU acceleration)

**Priority**: Medium (acceptable for MVP, <1hr meetings)

### 3. Overlapping Speech

**Issue**: When multiple people talk simultaneously, pyannote may:
- Choose one speaker (lose other person's words)
- Create multiple overlapping segments
- Merge algorithm assigns words to most-overlapping speaker

**Impact**: Partial information loss in heated discussions

**Workaround**: None (fundamental limitation of diarization)

**Mitigation**: Phase 2 meeting summaries can note "[multiple speakers]"

### 4. Similar Voices

**Issue**: Two speakers with very similar voices may be grouped together

**Impact**: Shown as one speaker when actually two

**Workaround**: None (requires better models)

**Priority**: Low (rare in typical meetings)

### 5. No Real-Time Diarization

**Issue**: Must wait for full audio file before processing

**Impact**: Can't see speakers during live recording

**Workaround**: Phase 9 will explore streaming diarization

**Priority**: Low (not critical for MVP)

---

## Testing

### Manual Testing Checklist

- [x] Two-speaker conversation (verified speaker separation)
- [x] Speaker count display (verified count accuracy)
- [x] Merged transcript format (verified [SPEAKER_XX] labels)
- [x] Progress updates (verified UI messages)
- [x] Build and type-check pass
- [x] Integration with transcription (verified end-to-end flow)

### Accuracy Testing

**Test**: Two-speaker recording (YouTube interview)

**Result**: ✅ 85%+ speaker assignment accuracy

**Errors**: Minor overlap confusion, one voice switch missed

### Performance Testing

- [x] 30s audio diarization: ~30s (verified 1:1 ratio)
- [x] Memory usage: <500MB (verified with Activity Monitor)
- [x] No memory leaks (verified multiple runs)

---

## Future Enhancements (Post-MVP)

### Phase 2: LLM-Based Speaker Attribution

- [ ] Use Claude API to match speaker labels with calendar attendee names
- [ ] Input: Generic labels + attendee list + context
- [ ] Output: "John Smith" instead of "SPEAKER_00"

**Example Prompt**:
```
Meeting: Q4 Planning Sync
Attendees: John Smith, Mary Johnson, Bob Lee
Transcript excerpt:
[SPEAKER_00]: Let's start with the roadmap.
[SPEAKER_01]: I have concerns about the timeline.
[SPEAKER_00]: Good point. Let's discuss offline.

Question: Which attendee is most likely SPEAKER_00?
Answer: John Smith (meeting organizer, directive tone)
```

### Phase 2+: GPU Acceleration

- [ ] Add PyTorch Metal (MPS) support for M1/M2/M3 Macs
- [ ] Add CUDA support for Windows/Linux with NVIDIA GPUs
- [ ] Add `USE_GPU_DIARIZATION` environment variable
- [ ] Show device used in UI (CPU/Metal/CUDA)

**Expected Speedup**: 3-10x (30s audio in 3-10s)

### Phase 9: Advanced Features

- [ ] Real-time streaming diarization
- [ ] Speaker clustering (group by voice similarity)
- [ ] Speaker enrollment (recognize known voices)
- [ ] Emotion detection (tone analysis)
- [ ] Overlapping speech handling (multi-channel output)

### Cross-Platform

- [ ] Windows support (pyannote.audio works on Windows)
- [ ] Linux support (pyannote.audio works on Linux)
- [ ] Intel Mac testing (currently only tested on Apple Silicon)

---

## References

- [pyannote.audio Documentation](https://github.com/pyannote/pyannote-audio)
- [pyannote.audio 3.1 Release](https://github.com/pyannote/pyannote-audio/releases/tag/3.1)
- [Speaker Diarization Explained](https://en.wikipedia.org/wiki/Speaker_diarisation)
- [PyTorch Metal (MPS) Backend](https://pytorch.org/docs/stable/notes/mps.html)
- [Hugging Face Models](https://huggingface.co/pyannote)

---

**Last Updated**: 2025-10-13
**Author**: Claude Code (Sonnet 4.5)
**Related Phases**: Phase 1.2 (Transcription), Phase 2 (M365 Integration)
