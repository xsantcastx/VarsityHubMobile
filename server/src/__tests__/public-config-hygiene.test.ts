import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), '..');

const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('public config hygiene', () => {
  it('app.json does not hardcode live runtime public keys', () => {
    const appJson = read('app.json');

    expect(appJson).not.toMatch(/pk_live_[A-Za-z0-9]+/);
    expect(appJson).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(appJson).not.toMatch(/https:\/\/[^"\s]+@o\d+\.ingest\.[^"\s]+\.sentry\.io\/\d+/);
    expect(appJson).not.toMatch(/phc_[A-Za-z0-9]+/);
  });

  it('client config does not expose a personal admin email fallback', () => {
    expect(read('app.json')).not.toContain('emancero@varsityhub.app');
    expect(read('app.config.js')).not.toContain('emancero@varsityhub.app');
  });
});
