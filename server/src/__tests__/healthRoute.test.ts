import { describe, expect, it } from '@jest/globals';
import { buildPublicHealthPayload } from '../routes/health.js';

describe('buildPublicHealthPayload', () => {
  it('marks the payload as ready when the database check passes', () => {
    const payload = buildPublicHealthPayload({ databaseHealthy: true, timestamp: '2026-08-09T00:00:00.000Z' });

    expect(payload).toMatchObject({
      status: 'ok',
      ready: true,
      timestamp: '2026-08-09T00:00:00.000Z',
      checks: {
        database: true,
      },
    });
  });

  it('marks the payload as not ready when the database check fails', () => {
    const payload = buildPublicHealthPayload({ databaseHealthy: false, timestamp: '2026-08-09T00:00:00.000Z' });

    expect(payload).toMatchObject({
      status: 'error',
      ready: false,
      timestamp: '2026-08-09T00:00:00.000Z',
      checks: {
        database: false,
      },
    });
  });
});
