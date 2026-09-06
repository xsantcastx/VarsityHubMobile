#!/usr/bin/env node
// Read-only aggregate evidence. A report is not a native crash-resolution gate.
const { writeFileSync } = require('node:fs');
async function main() {
  const token = process.env.SENTRY_AUTH_TOKEN,
    release = process.env.SENTRY_RELEASE;
  if (!token || !release)
    throw new Error('SENTRY_AUTH_TOKEN and exact SENTRY_RELEASE are required');
  const params = new URLSearchParams({
    project: process.env.SENTRY_PROJECT || 'varsityhub',
    statsPeriod: '7d',
    interval: '1d',
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    query: `release:${JSON.stringify(release)}`,
  });
  params.append('field', 'sum(session)');
  params.append('field', 'crash_free_rate(session)');
  params.append('groupBy', 'release');
  const response = await fetch(
    `https://sentry.io/api/0/organizations/${encodeURIComponent(process.env.SENTRY_ORG || 'lime-productions')}/sessions/?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    }
  );
  if (!response.ok) throw new Error(`Session evidence HTTP ${response.status}`);
  const data = await response.json();
  const group = data.groups?.find(row => row.by?.release === release);
  const sessions = group?.totals?.['sum(session)'];
  const crashFreeRate = group?.totals?.['crash_free_rate(session)'];
  if (!Number.isFinite(sessions) || sessions <= 0 || !Number.isFinite(crashFreeRate))
    throw new Error('No measurable sessions for the requested release; cannot report healthy');
  const report = {
    observedAt: new Date().toISOString(),
    release,
    environment: process.env.SENTRY_ENVIRONMENT || 'production',
    sessions,
    crashFreeRate,
    daysWithSessions: (group.series?.['sum(session)'] || []).filter(value => value > 0).length,
    start: data.start,
    end: data.end,
    intervals: data.intervals,
    series: group.series,
    testFlightIsolationVerified: false,
    nativeResolutionVerified: false,
  };
  if (process.env.SENTRY_HEALTH_REPORT)
    writeFileSync(process.env.SENTRY_HEALTH_REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
