import { describe, expect, it } from '@jest/globals';
import { buildProductionCspDirectives } from '../app.js';

describe('web CSP', () => {
  it('allows the exported web app to hydrate and reach the production API', async () => {
    const directives = buildProductionCspDirectives();

    expect(directives.scriptSrc).toContain(
      "'sha256-67fhrP0+BkBqmgGGXTtgiVO/9EQs3QruYNU/7fnRkI8='"
    );
    expect(directives.imgSrc).toContain('https:');
    expect(directives.imgSrc).toContain('https://images.unsplash.com');
    expect(directives.connectSrc).toContain('https://api-production-8ac3.up.railway.app');
    expect(directives.connectSrc).toContain('https://oauth2.googleapis.com');
  });
});
