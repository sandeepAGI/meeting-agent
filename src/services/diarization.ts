/**
 * Speaker diarization service using pyannote.audio.
 *
 * This service runs speaker diarization on audio files using a Python subprocess
 * that calls pyannote.audio's diarization pipeline.
 */

import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import type { DiarizationResult, DiarizationProgress } from '../types/diarization'

export class DiarizationService {
  private pythonPath: string
  private scriptPath: string
  private hfToken: string | undefined

  constructor() {
    // Use virtual environment Python
    this.pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python3')
    this.scriptPath = path.join(process.cwd(), 'scripts', 'diarize_audio.py')

    // Get Hugging Face token from environment
    this.hfToken = process.env.HUGGINGFACE_TOKEN
  }

  /**
   * Check if diarization is available (Python script and token exist).
   */
  async isAvailable(): Promise<boolean> {
    // Check if Python virtual environment exists
    if (!fs.existsSync(this.pythonPath)) {
      console.warn('Python virtual environment not found')
      return false
    }

    // Check if diarization script exists
    if (!fs.existsSync(this.scriptPath)) {
      console.warn('Diarization script not found')
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

        // Parse progress messages from pyannote (if any)
        if (message) {
          onProgress?.({ message })
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
