import type { CSSProperties, ReactElement } from 'react';
import type { SoundDefinition } from '../../core/types';

/**
 * Props for the sound palette component.
 */
export interface SoundPaletteProps {
  sounds: SoundDefinition[];
  selectedSoundId: string;
  onSelectSound: (soundId: string) => void;
}

/**
 * Renders the selectable Phase1 sound palette.
 *
 * @param {SoundPaletteProps} props Palette data and callbacks.
 * @returns {JSX.Element} Sound palette view.
 * @throws {Error} This component does not throw under normal operation.
 * @example
 * ```tsx
 * <SoundPalette sounds={sounds} selectedSoundId={selected} onSelectSound={setSelected} />
 * ```
 */
export function SoundPalette(props: SoundPaletteProps): ReactElement {
  return (
    <aside className="panel sound-palette" aria-label="Sound palette">
      <h2 className="panel-title">Sound Palette</h2>
      <p className="panel-subtitle">カテゴリを選択してタップ音を切り替え</p>
      <div className="sound-grid">
        {props.sounds.map((sound) => {
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
      </div>
    </aside>
  );
}
