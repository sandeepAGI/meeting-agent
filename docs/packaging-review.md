# Packaging Safety Review - Meeting Agent

**Review Date**: January 5, 2026
**Reviewer**: Claude Code (Thorough Analysis)
**Status**: ⚠️ **NEEDS FIXES BEFORE PACKAGING**

## Executive Summary

Your user data (database, settings, API keys) is **100% SAFE** and will NOT be overwritten by packaging. However, there are **CRITICAL PATH ISSUES** that will prevent the packaged app from working correctly. These must be fixed before running `npm run package:mac`.

---

## ✅ SAFE: User Data Protection

### Database Location
- **Current**: `~/Library/Application Support/meeting-agent/meeting-agent.db`
- **Source**: `src/services/database.ts:41`
- **Status**: ✅ SAFE - Uses `app.getPath('userData')`
- **Verification**: Database is stored in user data directory, NOT in app bundle
- **Packaging Impact**: None - packaged app will use the SAME database file

```typescript
// Line 41 in database.ts
this.dbPath = path.join(app.getPath('userData'), 'meeting-agent.db')
```

### Settings & API Keys
- **Settings File**: `~/Library/Application Support/meeting-agent/settings.json`
- **API Keys**: macOS Keychain (service: 'meeting-agent')
  - Anthropic API Key
  - HuggingFace Token
- **Source**: `src/services/settings.ts:28-29`
- **Status**: ✅ SAFE - Uses `app.getPath('userData')` and system keychain
- **Packaging Impact**: None - packaged app will use the SAME settings and keys

```typescript
// Settings location
const userDataPath = app.getPath('userData')
return path.join(userDataPath, 'settings.json')

// Keys in macOS Keychain
const KEYCHAIN_SERVICE = 'meeting-agent'
```

### Recordings
- **Location**: `~/Library/Application Support/meeting-agent/recordings/`
- **Source**: `src/main/index.ts:139, 166, 193`
- **Status**: ✅ SAFE - Uses `app.getPath('userData')`
- **Packaging Impact**: None - recordings preserved

### What Gets Excluded from Package
The `electron-builder.yml` only includes:
```yaml
files:
  - dist/**/*      # Compiled JavaScript only
  - package.json   # Dependencies list
```

Explicitly EXCLUDED (via .gitignore):
- ✅ `*.db` files (line 35-37)
- ✅ `.env` files (line 18-20)
- ✅ `recordings/` and `*.wav` (line 45-49)
- ✅ `data/` directory (*.db pattern)
- ✅ `out/` build output (line 10)

**Result**: Zero user data will be packaged into the app bundle.

---

## ⚠️ CRITICAL: Path Resolution Issues

These issues will cause the packaged app to **FAIL AT RUNTIME** because the paths point to development directories that won't exist in the packaged app.

### Issue 1: Diarization Service - Python Paths

**File**: `src/services/diarization.ts:20-21`

```typescript
// ❌ PROBLEM: Uses process.cwd() which is dev directory
this.pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3')
this.scriptPath = path.join(process.cwd(), 'scripts', 'diarize_audio.py')
```

