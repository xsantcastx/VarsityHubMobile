/**
 * Share-link surface consistency — pins every layer that touches the
 * universal-link/share URL space so they can never drift apart again.
 *
 * The 2026-07-15 Fanatics Fest incident: share links (varsityhub.app/events/:id)
 * 404'd for anyone WITHOUT the app because the Expo web export has no routes at
 * the universal-link paths — only bots got OG rewrites. Worse, the deploy
 * pipeline (scripts/deploy-web-static.sh) shipped its own embedded vercel.json,
 * so fixes to the repo vercel.json silently never reached production.
 *
 * Layers pinned together here:
 *  1. utils/links.ts AppLinks builders  → the web URLs we actually generate
 *  2. vercel.json                       → human redirect + bot rewrite per path
 *  3. utils/publicRoutes.ts             → redirect targets are guest-browseable
 *  4. public/.well-known AASA (Vercel)  → identical to server well-known.ts
 *  5. app.json Android intentFilters    → same paths, both hosts
 *  6. scripts/deploy-web-static.sh      → derives config from repo vercel.json
 */
import fs from 'fs';
import path from 'path';
import { GUEST_BROWSE_ROUTE_SEGMENTS } from '../utils/publicRoutes';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const vercel = JSON.parse(read('vercel.json'));
const appJson = JSON.parse(read('app.json'));
const staticAasa = JSON.parse(read('public/.well-known/apple-app-site-association'));
const serverWellKnown = read('server/src/routes/well-known.ts');
const deployScript = read('scripts/deploy-web-static.sh');
const linksSource = read('utils/links.ts');
const generatedExpoConfig = require(path.join(__dirname, '..', 'app.config.js'))({ config: {} });

/** Resource path → the guest-browseable web screen humans must land on. */
const RESOURCE_WEB_FALLBACKS: Record<string, string> = {
  posts: 'post-detail',
  games: 'game-detail',
  events: 'public-event',
  teams: 'team-page',
  users: 'user-profile',
  programs: 'program-page',
};

/** /share?type=X → web screen (mirrors utils/deepLinks.ts ROUTE_MAP). */
const SHARE_TYPE_WEB_FALLBACKS: Record<string, string> = {
  post: 'post-detail',
  game: 'game-detail',
  event: 'public-event',
  team: 'team-page',
  profile: 'user-profile',
};

describe('client link builders generate exactly the pinned resource paths', () => {
  it.each(Object.keys(RESOURCE_WEB_FALLBACKS))('AppLinks builds /%s/:id URLs', resource => {
    expect(linksSource).toContain(`\${WEB_BASE_URL}/${resource}/`);
  });
});

