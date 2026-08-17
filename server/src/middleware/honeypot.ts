/**
 * Canary / honeypot routes.
 *
 * These are paths a legitimate VarsityHub client NEVER requests, but automated
 * scanners and hands-on-keyboard attackers probe them first (secrets files,
 * framework admin panels, DB dumps). A single hit is a high-signal intrusion
 * indicator, so we fire a Sentry alert and return a bland 404 — the prober can't
 * tell the path is instrumented.
 *
 * Alerts are deduped per (ip, path) for 1h via Redis so a scanner loop can't
 * flood Sentry; if Redis is unavailable we fail OPEN (alert anyway) — over-
 * alerting on a security canary is the safe direction.
 */
import { Router } from 'express';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { captureMessage } from '../lib/sentry.js';

// Classic scanner targets with zero collision risk against real routes.
const DECOY_PATHS = [
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.git/config',
  '/.aws/credentials',
  '/config.json',
  '/secrets.json',
  '/backup.sql',
  '/db.sqlite',
  '/dump.sql',
  '/wp-login.php',
  '/wp-admin',
  '/phpinfo.php',
  '/actuator/env',
  '/server-status',
] as const;

export const honeypotRouter = Router();

for (const decoy of DECOY_PATHS) {
  honeypotRouter.all(decoy, async (req, res) => {
    try {
      const dedupeKey = `canary:${req.ip || 'unknown'}:${decoy}`;
      if (!(await cacheGet(dedupeKey))) {
        await cacheSet(dedupeKey, 1, 3600);
        captureMessage(`[canary] decoy path probed: ${req.method} ${decoy}`, 'warning', {
          canary: true,
          path: req.originalUrl,
          method: req.method,
          ip: req.ip || null,
          user_agent: req.get('user-agent') || null,
          referer: req.get('referer') || null,
          // If a token happened to be attached, capturing the actor is bonus signal.
          user_id: (req as any).user?.id ?? null,
        });
      }
    } catch {
      // A canary must never break a request path or throw — swallow everything.
    }
    res.status(404).type('text/plain').send('Not Found');
  });
}
