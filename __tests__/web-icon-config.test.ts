import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');

describe('web icon config', () => {
  it('uses the dedicated favicon asset instead of the splash image', () => {
    const appJson = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8'));
    const generatedExpoConfig = require(path.join(root, 'app.config.js'))({ config: {} });

    expect(appJson.expo.web.favicon).toBe('./assets/images/favicon.png');
    expect(generatedExpoConfig.web.favicon).toBe('./assets/images/favicon.png');
    expect(appJson.expo.web.favicon).not.toContain('splash');
    expect(existsSync(path.join(root, appJson.expo.web.favicon))).toBe(true);
  });
});
