import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import dotenv from 'dotenv'
import { initializeAudioLoopback } from './audioSetup'
import { transcriptionService } from '../services/transcription'
import { DiarizationService } from '../services/diarization'
import { mergeDiarizationWithTranscript } from '../utils/mergeDiarization'
import type { TranscriptionOptions } from '../types/transcription'

// Load environment variables from .env file
dotenv.config()
console.log('[ENV] HUGGINGFACE_TOKEN configured:', !!process.env.HUGGINGFACE_TOKEN)

// Initialize diarization service
const diarizationService = new DiarizationService()

let mainWindow: BrowserWindow | null = null

// Initialize audio loopback before app is ready
initializeAudioLoopback()

// IPC Handlers for transcription
ipcMain.handle('transcribe-audio', async (event, audioFilePath: string, options?: TranscriptionOptions) => {
  try {
    // Transcribe with progress updates
    const result = await transcriptionService.transcribe(
      audioFilePath,
      options,
      (progress) => {
        // Send progress updates to renderer
        event.sender.send('transcription-progress', progress)
      }
    )
    return { success: true, result }
  } catch (error) {
    console.error('Transcription error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed',
    }
  }
})

ipcMain.handle('save-audio-file', async (_event, blob: ArrayBuffer, filename: string) => {
  try {
    // Save audio file to app's userData directory
    const userDataPath = app.getPath('userData')
    const recordingsDir = path.join(userDataPath, 'recordings')

    // Create recordings directory if it doesn't exist
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true })
    }

    const filePath = path.join(recordingsDir, filename)

    // Write audio data to file
    fs.writeFileSync(filePath, Buffer.from(blob))

    console.log('Audio file saved:', filePath)
    return { success: true, filePath }
  } catch (error) {
    console.error('Failed to save audio file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save audio file',
    }
  }
})

ipcMain.handle('get-transcription-status', async () => {
  return transcriptionService.getStatus()
})

// IPC Handler for playing announcement
ipcMain.handle('play-announcement', async (_event, text: string) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('[Announcement] Playing:', text)

      // Use macOS 'say' command for text-to-speech
      const say = spawn('say', [text])

      say.on('error', (error) => {
        console.error('[Announcement] Failed to play:', error)
        reject(new Error(`Failed to play announcement: ${error.message}`))
      })

      say.on('close', (code) => {
        if (code === 0) {
          console.log('[Announcement] Completed successfully')
          resolve({ success: true })
        } else {
          console.error('[Announcement] Process exited with code:', code)
          reject(new Error(`Announcement failed with exit code ${code}`))
        }
      })
    } catch (error) {
      console.error('[Announcement] Error:', error)
      reject(error)
    }
  })
})

// IPC Handler for speaker diarization
ipcMain.handle('diarize-audio', async (event, audioFilePath: string) => {
  try {
    // Check if diarization is available
    const isAvailable = await diarizationService.isAvailable()
    if (!isAvailable) {
      return {
        success: false,
        error: 'Diarization not available. Install pyannote.audio and set HUGGINGFACE_TOKEN.'
      }
    }

    // Run diarization with progress updates
    const result = await diarizationService.diarize(
      audioFilePath,
      (progress) => {
        // Send progress updates to renderer
        event.sender.send('diarization-progress', progress)
      }
    )

    return { success: true, result }
  } catch (error) {
    console.error('Diarization error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Diarization failed'
    }
  }
})

// IPC Handler for transcription + diarization (combined)
ipcMain.handle('transcribe-and-diarize', async (event, audioFilePath: string, options?: TranscriptionOptions) => {
  try {
    // Step 1: Transcribe
    event.sender.send('transcription-progress', {
      stage: 'loading',
      progress: 0,
      message: 'Starting transcription...'
    })

    const transcriptionResult = await transcriptionService.transcribe(
      audioFilePath,
      options,
      (progress) => {
        // Scale progress to 0-50%
        event.sender.send('transcription-progress', {
          ...progress,
          progress: progress.progress / 2
        })
      }
    )

    // Step 2: Diarize (if available)
    const isAvailable = await diarizationService.isAvailable()
    if (!isAvailable) {
      // Return transcription only if diarization not available
      return {
        success: true,
        result: {
          ...transcriptionResult,
          merged: null
        }
      }
    }

    event.sender.send('transcription-progress', {
      stage: 'processing',
      progress: 50,
      message: 'Running speaker diarization...'
    })

    const diarizationResult = await diarizationService.diarize(
      audioFilePath,
      (progress) => {
        // Scale progress to 50-90%
        event.sender.send('transcription-progress', {
          stage: 'processing',
          progress: 50 + (progress.progress || 0) * 0.4,
          message: progress.message
        })
      }
    )

    // Step 3: Merge transcription + diarization
    event.sender.send('transcription-progress', {
      stage: 'processing',
      progress: 95,
      message: 'Merging transcription with speaker labels...'
    })

    const merged = mergeDiarizationWithTranscript(
      transcriptionResult.segments,
      diarizationResult
    )

    event.sender.send('transcription-progress', {
      stage: 'complete',
      progress: 100,
      message: 'Complete!'
    })

    return {
      success: true,
      result: {
        ...transcriptionResult,
        merged
      }
    }
  } catch (error) {
    console.error('Transcription + diarization error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transcription + diarization failed'
    }
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Initialize Whisper model
  try {
    await transcriptionService.initialize('base')
  } catch (error) {
    console.error('Failed to initialize Whisper:', error)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
