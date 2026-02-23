import type { ChangeEvent, ReactElement } from 'react';
import type { UserSoundAsset } from '../../core/types';

/**
 * Props for the recording panel component.
 */
export interface RecordingUIProps {
  isRecording: boolean;
  recordingLevel: number;
  statusMessage: string;
  assets: UserSoundAsset[];
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onImportFile: (file: File) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
}

/**
 * Converts timestamp to a short local date string.
 *
 * @param {number} timestamp Epoch milliseconds.
 * @returns {string} Localized short date-time.
 * @throws {Error} This function does not throw under normal operation.
 * @example
 * ```ts
 * const label = toShortDateTime(Date.now());
 * ```
 */
function toShortDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Renders recording and user-sound management controls.
 *
 * @param {RecordingUIProps} props Recording state and callbacks.
 * @returns {JSX.Element} Recording panel UI.
 * @throws {Error} This component does not throw under normal operation.
 * @example
 * ```tsx
 * <RecordingUI {...props} />
 * ```
 */
export function RecordingUI(props: RecordingUIProps): ReactElement {
  /**
   * Handles file picker changes and forwards the file to import logic.
   *
   * @param {ChangeEvent<HTMLInputElement>} event File input change event.
   * @returns {void} This handler does not return a value.
   * @throws {Error} This handler does not throw under normal operation.
   * @example
   * ```ts
   * handleFileChange(event);
   * ```
   */
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];

    if (file !== undefined) {
      void props.onImportFile(file);
    }

    event.currentTarget.value = '';
  };

  return (
    <aside className="panel recording-panel" aria-label="Recording controls">
      <h2 className="panel-title">Recording</h2>
      <p className="panel-subtitle">MediaRecorderで録音し、ユーザー音源として保存します。</p>

      <div className="recording-meter" aria-hidden="true">
        <div
          className={`recording-meter-fill ${props.isRecording ? 'is-live' : ''}`}
          style={{ width: `${Math.round(Math.min(Math.max(props.recordingLevel, 0), 1) * 100)}%` }}
        />
      </div>

      <div className="recording-controls">
        {!props.isRecording ? (
          <button
            type="button"
            className="action-button recording-action"
            onClick={() => {
              void props.onStartRecording();
            }}
          >
            ● 録音開始
          </button>
        ) : (
          <button
            type="button"
            className="action-button recording-action is-stop"
            onClick={() => {
              void props.onStopRecording();
            }}
          >
            ■ 録音停止
          </button>
        )}

        <label className="import-label">
          音源をインポート
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
            onChange={handleFileChange}
          />
        </label>
      </div>

      <p className="recording-status">{props.statusMessage}</p>

      <div className="user-sound-list-wrap">
        <h3 className="user-sound-heading">保存済み音源 ({props.assets.length})</h3>
        <ul className="user-sound-list">
          {props.assets.map((asset) => (
            <li key={asset.id} className="user-sound-item">
              <div className="user-sound-meta">
                <span className="user-sound-name">{asset.name}</span>
                <span className="user-sound-date">{toShortDateTime(asset.updatedAt)}</span>
              </div>
              <button
                type="button"
                className="user-sound-delete"
                onClick={() => {
                  void props.onDeleteAsset(asset.id);
                }}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
