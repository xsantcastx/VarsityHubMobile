import { act, renderHook } from '@testing-library/react-native';
import { useOrganizationSearch } from '../hooks/useOrganizationSearch';

jest.mock('@/utils/sentry', () => ({ captureException: jest.fn() }));
const mockGet = jest.fn();
jest.mock('@/api/http', () => ({ httpGet: (...args: unknown[]) => mockGet(...args) }));
jest.mock('@/api/entities', () => ({ Organization: { list: jest.fn() } }));
jest.mock('@/utils/toUserMessage', () => ({ toUserMessage: () => 'Request failed' }));

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('organization search request isolation', () => {
  beforeEach(() => mockGet.mockReset());

  it('keeps the latest query when an older request finishes last', async () => {
    const old = deferred();
    const recent = deferred();
    mockGet.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    const { result } = renderHook(() => useOrganizationSearch());
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = result.current.search({ mode: 'nearby', query: 'old ZIP' });
      second = result.current.search({ mode: 'nearby', query: 'new ZIP' });
    });
    await act(async () => {
      recent.resolve([{ id: 'new' }]);
      await second;
    });
    await act(async () => {
      old.resolve([{ id: 'old' }]);
      await first;
    });
    expect(result.current.organizations).toEqual([{ id: 'new' }]);
  });

  it('does not repopulate cleared search results from an in-flight request', async () => {
    const pending = deferred();
    mockGet.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useOrganizationSearch());
    let request!: Promise<void>;
    act(() => {
      request = result.current.search({ mode: 'nearby', query: 'old ZIP' });
    });
    act(() => result.current.clear());
    await act(async () => {
      pending.resolve([{ id: 'stale' }]);
      await request;
    });
    expect(result.current.organizations).toEqual([]);
  });

  it('surfaces an invalid payload instead of reporting a successful empty search', async () => {
    mockGet.mockResolvedValue({ unexpected_schema: true });
    const { result } = renderHook(() => useOrganizationSearch());
    await act(async () => {
      await result.current.search({ mode: 'nearby', query: 'ZIP' });
    });
    expect(result.current.error).not.toBeNull();
  });
});