**Why it breaks**:
- Development: `process.cwd()` = `/Users/sandeepmangaraj/myworkspace/Utilities/meeting-agent/`
- Packaged: `process.cwd()` = `/Applications/Meeting Agent.app/Contents/MacOS/` (or user's home)
- Result: `venv/` and `scripts/` won't exist → diarization fails

**Impact**: Speaker diarization completely broken in packaged app

### Issue 2: Transcription Service - Whisper Model Paths

**File**: `src/services/transcription.ts:27`

```typescript
// ❌ PROBLEM: Uses process.cwd() for models
this.modelPath = path.join(process.cwd(), 'models', `ggml-${this.modelName}.bin`)
```

**Why it breaks**:
- Development: Model at `/path/to/project/models/ggml-base.bin` (141MB)
- Packaged: `process.cwd()/models/` won't exist
- Result: Transcription fails immediately

**Impact**: Transcription completely broken in packaged app

---

## 🔧 Required Fixes

### Fix 1: Bundle Python Script

**Update** `electron-builder.yml`:
```yaml
files:
  - dist/**/*
  - package.json
  - scripts/diarize_audio.py  # Add this
```

**Update** `src/services/diarization.ts`:
```typescript
import { app } from 'electron'

constructor() {
  // Use bundled script
  const isDev = !app.isPackaged
  const scriptsPath = isDev
    ? path.join(process.cwd(), 'scripts')
    : path.join(process.resourcesPath, 'scripts')

  this.scriptPath = path.join(scriptsPath, 'diarize_audio.py')

  // Use system Python (not venv)
  this.pythonPath = 'python3'  // Assumes user has Python + pyannote installed
}
```

### Fix 2: Bundle or Download Whisper Models

**Option A: Bundle model (adds 141MB to app)**

Update `electron-builder.yml`:
```yaml
files:
  - dist/**/*
  - package.json
  - scripts/diarize_audio.py
  - models/**/*.bin  # Add this - WARNING: 141MB per model
```

Update `src/services/transcription.ts`:
```typescript
import { app } from 'electron'

constructor(modelName: TranscriptionModel = 'base') {
  const isDev = !app.isPackaged
  const modelsPath = isDev
    ? path.join(process.cwd(), 'models')
    : path.join(process.resourcesPath, 'models')

  this.modelPath = path.join(modelsPath, `ggml-${modelName}.bin`)
}
```

**Option B: Download on first run (better)**

Store models in userData:
```typescript
constructor(modelName: TranscriptionModel = 'base') {
  const modelsPath = path.join(app.getPath('userData'), 'models')
  this.modelPath = path.join(modelsPath, `ggml-${modelName}.bin`)

  // Check if model exists, download if not
  if (!fs.existsSync(this.modelPath)) {
    await this.downloadModel(modelName)
  }
}
```

### Fix 3: Python Environment

**Issue**: Packaged app won't have the `venv/` directory.

**Solution**: Require system Python installation
- User must install: `python3`, `torch`, `pyannote.audio`
- Document in README/installation instructions
- Check on first run and show error if missing

**Alternative**: Bundle Python (complex, adds ~500MB)

---

## 📋 Pre-Packaging Checklist

Before running `npm run package:mac`, complete these tasks:

### Critical (Must Fix)
- [ ] Update `electron-builder.yml` to include `scripts/diarize_audio.py`
- [ ] Fix `diarization.ts` to use `app.isPackaged` and `process.resourcesPath`
- [ ] Fix `transcription.ts` to use `app.isPackaged` and handle model paths
- [ ] Test with `process.env.NODE_ENV=production npm run build && npm run preview`
- [ ] Document Python/pyannote system requirements in README

### Recommended
- [ ] Add first-run check for Python dependencies
- [ ] Add model download on first run (or bundle in package)
- [ ] Add error messages if dependencies missing
- [ ] Test packaging in a clean environment (no project files)
- [ ] Create installation instructions

### Optional (Nice to Have)
- [ ] Add app icon (`resources/icon.icns`)
- [ ] Code signing with Apple Developer certificate
- [ ] Notarization for macOS Gatekeeper
- [ ] Auto-updater integration

---

## 🧪 Testing Strategy

### Phase 1: Build Simulation
```bash
# Test production build without packaging
NODE_ENV=production npm run build
npm run preview
```
Verify:
- Database loads from correct location
- Settings load correctly
- API keys accessible from keychain

### Phase 2: Package Locally
```bash
npm run package:mac
```
Result: Creates `out/Meeting Agent.app`

### Phase 3: Clean Environment Test
```bash
# Move app to another location
mv "out/Meeting Agent.app" ~/Desktop/

# Launch from Desktop
open ~/Desktop/Meeting\ Agent.app
```
Verify:
- App launches without errors
- Database created/loaded from ~/Library/Application Support/
- Transcription works (model found)
- Diarization works (Python script found)

---

## 📊 Packaging Impact Summary

| Component | Current Status | Packaging Impact | Action Required |
|-----------|---------------|------------------|-----------------|
| Database | ✅ Safe | None - uses userData | ✅ None |
| Settings | ✅ Safe | None - uses userData | ✅ None |
| API Keys | ✅ Safe | None - uses Keychain | ✅ None |
| Recordings | ✅ Safe | None - uses userData | ✅ None |
| Python Script | ⚠️ At Risk | Won't be found | ❌ Must fix paths |
| Whisper Models | ⚠️ At Risk | Won't be found | ❌ Must fix paths |
| Python Venv | ❌ Won't Work | Can't bundle | ❌ Require system Python |

---

## 💡 Recommended Approach

1. **Immediate** (Before any packaging):
   - Fix diarization.ts and transcription.ts path resolution
   - Update electron-builder.yml to include scripts/
   - Add environment detection (isDev vs isPackaged)

2. **Short-term** (First packaged release):
   - Bundle Python script and Whisper model (adds ~141MB)
   - Require system Python + pyannote (document in README)
   - Add first-run dependency check

3. **Long-term** (Future improvement):
   - Auto-download models on first run (store in userData)
   - Bundle Python with app (using PyInstaller or similar)
   - Add auto-updater for new models/dependencies

---

## 🎯 Bottom Line

### Your Data is Safe ✅
Your existing database, settings, API keys, and recordings will **NOT** be affected by packaging. The packaged app will use the **exact same files** in `~/Library/Application Support/meeting-agent/`.

### But the App Won't Work ❌
Without fixing the path issues, the packaged app will fail when trying to:
1. Transcribe audio (can't find Whisper model)
2. Diarize speakers (can't find Python script or venv)

### Before You Package
Complete the "Required Fixes" section above, then test with `npm run preview` in production mode.

---

**Generated**: 2026-01-05
**Reviewed by**: Claude Code
**Confidence**: High (based on code analysis and Electron best practices)
