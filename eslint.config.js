// https://docs.expo.dev/guides/using-eslint/
// Flat config compatible with ESLint 8.x — no expo preset required
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

const authI18nFiles = [
  'app/sign-in.tsx',
  'app/sign-up.tsx',
  'app/verify.tsx',
  'app/forgot-password.tsx',
  'app/reset-password.tsx',
];

const authI18nPlugin = {
  rules: {
    'no-auth-hardcoded-strings': {
      meta: {
        type: 'problem',
        messages: {
          hardcoded: 'Use auth/common translation keys instead of hardcoded auth copy.',
        },
      },
      create(context) {
        const hasLetters = (value) => /[A-Za-z]/.test(value);

        const isTranslateCallee = (callee) => {
          if (!callee) return false;

          if (callee.type === 'Identifier') {
            return callee.name === 't' || callee.name === 'translate';
          }

          return (
            callee.type === 'MemberExpression' &&
            !callee.computed &&
            callee.property.type === 'Identifier' &&
            callee.property.name === 't'
          );
        };

        const isInsideTranslateCall = (node) => {
          let current = node.parent;

          while (current) {
            if (current.type === 'CallExpression' && isTranslateCallee(current.callee)) {
              return true;
            }
            current = current.parent;
          }

          return false;
        };

        const isInsideScreenOptions = (node) => {
          let current = node.parent;

          while (current) {
            if (current.type === 'JSXAttribute' && current.name.type === 'JSXIdentifier' && current.name.name === 'options') {
              return true;
            }
            current = current.parent;
          }

          return false;
        };

        const reportIfLiteral = (node) => {
          if (isInsideTranslateCall(node)) {
            return;
          }

          if (node.type === 'Literal' && typeof node.value === 'string' && hasLetters(node.value)) {
            context.report({ node, messageId: 'hardcoded' });
          }

          if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
            const text = node.quasis.map((quasi) => quasi.value.cooked || '').join('');
            if (hasLetters(text)) {
              context.report({ node, messageId: 'hardcoded' });
            }
          }
        };

        const walk = (node) => {
          if (!node || typeof node !== 'object') {
            return;
          }

          if (node.type === 'Literal' || node.type === 'TemplateLiteral') {
            reportIfLiteral(node);
            return;
          }

          for (const [key, value] of Object.entries(node)) {
            if (key === 'parent') {
              continue;
            }

            if (Array.isArray(value)) {
              value.forEach(walk);
            } else if (value && typeof value.type === 'string') {
              walk(value);
            }
          }
        };

        return {
          JSXText(node) {
            if (hasLetters(node.value)) {
              context.report({ node, messageId: 'hardcoded' });
            }
          },
          JSXAttribute(node) {
            const attributeName = node.name && node.name.type === 'JSXIdentifier' ? node.name.name : '';

            if (!['placeholder', 'accessibilityLabel', 'accessibilityHint'].includes(attributeName)) {
              return;
            }

            walk(node.value);
          },
          CallExpression(node) {
            if (node.callee.type !== 'Identifier' || !['setError', 'setInfo'].includes(node.callee.name)) {
              return;
            }

            node.arguments.forEach(walk);
          },
          Property(node) {
            const keyName =
              node.key.type === 'Identifier'
                ? node.key.name
                : node.key.type === 'Literal' && typeof node.key.value === 'string'
                  ? node.key.value
                  : '';

            if (!['title', 'headerBackTitle'].includes(keyName)) {
              return;
            }

            if (!isInsideScreenOptions(node)) {
              return;
            }

            walk(node.value);
          },
        };
      },
    },
  },
};

module.exports = [
  // Ignore non-RN folders to keep lint signal focused
  {
    ignores: ['dist/*', 'server/**', 'node_modules/**', '.expo/**', 'android/**', 'ios/**'],
  },
  // RN rules for RN source folders (excluding test files)
  {
    files: ['app/**/*.{js,jsx,ts,tsx}', 'components/**/*.{js,jsx,ts,tsx}', 'hooks/**/*.{js,jsx,ts,tsx}'],
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
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
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
  {
    files: authI18nFiles,
    plugins: {
      local: authI18nPlugin,
    },
    rules: {
      'local/no-auth-hardcoded-strings': 'error',
    },
  },
];
