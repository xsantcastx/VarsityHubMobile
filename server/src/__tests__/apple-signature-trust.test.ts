import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { verifyAppleSignedJws } from '../lib/appleSignedJws.js';

it('rejects a forged self-signed root bearing the exact Apple name', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vh-forged-apple-'));
  const old = process.env.APPLE_BUNDLE_ID;
  try {
    const key = join(dir, 'key.pem'),
      cert = join(dir, 'cert.pem');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:prime256v1',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '1',
        '-subj',
        '/CN=Apple Root CA - G3/O=Apple Inc.',
      ],
      { stdio: 'pipe' }
    );
    const forged = new X509Certificate(readFileSync(cert));
    expect(forged.checkIssued(forged)).toBe(true);
    process.env.APPLE_BUNDLE_ID = 'test.varsity.bundle';
    const token = jwt.sign(
      {
        bundleId: process.env.APPLE_BUNDLE_ID,
        environment: 'Sandbox',
        productId: 'MOND_THURS',
        transactionId: 'forged-test-only',
        quantity: 1,
      },
      readFileSync(key),
      {
        algorithm: 'ES256',
        header: { alg: 'ES256', x5c: Array(3).fill(forged.raw.toString('base64')) },
      }
    );
    await expect(verifyAppleSignedJws(token)).rejects.toThrow(/trusted/i);
  } finally {
    if (old === undefined) delete process.env.APPLE_BUNDLE_ID;
    else process.env.APPLE_BUNDLE_ID = old;
    rmSync(dir, { recursive: true, force: true });
  }
});
