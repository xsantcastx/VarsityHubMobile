import AppLinks from '@/utils/links';

describe('organization sharing', () => {
  it('uses one canonical public URL per organization regardless of title changes', () => {
    const initialLink = AppLinks.organization('org_123', 'Westhill Athletics');
    const renamedLink = AppLinks.organization('org_123', 'Westhill Sports');

    expect(initialLink.webUrl).toBe('https://varsityhub.app/organizations/org_123');
    expect(renamedLink.webUrl).toBe(initialLink.webUrl);
    expect(initialLink.deepLink).toBe('varsityhubmobile://organizations/org_123');
  });

  it('gives different public URLs to different organizations', () => {
    expect(AppLinks.organization('org_123').webUrl).not.toBe(
      AppLinks.organization('org_456').webUrl
    );
  });
});
