# GPU Acceleration for Speaker Diarization

## Current Performance

The current implementation of speaker diarization uses pyannote.audio on CPU, which results in:

- **Diarization time**: ~30 seconds for 30-second audio (1:1 ratio)
- **Transcription time**: <1 second for 30-second audio (Metal GPU acceleration)

This performance disparity is due to:
1. Whisper.cpp uses Metal GPU acceleration on macOS (Apple Silicon)
2. pyannote.audio defaults to CPU-only processing

## GPU Acceleration Options for pyannote.audio

### Option 1: PyTorch Metal Backend (macOS)

PyTorch 2.0+ includes Metal Performance Shaders (MPS) support for Apple Silicon:

```python
import torch
from pyannote.audio import Pipeline

# Check if Metal is available
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
print(f"Using device: {device}")

# Load pipeline with Metal acceleration
pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    token=hf_token
)
pipeline = pipeline.to(device)

# Run diarization on Metal GPU
output = pipeline(audio_path)
```

**Requirements**:
- PyTorch >= 2.0 with Metal support
- macOS >= 12.3
- Apple Silicon (M1/M2/M3)

**Expected speedup**: 3-10x faster (estimate: 30s → 3-10s for 30s audio)

**Trade-offs**:
- Requires PyTorch Metal build (larger dependency)
- Metal MPS is still maturing (some ops may fall back to CPU)
- May increase memory usage

### Option 2: CUDA Support (Linux/Windows with NVIDIA GPU)

For systems with NVIDIA GPUs:

```python
import torch
from pyannote.audio import Pipeline

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    token=hf_token
)
pipeline = pipeline.to(device)

output = pipeline(audio_path)
```

**Requirements**:
- NVIDIA GPU with CUDA support
- PyTorch with CUDA build
- CUDA Toolkit

**Expected speedup**: 5-20x faster (depending on GPU)

### Option 3: Hybrid Approach (Current + Optional GPU)

Keep current CPU implementation as default, allow users to enable GPU acceleration:

**Advantages**:
- Works out-of-box without GPU (current behavior)
- Users with Apple Silicon can opt-in to Metal acceleration
- Graceful fallback if GPU acceleration fails

**Implementation**:
```python
# scripts/diarize_audio.py
import torch
from pyannote.audio import Pipeline
import sys
import os

def get_device():
    """Get best available device for PyTorch."""
    if torch.backends.mps.is_available():
        return torch.device("mps")
    elif torch.cuda.is_available():
        return torch.device("cuda")
    else:
        return torch.device("cpu")

def diarize_audio(audio_path: str, hf_token: str, use_gpu: bool = False):
    device = get_device() if use_gpu else torch.device("cpu")
    print(f"[PROGRESS] Using device: {device}", file=sys.stderr, flush=True)

    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        token=hf_token
    )

    if use_gpu:
        pipeline = pipeline.to(device)

    output = pipeline(audio_path)
    # ... rest of implementation
```

**Configuration**:
- Add `USE_GPU_DIARIZATION` environment variable (default: false)
- Add setting in Phase 7 (Settings UI)
- Show device used in progress messages

## Recommendation

**Phase 1.x (Current)**: Stick with CPU-only implementation
- Simpler dependencies (no Metal/CUDA builds)
- Works on all systems
- Performance is acceptable for MVP (1:1 ratio)

**Phase 2+**: Add optional GPU acceleration
- Add `--use-gpu` flag to `diarize_audio.py`
- Detect available backends (MPS/CUDA/CPU)
- Show device used in UI
- Add toggle in Settings (Phase 7)

**Future optimization**: If diarization performance becomes critical, consider:
1. Streaming diarization (process while transcribing)
2. Chunked processing (split long audio)
3. Alternative models (faster but less accurate)

## Installation Instructions (For Future Implementation)

### macOS with Apple Silicon (Metal)

```bash
# Install PyTorch with Metal support
pip install torch torchvision torchaudio

# Verify Metal is available
python3 -c "import torch; print('Metal available:', torch.backends.mps.is_available())"
```

### Linux/Windows with NVIDIA GPU (CUDA)

```bash
# Install PyTorch with CUDA support (CUDA 11.8 example)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Verify CUDA is available
python3 -c "import torch; print('CUDA available:', torch.cuda.is_available())"
```

## Performance Benchmarks (To Be Measured)

| Audio Duration | CPU Time | Metal (M3 Pro) | CUDA (RTX 3080) |
|----------------|----------|----------------|-----------------|
| 30 seconds     | ~30s     | TBD            | TBD             |
| 5 minutes      | TBD      | TBD            | TBD             |
| 30 minutes     | TBD      | TBD            | TBD             |
| 60 minutes     | TBD      | TBD            | TBD             |

*Note: Benchmarks will be collected after GPU acceleration is implemented.*

## References

- [PyTorch Metal (MPS) Backend](https://pytorch.org/docs/stable/notes/mps.html)
- [pyannote.audio GPU Support](https://github.com/pyannote/pyannote-audio/issues/1293)
- [PyTorch CUDA Support](https://pytorch.org/get-started/locally/)

## Status

**Current**: CPU-only implementation (Phase 1.3 complete)

**Next Steps** (Deferred to Phase 2+):
1. Add `--use-gpu` flag to diarization script
2. Implement device detection (MPS/CUDA/CPU)
3. Add environment variable `USE_GPU_DIARIZATION`
4. Update progress messages to show device used
5. Benchmark performance with Metal on M3 Pro
6. Add Settings UI toggle (Phase 7)
