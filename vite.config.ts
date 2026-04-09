import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Required for @ffmpeg/ffmpeg — prevents Vite pre-bundler from breaking WASM worker loading
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  // Needed for top-level await used in WASM bootstrap
  build: {
    target: 'esnext',
  },
  // COOP/COEP headers enable SharedArrayBuffer (required for @ffmpeg/core-mt multi-threaded mode).
  // Harmless for current single-threaded build; enables a future multi-threaded upgrade without
  // needing to re-configure the dev server.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
