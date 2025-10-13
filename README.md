# Meeting Agent

AI-powered meeting transcription and summarization tool for macOS.

## Status

**Current Version**: 0.1.3 - Phase 1.3 Complete ✅

This project is in active development. Phases 0-1.3 are complete (audio capture, transcription, speaker diarization). See [CHANGELOG.md](./CHANGELOG.md) for version history and [docs/planning/roadmap.md](./docs/planning/roadmap.md) for the full development plan.

## Overview

Meeting Agent is a desktop application that:

- ✅ **Captures audio** from online meetings (Teams, Zoom, Google Meet, etc.)
- ✅ **Transcribes audio locally** using OpenAI Whisper (free, runs on your machine)
- ✅ **Identifies speakers** using pyannote.audio speaker diarization
- 🔜 **Generates AI summaries** with action items using Claude API (Phase 3)
- 🔜 **Integrates with Microsoft 365** for meeting context and email distribution (Phase 2)
- 🔜 **Provides an editor** to review and customize summaries before sending (Phase 4)

## What Works Now (v0.1.3)

### Audio Capture
- Native system audio capture (no virtual drivers required!)
- Microphone capture with graceful fallback
- Real-time audio level monitoring
- 16kHz mono WAV output (Whisper-compatible)

### Transcription
- Local transcription using whisper.cpp (Metal GPU acceleration)
- ~1-2x realtime speed (17.9s audio in 20-30s)
- Progress monitoring with real-time updates
- Memory efficient: <200MB during transcription

### Speaker Diarization
- Identifies "who spoke when" using pyannote.audio
- Speaker-labeled transcripts: `[SPEAKER_00]: text`
- Two modes: "Transcribe Only" (fast) or "Transcribe + Diarize" (accurate)
- ~90s total for 30s audio (transcription + diarization)

## Key Features

- 🎤 **Universal Meeting Support**: Works with any meeting platform
- 💰 **Cost-Effective**: $0.00/meeting for transcription + diarization (100% local)
- 🔒 **Privacy-First**: All processing happens locally, you control all data
- 🚀 **Metal GPU Acceleration**: Fast transcription on Apple Silicon
- 🗣️ **Speaker Labels**: Know who said what in meetings
- 📧 **M365 Integration** (Coming in Phase 2): Auto-fetch meeting context, send via Outlook
- ✏️ **Edit Before Send** (Coming in Phase 4): Review and customize summaries
- 💾 **Smart Storage** (Coming in Phase 6): Auto-delete audio after transcription

## Tech Stack

- **Runtime**: Node.js 20+, Electron 38, TypeScript 5
- **UI**: React 19
- **Transcription**: whisper.cpp (local, Metal GPU)
- **Diarization**: pyannote.audio (local, Python)
- **Summarization**: Anthropic Claude API (Phase 3)
- **Database**: SQLite (Phase 6)
- **Audio**: electron-audio-loopback (no BlackHole required!)

## Installation & Setup

### Prerequisites

- **macOS**: 12.3+ (for native audio loopback)
- **Hardware**: Apple Silicon (M1/M2/M3) or Intel Mac with AVX2
- **Node.js**: 20+
- **Homebrew**: For installing tools

### 1. Install System Dependencies

```bash
# Install whisper.cpp for transcription
brew install whisper-cpp

# Install ffmpeg for audio preprocessing
brew install ffmpeg

# Verify installations
which whisper-cli ffmpeg
```

### 2. Download Whisper Model

```bash
# Create models directory
mkdir -p models

# Download base model (~150MB)
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin \
  -o models/ggml-base.bin
```

### 3. Set Up Python Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate venv
source venv/bin/activate

# Install pyannote.audio and dependencies
pip install pyannote.audio torch torchaudio python-dotenv
```

### 4. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your Hugging Face token
# Get token from: https://huggingface.co/settings/tokens
# Accept model license: https://huggingface.co/pyannote/speaker-diarization-3.1
nano .env
```

Add to `.env`:
```bash
HUGGINGFACE_TOKEN=hf_xxx
```

### 5. Install Node Dependencies

```bash
npm install
```

### 6. Run the App

```bash
# Development mode (hot-reload)
npm run dev

# Production build
npm run build
npm start
```

## Usage

1. **Initialize Audio**: Click "Initialize Audio Capture" and grant permissions
2. **Start Recording**: Click "🎤 Start Recording" when meeting begins
3. **Stop Recording**: Click "⏹ Stop Recording" when meeting ends
4. **Transcribe**: Choose between:
   - "⚡ Transcribe Only" (~30s for 30s audio, no speaker labels)
   - "📝 Transcribe + Diarize" (~90s for 30s audio, with speaker labels)
5. **View Transcript**: See full transcript with speaker labels

## Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** - Version history with completion dates
- **[docs/planning/roadmap.md](./docs/planning/roadmap.md)** - Full development plan (10 phases)
- **[docs/developer/architecture.md](./docs/developer/architecture.md)** - System architecture
- **[docs/technical/](./docs/technical/)** - Implementation details for each phase:
  - [audio-capture.md](./docs/technical/audio-capture.md) - Phase 1.1
  - [transcription.md](./docs/technical/transcription.md) - Phase 1.2
  - [diarization.md](./docs/technical/diarization.md) - Phase 1.3
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant development guide

