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
        // Initial UI threshold phase: exclude heavier modal/panel files so
        // HUD and DialogController drive coverage first. Remove these as
        // additional UI unit tests are added.
        'src/ui/{ElevatorButtons,ElevatorPanel,InfoDialog,InfoIcon,ModalBase,ModalKeyboardNavigator,QuizDialog,QuizResultsScreen}.ts',
        'src/input/phaser-augment.d.ts',
      ],
      thresholds: {
        'src/systems/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'src/input/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'src/ui/**': { lines: 60, branches: 60, functions: 60, statements: 60 },
        'src/entities/**': { lines: 60, branches: 60, functions: 60, statements: 60 },
      },
    },
  },
});
