import type { HeadRegion, SoundCategory, SoundDefinition } from './types';

/**
 * モデル空間オフセットを音響空間オフセットへ変換するスケール係数。
 */
export const AUDIO_SCALE = 1.35;

/**
 * 自然な頭部操作向けに調整したOrbitControl制約。
 */
export const ORBIT_LIMITS = {
  minPolarAngle: Math.PI / 3,
  maxPolarAngle: (5 * Math.PI) / 6,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity
} as const;

/**
 * 頭部各部位のユーザー向けラベル。
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
 * 各サウンドカテゴリのUIラベルとアイコンメタデータ。
 */
export const SOUND_CATEGORY_META: Record<
  SoundCategory,
  { label: string; icon: string; accentColor: string }
> = {
  whisper: { label: 'ささやき', icon: '🫧', accentColor: '#9ad9d1' },
  tapping: { label: 'タッピング', icon: '🪵', accentColor: '#f2c57c' },
  scratching: { label: 'スクラッチ', icon: '🪮', accentColor: '#f29e85' },
  brushing: { label: 'ブラッシング', icon: '🖌️', accentColor: '#b7d7f5' },
  water: { label: '水音', icon: '💧', accentColor: '#84d4ff' },
  ear_cleaning: { label: '耳かき', icon: '🎧', accentColor: '#b4c2ff' },
  ambient: { label: '環境音', icon: '🌧️', accentColor: '#90b4c8' },
  user: { label: 'マイ音源', icon: '🎙️', accentColor: '#d5a8ff' }
};

/**
 * サウンドパレットで使用するカテゴリ順。
 */
export const PALETTE_CATEGORY_ORDER: SoundCategory[] = [
  'whisper',
  'tapping',
  'scratching',
  'brushing',
  'water',
  'ear_cleaning',
  'user'
];

/**
 * 環境音コントロールで使用するカテゴリ一覧。
 */
export const AMBIENT_CATEGORY_ORDER: SoundCategory[] = ['ambient'];

/**
 * Phase2のデフォルト環境音ゲイン。
 */
export const DEFAULT_BGM_GAIN = 0.33;

/**
 * 一貫した既定値を持つ合成サウンド定義を1件作成する。
 *
 * @param {Omit<SoundDefinition, 'sourceType' | 'isUserGenerated'>} sound 一部項目のみを持つサウンド定義。
 * @returns {SoundDefinition} 補完済みの合成サウンド定義。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const sound = createSynthSoundDefinition({
 *   id: 'tap-wood-light',
 *   label: 'Wood Light',
 *   category: 'tapping',
 *   description: '軽い木タップ',
 *   accentColor: '#f2c57c',
 *   defaultGain: 0.42,
 *   defaultDurationSeconds: 0.3,
 *   loop: false,
 *   seed: 21,
 *   triggerMode: 'tap'
 * });
 * ```
 */
function createSynthSoundDefinition(
  sound: Omit<SoundDefinition, 'sourceType' | 'isUserGenerated'>
): SoundDefinition {
  return {
    ...sound,
    sourceType: 'synth',
    isUserGenerated: false
  };
}

/**
 * Phase2同梱サウンドパレット（30種以上）。
 */
