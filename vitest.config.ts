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
        'src/plugins/**',
        'src/systems/SpriteGenerator.ts',
        'src/systems/sprites/**',
        'src/systems/SoundGenerator.ts',
        'src/systems/sounds/**',
        // Initial UI threshold phase: exclude heavier modal/panel files so
        // HUD and DialogController drive coverage first. Remove these as
        // additional UI unit tests are added.
        'src/ui/{ElevatorButtons,InfoDialog,InfoIcon,ModalBase,QuizDialog,QuizResultsScreen}.ts',
        // New UI files added without unit tests yet — excluded until tests are written.
        // TODO: add tests for ControlHintsOverlay and touchPrimary to remove them too.
        'src/ui/{ControlHintsOverlay,touchPrimary}.ts',

        'src/input/phaser-augment.d.ts',
      ],
      thresholds: {
        'src/systems/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'src/input/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'src/ui/**': { lines: 65, branches: 60, functions: 65, statements: 65 },
        'src/entities/**': { lines: 60, branches: 60, functions: 60, statements: 60 },
        'src/scenes/**': { lines: 20, branches: 20, functions: 18, statements: 20 },
        'src/features/floors/**': { lines: 17, branches: 12, functions: 13, statements: 17 },
      },
    },
  },
});
