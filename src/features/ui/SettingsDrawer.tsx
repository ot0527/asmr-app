import type { ReactElement } from 'react';

/**
 * 設定ドロワーコンポーネントのProps。
 */
export interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Phase2向けの軽量設定ドロワーを描画する。
 *
 * @param {SettingsDrawerProps} props ドロワーの状態とクローズ用コールバック。
 * @returns {JSX.Element} 設定ドロワー表示。
 * @throws {Error} 通常運用ではこのコンポーネントは例外をスローしない。
 * @example
 * ```tsx
 * <SettingsDrawer isOpen={open} onClose={() => setOpen(false)} />
 * ```
 */
export function SettingsDrawer(props: SettingsDrawerProps): ReactElement {
  return (
    <aside className={`settings-drawer ${props.isOpen ? 'is-open' : ''}`} aria-hidden={!props.isOpen}>
      <div className="settings-content">
        <h2>Settings</h2>
        <p>Phase2では録音・BGM・カテゴリ拡張に対応し、操作設定を段階的に追加しています。</p>
        <ul>
          <li>モデル上ドラッグ: 連続ストローク再生</li>
          <li>余白ドラッグ: モデル回転</li>
          <li>録音/インポート: マイ音源へ追加</li>
        </ul>
        <button
          type="button"
          className="sub-action-button"
          onClick={() => {
            props.onClose();
          }}
        >
          閉じる
        </button>
      </div>
    </aside>
  );
}
