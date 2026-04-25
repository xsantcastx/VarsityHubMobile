/**
 * IAP product configuration invariants.
 *
 * These checks pin the subscription product IDs across client, server, and the
 * main operator docs so setup instructions cannot drift away from the live code.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SERVER_ROOT = process.cwd();
const REPO_ROOT = join(SERVER_ROOT, '..');

const read = (...parts: string[]) => readFileSync(join(...parts), 'utf8');

const payments = read(SERVER_ROOT, 'src', 'routes', 'payments.ts');
const env = read(SERVER_ROOT, 'src', 'lib', 'env.ts');
const clientIap = read(REPO_ROOT, 'hooks', 'useIAP.ts');
const clientIapWeb = read(REPO_ROOT, 'hooks', 'useIAP.web.ts');
const preReleaseDoc = read(REPO_ROOT, 'docs', 'PRE_RELEASE_CONFIG_VERIFICATION.md');
const externalSetupDoc = read(REPO_ROOT, 'docs', 'EXTERNAL_SETUP_GUIDE.md');
const appStoreDoc = read(REPO_ROOT, 'docs', 'BEFORE_APP_STORE_SUBMISSION.md');

describe('IAP product configuration invariants', () => {
  it('client subscription hooks use MIDTIER/TOPTIER product IDs', () => {
    expect(clientIap).toMatch(/veteran:\s*'MIDTIER'/);
    expect(clientIap).toMatch(/legend:\s*'TOPTIER'/);
    expect(clientIapWeb).toMatch(/veteran:\s*'MIDTIER'/);
    expect(clientIapWeb).toMatch(/legend:\s*'TOPTIER'/);
  });

  it('server maps MIDTIER/TOPTIER for Apple and Google subscription verification', () => {
    expect(payments).toMatch(/const APPLE_PRODUCT_TO_PLAN[\s\S]*MIDTIER:\s*'veteran'/);
    expect(payments).toMatch(/const APPLE_PRODUCT_TO_PLAN[\s\S]*TOPTIER:\s*'legend'/);
    expect(payments).toMatch(/const GOOGLE_PRODUCT_TO_PLAN[\s\S]*MIDTIER:\s*'veteran'/);
    expect(payments).toMatch(/const GOOGLE_PRODUCT_TO_PLAN[\s\S]*TOPTIER:\s*'legend'/);
  });

  it('operator docs reference MIDTIER/TOPTIER and not stale legacy SKUs', () => {
    for (const doc of [preReleaseDoc, externalSetupDoc, appStoreDoc]) {
      expect(doc).toMatch(/MIDTIER/);
      expect(doc).toMatch(/TOPTIER/);
      expect(doc).not.toMatch(/veteran_vhub/i);
      expect(doc).not.toMatch(/legend_vhub/i);
    }
  });

  it('production env validation hard-fails if Apple IAP is configured without APPLE_BUNDLE_ID', () => {
    expect(env).toMatch(/APPLE_IAP_SHARED_SECRET && !env\.APPLE_BUNDLE_ID/);
    expect(env).toMatch(/Apple IAP signed-transaction verification will fail in production/);
  });
});
