import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * ASMRプロトタイプ向けViteビルド設定。
 *
 * @returns {import('vite').UserConfig} React対応のVite設定。
 * @throws {Error} プラグイン解決に失敗した場合にスローする。
 * @example
 * ```ts
 * export default defineConfig({ plugins: [react()] });
 * ```
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  }
});
