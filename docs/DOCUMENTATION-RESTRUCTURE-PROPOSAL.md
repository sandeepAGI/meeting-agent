# Documentation Restructure Proposal

**Problem**: Documentation is too long, duplicative, and hard to navigate. Current roadmap.md is 1888 lines!

**Goal**: Make it easy to know (1) where we are, (2) what needs to be done, (3) what's next.

---

## Proposed New Structure

### 1. **roadmap.md** - SIMPLIFIED (Living Document)
**Purpose**: Quick reference - current status and what's next
**Max Length**: ~300 lines

**Sections**:
```markdown
# Meeting Agent - Development Roadmap

## 📍 Current Status
- Version: 0.6.2.5
- Phase: 6 (Settings) - Batch 1 Complete, Batches 2-6 Pending
- Production Ready: YES
- Last Updated: 2026-01-05

## 🎯 Next Up: Phase 7 - Storage Management
**Priority**: HIGH - User has retention settings configured but not enforced

Tasks:
- [ ] Transcript retention cleanup (30/60/90 days)
- [ ] Summary retention cleanup
- [ ] Audio storage quota enforcement
- [ ] Delete audio files after transcription (if disabled in settings)

Estimated: ~4 hours | See: docs/active/phase7-plan.md

## 🗺️ All Phases (Quick Reference)
✅ Phase 0: Foundation Setup
✅ Phase 1: Audio Capture + Transcription + Diarization
✅ Phase 2: M365 Integration (Auth + Calendar)
✅ Phase 2.3: LLM Intelligence (Batch API Summarization)
✅ Phase 4: Browse Mode + Branding
✅ Phase 5: Email Distribution
✅ Phase 5.5: Email Customization
⚠️ Phase 6: Settings UI (Batch 1 done, 2-6 pending)
⏳ Phase 7: Storage Management (NEXT)
📋 Phase 8: Performance Optimization
📋 Phase 9: Error Handling & Resilience
📋 Phase 10: Production Packaging & Distribution

## 📚 Completed Phases (Summary)

### Phase 6: Settings UI (Batch 1) ✅
**Completed**: Dec 4, 2025
**Summary**: Settings panel with 6 tabs, keychain integration, API keys fully wired
**Details**: docs/archive/phase6/

### Phase 5.5: Email Customization ✅
**Completed**: Oct 30, 2025
**Summary**: Section toggles, inline editing, custom intro, AI disclaimer
**Details**: docs/archive/phase5.5/

### Phase 5: Email Distribution ✅
**Completed**: Jan 27, 2025
**Summary**: One-click email via Microsoft Graph API, Aileron branding
**Details**: docs/archive/phase5/

[... other phases with one-line summaries ...]

## 📋 Backlog (Not Started)

### Phase 6 Completion (Batches 2-6)
- Wire remaining settings (threads, language, verbosity, etc.)
- Estimated: ~4 hours
- Priority: MEDIUM

### Phase 8: Performance Optimization
- Streaming transcription
- Parallel processing
- Priority: LOW

### Phase 9: Error Handling
- Retry mechanisms
- User-friendly errors
- Priority: MEDIUM

### Phase 10: Packaging
- Auto-updates
- Code signing
- Priority: HIGH (after Phase 7)

## 📖 Documentation Index
- Architecture: docs/developer/architecture.md
- User Guide: docs/guides/user-guide.md
- Technical Details: docs/technical/
- Active Work: docs/active/
- Archive: docs/archive/
```

**Benefits**:
- See current status in 5 seconds
- See what's next in 10 seconds
- All phases visible at a glance
- Details in archive, not cluttering main doc

---

### 2. **docs/active/** - Current Work (New Directory)
**Purpose**: Detailed plans for phases currently in progress

**Files**:
- `phase7-plan.md` - Detailed implementation plan for Phase 7
- `phase6-remaining.md` - Plan for finishing Phase 6 batches 2-6

**Lifecycle**:
1. Create detailed plan when starting a phase
2. Update as you work (checkboxes, notes)
3. When phase complete → move to `docs/archive/phaseX/`

**Example**: `docs/active/phase7-plan.md`
```markdown
# Phase 7: Storage Management - Implementation Plan

## Goal
Implement retention policies and storage quota management for recordings, transcripts, and summaries.

## Tasks

### 1. Transcript Retention Cleanup
- [ ] Create scheduled job that runs on startup
- [ ] Query database for transcripts older than retention days
- [ ] Delete matching records
- [ ] Handle retention = 0 (keep forever)
- Estimated: 1 hour

### 2. Summary Retention Cleanup
[...]

## Progress Log
- 2026-01-05: Started transcript retention implementation
- [...]

## Issues Encountered
- [log any blockers or bugs found]
```

