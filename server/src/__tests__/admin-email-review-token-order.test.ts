import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const adminSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'admin.ts'), 'utf8');
const reportsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'adminReports.ts'), 'utf8');

describe('admin email review token order', () => {
  it('consumes coach review tokens only after approve/reject succeeds', () => {
    const start = adminSrc.indexOf('async function handleCoachReview');
    const end = adminSrc.indexOf("adminRouter.get('/coaches/:id/approve'", start);
    const slice = adminSrc.slice(start, end);
    expect(slice.indexOf('const result =')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result =')
    );
  });

  it('consumes abuse report review tokens only after the guarded transition succeeds', () => {
    const start = reportsSrc.indexOf('async function handleEmailReportReview');
    const end = reportsSrc.indexOf("adminReportsRouter.get(\n  '/:id/resolve'", start);
    const slice = reportsSrc.slice(start, end);
    expect(slice.indexOf('const transition = await prisma.abuseReport.updateMany')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const transition = await prisma.abuseReport.updateMany')
    );
  });
});
