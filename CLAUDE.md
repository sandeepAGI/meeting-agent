# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meeting Agent is a macOS desktop application that captures, transcribes, and summarizes online meetings across any platform (Teams, Zoom, Google Meet, etc.). It integrates with Microsoft 365 to pull meeting context and allows users to review/edit summaries before distribution.

### Key Features
- Calendar integration via Microsoft Graph API
- Local audio capture using BlackHole virtual audio device
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

#### Phase 1.1: Audio Capture
**Tasks**:
- [ ] Install and configure BlackHole virtual audio driver
- [ ] Implement audio capture service using `node-mic` or `sox`
- [ ] Add audio level monitoring/visualization
- [ ] Implement start/stop recording functionality
- [ ] Save audio to temporary WAV files
- [ ] Add error handling for missing audio device

**Testing**:
- [ ] Manual test: Play system audio, verify agent captures it
- [ ] Verify audio files are created in correct format (16kHz, mono, PCM)
- [ ] Test error handling when BlackHole not installed
- [ ] Test audio level visualization shows real-time levels
- [ ] Test start/stop functionality doesn't corrupt audio files

**Files Created**:
- `src/services/audio.ts`
- `src/utils/audioDevice.ts`
- `tests/audio.test.ts`

#### Phase 1.2: Local Whisper Integration
**Tasks**:
- [ ] Research best Whisper implementation for Node.js (whisper.cpp bindings or Python child process)
- [ ] Download and configure Whisper model (recommend: `base` or `small` for speed)
- [ ] Implement transcription service
- [ ] Add chunked processing for real-time transcription
- [ ] Implement streaming transcript updates to GUI
- [ ] Add language detection (optional)
- [ ] Handle transcription errors gracefully

**Testing**:
- [ ] Unit test: Feed known audio file, verify transcript accuracy
- [ ] Test with 5-minute meeting recording
- [ ] Test with 60-minute meeting recording (performance check)
- [ ] Verify memory usage stays reasonable during long recordings
- [ ] Test real-time streaming updates (transcript appears as spoken)
- [ ] Test handling of silence/background noise

**Files Created**:
- `src/services/transcription.ts`
- `src/services/whisper.ts`
- `scripts/download-whisper-model.sh`
- `tests/transcription.test.ts`

**Success Criteria**: Record 5-minute test meeting, get accurate transcript in < 2 minutes

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
  - [ ] Delete audio immediately after successful transcription
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
1. **Default behavior**: Delete audio immediately after transcription succeeds
2. **Optional retention**: User can enable "Keep audio files" in settings
3. **Storage quota**: If keeping audio, enforce configurable limit (default 5GB)
4. **FIFO cleanup**: When quota exceeded, delete oldest audio files first
5. **User override**: Allow pinning important meetings to prevent deletion
6. **Storage dashboard**: Show current usage, quota, and cleanup options

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
  - Default: Delete audio immediately after transcription
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

1. **macOS only**: Windows/Linux support requires different audio capture
2. **BlackHole required**: User must install separately (not bundled)
3. **M365 dependency**: Requires M365 account for calendar/email
4. **English-first**: Whisper supports multiple languages, but prompts are English
5. **No automatic join**: User must manually join meetings
6. **Single meeting**: Can only record one meeting at a time

---

## Future Enhancements (Post-MVP)

- [ ] Windows support (WASAPI loopback)
- [ ] Linux support (PulseAudio)
- [ ] Multi-language support
- [ ] Speaker diarization (who said what)
- [ ] Real-time translation
- [ ] Slack/Discord integration
- [ ] Custom summary templates
- [ ] Meeting highlights/clips extraction
- [ ] Chrome extension for direct browser capture
- [ ] Mobile app for remote meeting review

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

**Current Status**: Phase 0 Complete ✅ - Ready for Phase 1 (Audio Capture)
**Last Updated**: 2025-10-07
**Next Milestone**: Phase 1.1 - Audio Capture Implementation
