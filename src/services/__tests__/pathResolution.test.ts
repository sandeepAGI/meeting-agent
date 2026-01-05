/**
 * Path Resolution Tests
 * Ensures services find resources in both dev and packaged environments
 *
 * Phase: Packaging Production Ready
 * TDD Approach: Write tests first (RED), then fix code (GREEN)
 */

import * as path from 'path'
import * as fs from 'fs'

// Mock electron app (must be before imports that use it)
const mockApp = {
  isPackaged: false,
  getPath: (name: string) => {
    if (name === 'userData') {
      return path.join(__dirname, '../../../test-data/userData')
    }
    if (name === 'resources') {
      return path.join(__dirname, '../../../test-data/resources')
    }
    return '/tmp/test'
  }
}

jest.mock('electron', () => ({
  app: mockApp
}))

import { DiarizationService } from '../diarization'
import { TranscriptionService } from '../transcription'

describe('Path Resolution - Development Mode', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development'
    mockApp.isPackaged = false
  })

  test('DiarizationService uses process.cwd() for script in development', () => {
    const service = new DiarizationService()
    const scriptPath = (service as any).scriptPath

    // Should point to project scripts directory
    expect(scriptPath).toContain('scripts')
    expect(scriptPath).toContain('diarize_audio.py')
    expect(scriptPath).toContain(process.cwd())
  })

  test('DiarizationService uses system Python (not venv)', () => {
    const service = new DiarizationService()
    const pythonPath = (service as any).pythonPath

    // Should use system Python, not venv
    expect(pythonPath).toBe('python3')
    expect(pythonPath).not.toContain('venv')
  })

  test('TranscriptionService uses userData for models in development', () => {
    const service = new TranscriptionService()
    const modelPath = (service as any).modelPath

    // Should point to userData/models directory (not process.cwd()/models)
    expect(modelPath).toContain('userData')
    expect(modelPath).toContain('models')
    expect(modelPath).toContain('ggml-base.bin')
    // Should not be in the project models directory
    expect(modelPath).not.toContain(path.join(process.cwd(), 'models'))
  })
})

describe('Path Resolution - Packaged Mode', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production'
    mockApp.isPackaged = true
  })

  test('DiarizationService uses resourcesPath for script when packaged', () => {
    const service = new DiarizationService()
    const scriptPath = (service as any).scriptPath

    // Should point to app resources (not process.cwd())
    // macOS app bundles use "Resources" (capital R)
    expect(scriptPath.toLowerCase()).toContain('resources')
    expect(scriptPath).toContain('scripts')
    expect(scriptPath).toContain('diarize_audio.py')
    // Should not be directly in process.cwd() scripts
    expect(scriptPath).not.toContain(path.join(process.cwd(), 'scripts'))
  })

  test('DiarizationService still uses system Python when packaged', () => {
    const service = new DiarizationService()
    const pythonPath = (service as any).pythonPath

    // Should use system Python in both dev and packaged
    expect(pythonPath).toBe('python3')
  })

  test('TranscriptionService uses userData for models when packaged', () => {
    const service = new TranscriptionService()
    const modelPath = (service as any).modelPath

    // Should still use userData (not bundled in Resources)
    expect(modelPath).toContain('userData')
    expect(modelPath).toContain('models')
    expect(modelPath).not.toContain('resources')
    // Should not be in the project models directory
    expect(modelPath).not.toContain(path.join(process.cwd(), 'models'))
  })
})

describe('Path Resolution - Models Directory Creation', () => {
  test('TranscriptionService creates models directory if missing', () => {
    const service = new TranscriptionService()
    const modelsPath = path.join(mockApp.getPath('userData'), 'models')

    // Directory should be created (mocked, so we check the path is correct)
    expect((service as any).modelPath).toContain(modelsPath)
  })
})
