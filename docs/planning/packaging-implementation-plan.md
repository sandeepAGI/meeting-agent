# Packaging Implementation Plan - TDD Approach

**Version**: 1.0
**Created**: 2026-01-05
**Status**: Ready for Implementation
**Approach**: Test-Driven Development (Red-Green-Refactor)

---

## Executive Summary

This plan implements production-ready packaging for Meeting Agent using TDD methodology. It addresses critical path resolution issues and implements smart model management with download-on-demand.

**Timeline**: 2-3 days (8-12 hours active work)
**Risk Level**: Medium (mitigated by TDD + incremental deployment)
**Breaking Changes**: None (backwards compatible)

---

## Prerequisites & Decisions

Based on user input:

- ✅ **Python**: Require system installation (documented in README)
- ✅ **Model Source**: Official Hugging Face repository
- ✅ **Offline Behavior**: Show error, require internet for first run
- ✅ **Models Supported**: base (141MB) - current default
- ✅ **Testing**: Full TDD approach with unit + integration tests

---

## Table of Contents

1. [Phase 0: Preparation & Backup](#phase-0-preparation--backup)
2. [Phase 1: Path Resolution Fixes](#phase-1-path-resolution-fixes)
3. [Phase 2: Model Download System](#phase-2-model-download-system)
4. [Phase 3: Integration Testing](#phase-3-integration-testing)
5. [Phase 4: Production Packaging](#phase-4-production-packaging)
6. [Rollback Procedures](#rollback-procedures)
7. [Validation Checklist](#validation-checklist)

---

## Phase 0: Preparation & Backup

**Duration**: 15 minutes
**Goal**: Ensure safe experimentation with full rollback capability

### 0.1 Create Safety Branch

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/packaging-production-ready

# Verify clean state
git status
```

**Validation**: ✅ On feature branch, no uncommitted changes

### 0.2 Backup Current Database

```bash
# Backup production database
cp ~/Library/Application\ Support/meeting-agent/meeting-agent.db \
   ~/Library/Application\ Support/meeting-agent/meeting-agent.db.backup-$(date +%Y%m%d)

# Backup settings
cp ~/Library/Application\ Support/meeting-agent/settings.json \
   ~/Library/Application\ Support/meeting-agent/settings.json.backup-$(date +%Y%m%d) 2>/dev/null || true

# Verify backups
ls -lh ~/Library/Application\ Support/meeting-agent/*.backup*
```

**Validation**: ✅ Backup files exist with today's date

### 0.3 Document Current State

```bash
# Capture current model location
ls -lh models/

# Capture current settings
cat ~/Library/Application\ Support/meeting-agent/settings.json 2>/dev/null || echo "No settings yet"

# Test current app works
npm run dev
# Verify: App launches, transcription works, diarization works
```

**Validation**: ✅ Current app fully functional

---

## Phase 1: Path Resolution Fixes

**Duration**: 2-3 hours
**Goal**: Fix critical path issues for diarization and transcription
**Approach**: TDD - Write tests first, then fix code

### 1.1 Setup Test Infrastructure

**Test File**: `src/services/__tests__/pathResolution.test.ts`

```typescript
/**
 * Path Resolution Tests
 * Ensures services find resources in both dev and packaged environments
 */

import { DiarizationService } from '../diarization'
import { TranscriptionService } from '../transcription'
import * as path from 'path'
import * as fs from 'fs'

// Mock electron app
jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: (name: string) => {
      if (name === 'userData') return '/tmp/test-userdata'
      if (name === 'resources') return '/tmp/test-resources'
      return '/tmp'
    }
  }
}))

describe('Path Resolution - Development Mode', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development'
  })

  test('DiarizationService finds Python script in development', () => {
    const service = new DiarizationService()
    const scriptPath = service['scriptPath']

    // Should point to project scripts directory
    expect(scriptPath).toContain('scripts/diarize_audio.py')
    expect(fs.existsSync(scriptPath)).toBe(true)
  })

  test('TranscriptionService uses userData for models in development', () => {
    const service = new TranscriptionService()
    const modelPath = service['modelPath']

    // Should point to userData/models directory
    expect(modelPath).toContain('userData')
    expect(modelPath).toContain('models')
    expect(modelPath).toContain('ggml-base.bin')
  })
})

