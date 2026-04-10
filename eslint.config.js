// https://docs.expo.dev/guides/using-eslint/
// Flat config compatible with ESLint 8.x — no expo preset required
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  // Ignore non-RN folders to keep lint signal focused
  {
    ignores: ['dist/*', 'server/**', 'node_modules/**', '.expo/**', 'android/**', 'ios/**'],
  },
  // RN rules for RN source folders (excluding test files)
  {
    files: [
      'app/**/*.{js,jsx,ts,tsx}',
      'components/**/*.{js,jsx,ts,tsx}',
      'src/**/*.{js,jsx,ts,tsx}',
    ],
    ignores: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
      },
    },
    plugins: {
      'react-native': reactNative,
      'react-hooks': reactHooks,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'react-native/no-raw-text': ['error', { skip: ['ThemedText'] }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Use TS version instead of base ESLint rule
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Intentional fire-and-forget patterns (haptics, analytics) - warn not error
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      // Allow console.warn and console.error for debugging
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Test files are ignored from linting to avoid parser issues
  {
    ignores: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
  },
];
