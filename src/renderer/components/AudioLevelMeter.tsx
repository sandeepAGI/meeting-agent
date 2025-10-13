/**
 * Audio level visualization component.
 * Displays a visual meter of the current audio level.
 */

import type { AudioLevel } from '../../types/audio'

interface AudioLevelMeterProps {
  audioLevel: AudioLevel
}

export function AudioLevelMeter({ audioLevel }: AudioLevelMeterProps) {
  return (
    <div className="audio-level">
      <label>Audio Level:</label>
      <div className="level-bar">
        <div
          className="level-fill"
          style={{ width: `${audioLevel.level}%` }}
        ></div>
      </div>
      <span className="level-text">{audioLevel.level}%</span>
    </div>
  )
}
