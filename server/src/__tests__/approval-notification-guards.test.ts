import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const approvalService = readFileSync(
  join(process.cwd(), 'src', 'lib', 'approvalService.ts'),
  'utf8'
);
const organizations = readFileSync(
  join(process.cwd(), 'src', 'routes', 'organizations.ts'),
  'utf8'
);

const extractFunctionBody = (source: string, name: string): string => {
  const match = source.match(new RegExp(`export async function ${name}[\\s\\S]*?^\\}`, 'm'));
  if (!match) throw new Error(`Could not locate function ${name}`);
  return match[0];
};

describe('approval notification guards', () => {
  it('approvalService centralizes in-app notification failure capture', () => {
    expect(approvalService).toMatch(/async function createApprovalNotification/);
    expect(approvalService).toMatch(/captureException\(err as Error,\s*\{/);
  });

  it.each([
    'approveOrganization',
    'rejectOrganization',
    'approveCoach',
    'rejectCoach',
    'approveAd',
    'rejectAd',
  ])('%s awaits the in-app notification helper instead of fire-and-forget create', (fnName) => {
    const body = extractFunctionBody(approvalService, fnName);
    expect(body).toMatch(/await createApprovalNotification\(prisma,\s*\{/);
  });

  it('join-request approval captures in-app notification failures to Sentry', () => {
    expect(organizations).toMatch(
      /JOIN_REQUEST_APPROVED[\s\S]*?captureException\(err as Error,\s*\{[\s\S]*?context:\s*'join_request_approval_notification_failed'/
    );
  });

  it('join-request denial captures in-app notification failures to Sentry', () => {
    expect(organizations).toMatch(
      /JOIN_REQUEST_DENIED[\s\S]*?captureException\(notifErr as Error,\s*\{[\s\S]*?context:\s*'join_request_denial_notification_failed'/
    );
  });

  it('ad approval and rejection fan out admin confirmation emails', () => {
    const approveAdBody = extractFunctionBody(approvalService, 'approveAd');
    const rejectAdBody = extractFunctionBody(approvalService, 'rejectAd');
    expect(approveAdBody).toMatch(/await notifyAllAdminsOfAdAction\(\s*\{/);
    expect(approveAdBody).toMatch(/action:\s*'ad_approved'/);
    expect(rejectAdBody).toMatch(/await notifyAllAdminsOfAdAction\(\s*\{/);
    expect(rejectAdBody).toMatch(/action:\s*'ad_rejected'/);
  });
});
