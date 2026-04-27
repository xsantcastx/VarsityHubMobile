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
  it('admin dashboard defers expired-session approvals to the global auth handler and still surfaces load-state copy', () => {
    expect(adminDashboardSource).toMatch(/from ['"]@\/utils\/sessionExpiryError['"]/);
    expect(adminDashboardSource).toContain('if (isSessionExpiryError(e)) {');
    expect(adminDashboardSource).toContain(
      "'Your admin session expired. Please sign in again.'"
    );
    expect(adminDashboardSource).not.toContain("Alert.alert('Session expired'");
  });

  it('league-owner approvals screen defers expired-session errors to the global auth handler', () => {
    expect(approvalsSource).toMatch(/isSessionExpiryError/);
    expect(approvalsSource).toContain('if (isSessionExpiryError(err)) {');
    expect(approvalsSource).not.toContain("Alert.alert('Session expired'");
  });
});