describe('Path Resolution - Packaged Mode', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production'
    // Mock app.isPackaged = true
    jest.mock('electron', () => ({
      app: {
        isPackaged: true,
        getPath: (name: string) => {
          if (name === 'userData') return '/tmp/test-userdata'
          return '/Applications/Meeting Agent.app/Contents/Resources'
        }
      }
    }))
  })

  test('DiarizationService finds bundled Python script when packaged', () => {
    const service = new DiarizationService()
    const scriptPath = service['scriptPath']

    // Should point to app resources
    expect(scriptPath).toContain('Resources/scripts/diarize_audio.py')
  })

  test('TranscriptionService uses userData for models when packaged', () => {
    const service = new TranscriptionService()
    const modelPath = service['modelPath']

    // Should still use userData (not bundled)
    expect(modelPath).toContain('userData')
    expect(modelPath).not.toContain('Resources')
  })
})
```

**Action**: Create this test file

```bash
mkdir -p src/services/__tests__
# Create pathResolution.test.ts with content above
```

**Expected Result**: ❌ Tests fail (RED phase)

### 1.2 Fix DiarizationService Paths

**File**: `src/services/diarization.ts`

**Current Code** (lines 18-21):

```typescript
constructor() {
  // Use virtual environment Python
  this.pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3')
  this.scriptPath = path.join(process.cwd(), 'scripts', 'diarize_audio.py')

  // Get Hugging Face token from environment (fallback)
  this.hfToken = process.env.HUGGINGFACE_TOKEN
}
```

**New Code**:

```typescript
import { app } from 'electron'

constructor() {
  // Determine if running in development or production
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    // Development: Use project scripts directory
    this.scriptPath = path.join(process.cwd(), 'scripts', 'diarize_audio.py')
  } else {
    // Production: Use bundled script in app resources
    this.scriptPath = path.join(process.resourcesPath, 'scripts', 'diarize_audio.py')
  }

  // Use system Python (user must have it installed)
  // This works in both dev and production
  this.pythonPath = 'python3'

  // Get Hugging Face token from environment (fallback)
  this.hfToken = process.env.HUGGINGFACE_TOKEN

  console.log('[Diarization] Script path:', this.scriptPath)
  console.log('[Diarization] Python path:', this.pythonPath)
}
```

**Run Tests**:

```bash
npm run test -- pathResolution.test.ts
```

**Expected Result**: ✅ Diarization tests pass (GREEN phase)

### 1.3 Fix TranscriptionService Paths

**File**: `src/services/transcription.ts`

**Current Code** (line 27):

```typescript
constructor(options: { model?: string; whisperPath?: string; threads?: number } = {}) {
  // Default to base model in project directory
  this.modelName = options.model || 'base'
  this.modelPath = path.join(process.cwd(), 'models', `ggml-${this.modelName}.bin`)

  // whisper-cli should be in PATH (installed via Homebrew) or custom path
  this.whisperCliPath = options.whisperPath || 'whisper-cli'
  this.threads = options.threads || 0 // Auto-detect
}
```

**New Code**:

```typescript
import { app } from 'electron'

constructor(options: { model?: string; whisperPath?: string; threads?: number } = {}) {
  // Default to base model
  this.modelName = options.model || 'base'

  // ALWAYS use userData for models (in both dev and production)
  // This allows downloading models on first run
  const modelsPath = path.join(app.getPath('userData'), 'models')
  this.modelPath = path.join(modelsPath, `ggml-${this.modelName}.bin`)

  // Ensure models directory exists
  if (!fs.existsSync(modelsPath)) {
    fs.mkdirSync(modelsPath, { recursive: true })
  }

  // whisper-cli should be in PATH (installed via Homebrew) or custom path
  this.whisperCliPath = options.whisperPath || 'whisper-cli'
  this.threads = options.threads || 0 // Auto-detect

  console.log('[Transcription] Model path:', this.modelPath)
}
```

**Migration for Existing Users**:

Add migration code to copy existing model:

```typescript
/**
 * Migrate existing model from project directory to userData
 * Called on first run after upgrade
 */
