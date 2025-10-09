import { contextBridge, ipcRenderer } from 'electron'

// Expose API for electron-audio-loopback manual mode
// IPC handlers are automatically registered by initMain() in audioSetup.ts
contextBridge.exposeInMainWorld('electronAPI', {
  enableLoopbackAudio: () => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: () => ipcRenderer.invoke('disable-loopback-audio'),
})

export {}
