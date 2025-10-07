import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // IPC methods will be added as features are implemented
  ping: () => ipcRenderer.invoke('ping'),
})

export {}
