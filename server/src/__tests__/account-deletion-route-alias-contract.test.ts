import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

const authRoute = read('src/routes/auth.ts');
const usersRoute = read('src/routes/users.ts');

describe('account deletion route alias contract', () => {
  it('parses both route payloads through the shared account deletion schema', () => {
    expect(authRoute).toMatch(/accountDeletionPayloadSchema\.safeParse\(req\.body \?\? \{\}\)/);
    expect(usersRoute).toMatch(/accountDeletionPayloadSchema\.safeParse\(req\.body \|\| \{\}\)/);
  });

  it('routes both endpoints through the canonical processSelfAccountDeletion flow', () => {
    expect(authRoute).toMatch(/processSelfAccountDeletion\(userId, parsed\.data\)/);
    expect(usersRoute).toMatch(/processSelfAccountDeletion\(id, parsed\.data\)/);
    expect(authRoute).toMatch(/return res\.status\(deletion\.status\)\.json\(deletion\.body\);/);
    expect(usersRoute).toMatch(/return res\.status\(deletion\.status\)\.json\(deletion\.body\);/);
  });

  it('keeps route handlers thin so deletion logic is not duplicated on top of the shared flow', () => {
    expect(authRoute).not.toMatch(/assertCanSelfDeleteUser\(/);
    expect(authRoute).not.toMatch(/softDeleteUserAccount\(/);
    expect(authRoute).not.toMatch(/getAccountDeletionConfirmationRequirements\(/);

    expect(usersRoute).not.toMatch(/assertCanSelfDeleteUser\(/);
    expect(usersRoute).not.toMatch(/softDeleteUserAccount\(/);
    expect(usersRoute).not.toMatch(/getAccountDeletionConfirmationRequirements\(/);
    expect(usersRoute).not.toMatch(/bcrypt\.compare/);
  });

  it('removes legacy /users/me deletion response drift and side-effect email sends', () => {
    expect(usersRoute).not.toMatch(/Account deletion accepted/);
    expect(usersRoute).not.toMatch(/sendEmail/);
    expect(usersRoute).not.toMatch(/deleted:\s*true/);
  });
});
