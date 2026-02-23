import type { Vector3 } from 'three';

/**
 * Supported sound categories in the MVP palette.
 */
export type SoundCategory =
  | 'whisper'
  | 'tapping'
  | 'scratching'
  | 'brushing'
  | 'water';

/**
 * Gesture types detected from pointer interaction.
 */
export type GestureType = 'tap' | 'drag';

/**
 * Named regions on the head model used for trigger mapping.
 */
export type HeadRegion =
  | 'ear_left'
  | 'ear_right'
  | 'top'
  | 'back'
  | 'forehead'
  | 'head_core';

/**
 * Serializable 3D position for audio panning.
 */
export interface AudioPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Definition of an ASMR sound item shown in the palette.
 */
export interface SoundDefinition {
  id: string;
  label: string;
  category: SoundCategory;
  description: string;
  accentColor: string;
  defaultGain: number;
  defaultDurationSeconds: number;
  loop: boolean;
  seed: number;
}

/**
 * A raycast hit normalized into app-level interaction data.
 */
export interface TouchHit {
  region: HeadRegion;
  point: Vector3;
  objectName: string;
}

/**
 * Payload used by the audio engine to play a sound.
 */
export interface PlaybackRequest {
  sound: SoundDefinition;
  position: AudioPosition;
  intensity: number;
  gesture: GestureType;
}
