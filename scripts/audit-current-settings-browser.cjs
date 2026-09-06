/** Run with the disposable API in server/scripts/e2e/audit-current-settings-api.mts. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { expect } = require('@playwright/test');
const dir = '/tmp/varsityhub-current-reaudit-20260905';
const sessions = JSON.parse(fs.readFileSync(`${dir}/browser-sessions.json`));
const base = process.env.CURRENT_BROWSER_BASE || 'http://localhost:8098';
const rows = [];
const errors = [];
const apiCalls = [];
const tabs = [
  ['/feed', /Feed|No posts|View Games Nearby/],
  ['/highlights', /Highlights|No highlights/],
  ['/create', /Create|Post|Upload/],
  ['/discover', /Discover|Events|Calendar/],
  ['/profile', /@au(?:fan|coach|organizer)/],
];
async function check(id, run) {
  try {
    await run();
    rows.push({ id, passed: true });
  } catch (e) {
    rows.push({ id, passed: false, error: String(e.message).slice(0, 1200) });
  }
  fs.writeFileSync(
    `${dir}/browser-current.json`,
    JSON.stringify({ rows, errors, apiCalls }, null, 2)
  );
  console.log(JSON.stringify(rows.at(-1)));
}
async function me(token) {
  const res = await fetch('http://127.0.0.1:4498/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200);
  return res.json();
}
(async () => {
  const browser = await chromium.launch();
  try {
    for (const persona of ['fan', 'coach', 'organizer']) {
      const reset = await fetch('http://127.0.0.1:4498/auth/me/preferences', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessions[persona].token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_private: false,
          notifications: { game_event_reminders: true },
        }),
      });
      assert.equal(reset.status, 200);
      const context = await browser.newContext({ colorScheme: 'dark' });
      let closing = false;
      // Every browser request remains on loopback; no production writes or provider calls.
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'api-production-8ac3.up.railway.app') {
          try {
            const response = await route.fetch({
              url: `http://127.0.0.1:4498${url.pathname}${url.search}`,
            });
            apiCalls.push({
              persona,
              path: url.pathname,
              method: route.request().method(),
              status: response.status(),
            });
            return await route.fulfill({ response });
          } catch {
            if (!closing)
              errors.push({ persona, error: `Local transport failed: ${url.pathname}` });
            await route.abort().catch(() => undefined);
            return;
          }
        }
        if (url.hostname === new URL(base).hostname && route.request().method() === 'GET')
          return route.continue();
        return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort();
      });
      await context.addInitScript(
        token => sessionStorage.setItem('auth_token_key', token),
        sessions[persona].token
      );
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.on('pageerror', e => errors.push({ persona, error: e.message }));
      page.on('response', r => {
        if (r.url().startsWith('http://127.0.0.1:4498/'))
          apiCalls.push({
            persona,
            path: new URL(r.url()).pathname,
            method: r.request().method(),
            status: r.status(),
          });
      });
      for (const [path, expected] of tabs)
        await check(`${persona}:${path}`, async () => {
          const before = errors.length;
          await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await expect(page.locator('body')).toContainText(expected, { timeout: 15000 });
          await expect(page).not.toHaveURL(/sign-in|onboarding/);
          assert.equal(errors.length, before);
        });
      await check(`${persona}:privacy-save-navigate-reopen`, async () => {
        await page.goto(`${base}/settings`);
        await page.getByLabel('Privacy section', { exact: true }).first().click();
        await page.getByRole('switch', { name: 'Private Profile', exact: true }).click();
        // Client-side navigation immediately after the press exercises the provider-owned queue.
        if (!(await page.getByText('Edit Username', { exact: true }).isVisible()))
          await page.getByLabel('Account section', { exact: true }).click();
        await page.getByText('Edit Username', { exact: true }).click();
        await expect
          .poll(async () => (await me(sessions[persona].token)).preferences.profile_private)
          .toBe(true);
        await page.goto(`${base}/settings`);
        await page.getByLabel('Privacy section', { exact: true }).first().click();
        await expect(
          page.getByRole('switch', { name: 'Private Profile', exact: true })
        ).toBeChecked();
      });
      await check(`${persona}:notification-save-roundtrip`, async () => {
        const toggle = page.getByRole('switch', { name: 'Game/Event Reminders', exact: true });
        if (!(await toggle.isVisible()))
          await page.getByLabel('Notifications section', { exact: true }).click();
        await toggle.click();
        await expect
          .poll(
            async () =>
              (await me(sessions[persona].token)).preferences.notifications.game_event_reminders
          )
          .toBe(false);
        await page.reload();
        await expect(
          page.getByRole('switch', { name: 'Game/Event Reminders', exact: true })
        ).not.toBeChecked();
      });
      await check(`${persona}:no-founder-controls`, async () => {
        await expect(page.getByText('Admin Dashboard', { exact: true })).toHaveCount(0);
        const r = await fetch('http://127.0.0.1:4498/admin/metrics', {
          headers: { Authorization: `Bearer ${sessions[persona].token}` },
        });
        assert.equal(r.status, 403);
      });
      if (persona === 'fan') {
        const settings = [
          ['edit-username', /Edit Username|Username/],
          ['rsvp-history', /RSVP|Reservations/],
          ['followed-teams', /Followed Teams/],
          ['favorites', /Favorites|Bookmarks/],
          ['blocked-users', /Blocked Users|Blocked users/],
          ['feedback', /Feedback/],
          ['data-export', /Download My Data|Data Export/],
          ['privacy-policy', /Privacy Policy/],
          ['terms-of-service', /Terms of Service/],
          ['dmca', /DMCA/],
          ['request-host-event', /Host|Event/],
          ['billing-history', /Billing History/],
        ];
        for (const [route, expected] of settings)
          await check(`fan:settings/${route}`, async () => {
            const before = errors.length;
            await page.goto(`${base}/settings/${route}`, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('body')).toContainText(expected);
            await expect(page).not.toHaveURL(/sign-in/);
            assert.equal(errors.length, before);
            if (route === 'data-export')
              await expect(page.locator('body')).toContainText(/unavailable|not available/i);
          });
      }
      await page.screenshot({ path: `${dir}/${persona}-final.png` });
      closing = true;
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ passed: rows.filter(r => r.passed).length, required: rows.length }));
  if (rows.some(r => !r.passed)) process.exitCode = 1;
})().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
