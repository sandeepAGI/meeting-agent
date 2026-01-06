# Meeting Agent - AI Assistant Guidance

**Project**: macOS desktop app for meeting transcription, speaker identification, and AI summarization
**Version**: 0.6.2.5 | **Status**: Production-ready (Phase 6 in progress)

---

## Current Work

**Phase 6 Completion** (Batches 2-6) - Wire remaining settings
- See: `docs/planning/phase6-completion-plan.md` for detailed task list
- See: `docs/planning/roadmap.md` for overall status and what's next

---

## Tech Stack

- **Electron** 38.2.1 + **React** 19 + **TypeScript** 5
- **Audio**: electron-audio-loopback, Web Audio API
- **ML (Local)**: whisper.cpp (Homebrew), pyannote.audio (Python), ffmpeg
- **Cloud**: Microsoft Graph API (M365), Anthropic Claude API (Batch)
- **Database**: better-sqlite3 (SQLite)

---

## Commands

```bash
npm run dev          # Development mode (hot-reload)
npm run build        # Build for production
npm run type-check   # Type checking
npm test             # Run tests
npm run package:mac  # Create DMG installer
```

---

## Critical Patterns

### 1. Subprocess Pattern (for ML models)
- Use `spawn()` to run external executables (whisper-cli, Python scripts)
- Avoid native Node.js modules (Electron compatibility issues)
- Parse progress from stderr, results from stdout

### 2. IPC Handler Pattern
- Main: `ipcMain.handle()` with try/catch, return `{success, result/error}`
- Preload: Expose via `contextBridge.exposeInMainWorld()`
- Renderer: `window.electronAPI.methodName()`

### 3. Testing Strategy (Phase 6+)

**Hybrid Approach:**
- **Phase 6 (Settings wiring)**: Manual testing + type-check (integration work)
- **Phase 7+ (Storage/Performance/Error Handling)**: TDD required for business logic
- **Bug fixes**: Always write test first (RED → GREEN → REFACTOR)

**When to write tests first:**
- Complex business logic (quota enforcement, retention cleanup, scheduled jobs)
- Data operations (database mutations, file deletion)
- Bug fixes (reproduce first, then fix)

**When manual testing is sufficient:**
- Simple settings wiring (read setting → use setting)
- UI updates (complement with smoke tests)
- Trivial changes (type-check catches issues)

**Mandatory Testing Levels:**
- **Level 1**: `npm run type-check` + `npm run build`
- **Level 2**: Logic review (error handling, edge cases, cleanup)
- **Level 3**: Manual testing (happy path + edge cases)
- **Never claim "complete" without Level 3 testing**

---

## Project Structure

**Source Code**:
- `src/main/` - Electron main process (IPC handlers, app lifecycle)
- `src/renderer/` - React UI (components, hooks, styles)
- `src/services/` - Business logic (audio, transcription, diarization, database, settings, M365, Claude)
- `src/preload/` - IPC bridge (exposes APIs to renderer)
- `src/types/` - TypeScript interfaces and types
- `src/utils/` - Helpers (merge algorithm, email generator, prompt loader)
- `scripts/` - External scripts (Python diarization, utilities)
- `docs/` - Documentation (planning/, archive/, technical/, developer/, guides/)
- `models/` - Whisper models (dev only, downloads to userData in production)
- `data/` - SQLite database (dev only, uses userData in production)

**Data Locations**:
- **Dev**: `./data/`, `./models/`
- **Prod**: `~/Library/Application Support/meeting-agent/`
  - Database: `meeting-agent.db`
  - Models: `models/`
  - Recordings: `recordings/`
  - Settings: `settings.json` + macOS Keychain (API keys)

---

## Documentation

- **Current status**: `docs/planning/roadmap.md`
- **Current work**: `docs/planning/phase6-completion-plan.md`
- **Architecture**: `docs/developer/architecture.md`
- **Technical details**: `docs/technical/{audio-capture,transcription,diarization,llm-intelligence}.md`
- **Version history**: `CHANGELOG.md`

---

## Git Workflow

**Commits**:
- Phase completion: Include phase reference in commit message
- Bug fixes: Update CHANGELOG.md (patch version)
- New features: Update CHANGELOG.md (minor version)
- Always update docs in same commit as code changes

**Documentation updates** (mandatory with code changes):
- Phase complete → Update roadmap.md + CHANGELOG.md + move plan to archive
- Bug fix → Update CHANGELOG.md + technical docs if needed
- New dependency → Update technical docs + README.md

---

## Important Notes

1. **Data Safety**: All directory creation uses `if (!fs.existsSync())`, database uses `CREATE TABLE IF NOT EXISTS`, migrations only ADD columns
2. **Settings**: Phase 6 Batch 1 (API keys) complete and wired; Batches 2-6 saved but not yet used by application
3. **Path Resolution**: Use `app.isPackaged` to detect dev vs production, `app.getPath('userData')` for persistent data
4. **GPU Acceleration**: Metal GPU automatic on Apple Silicon for both transcription and diarization
