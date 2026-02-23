import type { CSSProperties, ReactElement } from 'react';
import { PALETTE_CATEGORY_ORDER, SOUND_CATEGORY_META } from '../../core/constants';
import type { SoundCategory, SoundDefinition } from '../../core/types';

/**
 * Props for the sound palette component.
 */
export interface SoundPaletteProps {
  sounds: SoundDefinition[];
  selectedCategory: SoundCategory;
  selectedSoundId: string;
  onSelectCategory: (category: SoundCategory) => void;
  onSelectSound: (soundId: string) => void;
}

/**
 * Filters sounds to those displayed in the interaction palette.
 *
 * @param {SoundDefinition[]} sounds Input sound list.
 * @param {SoundCategory} category Active category tab.
 * @returns {SoundDefinition[]} Category-filtered interaction sounds.
 * @throws {Error} This function does not throw under normal operation.
 * @example
 * ```ts
 * const visible = toPaletteSounds(sounds, 'tapping');
 * ```
 */
function toPaletteSounds(sounds: SoundDefinition[], category: SoundCategory): SoundDefinition[] {
  return sounds.filter((sound) => sound.category === category && sound.triggerMode !== 'bgm');
}

/**
 * Renders the selectable Phase2 sound palette with category tabs.
 *
 * @param {SoundPaletteProps} props Palette data and callbacks.
 * @returns {JSX.Element} Sound palette view.
 * @throws {Error} This component does not throw under normal operation.
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
