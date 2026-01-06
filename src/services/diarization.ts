/**
 * Speaker diarization service using pyannote.audio.
 *
 * This service runs speaker diarization on audio files using a Python subprocess
 * that calls pyannote.audio's diarization pipeline.
 */

import { spawn } from 'child_process'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import type { DiarizationResult, DiarizationProgress } from '../types/diarization'

export class DiarizationService {
  private pythonPath: string
  private scriptPath: string
  private hfToken: string | undefined

  constructor() {
    // Determine if running in development or production
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

    if (isDev) {
      // Development: Use project scripts directory
      this.scriptPath = path.join(process.cwd(), 'scripts', 'diarize_audio.py')
    } else {
      // Production: Use bundled script in app resources
      // process.resourcesPath is available in packaged Electron apps
      const resourcesPath = (process as any).resourcesPath || path.join(app.getPath('userData'), '../Resources')
      this.scriptPath = path.join(resourcesPath, 'scripts', 'diarize_audio.py')
    }

    // Use venv Python if available (per README setup instructions)
    // Fall back to system Python if venv doesn't exist
    const venvPythonPath = path.join(app.getPath('home'), 'meeting-agent-venv', 'bin', 'python3')
    if (fs.existsSync(venvPythonPath)) {
      this.pythonPath = venvPythonPath
    } else {
      this.pythonPath = 'python3'
      console.warn('[Diarization] Virtual environment not found at ~/meeting-agent-venv')
      console.warn('[Diarization] Using system Python - make sure packages are installed')
    }

    // Get Hugging Face token from environment (fallback)
    this.hfToken = process.env.HUGGINGFACE_TOKEN

    console.log('[Diarization] Script path:', this.scriptPath)
    console.log('[Diarization] Python path:', this.pythonPath)
  }

  /**
   * Set the HuggingFace token dynamically (Phase 6: Settings integration)
   * This allows updating the token from settings without recreating the service.
   */
  setToken(token: string | undefined): void {
    this.hfToken = token
    console.log('[Diarization] Token updated from settings')
  }

  /**
   * Get whether a token is currently configured.
   */
  hasToken(): boolean {
    return !!this.hfToken
  }

  /**
   * Check if diarization is available (Python script and token exist).
   */
  async isAvailable(): Promise<boolean> {
    // Check if diarization script exists
    if (!fs.existsSync(this.scriptPath)) {
      console.warn('Diarization script not found at:', this.scriptPath)
      return false
    }

    // Check if HF token is configured
    if (!this.hfToken) {
      console.warn('HUGGINGFACE_TOKEN not configured')
      return false
    }

    return true
  }

  /**
   * Run speaker diarization on an audio file.
   *
   * @param audioPath - Path to the audio file (preferably WAV format)
   * @param onProgress - Optional callback for progress updates
   * @returns Promise resolving to diarization result
   */
  async diarize(
    audioPath: string,
    onProgress?: (progress: DiarizationProgress) => void
  ): Promise<DiarizationResult> {
    // Check if diarization is available
    if (!(await this.isAvailable())) {
      throw new Error(
        'Diarization not available. Make sure pyannote.audio is installed and HUGGINGFACE_TOKEN is set.'
      )
    }

    // Check if audio file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`)
    }

    return new Promise((resolve, reject) => {
      onProgress?.({ message: 'Starting speaker diarization...' })

      // Spawn Python process
      const args = [this.scriptPath, audioPath, '--token', this.hfToken!]
      const process = spawn(this.pythonPath, args)

      let stdoutData = ''
      let stderrData = ''

      // Capture stdout (JSON result)
      process.stdout.on('data', (data: Buffer) => {
        stdoutData += data.toString()
      })

      // Capture stderr (progress messages)
      process.stderr.on('data', (data: Buffer) => {
        const message = data.toString().trim()
        stderrData += message + '\n'

        // Parse progress messages from Python script
        // Look for [PROGRESS] prefix to extract user-facing messages
        if (message.includes('[PROGRESS]')) {
          const progressMessage = message.replace(/\[PROGRESS\]\s*/g, '').trim()
          if (progressMessage) {
            onProgress?.({ message: progressMessage })
          }
        }
      })

      // Handle process completion
      process.on('close', (code: number) => {
        if (code === 0) {
          try {
            // Parse JSON output
            const result: DiarizationResult = JSON.parse(stdoutData)
            onProgress?.({ message: 'Diarization complete', progress: 100 })
            resolve(result)
          } catch (error) {
            reject(new Error(`Failed to parse diarization output: ${error}`))
          }
        } else {
          reject(new Error(`Diarization failed with code ${code}: ${stderrData}`))
        }
      })

      // Handle process errors
      process.on('error', (error: Error) => {
        reject(new Error(`Failed to start diarization process: ${error.message}`))
      })
    })
  }

  /**
   * Get the number of unique speakers in diarization result.
   */
  getSpeakerCount(result: DiarizationResult): number {
    const speakers = new Set(result.segments.map((seg) => seg.speaker))
    return speakers.size
  }

  /**
   * Get total duration covered by a specific speaker.
   */
  getSpeakerDuration(result: DiarizationResult, speaker: string): number {
    return result.segments
      .filter((seg) => seg.speaker === speaker)
      .reduce((total, seg) => total + (seg.end - seg.start), 0)
  }

  /**
   * Get statistics about speakers in the diarization result.
   */
  getStatistics(result: DiarizationResult): {
    speakerCount: number
    speakers: { label: string; duration: number; segments: number }[]
  } {
    const speakers = new Map<string, { duration: number; segments: number }>()

    for (const segment of result.segments) {
      if (!speakers.has(segment.speaker)) {
        speakers.set(segment.speaker, { duration: 0, segments: 0 })
      }

      const stats = speakers.get(segment.speaker)!
      stats.duration += segment.end - segment.start
      stats.segments += 1
    }

    return {
      speakerCount: speakers.size,
      speakers: Array.from(speakers.entries()).map(([label, stats]) => ({
        label,
        duration: stats.duration,
        segments: stats.segments
      }))
    }
  }
}
