import path from 'path'
import fs from 'fs'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import { spawn } from 'child_process'
import { app } from 'electron'
import { ModelManager, type WhisperModel } from './modelManager'
import type {
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionProgress,
  TranscriptionCallback,
} from '../types/transcription'

/**
 * Transcription service using whisper.cpp CLI
 * Spawns whisper-cli as a child process for clean isolation
 */
export class TranscriptionService {
  private modelPath: string
  private modelName: WhisperModel
  private whisperCliPath: string
  private defaultThreads: number
  private isInitialized = false
  private modelManager: ModelManager

  constructor(options: { model?: string; whisperPath?: string; threads?: number } = {}) {
    // Initialize model manager
    this.modelManager = new ModelManager()

    // Default to base model
    this.modelName = (options.model as WhisperModel) || 'base'

    // ALWAYS use userData for models (in both dev and production)
    // This allows downloading models on first run
    this.modelPath = this.modelManager.getModelPath(this.modelName)

    // whisper-cli should be in PATH (installed via Homebrew) or custom path
    this.whisperCliPath = options.whisperPath || 'whisper-cli'
    // Default threads: use available CPUs minus 3 for OS/Electron, minimum 1
    this.defaultThreads = options.threads || Math.max(1, require('os').cpus().length - 3)

    console.log('[Transcription] Model path:', this.modelPath)
  }

  /**
   * Initialize Whisper model (must be called before transcription)
   * Downloads model automatically if not available
   * @param modelName Optional model name to override constructor option
   */
  async initialize(modelName?: string): Promise<void> {
    if (this.isInitialized) {
      console.log('Whisper model already initialized')
      return
    }

    try {
      // Use provided model name or fall back to constructor value
      if (modelName) {
        this.modelName = modelName as WhisperModel
        this.modelPath = this.modelManager.getModelPath(this.modelName)
      }

      // Migrate existing model from project directory if needed
      await this.migrateExistingModel()

      // Check if model is available
      const modelAvailable = await this.modelManager.isModelAvailable(this.modelName)

      if (!modelAvailable) {
        console.log(`[Transcription] Model ${this.modelName} not found, downloading...`)

        // Download model with progress tracking
        await this.modelManager.downloadModel(this.modelName, (progress) => {
          const speedMB = (progress.speed / (1024 * 1024)).toFixed(1)
          console.log(
            `[Transcription] Download progress: ${progress.percentage}% (${speedMB} MB/s)`
          )
        })

        console.log(`[Transcription] ✅ Model ${this.modelName} downloaded successfully`)
      }

      // Validate model
      const isValid = await this.modelManager.validateModel(this.modelName)
      if (!isValid) {
        throw new Error(
          `Model ${this.modelName} validation failed. File may be corrupted. Delete and retry.`
        )
      }

      console.log('Whisper model path:', this.modelPath)
      console.log('Default threads:', this.defaultThreads)
      this.isInitialized = true
      console.log('✅ Whisper service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Whisper service:', error)
      throw error
    }
  }

  /**
   * Migrate existing model from project directory to userData
   * Called on first run after upgrade
   */
  private async migrateExistingModel(): Promise<void> {
    const oldPath = path.join(process.cwd(), 'models', `ggml-${this.modelName}.bin`)

    // If model exists in old location and not in new location
    if (fs.existsSync(oldPath) && !fs.existsSync(this.modelPath)) {
      console.log('[Transcription] Migrating model from project directory to userData...')
      try {
        fs.copyFileSync(oldPath, this.modelPath)
        console.log('[Transcription] ✅ Migration complete:', this.modelPath)
      } catch (error) {
        console.warn('[Transcription] Migration failed, will use existing location:', error)
      }
    }
  }

