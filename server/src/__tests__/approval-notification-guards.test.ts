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
const events = readFileSync(
  join(process.cwd(), 'src', 'routes', 'events.ts'),
  'utf8'
);
const games = readFileSync(
  join(process.cwd(), 'src', 'routes', 'games.ts'),
  'utf8'
);
const ads = readFileSync(
  join(process.cwd(), 'src', 'routes', 'ads.ts'),
  'utf8'
);
const reviewFlow = readFileSync(
  join(process.cwd(), 'src', 'lib', 'reviewFlow.ts'),
  'utf8'
);
const adminReports = readFileSync(
  join(process.cwd(), 'src', 'routes', 'adminReports.ts'),
  'utf8'
);
const adminRoutes = readFileSync(
  join(process.cwd(), 'src', 'routes', 'admin.ts'),
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
    'approveEvent',
    'rejectEvent',
  ])('%s awaits the in-app notification helper instead of fire-and-forget create', (fnName) => {
    const body = extractFunctionBody(approvalService, fnName);
    expect(body).toMatch(/await createApprovalNotification\(prisma,\s*\{/);
  });

  it('approvalService centralizes push failure capture', () => {
    expect(approvalService).toMatch(/function reportPushFailure/);
    expect(approvalService).toMatch(/context:\s*'approval_service_push_failed'/);
  });

  it('join-request approval routes notification failures through the shared reporter', () => {
    expect(organizations).toMatch(/function reportApprovalNotificationFailure/);
    expect(organizations).toMatch(/coach_join_request_approved_email_failed/);
    expect(organizations).toMatch(/join_request_approval_push_failed/);
    expect(organizations).toMatch(/join_request_approval_notification_failed/);
  });

  it('join-request denial captures in-app notification failures to Sentry', () => {
    expect(organizations).toMatch(
      /JOIN_REQUEST_DENIED[\s\S]*?captureException\(notifErr as Error,\s*\{[\s\S]*?context:\s*'join_request_denial_notification_failed'/
    );
  });

  it('email-token event and game review routes pass reviewer identity through instead of the sentinel string', () => {
    expect(events).toMatch(/const reviewerUserId = req\.user\?\.id \?\? null;/);
    expect(events).not.toMatch(/approveEventService\(eventId,\s*'email-token'/);
    expect(events).not.toMatch(/rejectEventService\(eventId,\s*'email-token'/);

    expect(games).toMatch(/const reviewerUserId = req\.user\?\.id \?\? null;/);
    expect(games).not.toMatch(/action === 'approve' \? 'approved' : 'rejected',\s*'email-token'/);
  });

  it('tokenized game/event/report review routes require authenticated admin sessions', () => {
    expect(events).toMatch(/const signedInAdmin = await getIsAdmin\(req as any\);/);
    expect(events).toMatch(/renderEventAdminLoginRequiredPage/);

    expect(games).toMatch(/const signedInAdmin = await getIsAdmin\(req as any\);/);
    expect(games).toMatch(/renderGameAdminLoginRequiredPage/);

    expect(adminReports).toMatch(/Both paths require an authenticated, verified admin identity\./);
    expect(adminReports).toMatch(/if \(tokenValid && !signedInAdminSession\)/);
    expect(adminReports).not.toMatch(/reviewed_by:\s*'email-token'/);

    expect(adminRoutes).toMatch(/const signedInAdminSession = await resolveVerifiedAdminSession\(req\);/);
    expect(adminRoutes).toMatch(/if \(tokenValid && !signedInAdminSession\)/);

    expect(ads).toMatch(/const signedInAdminSession = await resolveVerifiedAdminSession\(req\);/);
    expect(ads).toMatch(/const signedInAdmin = !!signedInAdminSession;/);
    expect(ads).toMatch(/sendAdminSignInRequiredHtml\(res,\s*confirmationPage,\s*'approve',\s*'this ad'\)/);
    expect(ads).toMatch(/sendAdminSignInRequiredHtml\(res,\s*confirmationPage,\s*'reject',\s*'this ad'\)/);

    expect(reviewFlow).toMatch(/export async function resolveVerifiedAdminSession/);
    expect(reviewFlow).toMatch(/export function sendAdminSignInRequiredHtml/);
    expect(reviewFlow).toMatch(/You must be signed in as a verified admin to/);
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
