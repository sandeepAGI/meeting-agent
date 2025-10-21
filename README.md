# Meeting Agent

AI-powered meeting transcription and summarization tool for macOS.

## Status

**Current Version**: 0.4.0 - Phase 4: Browse Mode Complete ✅

This project is in active development. Phases 0-4 (Browse Mode) are complete (audio capture, transcription, speaker diarization, M365 integration, LLM intelligence backend + UI, meeting-recording association, browse mode, Aileron branding). See [CHANGELOG.md](./CHANGELOG.md) for version history and [docs/planning/roadmap.md](./docs/planning/roadmap.md) for the full development plan.

## Overview

Meeting Agent is a desktop application that:

- ✅ **Captures audio** from online meetings (Teams, Zoom, Google Meet, etc.)
- ✅ **Transcribes audio locally** using OpenAI Whisper (free, runs on your machine)
- ✅ **Identifies speakers** using pyannote.audio speaker diarization
- ✅ **Integrates with Microsoft 365** for meeting context and calendar
- ✅ **Generates AI summaries** with speaker identification and action items using Claude API
- ✅ **Browse past recordings** with transcript and summary viewing
- ✅ **Provides export** to save summaries as markdown files with clipboard copy
- ✅ **Aileron branding** with professional design system
- 🔜 **Enhanced editor** to customize summaries with inline editing (Phase 4 continued)

## What Works Now (v0.4.0)

### Audio Capture
- Native system audio capture (no virtual drivers required!)
- Microphone capture with graceful fallback
- Real-time audio level monitoring
- 16kHz mono WAV output (Whisper-compatible)
- **Auto-save every 5 minutes** during recording
- Prevents memory exhaustion for long meetings (60+ minutes)
- **Stop Audio Capture** button to free system resources

### Recording Announcement
- **Automatic announcement** when recording starts
- Informs participants: "This meeting, with your permission, is being recorded..."
- **Legal compliance**: Ensures transparency and consent
- **Captured in recording**: Announcement is part of the audio file

### Transcription & Diarization
- Local transcription using whisper.cpp (Metal GPU acceleration)
- ~50x realtime speed (5min audio in ~5.7s)
- Speaker identification using pyannote.audio
- **Metal GPU acceleration**: 3-10x faster than CPU (automatic on Apple Silicon)
- Speaker-labeled transcripts: `[SPEAKER_00]: text`
- Progress monitoring with real-time updates
- Memory efficient: <700MB peak during transcription + diarization

### Microsoft 365 Integration (Phase 2.1-2.2)
- **OAuth2 authentication** with MSAL Node
- **Secure token storage** in system keychain
- **Today's calendar meetings** with attendees, times, and join links
- **Automatic token refresh** for seamless authentication
- Visual indicators for active/upcoming meetings
- **Always accessible** (no audio initialization required)

### Meeting Intelligence (Phase 2.3-3 Complete)
- **Recording Browser**: Visual selection from past recordings with transcript previews
- **Two-pass LLM workflow** for high-quality summaries
  - Pass 1: Speaker identification + initial summary
  - Pass 2: Validation and refinement
- **Real-time status display** during batch processing
- **Summary Display**: Speaker mappings, action items, key decisions
- **Export functionality**: Download as markdown + copy to clipboard
- **Standalone recordings**: Works without calendar meetings
- **Batch API integration** (50% cost savings)
- **SQLite database** for meeting persistence
- **Adaptive polling** (5min → 30sec intervals)
- **Background processing** (non-blocking)
- **Cost**: ~$0.09 per 60-min meeting (96% savings vs cloud alternatives)

### Meeting-Recording Association (Phase 2.3-4 Complete)
- **Two-tab interface**: Browse "Standalone Recordings" or "Calendar Meetings"
- **Link recordings to meetings**: Choose meeting during summary generation (Option C)
- **Date range filters**: Today, Last 7 Days, Last 30 Days, All
- **Search functionality**: Filter meetings by title
- **Auto-sync from M365**: Automatically fetches meetings for selected date range
- **Recording status badges**: Visual indicators ("🎙️ Recorded" | "❌ No Recording")
- **MeetingPicker dialog**: Select which meeting a recording belongs to
- **Standalone option**: Recordings work without calendar association
- **Back to Selection**: Easy navigation between summary and selection views
- **Automatic UI updates**: Recording moves between tabs after linking

### Browse Mode (Phase 4 Complete)
- **Browse/Generate toggle**: Switch between viewing past recordings and generating new summaries
- **Unified recording list**: Shows all recordings with status badges (✅ Summary | 📝 Transcript)
- **TranscriptViewer**: Full viewer for past transcripts with speaker labels and metadata
- **Smart navigation**: Click to view transcript or summary based on recording status
- **Search recordings**: Filter by meeting title or transcript content
- **Recording metadata**: Date, duration, speaker count displayed for each recording
- **Generate from transcript**: Option to create summary from transcript viewer
- **Aileron branding**: Professional design system with logo, colors, and Montserrat font

## Key Features

