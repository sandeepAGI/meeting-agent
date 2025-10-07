import type { AudioDevice } from '../types/audio'

// Dynamically import naudiodon to avoid issues if native module fails to load
let portAudio: any = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  portAudio = require('naudiodon')
} catch (error) {
  console.error('Failed to load naudiodon:', error)
}

/**
 * Get all available audio input devices
 */
export function getAudioDevices(): AudioDevice[] {
  if (!portAudio) {
    console.warn('PortAudio not available')
    return []
  }

  try {
    const devices = portAudio.getDevices()
    // Filter for input devices (maxInputChannels > 0)
    return devices.filter((device: AudioDevice) => device.maxInputChannels > 0)
  } catch (error) {
    console.error('Error getting audio devices:', error)
    return []
  }
}

/**
 * Find BlackHole audio device
 */
export function findBlackHoleDevice(): AudioDevice | null {
  const devices = getAudioDevices()
  const blackHole = devices.find(device =>
    device.name.toLowerCase().includes('blackhole')
  )

  return blackHole || null
}

/**
 * Check if BlackHole is installed and available
 */
export function isBlackHoleAvailable(): boolean {
  return findBlackHoleDevice() !== null
}

/**
 * Get default audio input device
 */
export function getDefaultInputDevice(): AudioDevice | null {
  const devices = getAudioDevices()

  // naudiodon doesn't mark default device, so we'll return the first input device
  // or BlackHole if available
  const blackHole = findBlackHoleDevice()
  if (blackHole) return blackHole

  return devices.length > 0 ? devices[0] : null
}

/**
 * Get device by ID
 */
export function getDeviceById(deviceId: number): AudioDevice | null {
  const devices = getAudioDevices()
  return devices.find(device => device.id === deviceId) || null
}

/**
 * Check if PortAudio is available
 */
export function isPortAudioAvailable(): boolean {
  return portAudio !== null
}
