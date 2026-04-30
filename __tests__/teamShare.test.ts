import AppLinks from '@/utils/links';
import { canShareTeamQr, getCanonicalTeamShareUrl } from '@/utils/teamShare';

describe('team QR sharing', () => {
  it('only allows QR sharing for persisted public teams', () => {
    expect(canShareTeamQr({ id: 'team_123', is_private: false })).toBe(true);
    expect(canShareTeamQr({ id: 'team_123', is_private: true })).toBe(false);
    expect(canShareTeamQr({ id: 'temp-westhill', is_private: false })).toBe(false);
    expect(canShareTeamQr({ id: '', is_private: false })).toBe(false);
    expect(canShareTeamQr(null)).toBe(false);
  });

  it('uses one canonical QR URL per team regardless of title changes', () => {
    const initialLink = AppLinks.team('team_123', 'Westhill Wildcats');
    const renamedLink = AppLinks.team('team_123', 'Westhill Hoops');

    expect(initialLink.webUrl).toBe('https://varsityhub.app/teams/team_123');
    expect(renamedLink.webUrl).toBe(initialLink.webUrl);
    expect(getCanonicalTeamShareUrl('team_123')).toBe(initialLink.webUrl);
  });

  it('gives different QR URLs to different teams', () => {
    expect(getCanonicalTeamShareUrl('team_123')).not.toBe(getCanonicalTeamShareUrl('team_456'));
  });
});

