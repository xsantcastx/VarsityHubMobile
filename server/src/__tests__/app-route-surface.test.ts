import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const srcRoot = join(process.cwd(), 'src');
const appSrc = readFileSync(join(srcRoot, 'app.ts'), 'utf8');
const testAppSrc = readFileSync(join(srcRoot, 'testApp.ts'), 'utf8');

describe('app route surface contracts', () => {
  it('mounts data export and consent resend on the production app surface', () => {
    expect(appSrc).toContain("import { dataExportRouter } from './routes/dataExport.js';");
    expect(appSrc).toContain("import { handleConsentResend } from './routes/consent.js';");
    expect(appSrc).toContain("parent.post('/me/consent/resend'");
    expect(appSrc).toContain('parent.use(dataExportRouter);');
  });

  it('mirrors /me and /v1 route surfaces in the shared test app', () => {
    expect(testAppSrc).toContain("const meProxy = (req: any, res: any, next: any) => {");
    expect(testAppSrc).toContain("parent.use('/me', meProxy);");
    expect(testAppSrc).toContain("parent.post('/me/consent/resend'");
    expect(testAppSrc).toContain("app.use('/v1', v1);");
  });
});
