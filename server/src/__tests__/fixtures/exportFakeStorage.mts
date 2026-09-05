import type { ObjectStorageAdapter } from '../../lib/objectStorage.js';
export function makeFakeStorage(opts: { configured?: boolean; failDeleteOn?: string } = {}) {
  const puts: Array<{ key: string; contentType: string; sizeBytes: number }> = [];
  const deletes: string[] = [];
  const state = { failDeleteOn: opts.failDeleteOn };

  return {
    puts,
    deletes,
    adapter: {
      isConfigured: () => opts.configured !== false,
      async putObject(key: string, body: Buffer, contentType: string) {
        puts.push({
          key,
          contentType,
          sizeBytes: Buffer.isBuffer(body) ? body.byteLength : 0,
        });
      },
      async getSignedDownloadUrl(key: string, ttlSeconds = 300) {
        return `https://fake-storage.test/${key}?ttl=${ttlSeconds}&sig=fake`;
      },
      async deleteObject(key: string) {
        if (state.failDeleteOn === key) throw new Error('simulated storage failure');
        deletes.push(key);
      },
    } satisfies ObjectStorageAdapter,
    setFailDeleteOn(key?: string) {
      state.failDeleteOn = key;
    },
  };
}
