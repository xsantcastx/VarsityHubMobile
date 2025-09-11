// https://docs.expo.dev/guides/using-eslint/
// Flat config compatible with ESLint 8.x — no expo preset required
const reactNative = require('eslint-plugin-react-native');

module.exports = [
  // Ignore non-RN folders to keep lint signal focused
  {
    ignores: ['dist/*', 'server/**', 'src/**', 'node_modules/**'],
  },
  // RN rules for RN source folders
  {
    files: ['app/**/*.{js,jsx,ts,tsx}', 'components/**/*.{js,jsx,ts,tsx}', 'hooks/**/*.{js,jsx,ts,tsx}'],
    plugins: { 'react-native': reactNative },
    rules: {
      'react-native/no-raw-text': 'error',
    },
  },
];
