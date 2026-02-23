import type { ReactElement } from 'react';

/**
 * Props for the settings drawer component.
 */
export interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Renders a lightweight settings drawer for Phase1.
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
        <p>Phase1では音響と3D操作に集中するため、設定は最小構成です。</p>
        <ul>
          <li>モデル上ドラッグ: ASMRトリガー</li>
          <li>余白ドラッグ: モデル回転</li>
          <li>タップ: 単発再生</li>
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