## Cost Estimate

### Current (Phases 1.1-1.3)
- **Transcription**: $0.00 (local Whisper)
- **Diarization**: $0.00 (local pyannote.audio)
- **Total**: **$0.00 per meeting** 🎉

### Future (Phase 3+)
- **Summarization**: ~$0.015 per 60-min meeting (Claude API)
- **Microsoft Graph API**: $0.00 (included with M365 subscription)
- **Estimated Monthly**: ~$0.30 for 20 meetings

### Comparison
- **Cloud-only alternative**: Azure Speech + Azure OpenAI = ~$2.50/meeting = $50/month
- **Meeting Agent**: ~$0.015/meeting = $0.30/month
- **Savings**: 99% 💰

## Privacy & Ethics

- ⚠️ **User must explicitly inform meeting participants** about recording/transcription
- 🔒 All transcription and diarization happen locally on your machine
- 👤 User reviews and approves summaries before distribution (Phase 4)
- 🗑️ Configurable data retention and auto-deletion (Phase 6)
- 🚫 No telemetry or usage tracking

## Development

### Commands

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

### Project Structure

```
meeting-agent/
├── src/
│   ├── main/            # Electron main process
│   ├── preload/         # IPC bridge
│   ├── renderer/        # React UI
│   ├── services/        # Business logic (audio, transcription, diarization)
│   ├── utils/           # Helper functions
│   └── types/           # TypeScript types
├── scripts/             # Python scripts (diarization)
├── models/              # Whisper models
├── venv/                # Python virtual environment
├── docs/                # Documentation
└── CLAUDE.md            # Development plan
```

## Performance

### Benchmarks (M3 Pro, 11 cores, 18GB RAM)

| Operation | Time | Ratio | Memory |
|-----------|------|-------|--------|
| Audio Capture | Real-time | 1:1 | ~100MB |
| Transcription (base model) | 20-30s for 17.9s | 1.1-1.7x | ~200MB |
| Diarization (CPU-only) | 30s for 30s | 1:1 | ~500MB |
| **Total (Transcribe + Diarize)** | **~90s for 30s** | **3:1** | **~700MB peak** |

**Note**: Transcription uses Metal GPU (automatic). Diarization uses CPU (GPU acceleration deferred to Phase 2+).

## Known Limitations

1. **macOS Only**: Currently requires macOS 12.3+ for native audio loopback
2. **Generic Speaker Labels**: Speakers labeled "SPEAKER_00", "SPEAKER_01", etc. (Phase 2 will add name matching with calendar attendees)
3. **CPU-Only Diarization**: ~1:1 processing time (GPU acceleration planned for Phase 2+)
4. **No M365 Integration Yet**: Calendar and email features coming in Phase 2
5. **No Summarization Yet**: AI summaries coming in Phase 3
6. **English-Focused**: Multi-language support planned for Phase 7

## Roadmap

### ✅ Phase 0: Foundation Setup (2025-10-07)
- Electron, React, TypeScript project setup

### ✅ Phase 1.1: Audio Capture (2025-10-09)
- Native system audio + microphone capture
- Real-time audio level monitoring

### ✅ Phase 1.2: Transcription (2025-10-13)
- Local Whisper transcription with Metal GPU

### ✅ Phase 1.3: Speaker Diarization (2025-10-13)
- Speaker identification using pyannote.audio

### 🔜 Phase 2: Microsoft Graph Integration
- M365 authentication
- Calendar integration
- Meeting context

### 📅 Phase 3: AI Summarization
- Claude API integration
- Action item extraction
- Decision tracking

### 📅 Phase 4: GUI Development
- Meeting list UI
- Summary editor
- Recipient selector

### 📅 Phase 5-10
- Email distribution, data management, settings, error handling, performance optimization, documentation

See [docs/planning/roadmap.md](./docs/planning/roadmap.md) for full details.

## Troubleshooting

### "No audio device found"
- Check System Settings → Privacy & Security → Screen Recording
- Grant permission to the app

### "Whisper model not found"
- Download model: `curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -o models/ggml-base.bin`

### "HUGGINGFACE_TOKEN not configured"
- Get token: https://huggingface.co/settings/tokens
- Accept license: https://huggingface.co/pyannote/speaker-diarization-3.1
- Add to `.env`: `HUGGINGFACE_TOKEN=hf_xxx`

### "Transcription is slow"
- Using base model (150MB) - fastest quality balance
- Metal GPU acceleration automatic on Apple Silicon
- Ensure other CPU-intensive apps are closed

### "Python script failed"
- Activate venv: `source venv/bin/activate`
- Reinstall: `pip install pyannote.audio torch torchaudio`

## Contributing

This is currently a personal project being developed with Claude Code. Contribution guidelines will be added once core functionality is stable.

If you find bugs or have suggestions, please open an issue on GitHub.

## License

MIT License - See LICENSE file

---

**Current Phase**: Phase 1.3 Complete ✅ (Audio Capture + Transcription + Diarization)

**Next Milestone**: Phase 2.1 - Microsoft 365 Authentication

**Last Updated**: 2025-10-13

**Built with**: Claude Code (Sonnet 4.5) 🤖
