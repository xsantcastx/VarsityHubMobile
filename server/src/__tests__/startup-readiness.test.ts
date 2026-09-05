/** Exercise the real shell startup with local command stubs; never run Prisma/DB/provider calls. */
import { afterAll, describe, expect, it } from '@jest/globals';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import http from 'node:http';
const source = readFileSync(resolve('start.sh'), 'utf8');
const dirs: string[] = [];
afterAll(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })));
const quote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

async function runStartup(options: { migrationFails?: boolean; backupFails?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'varsityhub-startup-test-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'start.sh'), source);
  writeFileSync(
    join(dir, 'bin', 'node'),
    `#!/bin/sh\nif [ "$1" = "dist/index.js" ]; then echo REAL_API_STARTED; exit 0; fi\nexec ${quote(process.execPath)} "$@"\n`,
    { mode: 0o700 }
  );
  writeFileSync(
    join(dir, 'bin', 'timeout'),
    '#!/bin/sh\nif [ "$1" != "--kill-after=5" ]; then exit 99; fi\nshift\necho "TIMEOUT_BOUND=$1"\nshift\nexec "$@"\n',
    { mode: 0o700 }
  );
  writeFileSync(
    join(dir, 'node_modules', '.bin', 'prisma'),
    `#!/bin/sh\necho "PRISMA_STUB:$*"\nif [ "$1:$2" = "migrate:deploy" ] && [ "$FAIL_MIGRATION" = "1" ]; then exit 7; fi\nif [ "$1:$2" = "db:push" ] && [ "$FAIL_BACKUP" = "1" ]; then exit 8; fi\nexit 0\n`,
    { mode: 0o700 }
  );
  return await new Promise<{ code: number | null; output: string }>((resolveRun, reject) => {
    const child = spawn('/bin/sh', ['start.sh'], {
      cwd: dir,
      env: {
        PATH: `${join(dir, 'bin')}:/usr/bin:/bin`,
        NODE_ENV: 'test',
        PORT: '0',
        HOST: '127.0.0.1',
        DATABASE_URL: 'postgresql://audit@127.0.0.1:5432/unused_local_fixture',
        ...(options.backupFails
          ? {
              DATABASE_BACKUP_URL: 'postgresql://audit@127.0.0.1:5432/unused_backup_fixture',
              FAIL_BACKUP: '1',
            }
          : {}),
        FAIL_MIGRATION: options.migrationFails ? '1' : '0',
        PRISMA_MIGRATE_RETRIES: '2',
        PRISMA_MIGRATE_SLEEP_SECS: '0',
      },
    });
    let output = '';
    child.stdout.on('data', data => {
      output += String(data);
    });
    child.stderr.on('data', data => {
      output += String(data);
    });
    child.on('error', reject);
    child.on('close', code => resolveRun({ code, output }));
  });
}

function get(port: number, path: string) {
  return new Promise<{ status: number | undefined; retryAfter: string | undefined; body: any }>(
    (resolveGet, reject) => {
      http
        .get({ hostname: '127.0.0.1', port, path }, response => {
          let body = '';
          response.on('data', data => {
            body += String(data);
          });
          response.on('end', () =>
            resolveGet({
              status: response.statusCode,
              retryAfter: response.headers['retry-after'],
              body: JSON.parse(body),
            })
          );
        })
        .on('error', reject);
    }
  );
}

describe('deployment readiness before the real API', () => {
  it('returns 503 and retry advice for health variants and API requests while startup is incomplete', async () => {
    const placeholder = /node <<'EOF' &\n([\s\S]*?)\nEOF/.exec(source)?.[1];
    expect(placeholder).toBeTruthy();
    const child = spawn(process.execPath, ['-e', placeholder!], {
      env: { PORT: '0', HOST: '127.0.0.1' },
    });
    try {
      const port = await new Promise<number>((resolvePort, reject) => {
        child.on('error', reject);
        child.on('exit', code => reject(new Error(`Placeholder exited early: ${code}`)));
        child.stdout.on('data', data => {
          const match = /127\.0\.0\.1:(\d+)/.exec(String(data));
          if (match) resolvePort(Number(match[1]));
        });
      });
      for (const path of ['/health', '/health/', '/health?probe=1', '/games']) {
        expect(await get(port, path)).toEqual({
          status: 503,
          retryAfter: '15',
          body: { status: 'starting', message: 'API startup in progress' },
        });
      }
    } finally {
      child.kill('SIGTERM');
      await new Promise(resolveClose => child.on('close', resolveClose));
    }
  });
  it('fails closed after migration retries, preserves the actual exit code, and bounds diagnostics', async () => {
    const result = await runStartup({ migrationFails: true });
    expect(result.code).toBe(1);
    expect(result.output.match(/PRISMA_STUB:migrate deploy/g)).toHaveLength(2);
    expect(result.output).toContain('exited with status 7');
    expect(result.output).toContain('TIMEOUT_BOUND=30');
    expect(result.output).toContain('TIMEOUT_BOUND=10');
    expect(result.output).not.toContain('REAL_API_STARTED');
  });
  it('starts the real API after successful migration and treats a bounded backup failure as nonfatal', async () => {
    const result = await runStartup({ backupFails: true });
    expect(result.code).toBe(0);
    expect(result.output).toContain('Migrations applied successfully');
    expect(result.output).toContain('TIMEOUT_BOUND=180');
    expect(result.output).toContain('Backup schema push failed (non-fatal)');
    expect(result.output).toContain('REAL_API_STARTED');
    expect(result.output.indexOf('Migrations applied successfully')).toBeLessThan(
      result.output.indexOf('REAL_API_STARTED')
    );
  });
});
