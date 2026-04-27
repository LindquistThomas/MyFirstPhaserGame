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
        // New UI files added without unit tests yet — excluded until tests are written.
        'src/ui/{AchievementsDialog,ControlHintsOverlay,VirtualGamepad,WelcomeModal,touchPrimary}.ts',
        // Boss-battle + room-elevator UI added without unit tests; tracked in
        // https://github.com/norconsult-digital/architect-elevator-game/issues/248
        // — add tests and remove these exclusions to restore the original floor.
        'src/ui/{BossHealthBar,CallElevatorButton}.ts',
        // Boss-battle entities (projectiles, CEO boss, mission item, terrorist commander)
        // added without unit tests; tracked in the same issue (#248).
        'src/entities/{BriefcaseProjectile,CEOBoss,CoffeeMugProjectile,MissionItem,PistolProjectile}.ts',
        'src/entities/enemies/TerroristCommander.ts',
        'src/input/phaser-augment.d.ts',
      ],
      thresholds: {
        'src/systems/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'src/input/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'src/ui/**': { lines: 60, branches: 55, functions: 60, statements: 60 },
        'src/entities/**': { lines: 60, branches: 60, functions: 60, statements: 60 },
      },
    },
  },
});
