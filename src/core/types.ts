import type { Vector3 } from 'three';

/**
 * Supported sound categories in the Phase2 palette.
 */
export type SoundCategory =
  | 'whisper'
  | 'tapping'
  | 'scratching'
  | 'brushing'
  | 'water'
  | 'ear_cleaning'
  | 'ambient'
  | 'user';

/**
 * Gesture types detected from pointer interaction.
 */
export type GestureType = 'tap' | 'drag';

/**
 * Trigger mode deciding when the sound should be played.
 */
export type TriggerMode = 'tap' | 'drag' | 'both' | 'bgm';

/**
 * Source type indicating how audio data is prepared.
 */
export type SoundSourceType = 'synth' | 'user_recording' | 'user_imported';

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
 * Motion metrics extracted from pointer interactions.
 */
export interface GestureMetrics {
  speedPxPerSecond: number;
  smoothingAlpha: number;
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
  triggerMode: TriggerMode;
  sourceType: SoundSourceType;
  isUserGenerated: boolean;
  audioBuffer?: AudioBuffer;
  userSoundId?: string;
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
  strokeSpeed: number;
}

/**
 * User-managed raw sound data persisted in IndexedDB.
 */
export interface UserSoundAsset {
  id: string;
  name: string;
  kind: 'recording' | 'imported';
  mimeType: string;
  createdAt: number;
  updatedAt: number;
  blob: Blob;
}

/**
 * Persistent user preferences for ambient playback.
 */
export interface BgmState {
  soundId: string | null;
  gain: number;
}
