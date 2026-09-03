const shellQuote = value => `'${String(value).replace(/'/g, `'\"'\"'`)}'`;

module.exports = {
  '{app,components,hooks,utils,api,context,constants,lib,shared,__tests__,tests}/**/*.{js,jsx,ts,tsx}':
    files => {
      const quotedFiles = files.map(shellQuote).join(' ');
      const tsFiles = files.filter(file => /\.(ts|tsx)$/.test(file));
      const tasks = [
        // prettier first so eslint sees already-formatted code
        `prettier --write ${quotedFiles}`,
      ];

      if (tsFiles.length > 0) {
        tasks.push(`tsc-files --noEmit -p tsconfig.json ${tsFiles.map(shellQuote).join(' ')}`);
      }

      if (tsFiles.length > 0) {
        tasks.push(`eslint --cache --fix --no-warn-ignored ${tsFiles.map(shellQuote).join(' ')}`);
      }

      return tasks;
    },
  'server/src/**/*.{ts,tsx}': files => {
    const serverFiles = files
      .filter(file => file.startsWith('server/'))
      .map(file => file.slice('server/'.length));

    if (serverFiles.length === 0) return [];

    return [
      `eslint --cache --fix --no-warn-ignored ${serverFiles.map(file => shellQuote(`server/${file}`)).join(' ')}`,
      `prettier --write ${serverFiles.map(file => shellQuote(`server/${file}`)).join(' ')}`,
      `bash -lc "cd server && npx tsc-files --noEmit -p tsconfig.json ${serverFiles.map(shellQuote).join(' ')}"`,
    ];
  },
  '*.{json,md}': ['prettier --write'],
};