**Benefits**:
- All active work in one place
- Can track progress without cluttering main roadmap
- Easy to find current plan
- Archive keeps history without bloat

---

### 3. **docs/archive/** - Completed Work (Restructured)

**Current**: Flat structure with mixed content
**Proposed**: Organized by phase

```
docs/archive/
├── phase0/
│   └── foundation-implementation.md
├── phase1/
│   ├── audio-capture-implementation.md
│   ├── transcription-implementation.md
│   └── diarization-implementation.md
├── phase2/
│   ├── m365-auth-implementation.md
│   ├── calendar-implementation.md
│   └── llm-intelligence-implementation.md
├── phase4/
│   ├── browse-mode-implementation.md
│   └── branding-implementation.md
├── phase5/
│   └── email-distribution-implementation.md
├── phase5.5/
│   ├── email-customization-implementation.md
│   ├── bug-report.md
│   └── code-review.md
├── phase6/
│   ├── settings-ui-implementation.md
│   ├── batch1-api-keys.md
│   ├── implementation-status.md
│   └── test-plan.md
├── packaging/
│   ├── packaging-implementation-plan.md
│   └── phase0-4-complete.md
└── investigations/
    ├── email-context-deprecation.md
    └── summary-persistence-bug.md
```

**Benefits**:
- Easy to find details about any completed phase
- Doesn't clutter main docs
- Preserves all historical information

---

### 4. **CLAUDE.md** - Simplified

**Remove**:
- Duplicate roadmap information (point to roadmap.md instead)
- Detailed phase completion history (keep only last 2-3)
- Long lists of "What Works Now" (summarize, link to roadmap)

**Keep**:
- Project overview and current version
- Critical development patterns (subprocess, IPC, testing protocol)
- Documentation update protocol
- Recent updates (last 2-3 phases only)

**Add**:
- Clear section: "Where to find things"
  - Current status? → roadmap.md
  - Current work? → docs/active/
  - How was X implemented? → docs/archive/phaseX/
  - Technical details? → docs/technical/

**Estimated reduction**: 600 lines → 300 lines

---

## Migration Plan

### Step 1: Archive Completed Phase Details
1. Create `docs/archive/phase6/` directory
2. Move `phase6-implementation-status.md` → `docs/archive/phase6/`
3. Move `phase6-actual-status.md` → `docs/archive/phase6/`
4. Move `phase6-test-plan.md` → `docs/archive/phase6/`
5. Move `packaging-implementation-plan.md` → `docs/archive/packaging/`

### Step 2: Create Active Work Directory
1. Create `docs/active/` directory
2. Create `docs/active/phase7-plan.md` with storage management tasks
3. Create `docs/active/phase6-remaining.md` with batches 2-6 tasks

### Step 3: Simplify roadmap.md
1. Backup current: `cp docs/planning/roadmap.md docs/archive/roadmap-full-history.md`
2. Rewrite roadmap.md with new structure (300 lines)
   - Current status at top
   - Next up (Phase 7) clearly visible
   - All phases quick reference
   - Completed phases: one-line summaries only
   - Link to archive for details

### Step 4: Simplify CLAUDE.md
1. Remove duplicate phase details
2. Point to roadmap.md for status
3. Keep only critical patterns and last 2-3 updates
4. Add "Where to find things" section

### Step 5: Clean Up
1. Remove duplicate/outdated docs from planning/testing
2. Move to archive or delete

---

## Expected Outcome

**Before**:
- "Where are we?" → Read 1888 lines of roadmap.md
- "What's next?" → Not clear, scattered across multiple docs
- "What needs to be done?" → Buried in phase details
- "How was X implemented?" → Search through multiple files

**After**:
- "Where are we?" → See top of roadmap.md (30 seconds)
- "What's next?" → Clearly stated at top with link to plan (10 seconds)
- "What needs to be done?" → Check docs/active/ (1 minute)
- "How was X implemented?" → Go to docs/archive/phaseX/ (1 minute)

**Documentation sizes**:
- roadmap.md: 1888 lines → ~300 lines
- CLAUDE.md: ~600 lines → ~300 lines
- Active work: New `docs/active/` directory
- Historical details: Organized in `docs/archive/`

---

## Recommendation

**Start with**:
1. Create the simplified roadmap.md (highest impact)
2. Create docs/active/phase7-plan.md (what we need to work on next)
3. Archive Phase 6 documents

**Then**:
4. Simplify CLAUDE.md
5. Reorganize docs/archive/

**Benefit**: Immediate clarity on where we are and what's next, foundation for better organization going forward.

---

## Questions for You

1. Does this structure make sense?
2. Any sections missing from the new roadmap.md?
3. Should we keep any current roadmap.md details that I'm proposing to remove?
4. Want me to create the simplified roadmap.md as a draft for your review?
