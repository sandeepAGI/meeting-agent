import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { initializeAudioLoopback } from './audioSetup'
import { transcriptionService } from '../services/transcription'
import type { TranscriptionOptions } from '../types/transcription'

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
