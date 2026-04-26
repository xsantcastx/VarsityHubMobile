/**
 * Regression: ad-banner moderation must not become a server-side request
 * forgery (SSRF) vector. The banner_url comes from user-submitted ad
 * payload (Zod's z.string().url() only checks shape, not destination).
 * Without an SSRF guard, an attacker can submit a banner_url pointing at
 * Railway internal services (Postgres, Redis, metadata endpoints) and
 * trigger server-side fetches inside the trust boundary.
 *
 * Tests assert directly on the exported guard helper rather than driving
 * through moderateBannerUrl(), since the moderation feature flag is
 * frozen at module load time and toggling it per-test is brittle. The
 * guard is the security boundary; testing it directly is what matters.
 */

import { describe, expect, it } from '@jest/globals';
import { assertSafeFetchTarget } from '../lib/adImageModeration.js';

async function expectRejection(url: string, pattern: RegExp) {
  await expect(assertSafeFetchTarget(url)).rejects.toThrow(pattern);
}

async function expectAllowed(url: string) {
  // We cannot actually network-allow without a live DNS resolution.
  // Tests exercise the rejection paths comprehensively; allowed-paths
  // are smoke-checked via well-known public DNS hosts when available
  // (skipped in offline CI by catching the resolution failure).
  try {
    await assertSafeFetchTarget(url);
  } catch (err: any) {
    if (/could not be resolved/i.test(String(err?.message || ''))) {
      // Offline test runner — accept the inconclusive case
      return;
    }
    throw err;
  }
}

describe('assertSafeFetchTarget — SSRF guard', () => {
  describe('scheme enforcement', () => {
    it('rejects file: scheme', async () => {
      await expectRejection('file:///etc/passwd', /scheme not allowed/i);
    });
    it('rejects gopher: scheme', async () => {
      await expectRejection('gopher://localhost:6379/_INFO', /scheme not allowed/i);
    });
    it('rejects javascript: scheme', async () => {
      await expectRejection('javascript:alert(1)', /scheme not allowed/i);
    });
    it('rejects malformed URL strings', async () => {
      await expectRejection('not a url', /not a valid URL/i);
    });
  });

  describe('hostname denylist (pre-DNS)', () => {
    it('rejects literal localhost', async () => {
      await expectRejection('http://localhost:8080/banner.png', /host not allowed/i);
    });
    it('rejects ip6-localhost alias', async () => {
      await expectRejection('http://ip6-localhost/banner.png', /host not allowed/i);
    });
    it('rejects *.local mDNS suffix', async () => {
      await expectRejection('http://printer.local/img.png', /host not allowed/i);
    });
    it('rejects *.internal suffix (Railway internal hostnames)', async () => {
      await expectRejection(
        'http://postgres-tngr.railway.internal:5432/',
        /host not allowed/i
      );
    });
    it('rejects *.localhost suffix', async () => {
      await expectRejection('http://api.localhost/x', /host not allowed/i);
    });
  });

  describe('IPv4 private/loopback ranges', () => {
    it('rejects 127.0.0.1 loopback', async () => {
      await expectRejection('http://127.0.0.1/banner.png', /blocked address/i);
    });
    it('rejects 10.x RFC 1918', async () => {
      await expectRejection('http://10.0.0.5/banner.png', /blocked address/i);
    });
    it('rejects 192.168.x RFC 1918', async () => {
      await expectRejection('http://192.168.1.10/banner.png', /blocked address/i);
    });
    it('rejects 172.20.x RFC 1918', async () => {
      await expectRejection('http://172.20.5.5/banner.png', /blocked address/i);
    });
    it('rejects 169.254.169.254 cloud metadata', async () => {
      await expectRejection(
        'http://169.254.169.254/latest/meta-data/',
        /blocked address/i
      );
    });
    it('rejects 0.0.0.0', async () => {
      await expectRejection('http://0.0.0.0/x', /blocked address/i);
    });
    it('rejects 100.64.x carrier-grade NAT (Railway edge)', async () => {
      await expectRejection('http://100.64.0.1/banner.png', /blocked address/i);
    });
    it('accepts public IPs (smoke)', async () => {
      // 1.1.1.1 (Cloudflare) is public unicast; if DNS works it should pass
      await expectAllowed('http://1.1.1.1/');
    });
  });

  describe('IPv6 private/loopback ranges', () => {
    it('rejects ::1 loopback', async () => {
      await expectRejection('http://[::1]/banner.png', /blocked address/i);
    });
    it('rejects fc00::/7 unique-local', async () => {
      await expectRejection('http://[fc00::1]/x', /blocked address/i);
    });
    it('rejects fd00::/8 unique-local', async () => {
      await expectRejection('http://[fd12:3456::1]/x', /blocked address/i);
    });
    it('rejects fe80::/10 link-local', async () => {
      await expectRejection('http://[fe80::1]/x', /blocked address/i);
    });
    it('rejects v4-mapped private (::ffff:127.0.0.1)', async () => {
      await expectRejection('http://[::ffff:127.0.0.1]/x', /blocked address/i);
    });
  });

  describe('boundary checks', () => {
    it('accepts 172.15.x (just below RFC 1918 lower bound)', async () => {
      // 172.15.0.0/16 is public; only 172.16-31 are private
      await expectAllowed('http://172.15.0.1/');
    });
    it('accepts 172.32.x (just above RFC 1918 upper bound)', async () => {
      await expectAllowed('http://172.32.0.1/');
    });
  });
});
