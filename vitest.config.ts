import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/main.ts',
        'src/pwa.ts',
        'src/plugins/**',
        'src/features/floors/boss/BossArenaScene.ts',
        'src/systems/SpriteGenerator.ts',
        'src/systems/sprites/**',
        'src/systems/SoundGenerator.ts',
        'src/systems/sounds/**',

        'src/input/phaser-augment.d.ts',
      ],
      thresholds: {
        'src/systems/**': { lines: 80, branches: 75, functions: 80, statements: 80 },
        'src/input/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'src/ui/**': { lines: 75, branches: 70, functions: 75, statements: 75 },
        'src/entities/**': { lines: 60, branches: 60, functions: 60, statements: 60 },
        'src/scenes/**': { lines: 40, branches: 20, functions: 35, statements: 40 },
        'src/features/floors/**': { lines: 45, branches: 40, functions: 40, statements: 45 },
        'src/features/floors/boss/**': { lines: 75, branches: 60, functions: 70, statements: 75 },
      },
    },
  },
});
