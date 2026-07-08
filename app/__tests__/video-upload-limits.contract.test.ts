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
});
