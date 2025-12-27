/**
 * Jest tests for usePagination hook
 * Covers pagination logic, cursor management, and request deduplication
 */

import { usePagination } from '@/hooks/usePagination';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

describe('usePagination Hook', () => {
  const mockItems = [
    { id: '1', title: 'Item 1' },
    { id: '2', title: 'Item 2' },
    { id: '3', title: 'Item 3' },
  ];

  const mockNextPage = [
    { id: '4', title: 'Item 4' },
    { id: '5', title: 'Item 5' },
  ];

  afterEach(() => {
    cleanup();
  });

  describe('Initial State', () => {
    it('should initialize with empty items', () => {
      const fetchFn = jest.fn(async () => ({ items: [], nextCursor: null }));
      const { result } = renderHook(() => usePagination(fetchFn));

      expect(result.current.items).toEqual([]);
      expect(result.current.cursor).toBeNull();
      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should have refresh, loadMore, and reset methods', () => {
      const fetchFn = jest.fn(async () => ({ items: [], nextCursor: null }));
      const { result } = renderHook(() => usePagination(fetchFn));

      expect(typeof result.current.refresh).toBe('function');
      expect(typeof result.current.loadMore).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Refresh (First Page)', () => {
    it('should load first page of items', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        items: mockItems,
        nextCursor: 'cursor-1',
      });

      const { result } = renderHook(() => usePagination(fetchFn));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.items).toEqual(mockItems);
      expect(result.current.cursor).toBe('cursor-1');
      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should set hasMore to false when no nextCursor', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        items: mockItems,
        nextCursor: null,
      });

      const { result } = renderHook(() => usePagination(fetchFn));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.hasMore).toBe(false);
    });

    it('should call onCountsUpdate callback with counts', async () => {
      const onCountsUpdate = jest.fn();
      const counts = { total: 10, pages: 2 };
      const fetchFn = jest.fn().mockResolvedValue({
        items: mockItems,
        nextCursor: 'cursor-1',
        counts,
      });

      const { result } = renderHook(() =>
        usePagination(fetchFn, { onCountsUpdate })
      );

      // Trigger refresh to get counts
      await act(async () => {
        await result.current.refresh();
      });

      // Wait for callback to be called
      await waitFor(() => {
        expect(onCountsUpdate).toHaveBeenCalledWith(counts);
      });
    });

    it('should handle errors with onError callback', async () => {
      const onError = jest.fn();
      const error = new Error('Fetch failed');
      const fetchFn = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() =>
        usePagination(fetchFn, { onError })
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBe('Fetch failed');
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should handle errors without error message', async () => {
      const onError = jest.fn();
      const fetchFn = jest.fn().mockRejectedValue('Unknown error');

      const { result } = renderHook(() =>
        usePagination(fetchFn, { onError })
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBe('Failed to load data');
      expect(onError).toHaveBeenCalled();
    });

    it('should set isLoading while fetching', async () => {
      let resolvePromise: (value: any) => void;
      const fetchFn = jest.fn(
        () =>
          new Promise<{ items: typeof mockItems; nextCursor: string | null }>((resolve) => {
            resolvePromise = resolve;
          })
      );

      const { result } = renderHook(() => usePagination(fetchFn));

      // Start refresh
      act(() => {
        result.current.refresh();
      });

      // Wait for isLoading to become true
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Resolve the fetch
      await act(async () => {
        resolvePromise!({
          items: mockItems,
          nextCursor: 'cursor-1',
        });
      });

      // After loading
      expect(result.current.isLoading).toBe(false);
    });

    it('should prevent duplicate concurrent refresh requests', async () => {
      const fetchFn = jest.fn(
        () =>
          new Promise<{ items: typeof mockItems; nextCursor: string | null }>((resolve) =>
            setTimeout(() => {
              resolve({ items: mockItems, nextCursor: null });
            }, 50)
          )
      );

      const { result } = renderHook(() => usePagination(fetchFn));

      // Start two refresh calls simultaneously
      await act(async () => {
        result.current.refresh();
        result.current.refresh();
      });

      // Should only call fetch once due to requestInFlightRef
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('LoadMore (Pagination)', () => {
    it('should append next page items', async () => {
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce({
          items: mockItems,
          nextCursor: 'cursor-1',
        })
        .mockResolvedValueOnce({
          items: mockNextPage,
          nextCursor: 'cursor-2',
        });

      const { result } = renderHook(() => usePagination(fetchFn));

      // Load first page
      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.items).toEqual(mockItems);

      // Load next page
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.items).toEqual([...mockItems, ...mockNextPage]);
    });

    it('should update cursor after loadMore', async () => {
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce({
          items: mockItems,
          nextCursor: 'cursor-1',
        })
        .mockResolvedValueOnce({
          items: mockNextPage,
          nextCursor: 'cursor-2',
        });

      const { result } = renderHook(() => usePagination(fetchFn));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.cursor).toBe('cursor-1');

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.cursor).toBe('cursor-2');
    });

    it('should not loadMore if isLoading', async () => {
      const fetchFn = jest.fn(
        () =>
          new Promise<{ items: typeof mockItems; nextCursor: string | null }>((resolve) =>
            setTimeout(() => {
              resolve({ items: mockItems, nextCursor: 'cursor-1' });
            }, 100)
          )
      );

      const { result } = renderHook(() => usePagination(fetchFn));

      // Start loading
      act(() => {
        result.current.refresh();
      });

      // Try to loadMore while isLoading
      await act(async () => {
        await result.current.loadMore();
      });

      // Should only call fetch once (from refresh)
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should not loadMore if hasMore is false', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        items: mockItems,
        nextCursor: null,
      });

      const { result } = renderHook(() => usePagination(fetchFn));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.hasMore).toBe(false);

      // Try to loadMore
      await act(async () => {
        await result.current.loadMore();
      });

      // Should only call fetch once (from refresh)
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should pass cursor to fetchFn', async () => {
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce({
          items: mockItems,
          nextCursor: 'cursor-1',
        })
        .mockResolvedValueOnce({
          items: mockNextPage,
          nextCursor: null,
        });

      const { result } = renderHook(() => usePagination(fetchFn));

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => expect(fetchFn).toHaveBeenCalledWith(null));

      await act(async () => {
        await result.current.loadMore();
      });

      await waitFor(() => expect(fetchFn).toHaveBeenCalledWith('cursor-1'));
    });
  });

  describe('Reset', () => {
    it('should clear all pagination state', async () => {
      const fetchFn = jest.fn().mockResolvedValue({
        items: mockItems,
        nextCursor: 'cursor-1',
      });

      const { result } = renderHook(() => usePagination(fetchFn));

      // Load some data
      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.cursor).toBeNull();
      expect(result.current.hasMore).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Integration with Dependencies', () => {
    it('should handle changing fetchFn dependency', async () => {
      let fetchFn = jest.fn().mockResolvedValue({
        items: mockItems,
        nextCursor: null,
      });

      const { result, rerender } = renderHook(
        ({ fn }) => usePagination(fn),
        { initialProps: { fn: fetchFn } }
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.items).toEqual(mockItems);

      // Change fetchFn
      const newFetchFn = jest.fn().mockResolvedValue({
        items: mockNextPage,
        nextCursor: null,
      });

      rerender({ fn: newFetchFn });

      // Should use new fetchFn on next call
      await act(async () => {
        await result.current.refresh();
      });

      expect(newFetchFn).toHaveBeenCalled();
      expect(result.current.items).toEqual(mockNextPage);
    });

    it('should work with generic type parameter', async () => {
      interface CustomItem {
        id: string;
        name: string;
        active: boolean;
      }

      const customItems: CustomItem[] = [
        { id: '1', name: 'Item 1', active: true },
        { id: '2', name: 'Item 2', active: false },
      ];

      const fetchFn = jest.fn().mockResolvedValue({
        items: customItems,
        nextCursor: null,
      });

      const { result } = renderHook(() => usePagination<CustomItem>(fetchFn));

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.items).toEqual(customItems);
        expect(result.current.items[0]?.active).toBe(true);
      });
    });
  });
});