describe('vercel.json — human browsers reach the web app, bots keep OG previews', () => {
  it.each(Object.entries(RESOURCE_WEB_FALLBACKS))(
    '/%s/:id redirects non-bot traffic to a guest-browseable page',
    (resource, screen) => {
      const redirect = (vercel.redirects as any[]).find(
        r => r.source === `/${resource}/:id` && Array.isArray(r.missing)
      );
      expect(redirect).toBeDefined();
      // Bot guard: user-agent `missing` match so crawlers fall through to rewrites.
      expect(redirect.missing[0]).toMatchObject({ type: 'header', key: 'user-agent' });
      expect(redirect.destination).toBe(`/${screen}?id=:id`);
      expect(redirect.permanent).toBe(false);
      // The destination screen must be guest-browseable, or logged-out web
      // visitors bounce off the page they were sent to.
      expect(GUEST_BROWSE_ROUTE_SEGMENTS).toContain(screen);
    }
  );

  it.each(Object.keys(RESOURCE_WEB_FALLBACKS))(
    '/%s/:id rewrites bot traffic to the API share/OG landing',
    resource => {
      const rewrite = (vercel.rewrites as any[]).find(
        r => r.source === `/${resource}/:id` && Array.isArray(r.has)
      );
      expect(rewrite).toBeDefined();
      expect(rewrite.has[0]).toMatchObject({ type: 'header', key: 'user-agent' });
      expect(rewrite.destination).toMatch(/^https:\/\/api-production-8ac3\.up\.railway\.app\//);
    }
  );

  it.each(Object.entries(SHARE_TYPE_WEB_FALLBACKS))(
    '/share?type=%s redirects humans to its guest-browseable page',
    (type, screen) => {
      const redirect = (vercel.redirects as any[]).find(
        r =>
          r.source === '/share' &&
          Array.isArray(r.has) &&
          r.has.some((h: any) => h.type === 'query' && h.key === 'type' && h.value === type)
      );
      expect(redirect).toBeDefined();
      expect(redirect.destination).toBe(`/${screen}`);
      expect(GUEST_BROWSE_ROUTE_SEGMENTS).toContain(screen);
    }
  );

  it('bare /share still lands humans somewhere real (feed) instead of a 404', () => {
    const fallback = (vercel.redirects as any[]).find(
      r => r.source === '/share' && !r.has && Array.isArray(r.missing)
    );
    expect(fallback).toBeDefined();
    expect(fallback.destination).toBe('/');
  });

  it('/join invite links land on their invite screens', () => {
    const org = (vercel.redirects as any[]).find(r => r.source === '/join/org');
    const team = (vercel.redirects as any[]).find(r => r.source === '/join/team');
    expect(org?.destination).toBe('/organization-invites');
    expect(team?.destination).toBe('/team-invites');
  });

  it('/organizations/:id serves the exported dynamic route shell', () => {
    const rewrite = (vercel.rewrites as any[]).find(r => r.source === '/organizations/:id');
    expect(rewrite?.destination).toBe('/organizations/[id]');
  });
});

describe('AASA parity — the static file Vercel serves matches the server source of truth', () => {
  const staticPaths: string[] = staticAasa.applinks.details[0].paths;

  it('static AASA paths equal server IOS_PATHS exactly', () => {
    const serverPathsMatch = serverWellKnown.match(/const IOS_PATHS = \[([^\]]+)\]/);
    expect(serverPathsMatch).not.toBeNull();
    const serverPaths = [...serverPathsMatch![1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    expect([...staticPaths].sort()).toEqual([...serverPaths].sort());
  });

  it('covers every generated resource path', () => {
    for (const resource of Object.keys(RESOURCE_WEB_FALLBACKS)) {
      expect(staticPaths).toContain(`/${resource}/*`);
    }
  });

  it('keeps webcredentials so iOS password autofill association survives', () => {
    expect(staticAasa.webcredentials.apps).toContain('B5H8F69RW5.com.varsithub.varsityhub-ios');
  });
});

describe('Android intent filters cover the same URL space on both hosts', () => {
  const data: Array<{ host: string; pathPrefix: string }> =
    appJson.expo.android.intentFilters[0].data;

  it.each(Object.keys(RESOURCE_WEB_FALLBACKS))('handles /%s on apex and www', resource => {
    for (const host of ['varsityhub.app', 'www.varsityhub.app']) {
      expect(data.some(d => d.host === host && d.pathPrefix === `/${resource}`)).toBe(true);
    }
  });

  it('handles /join and /share on both hosts', () => {
    for (const host of ['varsityhub.app', 'www.varsityhub.app']) {
      for (const prefix of ['/join', '/share']) {
        expect(data.some(d => d.host === host && d.pathPrefix === prefix)).toBe(true);
      }
    }
  });
});

describe('dynamic Expo config Android intent filters cover the same URL space', () => {
  const data: Array<{ host: string; pathPrefix: string }> =
    generatedExpoConfig.android.intentFilters[0].data;

  it.each(Object.keys(RESOURCE_WEB_FALLBACKS))(
    'handles /%s on generated config hosts',
    resource => {
      for (const host of ['varsityhub.app', 'www.varsityhub.app', 'app.varsityhub.app']) {
        expect(data.some(d => d.host === host && d.pathPrefix === `/${resource}`)).toBe(true);
      }
    }
  );

  it('handles /join and /share on generated config hosts', () => {
    for (const host of ['varsityhub.app', 'www.varsityhub.app', 'app.varsityhub.app']) {
      for (const prefix of ['/join', '/share']) {
        expect(data.some(d => d.host === host && d.pathPrefix === prefix)).toBe(true);
      }
    }
  });
});

describe('deploy pipeline ships the repo vercel.json, never an embedded copy', () => {
  it('deploy-web-static.sh derives the deployed config from the repo root vercel.json', () => {
    expect(deployScript).not.toContain('cat > "$DEPLOY_DIR/vercel.json"');
    expect(deployScript).toContain('"$ROOT_DIR/vercel.json" "$DEPLOY_DIR/vercel.json"');
  });
});
