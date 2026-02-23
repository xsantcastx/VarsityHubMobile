/**
 * Ensures .prisma/client has "type": "commonjs" so Node treats the
 * generated CJS correctly when the project has "type": "module".
 * Fixes: "Must use import to load ES Module" when Jest loads Prisma.
 */
const fs = require('node:fs');
const path = require('node:path');

const prismaClientDir = path.resolve(
  process.cwd(),
  'node_modules',
  '.prisma',
  'client'
);

if (!fs.existsSync(prismaClientDir)) {
  process.exit(0);
}

const pkgPath = path.join(prismaClientDir, 'package.json');
const pkg = { type: 'commonjs' };
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
