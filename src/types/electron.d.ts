export interface ElectronAPI {
  enableLoopbackAudio: () => Promise<void>
  disableLoopbackAudio: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
