/**
 * API responses must be gzip-compressed when the client advertises support.
 * Mobile clients pull large JSON payloads (feed, rosters, games) over
 * cellular; without the compression middleware every byte ships raw.
 */
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../app.js';

describe('HTTP response compression', () => {
  it('gzips large responses when Accept-Encoding allows it', async () => {
    // Share-landing generic page: unauthenticated, no DB row needed, >1KB HTML.
    const res = await request(app)
      .get('/share')
      .set('Accept', 'text/html')
      .set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(200);
    // Premise guard: compression only kicks in above the 1KB threshold, so the
    // test target must actually be large enough to trigger it.
    expect(res.text.length).toBeGreaterThan(1024);
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('leaves responses uncompressed when the client does not accept gzip', async () => {
    const res = await request(app)
      .get('/share')
      .set('Accept', 'text/html')
      .set('Accept-Encoding', 'identity');

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });
});
