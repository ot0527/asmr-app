import { ScreenOrientation } from '@capacitor/screen-orientation';
import { isNativeRuntime } from './runtime';

/**
 * ネイティブ実行時のみ画面向きを横向きにロックする。
 *
 * @returns {Promise<boolean>} ロック成功時はtrue、未対応または失敗時はfalse。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const locked = await lockLandscapeWhenNative();
 * ```
 */
export async function lockLandscapeWhenNative(): Promise<boolean> {
  if (!isNativeRuntime()) {
    return false;
  }

  try {
    await ScreenOrientation.lock({ orientation: 'landscape' });
    return true;
  } catch {
    return false;
  }
}
