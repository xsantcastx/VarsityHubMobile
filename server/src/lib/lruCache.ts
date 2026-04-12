/**
 * Tiny LRU cache with per-entry TTL.
 *
 * Built on Map insertion order: on every read we re-insert the key so the
 * eviction tail is always the genuinely least-recently-used entry. Size cap
 * is enforced on every write, not reactively.
 *
 * This is used by the auth middleware to cache ban/session-version state so a
 * hot path doesn't hit Postgres per request; eviction discipline matters
 * because stale ban flags mean a banned user keeps operating.
 */
export class LruCache<K, V> {
  private readonly store = new Map<K, { value: V; expiresAt: number }>();

  constructor(private readonly maxSize: number) {
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      throw new Error(`LruCache requires a positive maxSize (got ${maxSize})`);
    }
  }

  get size(): number {
    return this.store.size;
  }

  get(key: K): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Re-insert so this key is now the most-recently-used.
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: K, value: V, ttlMs: number): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.store.size > this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
    }
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
