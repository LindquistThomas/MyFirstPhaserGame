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
        'src/scenes/**',
        'src/features/floors/**',
        'src/plugins/**',
        'src/systems/SpriteGenerator.ts',
        'src/systems/sprites/**',
        'src/systems/SoundGenerator.ts',
        'src/systems/sounds/**',
        'src/systems/MusicGenerator.ts',
        'src/ui/**',
        'src/entities/**',
        'src/input/phaser-augment.d.ts',
      ],
      thresholds: {
        'src/systems/**': { lines: 60, branches: 60, functions: 60, statements: 60 },
        'src/input/**': { lines: 60, branches: 60, functions: 60, statements: 60 },
      },
    },
  },
});
