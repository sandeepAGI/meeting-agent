# Meeting Agent

AI-powered meeting transcription and summarization tool for macOS.

## Status

🚧 **Currently in Development - Phase 0** 🚧

This project is being actively developed. See [CLAUDE.md](./CLAUDE.md) for the detailed development plan and current progress.

## Overview

Meeting Agent is a desktop application that:
- Captures audio from online meetings (Teams, Zoom, Google Meet, etc.)
- Transcribes audio locally using OpenAI Whisper (free, runs on your machine)
- Generates AI summaries with action items using Claude API
- Integrates with Microsoft 365 for meeting context and email distribution
- Provides an editor to review and customize summaries before sending

## Key Features (Planned)

- 🎤 **Universal Meeting Support**: Works with any meeting platform
- 💰 **Cost-Effective**: ~$0.30/month for 20 meetings (local transcription)
- 🔒 **Privacy-First**: Transcription happens locally, you control all data
- 📧 **M365 Integration**: Auto-fetch meeting context, send via Outlook
- ✏️ **Edit Before Send**: Review and customize summaries
- 💾 **Smart Storage**: Auto-delete audio after transcription (configurable)

## Tech Stack

- **Runtime**: Node.js 20+, Electron, TypeScript
- **UI**: React 18
- **Transcription**: OpenAI Whisper (local)
- **Summarization**: Anthropic Claude API
- **Database**: SQLite
- **Audio**: BlackHole virtual audio driver

## Development Setup

This project is in early development. Setup instructions will be added as the project progresses.

### Prerequisites

- macOS (currently only platform supported)
- Node.js 20+
- BlackHole audio driver (for audio capture)

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Complete development plan and architecture
- Additional documentation will be added as features are implemented

## Cost Estimate

- **Transcription**: Free (runs locally)
- **Summarization**: ~$0.015 per 60-min meeting
- **Microsoft Graph API**: Free (included with M365)
- **Total**: ~$0.30/month for 20 meetings

## Privacy & Ethics

- User must explicitly inform meeting participants about recording/transcription
- All transcription happens locally on your machine
- User reviews and approves summaries before distribution
- Configurable data retention and auto-deletion

## License

MIT License - See LICENSE file

## Contributing

This is currently a personal project. Contribution guidelines will be added once the core functionality is stable.

---

**Current Phase**: Phase 0 - Foundation Setup
**Last Updated**: 2025-10-07
