import { Capacitor } from '@capacitor/core';

/**
 * 実行中のランタイムプラットフォーム種別。
 */
export type RuntimePlatform = 'web' | 'android' | 'ios' | 'unknown';

/**
 * 現在の実行プラットフォームを正規化して返す。
 *
 * @returns {RuntimePlatform} 実行中プラットフォーム。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * const platform = resolveRuntimePlatform();
 * ```
 */
export function resolveRuntimePlatform(): RuntimePlatform {
  const platform = Capacitor.getPlatform();

  if (platform === 'web' || platform === 'android' || platform === 'ios') {
    return platform;
  }

  return 'unknown';
}

/**
 * 現在がネイティブ実行環境かを返す。
 *
 * @returns {boolean} Capacitorネイティブ環境の場合はtrue。
 * @throws {Error} 通常運用ではこの関数は例外をスローしない。
 * @example
 * ```ts
 * if (isNativeRuntime()) {
 *   // ネイティブ専用処理
 * }
 * ```
 */
export function isNativeRuntime(): boolean {
  return Capacitor.isNativePlatform();
}
