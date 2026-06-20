/**
 * Active outbound-connectivity probe.
 *
 * Why this exists: every alerting path in this server (Sentry `captureException`,
 * circuit-breaker `captureMessage`, the overnight cron) ships over the SAME
 * outbound HTTPS egress it is meant to watch. When Railway egress drops, those
 * alerts silently fail to send — the monitor goes dark in lockstep with the
 * outage (this is exactly how the 2026-06-20 ad-submission outage went unseen).
 *
 * This probe is meant to be read by an EXTERNAL monitor (UptimeRobot) that calls
 * IN over inbound networking (which stays healthy during an egress outage) and
 * alerts from its own infrastructure. A total egress loss then pages in ~1–2 min
 * instead of being discovered by hand.
 *
 * It does a real TCP+TLS round-trip to each provider host. ANY HTTP response —
 * even a 4xx — proves egress works; only a thrown error (timeout / DNS / connect
 * refused) counts as unreachable. Targets are hardcoded constants (no request
 * input), so this is not an SSRF surface.
 */

export type EgressTarget = { name: string; url: string };
export type EgressResult = {
  name: string;
  ok: boolean;
  status?: number;
  ms: number;
  error?: string;
};

const DEFAULT_TIMEOUT_MS = 2500;

/**
 * The third-party hosts this server must be able to reach. These mirror the
 * outbound dependencies that fail first in an egress outage: geocoding (Google
 * Maps), uploads (Cloudinary), payments (Stripe). Sentry's own ingest host is
 * added when a DSN is set — so the probe specifically catches "we can't even
 * reach the error tracker," which is the reason these outages stay invisible.
 */
export function getEgressTargets(): EgressTarget[] {
  const targets: EgressTarget[] = [
    { name: 'google_maps', url: 'https://maps.googleapis.com/maps/api/geocode/json' },
    { name: 'cloudinary', url: 'https://api.cloudinary.com/v1_1' },
    { name: 'stripe', url: 'https://api.stripe.com/v1' },
  ];
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    try {
      const host = new URL(dsn).host; // e.g. oXXXX.ingest.sentry.io
      targets.push({ name: 'sentry', url: `https://${host}` });
    } catch {
      // Malformed DSN — not worth failing the probe over.
    }
  }
  return targets;
}

async function probeOne(target: EgressTarget, timeoutMs: number): Promise<EgressResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // HEAD establishes the connection without pulling a body. A 4xx/405 still
    // resolves (proving egress); only a connect/TLS/timeout failure throws.
    const res = await fetch(target.url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual',
    });
    return { name: target.name, ok: true, status: res.status, ms: Date.now() - start };
  } catch (err: any) {
    return {
      name: target.name,
      ok: false,
      ms: Date.now() - start,
      error: String(err?.cause?.code || err?.code || err?.name || err?.message || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe all egress targets in parallel. `reachable === 0` means total egress
 * loss — the signal an external monitor should page on. `reachable < total`
 * is a partial/provider-specific degradation (warning, not an outage).
 */
export async function runEgressProbe(
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ reachable: number; total: number; results: EgressResult[] }> {
  const targets = getEgressTargets();
  const results = await Promise.all(targets.map(t => probeOne(t, timeoutMs)));
  const reachable = results.filter(r => r.ok).length;
  return { reachable, total: results.length, results };
}
