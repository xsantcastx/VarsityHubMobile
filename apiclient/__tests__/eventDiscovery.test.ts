import { fetchDiscoveryItems } from '../eventDiscovery';
import { httpGet } from '../http';
jest.mock('../http', () => ({ httpGet: jest.fn() }));
jest.mock('@/utils/sentry', () => ({ captureException: jest.fn() }));

describe('discovery page loading', () => {
  beforeEach(() => jest.resetAllMocks());
  it('continues empty pages and keeps same-ID game/event entities distinct', async () => {
    jest
      .mocked(httpGet)
      .mockResolvedValueOnce({ items: [], next_cursor: 'page-2' })
      .mockResolvedValueOnce({
        items: [{ id: 'same', source_type: 'game' }],
        next_cursor: 'page-3',
      })
      .mockResolvedValueOnce({ items: [{ id: 'same', source_type: 'event' }], next_cursor: null });
    const items = await fetchDiscoveryItems({ surface: 'map', sport: 'basketball' });
    expect(items.map(item => item.source_type)).toEqual(['game', 'event']);
    expect(httpGet).toHaveBeenCalledTimes(3);
    expect(jest.mocked(httpGet).mock.calls[2][0]).toContain('cursor=page-3');
  });
  it('never turns a malformed or legacy truncated response into a confirmed empty map', async () => {
    jest.mocked(httpGet).mockResolvedValue({ items: [] });
    await expect(fetchDiscoveryItems({ surface: 'map' })).rejects.toThrow('continuation');
  });
  it('fails the complete query when a later page fails instead of hiding missing events', async () => {
    jest
      .mocked(httpGet)
      .mockResolvedValueOnce({ items: [{ id: '1', source_type: 'game' }], next_cursor: 'more' })
      .mockRejectedValueOnce(new Error('offline'));
    await expect(fetchDiscoveryItems({ surface: 'map' })).rejects.toThrow('offline');
  });
  it('cancels between pages without starting more network work', async () => {
    const controller = new AbortController();
    jest.mocked(httpGet).mockImplementationOnce(async () => {
      controller.abort();
      return { items: [], next_cursor: 'more' };
    });
    await expect(fetchDiscoveryItems({ surface: 'map' }, controller.signal)).rejects.toThrow(
      'cancelled'
    );
    expect(httpGet).toHaveBeenCalledTimes(1);
  });
});
