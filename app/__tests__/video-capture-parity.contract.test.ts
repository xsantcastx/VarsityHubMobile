/**
 * Capture-parity contract: every surface that accepts VIDEO must
 *   (a) set the shared export preset (VIDEO_CAPTURE_PRESET),
 *   (b) size-gate the PICK against MAX_PICKED_VIDEO_SIZE_BYTES,
 *   (c) compress via prepareVideoForUpload (upload-time), which is what
 *       re-checks the real MAX_VIDEO_SIZE_BYTES upload cap.
 * And no file outside the allowlist may accept video at all — a new video
 * surface must be added here deliberately, with all three guarantees.
 *
 * (b) is deliberately NOT MAX_VIDEO_SIZE_BYTES. All three surfaces used to gate
 * the freshly-picked file against the 150MB upload cap, i.e. pre-compression
 * bytes vs a post-compression limit. A 90s 1080p export is ~160-180MB, so the
 * picker bounced highlights that POST_MAX_DURATION_S explicitly allows and that
 * compress to ~68MB. The cap belongs on the bytes we actually send, and
 * prepareVideoForUpload already enforces it there.
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
      it('size-gates the pick against the shared pick-time ceiling', () => {
        expect(src).toContain('MAX_PICKED_VIDEO_SIZE_BYTES');
      });
      it('does not gate the pick against the post-compression upload cap', () => {
        // The regression this pins: `pickedSize > MAX_VIDEO_SIZE_BYTES`.
        expect(src).not.toMatch(/>\s*MAX_VIDEO_SIZE_BYTES/);
      });
      it('compresses via prepareVideoForUpload', () => {
        expect(src).toContain('prepareVideoForUpload');
      });
    });
  }

  it('no file outside the allowlist accepts video from the picker', () => {
    // Idioms that admit video: MediaTypeOptions.All / .Videos, SDK-54 array form
    // MediaType.Videos / 'videos', and helper forms pickerAllMediaTypesProp() and
    // pickerMediaTypeFor('video').
    const videoPickerPattern =
      /MediaTypeOptions\.(All|Videos)|MediaType\.Videos|mediaTypes:\s*\[[^\]]*['"]videos['"]|pickerAllMediaTypesProp\s*\(|pickerMediaTypeFor\s*\(\s*['"]video['"]/;
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
