/**
 * Contract test: the client-side video size cap and the server-signed
 * Cloudinary max_bytes MUST stay equal. They live in different compilation
 * units (client TS vs server TS) and diverged once before (client 100MB vs
 * server 50MB — uploads between 50–100MB passed client validation and were
 * rejected by Cloudinary signature enforcement).
 *
 * Checked as file content because the two sides can't import each other.
 */
import fs from 'fs';
import path from 'path';

import {
  MAX_PICKED_VIDEO_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  POST_MAX_DURATION_S,
  VIDEO_TARGET_BITRATE_BPS,
} from '@/constants/video';

const ROOT = path.resolve(__dirname, '..', '..');

describe('video upload size limit parity', () => {
  it('client constants/video.ts declares 150MB in bytes', () => {
    const src = fs.readFileSync(path.join(ROOT, 'constants', 'video.ts'), 'utf8');
    expect(src).toMatch(/MAX_VIDEO_SIZE_BYTES\s*=\s*150 \* 1024 \* 1024/);
    expect(src).toMatch(/MAX_VIDEO_SIZE_MB\s*=\s*150/);
  });

  it('server cloudinary signature max_bytes equals 150MB', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server', 'src', 'routes', 'uploads.ts'), 'utf8');
    expect(src).toMatch(/maxBytes = '157286400'/);
    // The old 50MB literal must be gone
    expect(src).not.toMatch(/maxBytes = '52428800'/);
  });

  it('150MB in bytes is 157286400 (sanity)', () => {
    expect(150 * 1024 * 1024).toBe(157286400);
  });

  // The pick-time ceiling is a DIFFERENT limit from the upload cap and must stay
  // above the worst case a 90s POST_MAX_DURATION_S highlight can reach before
  // compression. iOS exports 1080p at roughly 14-16 Mbps, so 90s lands around
  // 160-180MB — comfortably over the 150MB upload cap. Gating the pick on the
  // upload cap therefore rejected clips the app explicitly allows and that
  // compress (VIDEO_TARGET_BITRATE_BPS) to ~68MB. Regression guard: the two
  // limits must not be collapsed back into one.
  it('the pick-time ceiling clears the worst-case 90s 1080p export', () => {
    const worstCase90sBytes = (POST_MAX_DURATION_S * 16_000_000) / 8; // 16 Mbps
    expect(worstCase90sBytes).toBeGreaterThan(MAX_VIDEO_SIZE_BYTES);
    expect(MAX_PICKED_VIDEO_SIZE_BYTES).toBeGreaterThan(worstCase90sBytes);
  });

  it('a 90s clip compresses to well under the upload cap', () => {
    const compressed90sBytes = (POST_MAX_DURATION_S * VIDEO_TARGET_BITRATE_BPS) / 8;
    expect(compressed90sBytes).toBeLessThan(MAX_VIDEO_SIZE_BYTES);
  });

  it('the pick-time ceiling is strictly looser than the upload cap', () => {
    expect(MAX_PICKED_VIDEO_SIZE_BYTES).toBeGreaterThan(MAX_VIDEO_SIZE_BYTES);
  });

  // Regression guard for the "Invalid Signature → HTTP 401" outage: Cloudinary
  // does NOT recognize `max_bytes` as an upload param, so it strips it from its
  // own signature string. Signing it server-side makes our SHA1 diverge from
  // Cloudinary's and rejects EVERY signed direct upload (videos have no proxy
  // fallback, so the whole video system breaks). `max_bytes` may be returned to
  // the client, but it must never enter the signed `params` object.
  it('cloudinary-signature does NOT sign max_bytes (Cloudinary strips it)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server', 'src', 'routes', 'uploads.ts'), 'utf8');
    // Isolate the signed params object feeding `toSign`.
    const paramsBlock = src.match(
      /const params: Record<string, string> = \{([\s\S]*?)\};[\s\S]*?const toSign =/
    );
    expect(paramsBlock).not.toBeNull();
    const signedParams = paramsBlock![1];
    expect(signedParams).not.toMatch(/max_bytes/);
    // Positive control: allowed_formats IS a real signed Cloudinary param.
    expect(signedParams).toMatch(/allowed_formats/);
  });

  it('client-accepted video formats are accepted by direct upload providers', () => {
    const createPostSrc = fs.readFileSync(
      path.join(ROOT, 'app', '(tabs)', 'create-post.tsx'),
      'utf8'
    );
    const uploadsSrc = fs.readFileSync(
      path.join(ROOT, 'server', 'src', 'routes', 'uploads.ts'),
      'utf8'
    );
    const r2Src = fs.readFileSync(path.join(ROOT, 'server', 'src', 'lib', 'r2.ts'), 'utf8');
    const uploadClientSrc = fs.readFileSync(path.join(ROOT, 'apiclient', 'upload.ts'), 'utf8');

    for (const mime of ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']) {
      expect(createPostSrc).toContain(`'${mime}'`);
      expect(uploadsSrc).toContain(`'${mime}'`);
      expect(r2Src).toContain(`'${mime}'`);
    }
    expect(uploadsSrc).toContain('mp4,mov,webm,m4v');
    expect(uploadClientSrc).toContain("webm: 'video/webm'");
    expect(uploadClientSrc).toContain("m4v: 'video/x-m4v'");
  });
});
