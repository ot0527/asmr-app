import type { HeadRegion, SoundDefinition } from './types';

/**
 * Scale factor converting model-space offsets into audio-space offsets.
 */
export const AUDIO_SCALE = 1.35;

/**
 * Orbit controls limits tuned for natural head manipulation.
 */
export const ORBIT_LIMITS = {
  minPolarAngle: Math.PI / 3,
  maxPolarAngle: (5 * Math.PI) / 6,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity
} as const;

/**
 * User-facing labels for each head region.
 */
export const HEAD_REGION_LABEL: Record<HeadRegion, string> = {
  ear_left: '左耳',
  ear_right: '右耳',
  top: '頭頂部',
  back: '後頭部',
  forehead: 'おでこ',
  head_core: '頭部'
};

/**
 * Phase1 MVP palette (5 sounds).
 */
export const SOUND_DEFINITIONS: SoundDefinition[] = [
  {
    id: 'whisper-soft',
    label: 'Whisper',
    category: 'whisper',
    description: '柔らかいささやきノイズ',
    accentColor: '#9ad9d1',
    defaultGain: 0.36,
    defaultDurationSeconds: 1.8,
    loop: false,
    seed: 11
  },
  {
    id: 'tap-wood',
    label: 'Tap',
    category: 'tapping',
    description: '木のタップのような短い音',
    accentColor: '#f2c57c',
    defaultGain: 0.44,
    defaultDurationSeconds: 0.24,
    loop: false,
    seed: 23
  },
  {
    id: 'scratch-gentle',
    label: 'Scratch',
    category: 'scratching',
    description: '細いスクラッチノイズ',
    accentColor: '#f29e85',
    defaultGain: 0.34,
    defaultDurationSeconds: 0.72,
    loop: false,
    seed: 37
  },
  {
    id: 'brush-fiber',
    label: 'Brush',
    category: 'brushing',
    description: 'ブラッシングのような往復ノイズ',
    accentColor: '#b7d7f5',
    defaultGain: 0.4,
    defaultDurationSeconds: 1.1,
    loop: false,
    seed: 51
  },
  {
    id: 'water-drop',
    label: 'Water',
    category: 'water',
    description: '水滴のような丸い音',
    accentColor: '#84d4ff',
    defaultGain: 0.42,
    defaultDurationSeconds: 0.8,
    loop: false,
    seed: 67
  }
];
