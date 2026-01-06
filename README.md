# Meeting Agent

AI-powered meeting transcription and summarization for macOS.

## Status

**Version**: 0.6.2.5 (Feature) | 0.1.0 (Package)
**Phase**: 6 - Settings & Configuration (Batch 1 Complete)
**Production**: ✅ Ready - DMG installer available (119MB)

🚀 **Download pre-built DMG** or build from source
📦 **All core features working** - Audio capture → Transcription → Diarization → AI Summaries → Email Distribution
⚙️ **Current work**: Phase 6 completion - wire remaining settings (~4 hours)

See [CHANGELOG.md](./CHANGELOG.md) for version history | [docs/planning/roadmap.md](./docs/planning/roadmap.md) for detailed roadmap

## What It Does

- **Captures audio** from any meeting (Teams, Zoom, Meet, etc.) using native macOS audio loopback
- **Transcribes locally** with OpenAI Whisper (Metal GPU, ~50x realtime, 100% free)
- **Identifies speakers** using pyannote.audio speaker diarization (Metal GPU accelerated)
- **Generates AI summaries** with Claude API (~$0.09/meeting, 96% cheaper than cloud alternatives)
- **Integrates with M365** for calendar context and attendee information
- **Sends email summaries** via Microsoft Graph API with Aileron-branded HTML templates
- **Browse & edit** past recordings with inline editing before sending

## Key Features

- 💰 **Cost-Effective**: ~$0.09/meeting (100% local transcription + diarization)
- 🔒 **Privacy-First**: All transcription and diarization run on your machine
- 🚀 **Metal GPU**: Fast on Apple Silicon (5.7s for 5min audio)
- ⚙️ **Settings UI**: Configure API keys, transcription, summaries, audio, and storage
- 📧 **M365 Integration**: Calendar sync and email distribution
- ✏️ **Edit Before Send**: Inline editing of summaries, speakers, action items

## Installation

### Option 1: Pre-built DMG (Recommended)

**Requirements**: macOS 12.3+, Apple Silicon or Intel Mac

