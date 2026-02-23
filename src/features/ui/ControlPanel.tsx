import type { ChangeEvent, ReactElement } from 'react';
import { HEAD_REGION_LABEL } from '../../core/constants';
import type { HeadRegion, SoundDefinition } from '../../core/types';

/**
 * Props for the control panel component.
 */
export interface ControlPanelProps {
  activeRegion: HeadRegion | null;
  selectedSound: SoundDefinition;
  isAudioReady: boolean;
  masterGain: number;
  bgmGain: number;
  bgmSounds: SoundDefinition[];
  selectedBgmId: string | null;
  onEnableAudio: () => Promise<void>;
  onMasterGainChange: (gain: number) => void;
  onBgmGainChange: (gain: number) => void;
  onSelectBgm: (bgmSoundId: string | null) => void;
  onToggleSettings: () => void;
}

/**
 * Converts a region id into user-facing text.
 *
 * @param {HeadRegion | null} region Active region value.
 * @returns {string} Human-readable region text.
 * @throws {Error} This function does not throw under normal operation.
 * @example
 * ```ts
 * const label = toRegionLabel('ear_left');
 * ```
 */
function toRegionLabel(region: HeadRegion | null): string {
  if (region === null) {
    return '未選択';
  }

  return HEAD_REGION_LABEL[region];
}

/**
 * Handles BGM select changes and normalizes empty values to null.
 *
 * @param {ChangeEvent<HTMLSelectElement>} event Select change event.
 * @param {(bgmSoundId: string | null) => void} onSelectBgm BGM selection callback.
 * @returns {void} This function does not return a value.
 * @throws {Error} This function does not throw under normal operation.
 * @example
 * ```ts
 * handleBgmSelection(event, onSelectBgm);
 * ```
 */
function handleBgmSelection(
  event: ChangeEvent<HTMLSelectElement>,
  onSelectBgm: (bgmSoundId: string | null) => void
): void {
  const value = event.currentTarget.value.trim();
  onSelectBgm(value.length === 0 ? null : value);
}

/**
 * Renders playback controls and ambient/BGM controls.
 *
 * @param {ControlPanelProps} props Panel state and callbacks.
 * @returns {JSX.Element} Control panel view.
 * @throws {Error} This component does not throw under normal operation.
 * @example
 * ```tsx
 * <ControlPanel {...props} />
 * ```
 */
export function ControlPanel(props: ControlPanelProps): ReactElement {
  return (
    <aside className="panel control-panel" aria-label="Controls">
      <h2 className="panel-title">Control</h2>
      <div className="control-list">
        <div className="control-item">
          <span className="control-label">選択中サウンド</span>
          <span className="control-value">{props.selectedSound.label}</span>
        </div>
        <div className="control-item">
          <span className="control-label">ヒット部位</span>
          <span className="control-value">{toRegionLabel(props.activeRegion)}</span>
        </div>
      </div>

      <button
        type="button"
        className={`action-button ${props.isAudioReady ? 'is-active' : ''}`}
        onClick={() => {
          void props.onEnableAudio();
        }}
      >
        {props.isAudioReady ? '音声有効化済み' : '音声を有効化'}
      </button>

      <label className="slider-wrap" htmlFor="master-gain">
        <span className="control-label">Master Gain</span>
        <input
          id="master-gain"
          type="range"
          min={0}
          max={1.2}
          step={0.01}
          value={props.masterGain}
          onChange={(event) => {
            props.onMasterGainChange(Number(event.currentTarget.value));
          }}
        />
      </label>

      <label className="slider-wrap" htmlFor="bgm-select">
        <span className="control-label">BGM</span>
        <select
          id="bgm-select"
          value={props.selectedBgmId ?? ''}
          onChange={(event) => {
            handleBgmSelection(event, props.onSelectBgm);
          }}
        >
          <option value="">なし</option>
          {props.bgmSounds.map((sound) => (
            <option key={sound.id} value={sound.id}>
              {sound.label}
            </option>
          ))}
        </select>
      </label>

      <label className="slider-wrap" htmlFor="bgm-gain">
        <span className="control-label">BGM Gain</span>
        <input
          id="bgm-gain"
          type="range"
          min={0}
          max={1.2}
          step={0.01}
          value={props.bgmGain}
          onChange={(event) => {
            props.onBgmGainChange(Number(event.currentTarget.value));
          }}
        />
      </label>

      <button
        type="button"
        className="sub-action-button"
        onClick={() => {
          props.onToggleSettings();
        }}
      >
        設定を開く
      </button>
    </aside>
  );
}
