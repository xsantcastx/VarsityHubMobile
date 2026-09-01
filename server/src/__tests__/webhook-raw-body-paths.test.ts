import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appSource = () => readFileSync(join(process.cwd(), 'src', 'app.ts'), 'utf8');

describe('webhook raw-body app wiring', () => {
  it('registers raw parsing for root and versioned Stripe/SendGrid webhook paths', () => {
    const src = appSource();

    expect(src).toMatch(/const rawBodyPaths = \[/);
    expect(src).toMatch(/'\/payments\/webhook'/);
    expect(src).toMatch(/'\/v1\/payments\/webhook'/);
    expect(src).toMatch(/'\/webhooks\/sendgrid'/);
    expect(src).toMatch(/'\/v1\/webhooks\/sendgrid'/);
  });

  it('keeps webhook raw parsing before the global JSON parser', () => {
    const src = appSource();

    expect(src.indexOf('express.raw({ type:')).toBeGreaterThan(-1);
    expect(src.indexOf('express.json({ limit:')).toBeGreaterThan(-1);
    expect(src.indexOf('express.raw({ type:')).toBeLessThan(src.indexOf('express.json({ limit:'));
    expect(src).toMatch(/rawBodyPaths\.some\(path => req\.originalUrl\.startsWith\(path\)\)/);
  });
});