1. **Download**: `Meeting Agent-0.1.0-arm64.dmg` (119MB)
2. **Install**: Drag to Applications folder
3. **Launch**: Open app and configure Settings:
   - **Anthropic API Key**: Get from [console.anthropic.com](https://console.anthropic.com)
   - **HuggingFace Token**: Get from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   - Accept pyannote license: [huggingface.co/pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
4. **Python Setup** (one-time, for speaker diarization):

   ```bash
   python3 -m venv ~/meeting-agent-venv
   source ~/meeting-agent-venv/bin/activate
   pip install pyannote.audio torch torchaudio python-dotenv
   ```

5. **Whisper Model**: App downloads automatically on first transcription (141MB)

### Option 2: Build from Source

**Prerequisites**: macOS 12.3+, Node.js 20+, Python 3.11+, Homebrew

```bash
# Install system dependencies
brew install whisper-cpp ffmpeg

# Clone and install
git clone https://github.com/sandeepAGI/meeting-agent.git
cd meeting-agent
npm install

# Set up Python environment
python3 -m venv venv
source venv/bin/activate
pip install pyannote.audio torch torchaudio python-dotenv

# Download Whisper model
mkdir -p models
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin \
  -o models/ggml-base.bin

# Configure environment
cp .env.example .env
# Edit .env and add:
#   HUGGINGFACE_TOKEN=hf_xxx
#   ANTHROPIC_API_KEY=sk-ant-xxx
#   AZURE_CLIENT_ID=your_client_id (optional, for M365)
#   AZURE_TENANT_ID=your_tenant_id (optional, for M365)

# Run
npm run dev          # Development mode
npm run build        # Production build
npm run package:mac  # Create DMG
```

## Quick Start

1. **Launch** the app and grant audio permissions
2. **Sign in to M365** (optional) to see calendar meetings
3. **Configure Settings**: Add API keys (Settings icon in top-right)
4. **Start Recording**: Click "Initialize Audio" → "🎤 Start Recording"
   - Automatic announcement informs participants
5. **Stop Recording**: Click "⏹ Stop Recording" when done
6. **Generate Summary**:
   - Choose "📝 Transcribe + Diarize" for speaker labels
   - Select meeting from calendar or create standalone recording
   - Wait for AI summary generation (~30-60 min via Batch API)
7. **Review & Send**: Edit summary, select recipients, preview email, send

## Tech Stack

**Runtime**: Electron 38 + React 19 + TypeScript 5
**Audio**: electron-audio-loopback (native macOS capture)
**Transcription**: whisper.cpp (local, Metal GPU)
**Diarization**: pyannote.audio (local, Metal GPU)
**AI**: Anthropic Claude Batch API (50% cost savings)
**Database**: SQLite (better-sqlite3)
**M365**: @azure/msal-node + Microsoft Graph API

## Performance

**M3 Pro (Apple Silicon)**:

- Audio capture: Real-time (constant ~100MB memory)
- Transcription: 5.7s for 5min audio (~50x realtime, Metal GPU)
- Diarization: 2.8s for 30s audio (~10x realtime, Metal GPU)
- Total: ~12s for 5min meeting
- Cost: ~$0.09 per 60-min meeting

## Documentation

**For Users**:

- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [docs/planning/roadmap.md](./docs/planning/roadmap.md) - Development roadmap

**For Developers**:

- [CLAUDE.md](./CLAUDE.md) - AI assistant guide (project instructions)
- [docs/developer/architecture.md](./docs/developer/architecture.md) - System architecture
- [docs/technical/](./docs/technical/) - Implementation details by phase

**Development Commands**:

```bash
npm run dev          # Hot-reload development
npm run build        # Production build
npm run type-check   # TypeScript validation
npm run lint         # ESLint
npm run package:mac  # Create DMG installer
```

## Roadmap

### ✅ Completed (Production Ready)

- **Phases 0-1.6**: Audio capture, transcription, diarization, GPU acceleration
- **Phases 2.1-2.4**: M365 auth, calendar, LLM intelligence, meeting association
- **Phases 4a-5.5**: Browse mode, branding, summary editor, email distribution
- **Phase 6 (Batch 1)**: Settings UI with API key management
- **Packaging (Phases 0-4)**: Production DMG installer ready

### ⏳ In Progress

- **Phase 6 (Batches 2-6)**: Wire remaining settings (~4 hours)

### 📅 Next

- **Phase 7**: Data management (retention, quotas, auto-cleanup)
- **Phase 8**: Performance optimization (streaming, large meetings)
- **Phase 9**: Error handling & logging (production-grade)
- **Phase 10**: Distribution (auto-updates, code signing)

See [docs/planning/roadmap.md](./docs/planning/roadmap.md) for detailed breakdown.

## Troubleshooting

### "No audio device found"

- Grant Screen Recording permission: System Settings → Privacy & Security → Screen Recording

### "HUGGINGFACE_TOKEN not configured"

- Add token in Settings panel or `.env` file
- Get token: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
- Accept license: [huggingface.co/pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)

### "Whisper model not found"

- DMG version: Download via Settings panel (automatic on first transcription)
- Source build: `curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -o models/ggml-base.bin`

### "Python script failed" or diarization errors

- Activate venv: `source ~/meeting-agent-venv/bin/activate` (DMG) or `source venv/bin/activate` (source)
- Reinstall: `pip install pyannote.audio torch torchaudio python-dotenv`

### M365 authentication issues

- Ensure Azure app registration has correct permissions
- Clear cached tokens: Delete `~/Library/Application Support/meeting-agent/` and restart app

## Contributing

This is a personal project developed with Claude Code. Bug reports and suggestions welcome via [GitHub Issues](https://github.com/sandeepAGI/meeting-agent/issues).

## License

MIT License - See [LICENSE](./LICENSE)

---

**Last Updated**: 2026-01-05
**Built with**: Claude Code (Sonnet 4.5) 🤖
