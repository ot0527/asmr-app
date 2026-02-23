import type { Vector3 } from 'three';

/**
 * Phase2パレットでサポートするサウンドカテゴリ。
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
 * ポインター操作で検出するジェスチャー種別。
 */
export type GestureType = 'tap' | 'drag';

/**
 * サウンド再生タイミングを決めるトリガーモード。
 */
export type TriggerMode = 'tap' | 'drag' | 'both' | 'bgm';

/**
 * 音声データの準備方法を示すソース種別。
 */
export type SoundSourceType = 'synth' | 'user_recording' | 'user_imported';

/**
 * トリガーマッピングで使う頭部モデル上の命名部位。
 */
export type HeadRegion =
  | 'ear_left'
  | 'ear_right'
  | 'top'
  | 'back'
  | 'forehead'
  | 'head_core';

/**
 * 音声パンニング用のシリアライズ可能な3D座標。
 */
export interface AudioPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * ポインター操作から抽出した動作指標。
 */
export interface GestureMetrics {
  speedPxPerSecond: number;
  smoothingAlpha: number;
}

/**
 * パレットに表示するASMRサウンド項目の定義。
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
 * レイキャスト結果をアプリ層の操作データに正規化した値。
 */
export interface TouchHit {
  region: HeadRegion;
  point: Vector3;
  objectName: string;
}

/**
 * 音響エンジンがサウンド再生に使うペイロード。
 */
export interface PlaybackRequest {
  sound: SoundDefinition;
  position: AudioPosition;
  intensity: number;
  gesture: GestureType;
  strokeSpeed: number;
}

/**
 * IndexedDBに永続化するユーザー管理の生音声データ。
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
 * 環境音再生の永続化ユーザー設定。
 */
export interface BgmState {
  soundId: string | null;
  gain: number;
}
