import { initMain } from 'electron-audio-loopback'

/**
 * Initialize electron-audio-loopback in the main process
 * Must be called before app is ready
 */
export function initializeAudioLoopback(): void {
  initMain({
    // Optional: Force Core Audio tap on macOS (can bypass bugs for certain versions)
    forceCoreAudioTap: false,
  })

  console.log('Audio loopback initialized')
}