export const SOUND_DEFINITIONS: SoundDefinition[] = [
  createSynthSoundDefinition({
    id: 'whisper-soft',
    label: 'Whisper Soft',
    category: 'whisper',
    description: '柔らかい息のささやき',
    accentColor: '#9ad9d1',
    defaultGain: 0.36,
    defaultDurationSeconds: 1.8,
    loop: false,
    seed: 11,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'whisper-close',
    label: 'Whisper Close',
    category: 'whisper',
    description: '距離が近いささやき',
    accentColor: '#93d6c8',
    defaultGain: 0.39,
    defaultDurationSeconds: 1.7,
    loop: false,
    seed: 12,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'whisper-breathy',
    label: 'Whisper Breathy',
    category: 'whisper',
    description: 'ブレス多めの囁き',
    accentColor: '#8ecfc5',
    defaultGain: 0.34,
    defaultDurationSeconds: 1.9,
    loop: false,
    seed: 13,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'whisper-hush',
    label: 'Whisper Hush',
    category: 'whisper',
    description: '静かなハッシュ音',
    accentColor: '#88c8bf',
    defaultGain: 0.31,
    defaultDurationSeconds: 1.6,
    loop: false,
    seed: 14,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'whisper-silk',
    label: 'Whisper Silk',
    category: 'whisper',
    description: '滑らかなシルク質感',
    accentColor: '#9adbcf',
    defaultGain: 0.37,
    defaultDurationSeconds: 1.75,
    loop: false,
    seed: 15,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'tap-wood',
    label: 'Tap Wood',
    category: 'tapping',
    description: '木のタップ',
    accentColor: '#f2c57c',
    defaultGain: 0.44,
    defaultDurationSeconds: 0.24,
    loop: false,
    seed: 21,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'tap-glass',
    label: 'Tap Glass',
    category: 'tapping',
    description: 'ガラス質の軽いタップ',
    accentColor: '#f2be71',
    defaultGain: 0.4,
    defaultDurationSeconds: 0.22,
    loop: false,
    seed: 22,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'tap-nail',
    label: 'Tap Nail',
    category: 'tapping',
    description: '爪先の鋭いタップ',
    accentColor: '#f5c98a',
    defaultGain: 0.41,
    defaultDurationSeconds: 0.19,
    loop: false,
    seed: 23,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'tap-hollow',
    label: 'Tap Hollow',
    category: 'tapping',
    description: '空洞に響くタップ',
    accentColor: '#eeb764',
    defaultGain: 0.43,
    defaultDurationSeconds: 0.27,
    loop: false,
    seed: 24,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'tap-rhythm',
    label: 'Tap Rhythm',
    category: 'tapping',
    description: 'リズミカルな連打',
    accentColor: '#f0be72',
    defaultGain: 0.39,
    defaultDurationSeconds: 0.3,
    loop: false,
    seed: 25,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'tap-mellow',
    label: 'Tap Mellow',
    category: 'tapping',
    description: '柔らかいタップ',
    accentColor: '#f3cb90',
    defaultGain: 0.38,
    defaultDurationSeconds: 0.28,
    loop: false,
    seed: 26,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'scratch-gentle',
    label: 'Scratch Gentle',
    category: 'scratching',
    description: '細いスクラッチノイズ',
    accentColor: '#f29e85',
    defaultGain: 0.34,
    defaultDurationSeconds: 0.72,
    loop: false,
    seed: 31,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'scratch-fabric',
    label: 'Scratch Fabric',
    category: 'scratching',
    description: '布をこする高音ノイズ',
    accentColor: '#f39d97',
    defaultGain: 0.36,
    defaultDurationSeconds: 0.8,
    loop: false,
    seed: 32,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'scratch-card',
    label: 'Scratch Card',
    category: 'scratching',
    description: 'カードをなぞる質感',
    accentColor: '#f49687',
    defaultGain: 0.35,
    defaultDurationSeconds: 0.76,
    loop: false,
    seed: 33,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'scratch-soft',
    label: 'Scratch Soft',
    category: 'scratching',
    description: '柔らかい摩擦ノイズ',
    accentColor: '#e78f7d',
    defaultGain: 0.31,
    defaultDurationSeconds: 0.88,
    loop: false,
    seed: 34,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'scratch-sharp',
    label: 'Scratch Sharp',
    category: 'scratching',
    description: '鋭いスクラッチ',
    accentColor: '#f0a090',
    defaultGain: 0.39,
    defaultDurationSeconds: 0.66,
    loop: false,
    seed: 35,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'brush-fiber',
    label: 'Brush Fiber',
    category: 'brushing',
    description: '繊維ブラシの往復音',
    accentColor: '#b7d7f5',
    defaultGain: 0.4,
    defaultDurationSeconds: 1.1,
    loop: false,
    seed: 41,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'brush-wide',
    label: 'Brush Wide',
    category: 'brushing',
    description: '幅広ブラシのなぞり',
    accentColor: '#b1d1ef',
    defaultGain: 0.42,
    defaultDurationSeconds: 1.15,
    loop: false,
    seed: 42,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'brush-silk',
    label: 'Brush Silk',
    category: 'brushing',
    description: 'シルクのような滑らかさ',
    accentColor: '#bfdaf9',
    defaultGain: 0.37,
    defaultDurationSeconds: 1.2,
    loop: false,
    seed: 43,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'brush-feather',
    label: 'Brush Feather',
    category: 'brushing',
    description: '羽根ブラシの軽い感触',
    accentColor: '#c8e1ff',
    defaultGain: 0.34,
    defaultDurationSeconds: 1.24,
    loop: false,
    seed: 44,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'brush-dense',
    label: 'Brush Dense',
    category: 'brushing',
    description: '密度の高いブラシ音',
    accentColor: '#abcdf0',
    defaultGain: 0.43,
    defaultDurationSeconds: 1.05,
    loop: false,
    seed: 45,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'water-drop',
    label: 'Water Drop',
    category: 'water',
    description: '水滴のような丸い音',
    accentColor: '#84d4ff',
    defaultGain: 0.42,
    defaultDurationSeconds: 0.8,
    loop: false,
    seed: 51,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'water-bubble',
    label: 'Water Bubble',
    category: 'water',
    description: '泡の弾ける質感',
    accentColor: '#7ac8f0',
    defaultGain: 0.41,
    defaultDurationSeconds: 0.72,
    loop: false,
    seed: 52,
    triggerMode: 'tap'
  }),
  createSynthSoundDefinition({
    id: 'water-stream',
    label: 'Water Stream',
    category: 'water',
    description: '小川のような連続感',
    accentColor: '#8fdbff',
    defaultGain: 0.37,
    defaultDurationSeconds: 0.95,
    loop: false,
    seed: 53,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'water-mist',
    label: 'Water Mist',
    category: 'water',
    description: '霧のように細かい水音',
    accentColor: '#9de4ff',
    defaultGain: 0.33,
    defaultDurationSeconds: 0.9,
    loop: false,
    seed: 54,
    triggerMode: 'both'
  }),
  createSynthSoundDefinition({
    id: 'ear-clean-cotton',
    label: 'Ear Cotton',
    category: 'ear_cleaning',
    description: '綿棒でこするような音',
    accentColor: '#b4c2ff',
    defaultGain: 0.34,
    defaultDurationSeconds: 1.05,
    loop: false,
    seed: 61,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'ear-clean-pick',
    label: 'Ear Pick',
    category: 'ear_cleaning',
    description: '耳かき棒の細い摩擦音',
    accentColor: '#aab8f5',
    defaultGain: 0.38,
    defaultDurationSeconds: 0.9,
    loop: false,
    seed: 62,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'ear-clean-brush',
    label: 'Ear Mini Brush',
    category: 'ear_cleaning',
    description: '小さなブラシで掃く音',
    accentColor: '#bec9ff',
    defaultGain: 0.33,
    defaultDurationSeconds: 1.1,
    loop: false,
    seed: 63,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'ear-clean-gel',
    label: 'Ear Gel',
    category: 'ear_cleaning',
    description: '粘性のある耳かき感',
    accentColor: '#c4cdff',
    defaultGain: 0.31,
    defaultDurationSeconds: 1.22,
    loop: false,
    seed: 64,
    triggerMode: 'drag'
  }),
  createSynthSoundDefinition({
    id: 'ambient-rain',
    label: 'Rain',
    category: 'ambient',
    description: 'やさしい雨音',
    accentColor: '#90b4c8',
    defaultGain: 0.27,
    defaultDurationSeconds: 8,
    loop: true,
    seed: 71,
    triggerMode: 'bgm'
  }),
  createSynthSoundDefinition({
    id: 'ambient-fire',
    label: 'Fireplace',
    category: 'ambient',
    description: '焚き火のパチパチ音',
    accentColor: '#d49e7a',
    defaultGain: 0.24,
    defaultDurationSeconds: 8,
    loop: true,
    seed: 72,
    triggerMode: 'bgm'
  }),
  createSynthSoundDefinition({
    id: 'ambient-forest',
    label: 'Forest',
    category: 'ambient',
    description: '木々のざわめき',
    accentColor: '#8cb79a',
    defaultGain: 0.23,
    defaultDurationSeconds: 8,
    loop: true,
    seed: 73,
    triggerMode: 'bgm'
  }),
  createSynthSoundDefinition({
    id: 'ambient-night',
    label: 'Night',
    category: 'ambient',
    description: '静かな夜の空気感',
    accentColor: '#8fa1ca',
    defaultGain: 0.22,
    defaultDurationSeconds: 8,
    loop: true,
    seed: 74,
    triggerMode: 'bgm'
  })
];
