import { DEFAULT_FALLBACK, inferContextualFallback } from '@/context/NavigationHistoryContext';

describe('inferContextualFallback', () => {
  it('falls back to organization teams for coach team workspace routes', () => {
    expect(inferContextualFallback('/create-team?orgId=org_123')).toBe(
      '/organization?id=org_123&tab=teams'
    );
    expect(inferContextualFallback('/team-admin?orgId=org_123&tab=staff')).toBe(
      '/organization?id=org_123&tab=teams'
    );
  });

  it('falls back to organization requests for coach review routes', () => {
    expect(
      inferContextualFallback('/organization-join-requests?organization_id=org_123')
    ).toBe('/organization?id=org_123&tab=requests');
  });

  it('falls back to the settings index for nested settings routes', () => {
    expect(inferContextualFallback('/settings/manage-subscription')).toBe('/settings');
  });

  it('falls back to messages for message detail routes', () => {
    expect(inferContextualFallback('/message-thread?conversation_id=conv_123')).toBe('/messages');
  });

  it('uses the last visited tab when no smarter mapping exists', () => {
    expect(inferContextualFallback('/public-event?id=evt_123', '/(tabs)/discover')).toBe(
      '/(tabs)/discover'
    );
    expect(inferContextualFallback(null)).toBe(DEFAULT_FALLBACK);
  });
});
