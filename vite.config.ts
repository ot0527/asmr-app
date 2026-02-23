import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite build settings for the ASMR prototype.
 *
 * @returns {import('vite').UserConfig} React-enabled Vite configuration.
 * @throws {Error} Throws when the plugin resolution fails.
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
