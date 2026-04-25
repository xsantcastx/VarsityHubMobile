import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { app } from '../app.js';

describe('Public app handoff routes', () => {
  it('serves a verification handoff page with the app-scheme fallback', async () => {
    const res = await request(app)
      .get('/verify')
      .query({ token: '123456', email: 'user@example.com' })
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toContain('text/html');
    expect(res.text).toContain('Verify Your Email');
    expect(res.text).toContain(
      'varsityhubmobile://verify?token=123456&email=user%40example.com'
    );
  });

  it('serves a billing handoff page for manage-subscription links', async () => {
    const res = await request(app)
      .get('/settings/manage-subscription')
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Manage Your Subscription');
    expect(res.text).toContain('varsityhubmobile://settings/manage-subscription');
  });

  it('serves an admin dashboard handoff page with preserved review params', async () => {
    const res = await request(app)
      .get('/admin-dashboard')
      .query({ review: 'league_approval', league_id: 'org_123', action: 'approve' })
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Open Admin Review');
    expect(res.text).toContain(
      'varsityhubmobile://admin-dashboard?review=league_approval&league_id=org_123&action=approve'
    );
  });
});
