/**
 * Capture-parity contract: every surface that accepts VIDEO must
 *   (a) set the shared export preset (VIDEO_CAPTURE_PRESET),
 *   (b) size-gate against MAX_VIDEO_SIZE (pick-time),
 *   (c) compress via prepareVideoForUpload (upload-time).
 * And no file outside the allowlist may accept video at all — a new video
 * surface must be added here deliberately, with all three guarantees.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const VIDEO_SURFACES = [
  'app/(tabs)/create-post.tsx',
  'app/game-details/GameDetailsScreen.tsx',
  'app/(tabs)/team-contacts.tsx',
];

const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('video capture parity', () => {
  for (const surface of VIDEO_SURFACES) {
    describe(surface, () => {
      const src = read(surface);
      it('uses the shared capture preset', () => {
        expect(src).toContain('VIDEO_CAPTURE_PRESET');
      });
      it('size-gates against the shared max', () => {
        expect(src).toContain('MAX_VIDEO_SIZE_BYTES');
      });
      it('compresses via prepareVideoForUpload', () => {
        expect(src).toContain('prepareVideoForUpload');
      });
    });
  }

  it('no file outside the allowlist accepts video from the picker', () => {
    // Both idioms that admit video: MediaTypeOptions.All / .Videos and the
    // SDK-54 array form MediaType.Videos / 'videos'.
    const videoPickerPattern =
      /MediaTypeOptions\.(All|Videos)|MediaType\.Videos|mediaTypes:\s*\[[^\]]*['"]videos['"]/;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(ROOT, dir))) {
        const rel = join(dir, entry);
        const full = join(ROOT, rel);
        if (statSync(full).isDirectory()) {
          if (!/node_modules|__tests__|\.git/.test(rel)) walk(rel);
        } else if (/\.tsx?$/.test(entry)) {
          const src = readFileSync(full, 'utf8');
          if (videoPickerPattern.test(src) && !VIDEO_SURFACES.includes(rel.replace(/\\/g, '/'))) {
            offenders.push(rel);
          }
        }
      }
    };
    walk('app');
    walk('components');
    expect(offenders).toEqual([]);
  });
});
