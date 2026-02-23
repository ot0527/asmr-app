import type { ChangeEvent, ReactElement } from 'react';
import { HEAD_REGION_LABEL } from '../../core/constants';
import type { HeadRegion, SoundDefinition } from '../../core/types';

/**
 * コントロールパネルコンポーネントのProps。
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
 * 部位IDをユーザー表示用テキストに変換する。
 *
 * @param {HeadRegion | null} region 現在アクティブな部位。
 * @returns {string} 表示用の部位テキスト。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
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
 * BGM選択変更を処理し、空値をnullに正規化する。
 *
 * @param {ChangeEvent<HTMLSelectElement>} event セレクト変更イベント。
 * @param {(bgmSoundId: string | null) => void} onSelectBgm BGM選択時のコールバック。
 * @returns {void} この関数は値を返しない。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
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
 * 再生コントロールと環境音/BGMコントロールを描画する。
 *
 * @param {ControlPanelProps} props パネルの状態とコールバック。
 * @returns {JSX.Element} コントロールパネル表示。
 * @throws {Error} 通常運用ではこのコンポーネントは例外をスローしない。
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
