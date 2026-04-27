import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const adminDashboardSource = readFileSync(
  join(process.cwd(), '..', 'app', 'admin-dashboard.tsx'),
  'utf8'
);
const approvalsSource = readFileSync(
  join(process.cwd(), '..', 'app', '(tabs)', 'approvals.tsx'),
  'utf8'
);

describe('admin session-expiry UI guards', () => {
  it('admin dashboard surfaces explicit expired-session messaging for approval actions and dashboard load', () => {
    expect(adminDashboardSource).toMatch(/const isSessionExpiryError =/);
    expect(adminDashboardSource).toContain(
      "Alert.alert('Session expired', 'Your admin session expired. Please sign in again, then retry this approval.')"
    );
    expect(adminDashboardSource).toContain(
      "'Your admin session expired. Please sign in again.'"
    );
  });

  it('league-owner approvals screen surfaces explicit expired-session messaging', () => {
    expect(approvalsSource).toMatch(/const isSessionExpiryError =/);
    expect(approvalsSource).toContain(
      "Alert.alert('Session expired', 'Your approval session expired. Please sign in again, then retry.')"
    );
  });
});
