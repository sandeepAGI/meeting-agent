import { ipcMain } from 'electron'
import { AudioService } from '../services/audio'
import { getAudioDevices, findBlackHoleDevice, isBlackHoleAvailable } from '../utils/audioDevice'
import { app } from 'electron'
import * as path from 'path'

let audioService: AudioService | null = null

export function setupIPC() {
  // Get recordings directory in user data
  const recordingsDir = path.join(app.getPath('userData'), 'recordings')

  // Audio device methods
  ipcMain.handle('audio:getDevices', () => {
    return getAudioDevices()
  })

  ipcMain.handle('audio:findBlackHole', () => {
    return findBlackHoleDevice()
  })

  ipcMain.handle('audio:isBlackHoleAvailable', () => {
    return isBlackHoleAvailable()
  })

  // Audio service methods
  ipcMain.handle('audio:initialize', async (_event, deviceId?: number) => {
    try {
      if (!audioService) {
        audioService = new AudioService(recordingsDir)
      }
      await audioService.initialize(deviceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('audio:startRecording', async event => {
    try {
      if (!audioService) {
        throw new Error('Audio service not initialized')
      }

      const session = await audioService.startRecording()

      // Forward audio level events to renderer
      audioService.on('audioLevel', level => {
        event.sender.send('audio:level', level)
      })

      return { success: true, session }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('audio:stopRecording', async () => {
    try {
      if (!audioService) {
        throw new Error('Audio service not initialized')
      }

      const session = await audioService.stopRecording()
      return { success: true, session }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('audio:getStatus', () => {
    if (!audioService) {
      return { isRecording: false, currentSession: null, duration: 0 }
    }
    return audioService.getStatus()
  })
}

// Clean up on app quit
export function cleanupIPC() {
  if (audioService) {
    audioService.destroy()
    audioService = null
  }
}
