import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const discoverScreen = read('app/(tabs)/discover/mobile-community.tsx');
const profileScreen = read('app/features/navigation/screens/ProfileScreen.tsx');
const teamScreen = read('app/team-page.tsx');

describe('discover result screen contracts', () => {
  it('discover result taps route to the canonical user, team, organization, game, and event screens', () => {
    expect(discoverScreen).toContain('void router.push(`/user-profile?id=${u.id}`);');
    expect(discoverScreen).toContain('void router.push(`/team-page?id=${t.id}`);');
    expect(discoverScreen).toContain("void router.push({ pathname: '/organizations/[id]', params: { id: String(o.id) } });");
    expect(discoverScreen).toContain("void router.push({ pathname: '/game/[id]', params: { id: String(game.id) } });");
    expect(discoverScreen).toContain("void router.push({ pathname: '/event-detail', params: { id: String(event.id) } });");
  });

  it('profile screen fails closed with retryable error states instead of a permanent loading spinner', () => {
    expect(profileScreen).toContain("setError(viewingUserId ? 'User not found.' : 'You need to sign in to view your profile.')");
    expect(profileScreen).toContain("setError('This user was not found or may have been deleted.')");
    expect(profileScreen).toContain('profileRequestInFlight.current = false;');
    expect(profileScreen).toContain('setLoading(false);');
    expect(profileScreen).toContain("<Text style={[styles.error, { color: theme.text, textAlign: 'center', marginBottom: 8 }]}>");
    expect(profileScreen).toContain('<Button onPress={() => void loadProfile()}>');
  });

  it('team screen rejects invalid or missing params and exits loading in all cases', () => {
    expect(teamScreen).toContain("setError('Invalid team ID format');");
    expect(teamScreen).toContain("setError('No team ID or name provided');");
    expect(teamScreen).toContain('if (mounted.current) setLoading(false);');
    expect(teamScreen).toContain("<Text style={[styles.error, { color: theme.text }]}>Team not found</Text>");
    expect(teamScreen).toContain('<Pressable onPress={loadTeam} style={styles.retryButton}>');
  });

  it('team screen surfaces venue and organization context from the public summary payload', () => {
    expect(teamScreen).toContain('venue_address?: string | null;');
    expect(teamScreen).toContain("const teamVenue = typeof team?.venue_address === 'string' ? team.venue_address.trim() : '';");
    expect(teamScreen).toContain('const teamOrganizationName =');
    expect(teamScreen).toContain("pathname: '/organization'");
    expect(teamScreen).toContain("Ionicons name=\"location-outline\"");
    expect(teamScreen).toContain("Ionicons name=\"business-outline\"");
  });
});