private async migrateExistingModel(): Promise<void> {
  const oldPath = path.join(process.cwd(), 'models', `ggml-${this.modelName}.bin`)

  // If model exists in old location and not in new location
  if (fs.existsSync(oldPath) && !fs.existsSync(this.modelPath)) {
    console.log('[Transcription] Migrating model to userData...')
    fs.copyFileSync(oldPath, this.modelPath)
    console.log('[Transcription] Migration complete')
  }
}
```

Call in `initialize()`:

```typescript
async initialize(modelName?: string): Promise<void> {
  // ... existing code ...

  // Migrate existing model if needed
  await this.migrateExistingModel()

  // ... rest of initialization ...
}
```

**Run Tests**:

```bash
npm run test -- pathResolution.test.ts
```

**Expected Result**: ✅ All path resolution tests pass (GREEN phase)

### 1.4 Update electron-builder.yml

**File**: `electron-builder.yml`

**Current**:

```yaml
files:
  - dist/**/*
  - package.json
```

**New**:

```yaml
files:
  - dist/**/*
  - package.json
  - scripts/diarize_audio.py  # Bundle Python script

# Explicitly exclude data files
asarUnpack:
  - scripts/**/*

# Don't bundle these (userData content)
files:
  - "!models/**/*"      # Models downloaded on first run
  - "!venv/**/*"        # No Python venv
  - "!data/**/*"        # No database files
  - "!recordings/**/*"  # No audio files
```

**Validation**:

```bash
# Check config is valid
npm run build
```

**Expected**: ✅ Build succeeds, no errors

### 1.5 Phase 1 Manual Testing

**Test in Development Mode**:

```bash
# Start app
npm run dev

# Verify:
# 1. App launches without errors
# 2. Transcription works (finds model in userData)
# 3. Diarization works (finds Python script)
# 4. Check console logs show correct paths
```

**Validation Checklist**:

- [ ] App launches successfully
- [ ] Console shows: `[Transcription] Model path: ~/Library/Application Support/meeting-agent/models/ggml-base.bin`
- [ ] Console shows: `[Diarization] Script path: /path/to/project/scripts/diarize_audio.py`
- [ ] Transcription works (test with a recording)
- [ ] Diarization works (test with a recording)

**If any fail**: Rollback to main branch, review errors

---

## Phase 2: Model Download System

**Duration**: 4-5 hours
**Goal**: Implement smart model download with progress tracking
**Approach**: TDD - Write tests for download manager first

**Progress**:
- ✅ Step 2.1: Create ModelManager tests (2026-01-05)
- ✅ Step 2.2: Implement ModelManager service (2026-01-05)
- ✅ Step 2.3: Integrate with TranscriptionService (2026-01-05)
- ✅ Step 2.4: Add IPC handlers for UI (2026-01-05)
- ⏸️ Step 2.5: Manual testing (pending)

### 2.1 Create ModelManager Service (TDD)

**Test File**: `src/services/__tests__/modelManager.test.ts`

```typescript
/**
 * Model Manager Tests
 * Tests model downloading, validation, and caching
 */

import { ModelManager } from '../modelManager'
import * as fs from 'fs'
import * as path from 'path'

