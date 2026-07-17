/**
 * PARITY GUARDRAIL: every post-serializing route must resolve a video poster
 * through the single authority `lib/mediaUtils.resolvePreviewUrl`, never by
 * calling `getVideoPreviewUrl(media_url)` directly.
 *
 * Why this is a real bug and not style: getVideoPreviewUrl synthesizes a poster
 * by rewriting a *Cloudinary* URL. R2 cannot transform on the fly, so since the
 * 2026-07-13 media migration every direct caller returned `preview_url: null`
 * for real video and the client rendered a black tile with a play button.
 * `resolvePreviewUrl` prefers the stored `poster_url` (which the uploader writes
 * alongside the video) and only falls back to the Cloudinary derivation.
 *
 * This is the same drift the Post-mapper Consistency Rule guards on the client:
 * a sibling serializer bypassing the shared pipeline. `lib/highlightPostSelect`
 * was already patched for exactly this — these three routes were not, which is
 * why previews worked on Highlights and nowhere else (owner report 2026-07-16).
 *
 * If you add a post-serializing route, route it through resolvePreviewUrl and
 * make sure its query selects `poster_url`.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const routeFile = (name: string) =>
  readFileSync(join(process.cwd(), 'src', 'routes', name), 'utf8');

// Every route module that serializes a post/story preview for a client.
const SERIALIZING_ROUTES = ['users.ts', 'feed.ts', 'games.ts', 'posts.ts'] as const;

describe('preview-url authority parity', () => {
  it.each(SERIALIZING_ROUTES)('%s resolves previews via resolvePreviewUrl', name => {
    const src = routeFile(name);
    expect(src).toMatch(
      /import\s*\{[^}]*\bresolvePreviewUrl\b[^}]*\}\s*from\s*'\.\.\/lib\/mediaUtils\.js'/
    );
    expect(src).toMatch(/resolvePreviewUrl\(/);
  });

  it.each(SERIALIZING_ROUTES)('%s never derives a preview from media_url directly', name => {
    const src = routeFile(name);
    // The Cloudinary-only derivation is reachable ONLY through resolvePreviewUrl.
    expect(src).not.toMatch(/getVideoPreviewUrl\s*\(/);
  });

  it('leaves the Cloudinary derivation as an internal of the authority', () => {
    const utils = readFileSync(join(process.cwd(), 'src', 'lib', 'mediaUtils.ts'), 'utf8');
    expect(utils).toMatch(/resolvePreviewUrl[\s\S]*poster_url\s*\?\?\s*getVideoPreviewUrl/);
  });
});
