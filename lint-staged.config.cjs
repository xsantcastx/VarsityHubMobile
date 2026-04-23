const shellQuote = (value) => `'${String(value).replace(/'/g, `'\"'\"'`)}'`;

module.exports = {
  '{app,components,hooks,utils,api,context,constants,lib,shared}/**/*.{js,jsx,ts,tsx}': [
    'tsc-files --noEmit -p tsconfig.json',
    'eslint --cache --fix --no-warn-ignored',
  ],
  'server/src/**/*.{ts,tsx}': (files) => {
    const serverFiles = files
      .filter((file) => file.startsWith('server/'))
      .map((file) => file.slice('server/'.length));

    if (serverFiles.length === 0) return [];

    return [
      `eslint --cache --fix --no-warn-ignored ${serverFiles.map((file) => shellQuote(`server/${file}`)).join(' ')}`,
      `bash -lc "cd server && npx tsc-files --noEmit -p tsconfig.json ${serverFiles.map(shellQuote).join(' ')}"`,
    ];
  },
  '*.{json,md}': [
    'prettier --write',
  ],
};
