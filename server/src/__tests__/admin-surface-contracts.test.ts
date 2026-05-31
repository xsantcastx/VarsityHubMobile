import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(process.cwd(), '..');
const readRepo = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');
const readServer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

const usersRoute = readServer('src/routes/users.ts');
const entities = readRepo('api/entities.ts');
const adminUsersScreen = readRepo('app/admin-users.tsx');
const adminTeamsScreen = readRepo('app/admin-teams.tsx');

describe('admin surface contracts', () => {
  it('admin user list and full-detail payloads include display_name', () => {
    expect(usersRoute).toMatch(/display_name/);
    expect(usersRoute).toMatch(
      /select:\s*\{[\s\S]*id: true,[\s\S]*email: true,[\s\S]*display_name: true,[\s\S]*username: true/
    );
  });

  it('admin user list search matches display_name as well as email and username', () => {
    expect(usersRoute).toMatch(/\{ display_name: \{ contains: q, mode: 'insensitive' \} \}/);
  });

  it('admin users screen uses the admin-specific user list path', () => {
    expect(adminUsersScreen).toMatch(/User\.listAllAdmin\(/);
  });

  it('team API exposes an admin-wide listing path using all=1', () => {
    expect(entities).toMatch(/listAllAdmin:\s*\(q\?: string, limit: number = 100\)/);
    expect(entities).toMatch(/all=1/);
  });

  it('admin teams screen uses the admin-wide team list path', () => {
    expect(adminTeamsScreen).toMatch(/TeamApi\.listAllAdmin\(/);
    expect(adminTeamsScreen).not.toMatch(/TeamApi\.list\('', false\)/);
  });
});
