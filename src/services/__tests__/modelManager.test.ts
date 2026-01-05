/**
 * Model Manager Tests
 * Tests model downloading, validation, and caching
 *
 * Phase: Packaging Production Ready - Phase 2
 * TDD Approach: Write tests first (RED), then implement (GREEN)
 */

import * as path from 'path'
import * as fs from 'fs'

// Mock electron app
const mockApp = {
  isPackaged: false,
  getPath: (name: string) => {
    if (name === 'userData') {
      return path.join(__dirname, '../../../test-data/userData')
    }
    return '/tmp/test'
  }
}

jest.mock('electron', () => ({
  app: mockApp
}))

import { ModelManager } from '../modelManager'

describe('ModelManager', () => {
  let manager: ModelManager
  let testModelPath: string

  beforeEach(() => {
    manager = new ModelManager()
    testModelPath = path.join(mockApp.getPath('userData'), 'models', 'ggml-base.bin')

    // Clean up any existing test files
    if (fs.existsSync(testModelPath)) {
      fs.unlinkSync(testModelPath)
    }
  })

  afterEach(() => {
    // Cleanup test files
    if (fs.existsSync(testModelPath)) {
      fs.unlinkSync(testModelPath)
    }
  })

  describe('Model Path Resolution', () => {
    test('getModelPath returns correct path for base model', () => {
      const modelPath = manager.getModelPath('base')
      expect(modelPath).toContain('userData')
      expect(modelPath).toContain('models')
      expect(modelPath).toContain('ggml-base.bin')
    })

    test('getModelPath returns correct path for different models', () => {
      const tinyPath = manager.getModelPath('tiny')
      const smallPath = manager.getModelPath('small')

      expect(tinyPath).toContain('ggml-tiny.bin')
      expect(smallPath).toContain('ggml-small.bin')
    })
  })

  describe('Model Availability', () => {
    test('isModelAvailable returns false for missing model', async () => {
      const available = await manager.isModelAvailable('base')
      expect(available).toBe(false)
    })

    test('isModelAvailable returns true for existing model with correct size', async () => {
      // Create dummy model file with realistic size
      const modelsDir = path.dirname(testModelPath)
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true })
      }

      // Create 130MB file (base model is ~141MB, allow 10% variance)
      const buffer = Buffer.alloc(130 * 1024 * 1024)
      fs.writeFileSync(testModelPath, buffer)

      const available = await manager.isModelAvailable('base')
      expect(available).toBe(true)
    })

    test('isModelAvailable returns false for corrupted model (too small)', async () => {
      const modelsDir = path.dirname(testModelPath)
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true })
      }

      // Create small dummy file (corrupted)
      fs.writeFileSync(testModelPath, 'corrupted data')

      const available = await manager.isModelAvailable('base')
      expect(available).toBe(false)
    })
  })

  describe('Model Info', () => {
    test('getModelInfo returns correct info for base model', () => {
      const info = manager.getModelInfo('base')

      expect(info.name).toBe('base')
      expect(info.size).toBe(141 * 1024 * 1024)
      expect(info.url).toContain('ggml-base.bin')
    })

    test('getModelInfo returns correct info for all models', () => {
      const models: Array<'tiny' | 'base' | 'small' | 'medium' | 'large'> = ['tiny', 'base', 'small', 'medium', 'large']

      models.forEach(modelName => {
        const info = manager.getModelInfo(modelName)
        expect(info.name).toBe(modelName)
        expect(info.size).toBeGreaterThan(0)
        expect(info.url).toContain(`ggml-${modelName}.bin`)
      })
    })
  })

  describe('Model Validation', () => {
    test('validateModel returns false for missing model', async () => {
      const isValid = await manager.validateModel('base')
      expect(isValid).toBe(false)
    })

    test('validateModel returns false for corrupted model', async () => {
      const modelsDir = path.dirname(testModelPath)
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true })
      }

      // Create small dummy file
      fs.writeFileSync(testModelPath, 'too small')

      const isValid = await manager.validateModel('base')
      expect(isValid).toBe(false)
    })

    test('validateModel returns true for correctly sized model', async () => {
      const modelsDir = path.dirname(testModelPath)
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true })
      }

      // Create file with correct size
      const buffer = Buffer.alloc(141 * 1024 * 1024)
      fs.writeFileSync(testModelPath, buffer)

      const isValid = await manager.validateModel('base')
      expect(isValid).toBe(true)
    })
  })

  describe('Model Listing', () => {
    test('listAvailableModels returns empty array when no models', async () => {
      const models = await manager.listAvailableModels()
      expect(models).toEqual([])
    })

    test('listAvailableModels returns array with available models', async () => {
      const modelsDir = path.dirname(testModelPath)
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true })
      }

      // Create base model
      const buffer = Buffer.alloc(141 * 1024 * 1024)
      fs.writeFileSync(testModelPath, buffer)

      const models = await manager.listAvailableModels()
      expect(models).toContain('base')
    })
  })

  describe('Model Deletion', () => {
    test('deleteModel removes existing model', async () => {
      const modelsDir = path.dirname(testModelPath)
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true })
      }

      // Create model
      fs.writeFileSync(testModelPath, 'test data')
      expect(fs.existsSync(testModelPath)).toBe(true)

      // Delete it
      await manager.deleteModel('base')
      expect(fs.existsSync(testModelPath)).toBe(false)
    })

    test('deleteModel handles non-existent model gracefully', async () => {
      // Should not throw
      await expect(manager.deleteModel('base')).resolves.not.toThrow()
    })
  })

  // Note: Actual download tests would require mocking HTTPS
  // We'll test the download integration in manual testing
})
