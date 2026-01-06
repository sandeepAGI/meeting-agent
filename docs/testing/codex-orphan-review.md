# Codex Orphan Review

Analysis Date: 2026-01-05

Snapshot of redundant or misplaced assets currently tracked in the
repository. These items are either generated artifacts that should be
ignored, obsolete fixtures that are no longer referenced by active test
runners, or duplicate files that should be consolidated.

## Build & Environment Outputs

- `dist/`, `out/`, `output/` &rarr; Generated artifacts already listed
  in `.gitignore` (`.gitignore:7-16`). Current tree contains compiled
  bundles (`dist/main`, `dist/renderer`), packaged DMGs/ZIPs (e.g.
  `out/Meeting Agent-0.1.0-arm64.dmg`), and ad-hoc LLM dumps in
  `output/`. Delete checked-in copies and rely on reproducible builds.
- `data/meeting-agent.db`, `data/test-meeting-agent.db*`,
  `models/ggml-base.bin` &rarr; User/local-dev state that belongs in the
  OS-specific userData directory per `CLAUDE.md`. Keeping real databases
  and model binaries in Git risks leaking user data and bloats clones.
- `node_modules/`, `venv/`, `.venv/` &rarr; Rebuildable env folders.
  `.gitignore` already covers `node_modules` but both Node dependencies
  and two full Python environments are currently tracked (see
  `du -sh node_modules venv .venv`). Remove from history and ensure
  virtualenvs are ignored.

## Duplicate / Unused Assets

- Aileron logo exists twice (`assets/branding/logos/aileron-logo.png`
  and `src/renderer/assets/branding/aileron-logo.png`). Checksums are
  identical; keep one canonical copy and import via alias to avoid
  double maintenance (`electron.vite.config.ts:26-33` and
  `src/renderer/App.tsx:21`).
- `brand/AILERON STYLE GUIDE.pdf`, `brand/Favicon.png` &rarr; Never
  referenced in code (`rg -n "Favicon.png"` returns no hits). Move to
  `docs/` or archive if needed for marketing materials.

## Empty / Placeholder Directories

- `migrations/`, `resources/` &rarr; No files inside (verified via
  `find migrations -maxdepth 1 -type f`). Remove or add a README if
  future population is expected.
- `tests/e2e`, `tests/integration`, `tests/unit` &rarr; Empty shells with
  no Jest/Playwright suites. Either delete or document intended use; the
  roadmap doesn’t include concrete suites yet.

## Legacy Fixtures / Scripts

- `tests/fixtures/manual-e2e/**`, `tests/fixtures/test-reports/**`,
  `tests/fixtures/real-meetings.json` &rarr; Only referenced by archived
  scripts such as `scripts/archive/test-full-pipeline.ts` and
  `scripts/archive/generate-report-from-json.js`. Since `npm run
  test:e2e` points to a non-existent `scripts/test-full-pipeline.ts`,
  these heavy JSON/DOCX fixtures are effectively unused. Consider moving
  them under `docs/archive/` or pruning entirely.

## Miscellaneous

- Remove builder debug output from `out/` (`builder-debug.yml`,
  notarized artifacts) – reproducible via `electron-builder`.
- Generated summaries and AI dumps inside `output/` should be removed
  after extracting any useful content; `.gitignore` already excludes the
  folder, so new runs won’t reintroduce them once cleaned.

> Recommendation: delete the listed artifacts, add gitignore entries for
> Python envs if missing, deduplicate the logo asset, and relocate any
> long-term reference material to `docs/archive/` to keep the working
> tree focused on source.
