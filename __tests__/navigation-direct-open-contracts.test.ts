import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const messageThread = read('app/message-thread.tsx');
const profile = read('app/profile.tsx');
const teamContacts = read('app/(tabs)/team-contacts.tsx');
const organizationDetail = read('app/organizations/[id].tsx');
const postDetail = read('app/post-detail.tsx');

describe('direct-open navigation contracts', () => {
  it('message-thread accepts an explicit fallback and callers preserve their parent screen', () => {
    expect(messageThread).toContain('fallback?: string');
    expect(messageThread).toContain("'/messages'");
    expect(messageThread).toContain('safeGoBack(router, explicitFallback)');
    expect(profile).toContain("pathname: '/message-thread'");
    expect(profile).toContain('fallback: `/user-profile?id=${encodeURIComponent(viewingUserId)}`');
    expect(teamContacts).toContain("pathname: '/message-thread'");
    expect(teamContacts).toContain('`/team-contacts?id=${encodeURIComponent(String(id))}`');
  });

  it('request-join-organization stays deleted — self-initiated org joining lives only in coach onboarding (step-3-league)', () => {
    // The screen was first orphaned (entry buttons removed by design), then
    // deleted entirely: athletes/fans must never self-join teams or orgs.
    expect(existsSync(join(ROOT, 'app/request-join-organization.tsx'))).toBe(false);
    expect(organizationDetail).not.toContain("pathname: '/request-join-organization'");
  });

  it('post-detail uses explicit fallback for direct highlights entry while still delegating to shared safe back', () => {
    expect(postDetail).toContain("params.from === 'highlights' ? '/(tabs)/highlights' : undefined");
    expect(postDetail).toContain('const handleBack = useCallback(() => {');
    expect(postDetail).toContain('safeGoBack(router, explicitFallback)');
  });
});
