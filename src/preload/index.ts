import { contextBridge, ipcRenderer } from 'electron'
import type { AudioDevice, AudioLevel, RecordingSession } from '../types/audio'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  audio: {
    // Device methods
    getDevices: (): Promise<AudioDevice[]> => ipcRenderer.invoke('audio:getDevices'),
    getAllDevices: (): Promise<any[]> => ipcRenderer.invoke('audio:getAllDevices'),
    findBlackHole: (): Promise<AudioDevice | null> =>
      ipcRenderer.invoke('audio:findBlackHole'),
    isBlackHoleAvailable: (): Promise<boolean> =>
      ipcRenderer.invoke('audio:isBlackHoleAvailable'),

    // Service methods
    initialize: (deviceId?: number): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('audio:initialize', deviceId),
    startRecording: (): Promise<{
      success: boolean
      session?: RecordingSession
      error?: string
    }> => ipcRenderer.invoke('audio:startRecording'),
    stopRecording: (): Promise<{
      success: boolean
      session?: RecordingSession
      error?: string
    }> => ipcRenderer.invoke('audio:stopRecording'),
    getStatus: (): Promise<{
      isRecording: boolean
      currentSession: RecordingSession | null
      duration: number
    }> => ipcRenderer.invoke('audio:getStatus'),

    // Event listeners
    onAudioLevel: (callback: (level: AudioLevel) => void) => {
      ipcRenderer.on('audio:level', (_event, level) => callback(level))
    },
    removeAudioLevelListener: () => {
      ipcRenderer.removeAllListeners('audio:level')
    },
  },
})

export {}
