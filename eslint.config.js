import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'tests/screenshots/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['tests/**/*.ts', 'src/**/*.test.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Guard: raw eventBus.on/once inside scene files leaks listeners across
  // scene restarts (Phaser reuses scene instances).  Use either:
  //   • this.scopedEvents.on(...)  — auto-cleaned on shutdown
  //   • const lc = createSceneLifecycle(this); lc.bindEventBus(...)  — same guarantee
  //     (create one lifecycle token per scene, then reuse it for all subscriptions)
  {
    files: ['**/*Scene.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="eventBus"][callee.property.name="on"]',
          message:
            'Use this.scopedEvents.on() or (const lc = createSceneLifecycle(this)) lc.bindEventBus() instead of raw eventBus.on() in scene files — unmanaged subscriptions accumulate across scene restarts.',
        },
        {
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.object.name="eventBus"][callee.property.name="once"]',
          message:
            'Use this.scopedEvents.once() or (const lc = createSceneLifecycle(this)) lc.bindEventBus() instead of raw eventBus.once() in scene files — unmanaged subscriptions accumulate across scene restarts.',
        },
      ],
    },
  },
];
