/** Disposable local API for the current tab/settings browser audit. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { app } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { signJwt } from '../../src/lib/jwt.js';

const database = new URL(process.env.DATABASE_URL || '');
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.pathname, '/varsityhub_audit_reaudit_browser_20260905');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.VARSITYHUB_ENV_PATH, '/dev/null');
assert.equal(process.env.DOTENV_CONFIG_PATH, '/dev/null');
const sessions: Record<string, unknown> = {};
const ids: string[] = [];
const run = Date.now();
for (const persona of ['fan', 'coach', 'organizer']) {
  const user = await prisma.user.create({
    data: {
      email: `current-ui-${persona}-${run}@example.test`,
      username: `au${persona}${run.toString(36)}`,
      display_name: `Current Audit ${persona}`,
      email_verified: true,
      role: persona === 'fan' ? 'fan' : 'coach',
      approval_status: 'APPROVED',
      onboarding_completed: true,
      coach_agreement_accepted_at: persona === 'fan' ? null : new Date(),
      coach_agreement_version: persona === 'fan' ? null : 1,
      date_of_birth: new Date('1990-01-01'),
      preferences: {
        role: persona === 'fan' ? 'fan' : 'coach',
        onboarding_completed: true,
        profile_private: false,
        zip_code: '10001',
        notifications: { game_event_reminders: true, team_updates: true, comments_upvotes: true },
      },
    },
  });
  ids.push(user.id);
  sessions[persona] = {
    userId: user.id,
    token: signJwt({ id: user.id, email: user.email, session_epoch: user.session_epoch }),
  };
}
const ownerId = (sessions.organizer as { userId: string }).userId;
const org = await prisma.organization.create({
  data: { name: `Current UI Org ${run}`, league_owner_id: ownerId, admin_approved: true },
});
await prisma.organizationMembership.create({
  data: { organization_id: org.id, user_id: ownerId, role: 'owner' },
});
const coachId = (sessions.coach as { userId: string }).userId;
await prisma.organizationMembership.create({
  data: { organization_id: org.id, user_id: coachId, role: 'member', status: 'active' },
});
await prisma.user.updateMany({
  where: { id: { in: [ownerId, coachId] } },
  data: { organization_id: org.id },
});
const team = await prisma.team.create({
  data: { organization_id: org.id, name: `Current UI Team ${run}` },
});
await prisma.teamMembership.create({
  data: { team_id: team.id, user_id: coachId, role: 'coach', status: 'active' },
});
writeFileSync(
  '/tmp/varsityhub-current-reaudit-20260905/browser-sessions.json',
  JSON.stringify(sessions),
  { mode: 0o600 }
);
const listener = app.listen(4498, '127.0.0.1', () => console.log('Audit API ready on 4498'));
async function shutdown() {
  listener.close();
  await prisma.team.delete({ where: { id: team.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
