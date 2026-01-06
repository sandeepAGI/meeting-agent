# Codex Refactor Recommendations – 2026-01-05

## Context

Comprehensive architectural/code review requested on 2026-01-05 to identify refactor opportunities and security risks in the Meeting Agent Electron app. Focus areas included Electron main-process orchestration, renderer structure, services, and supporting infrastructure.

## High-Priority Findings

1. **Main process monolith (`src/main/index.ts`)**  
   - 1,400+ lines combining service bootstrapping, environment loading, and every IPC handler.  
   - Impossible to unit test; any edit risks unrelated features.  
   - Recommendation: Extract domain-specific handler modules (audio, transcription, Graph/M365, meeting intelligence, settings, database) plus a small bootstrap that wires them up via a typed IPC router.

2. **Secrets exposed to renderer via preload bridge**  
   - `window.electronAPI.settings.getApiKey`/`setApiKey` return Anthropic and HuggingFace secrets directly to React (`src/preload/index.ts`).  
   - Renderer compromise would leak credentials despite context isolation.  
   - Recommendation: Remove read access from renderer; expose only status booleans or validation endpoints. Keep key retrieval strictly inside the main process/services that require them.

3. **Blocking work on UI thread (DB + LLM orchestration)**  
   - `DatabaseService` (better-sqlite3) and `MeetingIntelligenceService` synchronous polling both run on the Electron main thread.  
   - Long-running queries or Anthropic batch polling can freeze the window.  
   - Recommendation: Move database + meeting-intelligence orchestration into a worker/child process and communicate via IPC/MessagePort, keeping the UI thread responsive.

## Medium-Priority Findings

4. **DatabaseService god-object**  
   - Single 900-line class handles migrations, CRUD for every table, and logging.  
   - Hard to reason about transactions and to test in isolation.  
   - Recommendation: Split into repositories per aggregate (meetings, recordings, summaries, batch jobs, email cache) and centralize migrations in versioned SQL scripts.

5. **Renderer entry point doing everything**  
   - `src/renderer/App.tsx` orchestrates recording, transcription, calendar, meeting intelligence, transcript viewer, and settings toggles in one component.  
   - Leads to frequent full re-renders and tightly coupled UI logic.  
   - Recommendation: Introduce contexts/providers (RecordingContext, MeetingIntelligenceContext) and a higher-level layout/router to mount sections on demand.

6. **Audio capture polling + chunk state duplication**  
   - `AudioCaptureService` stores chunk metadata internally while `useAudioCapture` polls every 100 ms to mirror state in the renderer.  
   - Inefficient and error-prone (state split across processes).  
   - Recommendation: Emit progress events from the service, persist chunk metadata alongside files, and let the renderer subscribe instead of polling.

7. **Lack of automated coverage for critical services**  
   - Only model-manager tests exist. Settings migration, chunk saving, diarization, meeting-intelligence status calculations, and Graph email flows are untested.  
   - Recommendation: Add Jest/unit tests for `SettingsService`, `MeetingIntelligenceService` (JSON repair, status math), audio chunk saving/merging, and IPC/database integration.

## Suggested Next Steps

1. Align on security + main-process modularization plan (items 1 & 2).  
2. Spike moving DB + meeting-intelligence work into a worker to validate the IPC contract.  
3. Schedule subsequent UI/service refactors (items 4‑6) once the core architecture is stabilized.  
4. Expand automated tests in parallel to catch regressions as refactors land.