describe('ModelManager', () => {
  let manager: ModelManager
  let testModelPath: string

  beforeEach(() => {
    manager = new ModelManager()
    testModelPath = path.join('/tmp/test-models', 'ggml-base.bin')
  })

  afterEach(() => {
    // Cleanup test files
    if (fs.existsSync(testModelPath)) {
      fs.unlinkSync(testModelPath)
    }
  })

  describe('Model Availability', () => {
    test('isModelAvailable returns false for missing model', async () => {
      const available = await manager.isModelAvailable('base')
      expect(available).toBe(false)
    })

    test('isModelAvailable returns true for existing model', async () => {
      // Create dummy model file
      fs.writeFileSync(testModelPath, 'dummy model data')

      const available = await manager.isModelAvailable('base')
      expect(available).toBe(true)
    })
  })

  describe('Model Download', () => {
    test('downloadModel downloads from HuggingFace', async () => {
      const progressUpdates: number[] = []

      await manager.downloadModel('base', (progress) => {
        progressUpdates.push(progress)
      })

      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100)
      expect(fs.existsSync(testModelPath)).toBe(true)
    })

    test('downloadModel validates model after download', async () => {
      await manager.downloadModel('base')

      const isValid = await manager.validateModel('base')
      expect(isValid).toBe(true)
    })

    test('downloadModel throws on network error', async () => {
      // Mock network failure
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      await expect(manager.downloadModel('base')).rejects.toThrow('Network error')
    })
  })

  describe('Model Validation', () => {
    test('validateModel checks file size', async () => {
      // Create small dummy file (invalid)
      fs.writeFileSync(testModelPath, 'too small')

      const isValid = await manager.validateModel('base')
      expect(isValid).toBe(false)
    })

    test('validateModel checks file exists', async () => {
      const isValid = await manager.validateModel('nonexistent')
      expect(isValid).toBe(false)
    })
  })
})
```

**Run Tests**:

```bash
npm run test -- modelManager.test.ts
```

**Expected Result**: ❌ Tests fail - ModelManager doesn't exist yet (RED)

### 2.2 Implement ModelManager Service

**File**: `src/services/modelManager.ts`

```typescript
/**
 * ModelManager - Smart model download and validation
 * Phase: Packaging Production Ready
 *
 * Responsibilities:
 * - Download Whisper models from HuggingFace on demand
 * - Validate model integrity
 * - Track download progress
 * - Cache models in userData
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as https from 'https'

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large'

export interface ModelInfo {
  name: WhisperModel
  size: number // bytes
  url: string
  sha256?: string // Optional checksum for validation
}

// HuggingFace repository URLs for whisper.cpp GGML models
const MODEL_REPO = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

const MODELS: Record<WhisperModel, ModelInfo> = {
  tiny: {
    name: 'tiny',
    size: 75 * 1024 * 1024, // 75MB
    url: `${MODEL_REPO}/ggml-tiny.bin`
  },
  base: {
    name: 'base',
    size: 141 * 1024 * 1024, // 141MB
    url: `${MODEL_REPO}/ggml-base.bin`
  },
  small: {
    name: 'small',
    size: 466 * 1024 * 1024, // 466MB
    url: `${MODEL_REPO}/ggml-small.bin`
  },
  medium: {
    name: 'medium',
    size: 1500 * 1024 * 1024, // 1.5GB
    url: `${MODEL_REPO}/ggml-medium.bin`
  },
  large: {
    name: 'large',
    size: 2900 * 1024 * 1024, // 2.9GB
    url: `${MODEL_REPO}/ggml-large.bin`
  }
}

export type DownloadProgress = {
  bytesDownloaded: number
  totalBytes: number
  percentage: number
  speed: number // bytes per second
}

export class ModelManager {
  private modelsPath: string

  constructor() {
    this.modelsPath = path.join(app.getPath('userData'), 'models')
    this.ensureModelsDirectory()
  }

  /**
   * Ensure models directory exists
   */
  private ensureModelsDirectory(): void {
    if (!fs.existsSync(this.modelsPath)) {
      fs.mkdirSync(this.modelsPath, { recursive: true })
      console.log('[ModelManager] Created models directory:', this.modelsPath)
    }
  }

  /**
   * Get path for a specific model
   */
  getModelPath(modelName: WhisperModel): string {
    return path.join(this.modelsPath, `ggml-${modelName}.bin`)
  }

  /**
   * Check if a model is available locally
   */
  async isModelAvailable(modelName: WhisperModel): Promise<boolean> {
    const modelPath = this.getModelPath(modelName)

    if (!fs.existsSync(modelPath)) {
      return false
    }

    // Validate file size is reasonable (not corrupted/incomplete)
    const stats = fs.statSync(modelPath)
    const expectedSize = MODELS[modelName].size
    const minSize = expectedSize * 0.9 // Allow 10% variance

    return stats.size >= minSize
  }

  /**
   * Download a model from HuggingFace
   * @param modelName Model to download
   * @param onProgress Progress callback (optional)
   */
  async downloadModel(
    modelName: WhisperModel,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<void> {
    const modelInfo = MODELS[modelName]
    const modelPath = this.getModelPath(modelName)
    const tempPath = `${modelPath}.download`

    console.log(`[ModelManager] Downloading ${modelName} model from ${modelInfo.url}`)

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tempPath)
      let downloadedBytes = 0
      const startTime = Date.now()

      https.get(modelInfo.url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${response.statusCode}`))
          return
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length

          if (onProgress) {
            const elapsedSeconds = (Date.now() - startTime) / 1000
            const speed = downloadedBytes / elapsedSeconds

            onProgress({
              bytesDownloaded: downloadedBytes,
              totalBytes,
              percentage: Math.round((downloadedBytes / totalBytes) * 100),
              speed
            })
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()

          // Move temp file to final location
          fs.renameSync(tempPath, modelPath)

          console.log(`[ModelManager] Download complete: ${modelPath}`)
          resolve()
        })

        file.on('error', (err) => {
          fs.unlinkSync(tempPath)
          reject(err)
        })

        response.on('error', (err) => {
          fs.unlinkSync(tempPath)
          reject(err)
        })
      }).on('error', (err) => {
        reject(err)
      })
    })
  }

  /**
   * Validate a downloaded model
   */
  async validateModel(modelName: WhisperModel): Promise<boolean> {
    const modelPath = this.getModelPath(modelName)

    // Check file exists
    if (!fs.existsSync(modelPath)) {
      return false
    }

    // Check file size is reasonable
    const stats = fs.statSync(modelPath)
    const expectedSize = MODELS[modelName].size
    const minSize = expectedSize * 0.9 // Allow 10% variance
    const maxSize = expectedSize * 1.1

    if (stats.size < minSize || stats.size > maxSize) {
      console.warn(`[ModelManager] Model size mismatch: expected ~${expectedSize}, got ${stats.size}`)
      return false
    }

    // TODO: Add SHA256 checksum validation if needed

    return true
  }

  /**
   * Delete a model from disk
   */
  async deleteModel(modelName: WhisperModel): Promise<void> {
    const modelPath = this.getModelPath(modelName)

    if (fs.existsSync(modelPath)) {
      fs.unlinkSync(modelPath)
      console.log(`[ModelManager] Deleted model: ${modelPath}`)
    }
  }

  /**
   * List all available models (downloaded locally)
   */
  async listAvailableModels(): Promise<WhisperModel[]> {
    const available: WhisperModel[] = []

    for (const modelName of Object.keys(MODELS) as WhisperModel[]) {
      if (await this.isModelAvailable(modelName)) {
        available.push(modelName)
      }
    }

    return available
  }

  /**
   * Get model info
   */
  getModelInfo(modelName: WhisperModel): ModelInfo {
    return MODELS[modelName]
  }
}
```

**Run Tests**:

```bash
npm run test -- modelManager.test.ts
```

**Expected Result**: ✅ All tests pass (GREEN phase)

### 2.3 Integrate ModelManager with TranscriptionService

**File**: `src/services/transcription.ts`

Add model management to transcription service:

```typescript
import { ModelManager } from './modelManager'

export class TranscriptionService {
  private modelManager: ModelManager

  constructor(options: { model?: string; whisperPath?: string; threads?: number } = {}) {
    this.modelManager = new ModelManager()

    // ... existing constructor code ...
  }

  /**
   * Initialize transcription service
   * Downloads model if not available
   */
  async initialize(modelName?: string): Promise<void> {
    if (this.isInitialized) {
      console.log('Whisper model already initialized')
      return
    }

    // Use provided model name or fall back to constructor value
    if (modelName) {
      this.modelName = modelName
      this.modelPath = this.modelManager.getModelPath(modelName)
    }

    // Check if model is available
    const modelAvailable = await this.modelManager.isModelAvailable(this.modelName)

    if (!modelAvailable) {
      console.log(`[Transcription] Model ${this.modelName} not found, downloading...`)

      // Download model with progress tracking
      await this.modelManager.downloadModel(this.modelName, (progress) => {
        console.log(`[Transcription] Download progress: ${progress.percentage}% (${this.formatBytes(progress.speed)}/s)`)
      })

      console.log(`[Transcription] Model ${this.modelName} downloaded successfully`)
    }

    // Validate model
    const isValid = await this.modelManager.validateModel(this.modelName)
    if (!isValid) {
      throw new Error(`Model ${this.modelName} validation failed`)
    }

    // Verify whisper-cli is available
    await this.verifyWhisperCli()

    this.isInitialized = true
    console.log(`Transcription service initialized with model: ${this.modelName}`)
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}
```

### 2.4 Add IPC Handlers for Model Download Progress

**File**: `src/main/index.ts`

Add handlers for UI to track download progress:

```typescript
import { ModelManager } from '../services/modelManager'

// Initialize model manager
const modelManager = new ModelManager()

// Check if model is available
ipcMain.handle('model-is-available', async (_event, modelName: string) => {
  try {
    const available = await modelManager.isModelAvailable(modelName)
    return { success: true, available }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// Download model with progress
ipcMain.handle('model-download', async (event, modelName: string) => {
  try {
    await modelManager.downloadModel(modelName, (progress) => {
      // Send progress to renderer
      event.sender.send('model-download-progress', progress)
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// List available models
ipcMain.handle('model-list-available', async () => {
  try {
    const models = await modelManager.listAvailableModels()
    return { success: true, models }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})
```

**File**: `src/preload/index.ts`

Expose to renderer:

```typescript
const electronAPI = {
  // ... existing APIs ...

  // Model management
  modelIsAvailable: (modelName: string) => ipcRenderer.invoke('model-is-available', modelName),
  modelDownload: (modelName: string) => ipcRenderer.invoke('model-download', modelName),
  modelListAvailable: () => ipcRenderer.invoke('model-list-available'),
  onModelDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('model-download-progress', (_event, progress) => callback(progress))
  }
}
```

**✅ COMPLETED** (2026-01-05):
- Added 5 IPC handlers to `src/main/index.ts`:
  - `model-is-available` - Check if model is downloaded
  - `model-download` - Download model with progress tracking
  - `model-list-available` - List all downloaded models
  - `model-get-info` - Get model metadata (size, URL)
  - `model-delete` - Delete a model from disk
- Exposed handlers in `src/preload/index.ts` under `electronAPI.modelManager`
- Added progress callback with `onDownloadProgress` event listener
- Type-check passes ✅
- Build passes ✅

### 2.5 Phase 2 Manual Testing

**Test Model Download**:

```bash
# Delete existing model to test download
rm ~/Library/Application\ Support/meeting-agent/models/ggml-base.bin

# Start app
npm run dev

# Attempt to transcribe a recording
# Expected: Model downloads automatically with progress
```

**Validation Checklist**:

- [ ] App detects missing model
- [ ] Download starts automatically
- [ ] Progress is logged to console
- [ ] Download completes successfully
- [ ] Model is validated
- [ ] Transcription works after download
- [ ] Model persists across app restarts

**If any fail**: Review logs, fix issues, re-test

---

## Phase 3: Integration Testing

**Duration**: 2-3 hours
**Goal**: Test complete workflow in production-like environment

### 3.1 Test Production Build

**Build in Production Mode**:

```bash
# Clean build
rm -rf dist/
NODE_ENV=production npm run build

# Preview production build (not packaged, but uses production paths)
npm run preview
```

**Validation**:

- [ ] App launches without errors
- [ ] Paths resolve correctly (check console logs)
- [ ] Transcription works
- [ ] Diarization works
- [ ] Settings persist correctly
- [ ] Database loads from userData

### 3.2 Create Integration Test

**File**: `scripts/test-packaging.ts`

```typescript
/**
 * Integration test for packaging readiness
 * Simulates packaged app environment
 */

import { ModelManager } from '../src/services/modelManager'
import { TranscriptionService } from '../src/services/transcription'
import { DiarizationService } from '../src/services/diarization'
import * as fs from 'fs'

async function testPackagingReadiness() {
  console.log('🧪 Testing Packaging Readiness...\n')

  // Test 1: Model Manager
  console.log('1️⃣ Testing Model Manager...')
  const modelManager = new ModelManager()

  const baseAvailable = await modelManager.isModelAvailable('base')
  console.log(`   ✓ Base model available: ${baseAvailable}`)

  if (!baseAvailable) {
    console.log('   ⏳ Downloading base model...')
    await modelManager.downloadModel('base', (progress) => {
      if (progress.percentage % 10 === 0) {
        console.log(`   📥 Download: ${progress.percentage}%`)
      }
    })
    console.log('   ✓ Model downloaded')
  }

  // Test 2: Transcription Service
  console.log('\n2️⃣ Testing Transcription Service...')
  const transcription = new TranscriptionService()
  await transcription.initialize()
  console.log('   ✓ Transcription service initialized')

  // Test 3: Diarization Service
  console.log('\n3️⃣ Testing Diarization Service...')
  const diarization = new DiarizationService()
  const scriptExists = fs.existsSync(diarization['scriptPath'])
  console.log(`   ✓ Diarization script exists: ${scriptExists}`)

  // Test 4: Paths
  console.log('\n4️⃣ Testing Path Resolution...')
  console.log(`   Model path: ${modelManager.getModelPath('base')}`)
  console.log(`   Script path: ${diarization['scriptPath']}`)

  console.log('\n✅ All packaging readiness tests passed!\n')
}

testPackagingReadiness().catch((error) => {
  console.error('\n❌ Packaging readiness test failed:', error)
  process.exit(1)
})
```

**Run Integration Test**:

```bash
npx tsx scripts/test-packaging.ts
```

**Expected**: ✅ All tests pass

### 3.3 Test Actual Package

**Create Package**:

```bash
# Build and package
npm run package:mac
```

**Expected Output**:

```
out/
  Meeting Agent.app
  Meeting Agent.dmg
```

**Test Packaged App**:

```bash
# Move app to clean location
cp -r "out/Meeting Agent.app" ~/Desktop/

# Launch from Desktop
open ~/Desktop/Meeting\ Agent.app

# Monitor logs
tail -f ~/Library/Logs/Meeting\ Agent/main.log
```

**Validation Checklist**:

- [ ] App launches without errors
- [ ] No "module not found" errors in logs
- [ ] Paths resolve correctly (userData, not project directory)
- [ ] Model downloads on first transcription
- [ ] Diarization script found
- [ ] Settings load correctly
- [ ] Database persists across restarts
- [ ] All features work as in development

**If any fail**: Review logs, fix code, rebuild, re-test

---

## Phase 4: Production Packaging

**Duration**: 1 hour
**Goal**: Create production-ready distributable

### 4.1 Final Cleanup

```bash
# Clean all build artifacts
rm -rf dist/ out/

# Run full test suite
npm run test

# Type check
npm run type-check

# Lint
npm run lint
```

**Validation**: ✅ All checks pass

### 4.2 Update Documentation

**File**: `README.md`

Add section:

```markdown
## Installation

### Requirements

**System Requirements**:
- macOS 12.3 or later
- Python 3.9+ with pyannote.audio (`pip install pyannote.audio torch`)
- whisper-cli (`brew install whisper-cpp`)
- 2GB free disk space (for models)

### First Run

On first launch, Meeting Agent will automatically:
1. Create database in `~/Library/Application Support/meeting-agent/`
2. Download Whisper base model (141MB) - requires internet
3. Check for Python and pyannote.audio dependencies

If dependencies are missing, you'll see setup instructions.
```

### 4.3 Create Distribution Package

```bash
# Final production package
npm run package:mac

# Verify output
ls -lh out/
```

**Expected**:

- ✅ `Meeting Agent.app` (~150MB)
- ✅ `Meeting Agent.dmg` (~155MB)
- ✅ No bundled models (downloaded on first run)
- ✅ Python script bundled in app

### 4.4 Code Signing (Optional)

If you have Apple Developer certificate:

```bash
# Sign the app
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" "out/Meeting Agent.app"

# Verify signature
codesign --verify --deep --strict --verbose=2 "out/Meeting Agent.app"
```

### 4.5 Final Distribution Test

```bash
# Test on clean macOS (no project files)
# 1. Copy DMG to different machine
# 2. Install from DMG
# 3. Launch app
# 4. Verify all features work
```

---

## Rollback Procedures

### If Phase 1 Fails

```bash
# Rollback to main branch
git checkout main
git branch -D feature/packaging-production-ready

# Restore backups
cp ~/Library/Application\ Support/meeting-agent/meeting-agent.db.backup-* \
   ~/Library/Application\ Support/meeting-agent/meeting-agent.db
```

### If Phase 2 Fails

```bash
# Keep Phase 1 changes, revert Phase 2
git revert <phase-2-commit-hash>

# Or reset to Phase 1 completion
git reset --hard <phase-1-commit-hash>
```

### If Packaging Fails

```bash
# Keep development working
# Fix packaging issues incrementally
# Don't merge until packaging works
```

---

## Validation Checklist

### Pre-Merge Checklist

Before merging to main:

- [ ] All unit tests pass (`npm run test`)
- [ ] All integration tests pass (`npx tsx scripts/test-packaging.ts`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Development mode works (`npm run dev`)
- [ ] Production build works (`npm run build && npm run preview`)
- [ ] Packaged app works (`npm run package:mac` then test .app)
- [ ] Documentation updated (README.md)
- [ ] No regressions in existing features
- [ ] Database migrations work correctly
- [ ] Settings persist correctly

### Post-Merge Checklist

After merging:

- [ ] Tag release: `git tag v0.7.0-packaging`
- [ ] Create GitHub release with DMG
- [ ] Update CHANGELOG.md
- [ ] Test installation on clean macOS
- [ ] Monitor user reports for issues

---

## Success Criteria

**Phase 1 Complete**:
- ✅ Paths resolve correctly in dev and production
- ✅ Python script found in packaged app
- ✅ All tests pass

**Phase 2 Complete**:
- ✅ Models download automatically
- ✅ Download progress tracked
- ✅ Models validated
- ✅ All tests pass

**Phase 3 Complete**:
- ✅ Production build works
- ✅ Packaged app launches
- ✅ All features work in packaged app

**Phase 4 Complete**:
- ✅ DMG created
- ✅ Documentation updated
- ✅ Ready for distribution

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database corruption | High | Backup before Phase 0, test migrations |
| Path resolution breaks dev | High | Test dev mode after each change |
| Model download fails | Medium | Retry logic, clear error messages |
| Packaging breaks features | High | Incremental testing, rollback plan |
| User has no internet | Medium | Clear error message, offline detection |
| Python not installed | Medium | Check on startup, show instructions |

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 | 15 min | None |
| Phase 1 | 2-3 hours | Phase 0 |
| Phase 2 | 4-5 hours | Phase 1 |
| Phase 3 | 2-3 hours | Phase 2 |
| Phase 4 | 1 hour | Phase 3 |
| **Total** | **8-12 hours** | Sequential |

**Recommended Schedule**:
- Day 1: Phase 0-1 (3 hours)
- Day 2: Phase 2 (5 hours)
- Day 3: Phase 3-4 (4 hours)

---

## Questions & Clarifications

If you encounter issues during implementation:

1. **Check logs**: Console and `~/Library/Logs/Meeting Agent/`
2. **Review tests**: Unit tests show expected behavior
3. **Test incrementally**: Commit after each working step
4. **Ask for help**: Document the issue with logs

---

**Plan Status**: ✅ Ready for Implementation
**Next Step**: Phase 0 - Create feature branch and backups
**Estimated Completion**: 2-3 days

---

**Generated**: 2026-01-05
**Author**: Claude Code
**Version**: 1.0
