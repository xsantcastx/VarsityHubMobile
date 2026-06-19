import fs from 'node:fs';
import path from 'node:path';

/**
 * [AUDIT] Validation-parity guard.
 *
 * CLAUDE.md states: "frontend constraints match the backend Zod schema —
 * username (3–20), email format, password (8+)". Client TS and server Zod
 * compile independently and can silently diverge, so this test pins the shared
 * constraints as a single canonical spec and asserts BOTH sides still encode
 * them.
 *
 * Deliberately source-based (fs reads, no imports): importing the route modules
 * would pull in Prisma/Express side effects, and the guard's job is to detect a
 * human editing one side without the other — exactly what reading the source
 * verifies. Same approach as scripts/verify-guardrails.sh and audit-navigation.sh.
 *
 * If you intentionally change a constraint, update CANONICAL below AND both the
 * server schema and the client check — that's the point: the change is forced to
 * be made in lockstep.
 */

// jest for the server package runs with cwd = <repo>/server, so the repo root
// is one level up. (ESM test context — no __dirname available.)
const REPO_ROOT = path.resolve(process.cwd(), '..');
const read = (rel: string) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const CANONICAL = {
  usernameMin: 3,
  usernameMax: 20,
  usernameRegex: '/^[a-z0-9_.]+$/',
  passwordMin: 8,
};

describe('validation parity (frontend ↔ backend)', () => {
  describe('username', () => {
    const serverAuth = read('server/src/routes/auth.ts');
    const clientEdit = read('app/settings/edit-username.tsx');

    it('server Zod enforces min/max/regex', () => {
      expect(serverAuth).toContain(`.min(${CANONICAL.usernameMin})`);
      expect(serverAuth).toContain(`.max(${CANONICAL.usernameMax})`);
      expect(serverAuth).toContain(CANONICAL.usernameRegex);
    });

    it('client enforces the same min/max/regex', () => {
      expect(clientEdit).toMatch(
        new RegExp(`length\\s*<\\s*${CANONICAL.usernameMin}`)
      );
      expect(clientEdit).toMatch(
        new RegExp(`length\\s*>\\s*${CANONICAL.usernameMax}`)
      );
      expect(clientEdit).toContain(CANONICAL.usernameRegex);
    });
  });

  describe('password', () => {
    const serverAuth = read('server/src/routes/auth.ts');

    it('server Zod enforces min length + letter & number', () => {
      expect(serverAuth).toContain(`.min(${CANONICAL.passwordMin})`);
      expect(serverAuth).toContain('/[a-zA-Z]/.test(val)');
      expect(serverAuth).toContain('/[0-9]/.test(val)');
    });

    it('client enforces the same min length', () => {
      const clientReset = read('app/forgot-password.tsx');
      expect(clientReset).toMatch(
        new RegExp(`password\\.length\\s*<\\s*${CANONICAL.passwordMin}`)
      );
    });
  });
});
