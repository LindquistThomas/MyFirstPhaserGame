import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
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
