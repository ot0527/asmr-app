import type { CSSProperties, ReactElement } from 'react';
import { PALETTE_CATEGORY_ORDER, SOUND_CATEGORY_META } from '../../core/constants';
import type { SoundCategory, SoundDefinition } from '../../core/types';

/**
 * サウンドパレットコンポーネントのProps。
 */
export interface SoundPaletteProps {
  sounds: SoundDefinition[];
  selectedCategory: SoundCategory;
  selectedSoundId: string;
  onSelectCategory: (category: SoundCategory) => void;
  onSelectSound: (soundId: string) => void;
}

/**
 * 操作パレットに表示するサウンドへ絞り込みます。
 *
 * @param {SoundDefinition[]} sounds 入力のサウンド一覧。
 * @param {SoundCategory} category 現在選択中のカテゴリタブ。
 * @returns {SoundDefinition[]} カテゴリで絞り込んだ操作用サウンド一覧。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const visible = toPaletteSounds(sounds, 'tapping');
 * ```
 */
function toPaletteSounds(sounds: SoundDefinition[], category: SoundCategory): SoundDefinition[] {
  return sounds.filter((sound) => sound.category === category && sound.triggerMode !== 'bgm');
}

/**
 * カテゴリタブ付きの選択可能なPhase2サウンドパレットを描画する。
 *
 * @param {SoundPaletteProps} props パレット表示データとコールバック。
 * @returns {JSX.Element} サウンドパレット表示。
 * @throws {Error} 通常運用ではこのコンポーネントは例外をスローしない。
 * @example
 * ```tsx
 * <SoundPalette {...props} />
 * ```
 */
export function SoundPalette(props: SoundPaletteProps): ReactElement {
  const displayedSounds = toPaletteSounds(props.sounds, props.selectedCategory);

  return (
    <aside className="panel sound-palette" aria-label="Sound palette">
      <h2 className="panel-title">Sound Palette</h2>
      <p className="panel-subtitle">カテゴリを切り替えて音源を選択</p>

      <div className="category-tabs" role="tablist" aria-label="Sound categories">
        {PALETTE_CATEGORY_ORDER.map((category) => {
          const meta = SOUND_CATEGORY_META[category];
          const isActive = category === props.selectedCategory;

          return (
            <button
              key={category}
              type="button"
              className={`category-tab ${isActive ? 'is-active' : ''}`}
              style={{ '--category-accent': meta.accentColor } as CSSProperties}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                props.onSelectCategory(category);
              }}
            >
              <span aria-hidden="true">{meta.icon}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="sound-grid">
        {displayedSounds.map((sound) => {
          const isSelected = sound.id === props.selectedSoundId;

          return (
            <button
              key={sound.id}
              type="button"
              className={`sound-button ${isSelected ? 'is-selected' : ''}`}
              style={{ '--accent-color': sound.accentColor } as CSSProperties}
              onClick={() => {
                props.onSelectSound(sound.id);
              }}
            >
              <span className="sound-label">{sound.label}</span>
              <span className="sound-desc">{sound.description}</span>
            </button>
          );
        })}

        {displayedSounds.length === 0 ? (
          <p className="sound-empty-state">このカテゴリには音源がありません。</p>
        ) : null}
      </div>
    </aside>
  );
}
