/**
 * ModelManager - Smart model download and validation
 * Phase: Packaging Production Ready - Phase 2
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
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            console.log(`[ModelManager] Following redirect to: ${redirectUrl}`)
            https.get(redirectUrl, handleResponse).on('error', reject)
          } else {
            reject(new Error('Redirect without location header'))
          }
          return
        }

        handleResponse(response)
      }).on('error', reject)

      function handleResponse(response: any) {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${response.statusCode}`))
          return
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)

        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length

          if (onProgress && totalBytes > 0) {
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

        response.on('error', (err: Error) => {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
          }
          reject(err)
        })
      }
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
      console.warn(
        `[ModelManager] Model size mismatch: expected ~${expectedSize}, got ${stats.size}`
      )
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