  /**
   * Phase 6: Set the default thread count from settings.
   * Value of 0 means auto-detect (use CPU count - 3).
   */
  setThreads(threads: number): void {
    if (threads === 0) {
      // 0 = auto-detect
      this.defaultThreads = Math.max(1, require('os').cpus().length - 3)
      console.log(`[Transcription] Threads set to auto-detect: ${this.defaultThreads}`)
    } else {
      this.defaultThreads = Math.max(1, threads)
      console.log(`[Transcription] Threads set to: ${this.defaultThreads}`)
    }
  }

  /**
   * Get current default thread count.
   */
  getThreads(): number {
    return this.defaultThreads
  }

  /**
   * Convert audio to proper mono 16kHz WAV using ffmpeg
   * Fixes WAV header issues and ensures mono channel
   * Uses system temp directory with unique filename
   */
  private async convertToMonoWav(inputPath: string): Promise<string> {
    // Create temp file in system temp directory with unique name
    const tempId = randomBytes(16).toString('hex')
    const outputPath = path.join(tmpdir(), `whisper_mono_${tempId}.wav`)

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ac', '1',          // Mono
        '-ar', '16000',      // 16kHz
        '-y',                // Overwrite
        outputPath
      ])

      let stderr = ''
      ffmpeg.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      ffmpeg.on('exit', (code) => {
        if (code === 0) {
          resolve(outputPath)
        } else {
          reject(new Error(`ffmpeg failed: ${stderr}`))
        }
      })

      ffmpeg.on('error', (error) => {
        reject(new Error(`Failed to run ffmpeg: ${error.message}. Is ffmpeg installed?`))
      })
    })
  }

  async transcribe(
    audioPath: string,
    options: TranscriptionOptions = {},
    onProgress?: TranscriptionCallback
  ): Promise<TranscriptionResult> {
    if (!this.isInitialized) {
      throw new Error('Whisper service not initialized. Call initialize() first.')
    }

    // Validate audio file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`)
    }

    const startTime = Date.now()
    let monoFilePath: string | null = null

    try {
      // Convert to proper mono WAV (fixes header issues and ensures mono)
      onProgress?.({
        stage: 'loading',
        progress: 0,
        message: 'Preparing audio...',
      })

      monoFilePath = await this.convertToMonoWav(audioPath)
      console.log('[TranscriptionService] Converted to mono WAV:', monoFilePath)

      const processedAudioPath = monoFilePath
      // Report loading stage
      onProgress?.({
        stage: 'loading',
        progress: 10,
        message: 'Starting transcription...',
      })

      // Build whisper-cli command
      // whisper-cli -m model.bin -f audio.wav -oj -of output
      const outputDir = path.dirname(processedAudioPath)
      const outputName = path.basename(processedAudioPath, path.extname(processedAudioPath))

      // Use provided thread count or default
      const threads = options.threads !== undefined ? options.threads : this.defaultThreads

      const args = [
        '-m', this.modelPath,           // Model path
        '-f', processedAudioPath,        // Input audio file (converted mono)
        '-l', options.language || 'en',  // Language
        '-t', String(threads),           // Thread count (from options or default)
        '-p', '1',                       // 1 processor (default, but explicit)
        '-oj',                           // Output JSON
        '-of', path.join(outputDir, outputName), // Output file prefix
      ]

      console.log('[TranscriptionService] Running whisper-cli:', this.whisperCliPath, args.join(' '))

      // Report processing stage
      onProgress?.({
        stage: 'processing',
        progress: 30,
        message: 'Transcribing audio...',
      })

      const result = await new Promise<TranscriptionResult>((resolve, reject) => {
        const child = spawn(this.whisperCliPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stdoutData = ''
        let stderrData = ''

        // Capture stdout
        child.stdout?.on('data', (data) => {
          stdoutData += data.toString()
        })

        // Capture stderr (whisper-cli prints progress here)
        child.stderr?.on('data', (data) => {
          const text = data.toString()
          stderrData += text

          // Log progress
          console.log('[Whisper]', text.trim())

          // Simple progress estimation based on output
          if (text.includes('processing')) {
            onProgress?.({
              stage: 'processing',
              progress: 50,
              message: 'Processing audio...',
            })
          }
        })

        child.on('error', (error) => {
          console.error('[TranscriptionService] Failed to spawn whisper-cli:', error)
          reject(new Error(`Failed to run whisper-cli: ${error.message}. Is it installed? (brew install whisper-cpp)`))
        })

        child.on('exit', (code, signal) => {
          if (code !== 0) {
            console.error('[TranscriptionService] whisper-cli exited with code', code)
            console.error('stderr:', stderrData)
            reject(new Error(`whisper-cli failed with code ${code}`))
            return
          }

          if (signal) {
            console.error('[TranscriptionService] whisper-cli killed by signal', signal)
            reject(new Error(`whisper-cli killed by signal ${signal}`))
            return
          }

          // whisper-cli writes JSON output to file: <output-name>.json
          const jsonOutputPath = path.join(outputDir, `${outputName}.json`)

          try {
            // Read JSON output
            if (!fs.existsSync(jsonOutputPath)) {
              throw new Error(`Transcription output not found: ${jsonOutputPath}`)
            }

            const jsonData = fs.readFileSync(jsonOutputPath, 'utf-8')
            const whisperOutput = JSON.parse(jsonData)

            // Extract transcription text from whisper.cpp JSON format
            // Format: { "transcription": [{"timestamps": {...}, "text": "..."}, ...] }
            let transcriptionText = ''

            if (whisperOutput.transcription && Array.isArray(whisperOutput.transcription)) {
              transcriptionText = whisperOutput.transcription
                .map((segment: any) => segment.text || '')
                .join(' ')
                .trim()
            }

            // Calculate audio duration from the converted mono file
            const duration = this.calculateDuration(processedAudioPath)
            const processingTime = (Date.now() - startTime) / 1000

            // Report completion
            onProgress?.({
              stage: 'complete',
              progress: 100,
              message: 'Transcription complete',
            })

            // Clean up JSON file (optional - keep for debugging)
            // fs.unlinkSync(jsonOutputPath)

            console.log(`✅ Transcription complete in ${processingTime.toFixed(2)}s`)
            console.log(`📝 Transcript: "${transcriptionText.substring(0, 100)}..."`)

            resolve({
              text: transcriptionText,
              segments: whisperOutput.transcription || [],
              language: options.language || 'en',
              duration,
              processingTime,
            })
          } catch (error) {
            console.error('[TranscriptionService] Failed to parse output:', error)
            reject(error)
          }
        })
      })

      return result
    } catch (error) {
      console.error('Transcription failed:', error)
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Transcription failed',
      })
      throw error
    } finally {
      // Guaranteed cleanup of temp mono file
      if (monoFilePath && fs.existsSync(monoFilePath)) {
        try {
          fs.unlinkSync(monoFilePath)
          console.log('[TranscriptionService] Cleaned up temp file:', monoFilePath)
        } catch (error) {
          console.error('[TranscriptionService] Failed to clean temp file:', error)
        }
      }
    }
  }

  /**
   * Calculate audio file duration from WAV header
   * For 16-bit PCM mono 16kHz: 2 bytes/sample * 16000 samples/sec = 32000 bytes/sec
   */
  private calculateDuration(audioPath: string): number {
    try {
      const stats = fs.statSync(audioPath)
      const sizeBytes = stats.size

      // WAV header is 44 bytes
      const bytesPerSecond = 32000 // 16-bit mono 16kHz
      const duration = (sizeBytes - 44) / bytesPerSecond

      return Math.max(0, duration)
    } catch (error) {
      console.warn('Failed to calculate audio duration:', error)
      return 0
    }
  }

  /**
   * Cleanup service resources
   */
  async cleanup(): Promise<void> {
    if (this.isInitialized) {
      console.log('Cleaning up Whisper service...')
      this.isInitialized = false
    }
  }

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      modelPath: this.modelPath,
      whisperCliPath: this.whisperCliPath,
    }
  }
}

// Singleton instance for main process
export const transcriptionService = new TranscriptionService()
