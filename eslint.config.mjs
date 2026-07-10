import js from '@eslint/js';
import globals from 'globals';

const FIRST_PARTY_JAVASCRIPT = [
  'assets/**/*.js',
  'assets/**/*.mjs',
  'packages/**/*.js',
  'packages/**/*.mjs',
  'scripts/**/*.js',
  'scripts/**/*.mjs'
];

export default [
  {
    ignores: ['assets/js/vendor/**', 'dist/**', 'node_modules/**', 'release-artifacts/**', 'scripts/fixtures/**']
  },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error'
    }
  },
  {
    files: FIRST_PARTY_JAVASCRIPT,
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-control-regex': 'off',
      'no-empty': 'off',
      'no-regex-spaces': 'off',
      'no-unused-vars': 'off',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
      'preserve-caught-error': 'off'
    }
  }
];
