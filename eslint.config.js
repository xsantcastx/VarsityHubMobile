// https://docs.expo.dev/guides/using-eslint/
// Flat config compatible with ESLint 8.x — no expo preset required
const path = require('path');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');

const repoRoot = __dirname;
const appTsconfig = path.join(repoRoot, 'tsconfig.json');
const serverTsconfig = path.join(repoRoot, 'server', 'tsconfig.eslint.json');

module.exports = [
  {
    ignores: [
      'dist/*',
      'server/dist/**',
      'server/node_modules/**',
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
    ],
  },
  {
    files: [
      'app/**/*.{js,jsx,ts,tsx}',
      'components/**/*.{js,jsx,ts,tsx}',
      'hooks/**/*.{js,jsx,ts,tsx}',
      'context/**/*.{js,jsx,ts,tsx}',
      'api/**/*.{js,jsx,ts,tsx}',
      'utils/**/*.{js,jsx,ts,tsx}',
      'constants/**/*.{js,jsx,ts,tsx}',
      'lib/**/*.{js,jsx,ts,tsx}',
      'shared/**/*.{js,jsx,ts,tsx}',
    ],
    ignores: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: appTsconfig,
        tsconfigRootDir: repoRoot,
      },
    },
    plugins: {
      'react-native': reactNative,
      'react-hooks': reactHooks,
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      // `Button` (components/ui/button.tsx) wraps raw-text children in <Text>
      // internally via React.Children.map, so lint's static "no raw text"
      // check is a false positive there. Same pattern as ThemedText.
      'react-native/no-raw-text': ['error', { skip: ['ThemedText', 'Button'] }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      'consistent-return': 'warn',
      'import/no-cycle': ['warn', { ignoreExternal: true }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*', '@/features/*/*/*', '@/features/*/*/*/*'],
              message:
                'Import from a feature public barrel only (for example "@/features/team"), not another feature’s internals.',
            },
          ],
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['server/src/**/*.{ts,tsx}', 'server/scripts/**/*.{ts,tsx}'],
    ignores: ['server/src/**/*.test.{ts,tsx}', 'server/src/**/__tests__/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: serverTsconfig,
        tsconfigRootDir: repoRoot,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      'consistent-return': 'warn',
      'import/no-cycle': ['warn', { ignoreExternal: true }],
      'no-console': ['warn', { allow: ['log', 'warn', 'error'] }],
    },
  },
  {
    files: ['server/src/routes/**/*.{ts,tsx}'],
    rules: {
      // Route handlers sit at the untyped request boundary and still carry a
      // large amount of legacy Prisma/Express glue. Keeping this warning on
      // here produces noise that buries higher-signal lint results.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'context/**/*.{ts,tsx}'],
    rules: {
      // Legacy screen/component surfaces still use permissive view-model
      // shapes heavily. Disabling this here makes lint actionable again while
      // preserving the rule in shared/core utility layers.
      '@typescript-eslint/no-explicit-any': 'off',
      // This rule mostly false-positives on React effect/event-handler
      // branches in the app surface and adds little signal relative to the
      // hook-specific rules we already keep.
      'consistent-return': 'off',
    },
  },
  {
    // Screens must not call the global fetch directly — network calls go through
    // api/* (CLAUDE.md "[ENG] Screens never call fetch directly"). Migrated from
    // the PR-checklist grep so it surfaces in-editor. Uses no-restricted-globals
    // (not a syntactic selector) so it resolves scope: a locally-declared helper
    // named `fetch` or a method call like `Highlights.fetch()` is NOT flagged —
    // only a reference to the real global fetch.
    files: ['app/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Screens must not call fetch directly — route requests through api/*. If genuinely unavoidable, add // eslint-disable-next-line no-restricted-globals with a justification.',
        },
      ],
    },
  },
  {
    ignores: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
  },
];
