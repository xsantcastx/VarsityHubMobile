const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = __dirname.endsWith('/scripts')
  ? join(__dirname, '..')
  : process.cwd();
const serverDir = join(repoRoot, 'server');
const schemaPath = join(serverDir, 'prisma', 'schema.prisma');
const prismaBin = join(serverDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');

if (!existsSync(serverDir) || !existsSync(schemaPath) || !existsSync(prismaBin)) {
  process.exit(0);
}

const result = spawnSync(prismaBin, ['generate', '--schema', 'prisma/schema.prisma'], {
  cwd: serverDir,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
