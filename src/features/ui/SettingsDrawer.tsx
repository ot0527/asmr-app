import type { ReactElement } from 'react';

/**
 * Props for the settings drawer component.
 */
export interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Renders a lightweight settings drawer for Phase2.
 *
 * @param {SettingsDrawerProps} props Drawer state and close callback.
 * @returns {JSX.Element} Settings drawer view.
 * @throws {Error} This component does not throw under normal operation.
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
