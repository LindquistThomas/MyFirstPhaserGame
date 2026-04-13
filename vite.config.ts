import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    target: 'es2020',
  },
  server: {
    port: 3000,
    open: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
