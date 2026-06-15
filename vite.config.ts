import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const AUDIO_ASSET_RE = /\/assets\/.*\.(mp3|ogg|wav)$/i;
const isMusicRequest = (pathname: string): boolean =>
  pathname.includes('/music/') || AUDIO_ASSET_RE.test(pathname);

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        globIgnores: ['music/**'],
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => isMusicRequest(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'music-runtime-cache',
              expiration: {
                // Keep runtime cache bounded per acceptance criteria: enough for
                // typical session replay while avoiding install-cache bloat.
                maxEntries: 12,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: 'hidden',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split Phaser into its own long-lived chunk so app-code changes
        // don't invalidate the (~1.1 MB) engine bytes in the user's HTTP
        // cache. Vite 8 / Rolldown requires the function form of
        // `manualChunks`; the object form is rejected at build time.
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