- 🎤 **Universal Meeting Support**: Works with any meeting platform
- 💰 **Cost-Effective**: ~$0.09/meeting (100% local transcription + diarization, cloud summarization)
- 🔒 **Privacy-First**: All transcription and diarization happen locally, you control all data
- 🚀 **Metal GPU Acceleration**: Fast transcription AND diarization on Apple Silicon
- 🗣️ **Speaker Identification**: AI-powered speaker mapping with meeting context
- 📧 **M365 Integration**: Calendar context and attendee information
- 🧠 **Two-Pass LLM Workflow**: Initial summary + validation for high accuracy
- ✏️ **Edit Before Send** (Coming soon): Review and customize summaries
- 💾 **Smart Storage** (Coming soon): Auto-delete audio after transcription

## Tech Stack

- **Runtime**: Node.js 20+, Electron 38, TypeScript 5
- **UI**: React 19
- **Transcription**: whisper.cpp (local, Metal GPU)
- **Diarization**: pyannote.audio (local, Python)
- **Summarization**: Anthropic Claude API (Batch API with 50% cost savings)
- **Database**: SQLite (better-sqlite3)
- **M365**: @azure/msal-node + @microsoft/microsoft-graph-client
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

# Edit .env and add your tokens
# Get HF token from: https://huggingface.co/settings/tokens
# Accept model license: https://huggingface.co/pyannote/speaker-diarization-3.1
# Get Anthropic key from: https://console.anthropic.com/
nano .env
```

Add to `.env`:
```bash
HUGGINGFACE_TOKEN=hf_xxx
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Azure AD (for M365 integration)
AZURE_CLIENT_ID=your_client_id
AZURE_TENANT_ID=your_tenant_id
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
   - Announcement plays automatically to inform participants
   - Status shows "📢 Playing announcement..." then "🔴 Recording..."
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

### Current (Phase 2.3-3 Backend)
- **Transcription**: $0.00 (local Whisper)
- **Diarization**: $0.00 (local pyannote.audio)
- **Summarization (Two-Pass)**: ~$0.09 per 60-min meeting (Claude Batch API)
  - Pass 1: $0.045 (speaker ID + initial summary)
  - Pass 2: $0.048 (validation + refinement)
- **Microsoft Graph API**: $0.00 (included with M365 subscription)
- **Total per meeting**: **$0.09** 💰
- **Estimated Monthly** (20 meetings): **~$1.86**

### Comparison
- **Cloud-only alternative**: Azure Speech + GPT-4 = ~$2.50/meeting = $50/month
- **Meeting Agent**: ~$0.09/meeting = $1.86/month
- **Savings**: 96% 💰

## Privacy & Ethics

- ✅ **Automatic announcement** informs participants when recording starts (Phase 1.4)
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
| Transcription (base model, Metal GPU) | 5.7s for 5min | ~50x | ~200MB |
| Diarization (CPU) | 16s for 30s | 0.53x | ~500MB |
| Diarization (Metal GPU) | 2.8s for 30s | **5.8x faster** | ~500MB |
| **Total (Transcribe + Diarize, GPU)** | **~12s for 5min** | **~25x** | **~700MB peak** |

**Note**: Both transcription and diarization use Metal GPU (automatic on Apple Silicon). Graceful fallback to CPU if GPU unavailable.

**Speedup**: Metal GPU provides **5.8x speedup** for diarization compared to CPU (measured on M3 Pro).

## Known Limitations

1. **macOS Only**: Currently requires macOS 12.3+ for native audio loopback
2. **Batch Processing Latency**: Summaries take 30-60 minutes to generate (due to 50% cost savings)
3. **Manual Testing Pending**: End-to-end workflow needs user testing and validation
4. **English-Focused**: Multi-language support planned for Phase 7

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

### ✅ Phase 1.4: Recording Announcement (2025-10-13)
- Automatic announcement for transparency and consent
- Legal compliance with recording laws

### ✅ Phase 1.5: Chunked Recording (2025-10-13)
- Auto-save every 5 minutes
- Prevents data loss for long meetings
- Memory stays constant regardless of duration

### ✅ Phase 1.6: GPU Acceleration (2025-10-13)
- Metal GPU acceleration for diarization
- Automatic device detection (Metal/CUDA/CPU)
- 3-10x speedup on Apple Silicon

### ✅ Phase 2.1: M365 Authentication (2025-10-14)
- OAuth2 authentication with MSAL Node
- Secure token storage in system keychain
- Automatic token refresh

### ✅ Phase 2.2: Calendar Integration (2025-10-14)
- Today's calendar meetings display
- Meeting attendees and metadata
- Join links and location info

### ✅ Phase 2.3-3: Meeting Intelligence (2025-10-21)
- Two-pass LLM workflow for summaries
- Batch API integration (50% cost savings)
- SQLite database persistence
- Background async processing
- **UI components complete** (recording browser, summary display, export)

### 🔄 Phase 2.3-4: Meeting-Recording Association (In Progress)
- Meeting selection during summary generation (Option C)
- Week view with date range filters
- Search meetings by title and attendees
- Link recordings to calendar meetings
- "Back to Selection" navigation

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

**Current Phase**: Phase 2.3-3 UI Components Complete ✅ (Audio + Transcription + Diarization + M365 + Calendar + LLM Intelligence Backend + UI)

**Next Milestone**: Manual testing and Phase 2.3-3 completion review

**Last Updated**: 2025-10-14

**Built with**: Claude Code (Sonnet 4.5) 🤖
