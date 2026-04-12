import { describe, it, expect } from '@jest/globals';
import { LruCache } from '../lib/lruCache.js';

describe('LruCache', () => {
  it('returns undefined for a missing key', () => {
    const c = new LruCache<string, number>(4);
    expect(c.get('missing')).toBeUndefined();
  });

  it('stores and returns values within TTL', () => {
    const c = new LruCache<string, number>(4);
    c.set('a', 1, 10_000);
    expect(c.get('a')).toBe(1);
    expect(c.size).toBe(1);
  });

  it('expires values after TTL', () => {
    const c = new LruCache<string, number>(4);
    c.set('a', 1, 1); // 1ms
    const deadline = Date.now() + 10;
    while (Date.now() < deadline) {
      /* busy-wait */
    }
    expect(c.get('a')).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it('evicts the least-recently-used entry when over capacity', () => {
    const c = new LruCache<string, number>(3);
    c.set('a', 1, 10_000);
    c.set('b', 2, 10_000);
    c.set('c', 3, 10_000);
    // Touch 'a' so 'b' becomes least recently used.
    expect(c.get('a')).toBe(1);
    c.set('d', 4, 10_000);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(c.get('d')).toBe(4);
  });

  it('enforces the size cap strictly — no overflow', () => {
    const c = new LruCache<number, number>(5);
    for (let i = 0; i < 100; i += 1) c.set(i, i, 10_000);
    expect(c.size).toBe(5);
  });

  it('delete removes an entry; clear empties the cache', () => {
    const c = new LruCache<string, number>(4);
    c.set('a', 1, 10_000);
    c.set('b', 2, 10_000);
    expect(c.delete('a')).toBe(true);
    expect(c.get('a')).toBeUndefined();
    c.clear();
    expect(c.size).toBe(0);
  });

  it('rejects non-positive maxSize', () => {
    expect(() => new LruCache<string, number>(0)).toThrow();
    expect(() => new LruCache<string, number>(-1)).toThrow();
  });
});
