#!/usr/bin/env npx tsx
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { PrismaClient, type ApprovalStatus, type MembershipPlan } from '@prisma/client';
import {
  buildAuthStateColumns,
  getPreferencesObject,
  mergeAuthStateIntoPreferences,
} from '../src/lib/userAuthState.js';
import {
  buildBillingStateColumns,
  mergeBillingStateIntoPreferences,
} from '../src/lib/userBillingState.js';

const prisma = new PrismaClient();

export const COACH_UAT_EMAIL_DOMAIN = (process.env.COACH_UAT_EMAIL_DOMAIN || 'varsityhub.test').trim();
export const COACH_UAT_PASSWORD = (process.env.COACH_UAT_PASSWORD || 'CoachUAT2026!').trim();
const EMAIL_DOMAIN = COACH_UAT_EMAIL_DOMAIN;
const PASSWORD = COACH_UAT_PASSWORD;
const AGREEMENT_VERSION = Number(process.env.COACH_UAT_AGREEMENT_VERSION || '1') || 1;
const FAN_MODE_STATUS =
  String(process.env.COACH_UAT_FAN_MODE_STATUS || 'REJECTED').trim().toUpperCase() === 'PENDING'
    ? 'PENDING'
    : 'REJECTED';
const FIXTURE_DATE = new Date().toISOString().slice(0, 10);

type CoachStateSeed = {
  key: string;
  label: string;
  email: string;
  username: string;
  displayName: string;
  plan: MembershipPlan;
  approvalStatus: ApprovalStatus;
  coachAgreementAccepted: boolean;
  paidByOwner: boolean;
  paymentApproved: boolean;
  paymentPending: boolean;
  proceedingAsFan: boolean;
  expectation: string;
  maxTeams: number;
};

function coachEmail(slug: string) {
  return `coach-uat-${slug}@${EMAIL_DOMAIN}`;
}

export const COACH_ROUTE_BATTERY_LOCAL_EMAIL = coachEmail('rookie');
export const COACH_ROUTE_BATTERY_LOCAL_MISSING_AGREEMENT_EMAIL = coachEmail('missing-agreement');
export const COACH_ROUTE_BATTERY_LOCAL_FAN_MODE_EMAIL = coachEmail(
  FAN_MODE_STATUS === 'PENDING' ? 'pending-fan' : 'rejected-fan'
);
export const COACH_ROUTE_BATTERY_LOCAL_FAN_MODE_STATUS = FAN_MODE_STATUS;

function coachUsername(slug: string) {
  return `cuat_${slug}`.slice(0, 20);
}

function slugTitle(slug: string) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const coachStates: CoachStateSeed[] = [
  {
    key: 'rookie',
    label: 'Approved rookie coach with signed agreement',
    email: coachEmail('rookie'),
    username: coachUsername('rookie'),
    displayName: 'Coach UAT Rookie',
    plan: 'rookie',
    approvalStatus: 'APPROVED',
    coachAgreementAccepted: true,
    paidByOwner: false,
    paymentApproved: false,
    paymentPending: false,
    proceedingAsFan: false,
    expectation: 'All coach screens open; premium upsells remain gated.',
    maxTeams: 2,
  },
  {
    key: 'veteran',
    label: 'Approved veteran coach with completed payment',
    email: coachEmail('veteran'),
    username: coachUsername('veteran'),
    displayName: 'Coach UAT Veteran',
    plan: 'veteran',
    approvalStatus: 'APPROVED',
    coachAgreementAccepted: true,
    paidByOwner: false,
    paymentApproved: true,
    paymentPending: false,
    proceedingAsFan: false,
    expectation: 'Coach screens open; veteran entitlements visible after restart.',
    maxTeams: 3,
  },
  {
    key: 'legend',
    label: 'Approved legend coach with completed payment',
    email: coachEmail('legend'),
    username: coachUsername('legend'),
    displayName: 'Coach UAT Legend',
    plan: 'legend',
    approvalStatus: 'APPROVED',
    coachAgreementAccepted: true,
    paidByOwner: false,
    paymentApproved: true,
    paymentPending: false,
    proceedingAsFan: false,
    expectation: 'Coach screens open; legend entitlements visible after restart.',
    maxTeams: 99,
  },
  {
    key: 'owner-covered',
    label: 'Approved coach covered by league owner billing',
    email: coachEmail('owner-covered'),
    username: coachUsername('ownercov'),
    displayName: 'Coach UAT Owner Covered',
    plan: 'veteran',
    approvalStatus: 'APPROVED',
    coachAgreementAccepted: true,
    paidByOwner: true,
    paymentApproved: false,
    paymentPending: false,
    proceedingAsFan: false,
    expectation: 'Premium access works without self-checkout prompts.',
    maxTeams: 3,
  },
  {
    key: 'missing-agreement',
    label: 'Approved coach missing agreement signature',
    email: coachEmail('missing-agreement'),
    username: coachUsername('agreewait'),
    displayName: 'Coach UAT Agreement Required',
    plan: 'rookie',
    approvalStatus: 'APPROVED',
    coachAgreementAccepted: false,
    paidByOwner: false,
    paymentApproved: false,
    paymentPending: false,
    proceedingAsFan: false,
    expectation: 'Coach tools stay blocked until the agreement is accepted; recovery routes should point to coach-agreement.',
    maxTeams: 2,
  },
  {
    key: FAN_MODE_STATUS === 'PENDING' ? 'pending-fan-mode' : 'rejected-fan-mode',
    label:
      FAN_MODE_STATUS === 'PENDING'
        ? 'Pending coach proceeding as fan'
        : 'Rejected coach proceeding as fan',
    email: coachEmail(FAN_MODE_STATUS === 'PENDING' ? 'pending-fan' : 'rejected-fan'),
    username: coachUsername(FAN_MODE_STATUS === 'PENDING' ? 'pendingfan' : 'rejectfan'),
    displayName:
      FAN_MODE_STATUS === 'PENDING' ? 'Coach UAT Pending Fan Mode' : 'Coach UAT Rejected Fan Mode',
    plan: 'rookie',
    approvalStatus: FAN_MODE_STATUS as ApprovalStatus,
    coachAgreementAccepted: false,
    paidByOwner: false,
    paymentApproved: false,
    paymentPending: false,
    proceedingAsFan: true,
    expectation:
      FAN_MODE_STATUS === 'PENDING'
        ? 'Coach tools stay blocked; fan-safe paths remain available.'
        : 'Coach tools stay blocked; rejected-state messaging and reapply flow are visible.',
    maxTeams: 2,
  },
];

function subscriptionTierForPlan(plan: MembershipPlan, paidByOwner: boolean) {
  if (paidByOwner) return 'premium';
  return plan === 'rookie' ? 'free' : 'premium';
}

function makePasswordHash() {
  return bcrypt.hash(PASSWORD, 10);
}

async function upsertOrganization(params: {
  name: string;
  zipCode: string;
  leagueOwnerId: string;
  adminApproved?: boolean;
}) {
  const existing = await prisma.organization.findFirst({
    where: { name: params.name, zip_code: params.zipCode },
    select: { id: true },
  });

  if (existing) {
    return prisma.organization.update({
      where: { id: existing.id },
      data: {
        league_owner_id: params.leagueOwnerId,
        admin_approved: params.adminApproved ?? true,
        approved_at: params.adminApproved === false ? null : new Date(),
        approved_by: params.adminApproved === false ? null : params.leagueOwnerId,
        sport: 'basketball',
        org_type: 'school',
        location: 'UAT City, NY',
        zip_code: params.zipCode,
        status: 'active',
      },
    });
  }

  return prisma.organization.create({
    data: {
      name: params.name,
      league_owner_id: params.leagueOwnerId,
      admin_approved: params.adminApproved ?? true,
      approved_at: params.adminApproved === false ? null : new Date(),
      approved_by: params.adminApproved === false ? null : params.leagueOwnerId,
      sport: 'basketball',
      org_type: 'school',
      location: 'UAT City, NY',
      zip_code: params.zipCode,
      status: 'active',
    },
  });
}

async function upsertTeam(params: {
  organizationId: string;
  name: string;
  sport?: string;
}) {
  const existing = await prisma.team.findFirst({
    where: { organization_id: params.organizationId, name: params.name },
    select: { id: true },
  });

  if (existing) {
    return prisma.team.update({
      where: { id: existing.id },
      data: {
        sport: params.sport || 'basketball',
        status: 'active',
      },
    });
  }

  return prisma.team.create({
    data: {
      organization_id: params.organizationId,
      name: params.name,
      sport: params.sport || 'basketball',
      status: 'active',
    },
  });
}

async function ensureOrgMembership(organizationId: string, userId: string, role: string) {
  await prisma.organizationMembership.upsert({
    where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
    update: { role, status: 'active' },
    create: {
      organization_id: organizationId,
      user_id: userId,
      role,
      status: 'active',
    },
  });
}

async function ensureTeamMembership(
  teamId: string,
  userId: string,
  role: 'owner' | 'manager' | 'coach' | 'assistant_coach' | 'player',
) {
  await prisma.teamMembership.upsert({
    where: { team_id_user_id: { team_id: teamId, user_id: userId } },
    update: { role, status: 'active' },
    create: {
      team_id: teamId,
      user_id: userId,
      role,
      status: 'active',
    },
  });
}

async function upsertCoachUser(
  seed: CoachStateSeed,
  organizationId: string | null,
  organizationName: string | null,
) {
  const passwordHash = await makePasswordHash();
  const agreementAcceptedAt = seed.coachAgreementAccepted ? new Date() : null;
  const basePreferences = getPreferencesObject({});
  const authPreferences = mergeAuthStateIntoPreferences(basePreferences, {
    role: 'coach',
    onboarding_completed: true,
    organization_id: organizationId,
    proceeding_as_fan: seed.proceedingAsFan,
    coach_agreement_accepted_at: agreementAcceptedAt,
    coach_agreement_version: seed.coachAgreementAccepted ? AGREEMENT_VERSION : null,
  });
  const billingPreferences = mergeBillingStateIntoPreferences(authPreferences, {
    plan: seed.plan,
    pending_plan: null,
    payment_pending: seed.paymentPending,
    payment_approved: seed.paymentApproved,
  });
  const preferences = {
    ...billingPreferences,
    affiliation: 'school',
    organization_name: organizationName,
    join_request_pending: false,
    messaging_policy_accepted: true,
    notifications: {
      team_updates: true,
      messages_notifications: true,
      follows_notifications: true,
    },
  };

  const rejectedAt =
    seed.approvalStatus === 'REJECTED' ? new Date(Date.now() - 72 * 60 * 60 * 1000) : null;
  const rejectionReason =
    seed.approvalStatus === 'REJECTED' ? 'Coach UAT rejected-state fixture' : null;

  return prisma.user.upsert({
    where: { email: seed.email },
    update: {
      password_hash: passwordHash,
      display_name: seed.displayName,
      username: seed.username,
      email_verified: true,
      approval_status: seed.approvalStatus,
      paid_by_owner: seed.paidByOwner,
      subscription_tier: subscriptionTierForPlan(seed.plan, seed.paidByOwner),
      subscription_status: seed.approvalStatus === 'APPROVED' ? 'active' : 'cancelled',
      max_teams: seed.maxTeams,
      rejected_at: rejectedAt,
      rejection_reason: rejectionReason,
      preferences,
      ...buildAuthStateColumns({
        role: 'coach',
        onboarding_completed: true,
        organization_id: organizationId,
        proceeding_as_fan: seed.proceedingAsFan,
        coach_agreement_accepted_at: agreementAcceptedAt,
        coach_agreement_version: seed.coachAgreementAccepted ? AGREEMENT_VERSION : null,
      }),
      ...buildBillingStateColumns({
        plan: seed.plan,
        pending_plan: null,
        payment_pending: seed.paymentPending,
        payment_approved: seed.paymentApproved,
      }),
      date_of_birth: new Date('1990-06-15'),
      dob_set_at: new Date(),
      deleted_at: null,
      deletion_anonymized: false,
      banned: false,
    },
    create: {
      email: seed.email,
      password_hash: passwordHash,
      display_name: seed.displayName,
      username: seed.username,
      email_verified: true,
      approval_status: seed.approvalStatus,
      paid_by_owner: seed.paidByOwner,
      subscription_tier: subscriptionTierForPlan(seed.plan, seed.paidByOwner),
      subscription_status: seed.approvalStatus === 'APPROVED' ? 'active' : 'cancelled',
      max_teams: seed.maxTeams,
      rejected_at: rejectedAt,
      rejection_reason: rejectionReason,
      preferences,
      role: 'coach',
      onboarding_completed: true,
      organization_id: organizationId,
      proceeding_as_fan: seed.proceedingAsFan,
      coach_agreement_accepted_at: agreementAcceptedAt,
      coach_agreement_version: seed.coachAgreementAccepted ? AGREEMENT_VERSION : null,
      plan: seed.plan,
      pending_plan: null,
      payment_pending: seed.paymentPending,
      payment_approved: seed.paymentApproved,
      date_of_birth: new Date('1990-06-15'),
      dob_set_at: new Date(),
    },
  });
}

async function ensureFixtureEvent(teamId: string, creatorId: string) {
  const title = `Coach UAT Pending Event ${FIXTURE_DATE}`;
  const existing = await prisma.event.findFirst({
    where: { team_id: teamId, title },
    select: { id: true },
  });
  const eventDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  if (existing) {
    return prisma.event.update({
      where: { id: existing.id },
      data: {
        date: eventDate,
        approval_status: 'pending',
        status: 'approved',
        creator_id: creatorId,
        creator_role: 'fan',
        event_type: 'watch_party',
        location: 'Coach UAT Gym',
      },
    });
  }

  return prisma.event.create({
    data: {
      title,
      date: eventDate,
      location: 'Coach UAT Gym',
      team_id: teamId,
      creator_id: creatorId,
      creator_role: 'fan',
      approval_status: 'pending',
      status: 'approved',
      event_type: 'watch_party',
      description: 'Pending fixture for coach approvals UAT.',
      linked_league: 'Coach UAT League',
    },
  });
}

async function ensureFixtureGame(teamId: string, creatorId: string) {
  const title = `Coach UAT Pending Game ${FIXTURE_DATE}`;
  const existing = await prisma.game.findFirst({
    where: { title, home_team_id: teamId },
    select: { id: true },
  });
  const gameDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (existing) {
    return prisma.game.update({
      where: { id: existing.id },
      data: {
        date: gameDate,
        approval_status: 'pending',
        home_team_id: teamId,
        away_team_name: 'Coach UAT Opponent',
        created_by_id: creatorId,
        home_team: 'Coach UAT Home',
        away_team: 'Coach UAT Opponent',
      },
    });
  }

  return prisma.game.create({
    data: {
      title,
      date: gameDate,
      location: 'Coach UAT Court',
      approval_status: 'pending',
      home_team_id: teamId,
      home_team: 'Coach UAT Home',
      away_team_name: 'Coach UAT Opponent',
      away_team: 'Coach UAT Opponent',
      created_by_id: creatorId,
    },
  });
}

async function upsertFixtureFan() {
  const passwordHash = await makePasswordHash();
  return prisma.user.upsert({
    where: { email: `coach-uat-fan@${EMAIL_DOMAIN}` },
    update: {
      password_hash: passwordHash,
      display_name: 'Coach UAT Fan Fixture',
      username: 'cuat_fanfx',
      email_verified: true,
      approval_status: 'APPROVED',
      role: 'fan',
      onboarding_completed: true,
      plan: 'rookie',
      pending_plan: null,
      payment_pending: false,
      payment_approved: false,
      preferences: {
        role: 'fan',
        onboarding_completed: true,
        plan: 'rookie',
      },
      date_of_birth: new Date('1996-03-20'),
      dob_set_at: new Date(),
    },
    create: {
      email: `coach-uat-fan@${EMAIL_DOMAIN}`,
      password_hash: passwordHash,
      display_name: 'Coach UAT Fan Fixture',
      username: 'cuat_fanfx',
      email_verified: true,
      approval_status: 'APPROVED',
      role: 'fan',
      onboarding_completed: true,
      plan: 'rookie',
      pending_plan: null,
      payment_pending: false,
      payment_approved: false,
      preferences: {
        role: 'fan',
        onboarding_completed: true,
        plan: 'rookie',
      },
      date_of_birth: new Date('1996-03-20'),
      dob_set_at: new Date(),
    },
  });
}

// Fan-role user that holds a `manager` team membership — i.e. a non-coach
// AUTHORIZED user who should be ADMITTED to team-management surfaces by
// useRequireTeamManagement (membership-based), even though their user role is
// not 'coach'. Drives .maestro/flows/05-manager-admit.yaml.
async function upsertFixtureManager() {
  const passwordHash = await makePasswordHash();
  const data = {
    password_hash: passwordHash,
    display_name: 'Coach UAT Manager Fixture',
    username: 'cuat_mgrfx',
    email_verified: true,
    approval_status: 'APPROVED',
    role: 'fan' as const,
    onboarding_completed: true,
    plan: 'rookie' as const,
    pending_plan: null,
    payment_pending: false,
    payment_approved: false,
    preferences: { role: 'fan', onboarding_completed: true, plan: 'rookie' },
    date_of_birth: new Date('1992-07-11'),
    dob_set_at: new Date(),
  };
  return prisma.user.upsert({
    where: { email: `coach-uat-manager@${EMAIL_DOMAIN}` },
    update: data,
    create: { email: `coach-uat-manager@${EMAIL_DOMAIN}`, ...data },
  });
}

// Fan-role user that holds a `player` (roster) team membership — i.e. an
// athlete who must be BOUNCED from team-management surfaces. Drives
// .maestro/flows/04-coach-gating.yaml.
async function upsertFixtureAthlete() {
  const passwordHash = await makePasswordHash();
  const data = {
    password_hash: passwordHash,
    display_name: 'Coach UAT Athlete Fixture',
    username: 'cuat_athfx',
    email_verified: true,
    approval_status: 'APPROVED',
    role: 'fan' as const,
    onboarding_completed: true,
    plan: 'rookie' as const,
    pending_plan: null,
    payment_pending: false,
    payment_approved: false,
    preferences: { role: 'fan', onboarding_completed: true, plan: 'rookie' },
    date_of_birth: new Date('2006-09-02'),
    dob_set_at: new Date(),
  };
  return prisma.user.upsert({
    where: { email: `coach-uat-athlete@${EMAIL_DOMAIN}` },
    update: data,
    create: { email: `coach-uat-athlete@${EMAIL_DOMAIN}`, ...data },
  });
}

async function createPaidByOwnerOwner() {
  const passwordHash = await makePasswordHash();
  return prisma.user.upsert({
    where: { email: `coach-uat-owner@${EMAIL_DOMAIN}` },
    update: {
      password_hash: passwordHash,
      display_name: 'Coach UAT League Owner',
      username: 'cuat_ownerlg',
      email_verified: true,
      approval_status: 'APPROVED',
      subscription_tier: 'premium',
      subscription_status: 'active',
      max_teams: 99,
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        plan: 'legend',
        payment_pending: false,
        payment_approved: true,
        coach_agreement_accepted_at: new Date().toISOString(),
        coach_agreement_version: AGREEMENT_VERSION,
      },
      ...buildAuthStateColumns({
        role: 'coach',
        onboarding_completed: true,
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: AGREEMENT_VERSION,
      }),
      ...buildBillingStateColumns({
        plan: 'legend',
        pending_plan: null,
        payment_pending: false,
        payment_approved: true,
      }),
      date_of_birth: new Date('1986-01-11'),
      dob_set_at: new Date(),
    },
    create: {
      email: `coach-uat-owner@${EMAIL_DOMAIN}`,
      password_hash: passwordHash,
      display_name: 'Coach UAT League Owner',
      username: 'cuat_ownerlg',
      email_verified: true,
      approval_status: 'APPROVED',
      subscription_tier: 'premium',
      subscription_status: 'active',
      max_teams: 99,
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        plan: 'legend',
        payment_pending: false,
        payment_approved: true,
        coach_agreement_accepted_at: new Date().toISOString(),
        coach_agreement_version: AGREEMENT_VERSION,
      },
      role: 'coach',
      onboarding_completed: true,
      coach_agreement_accepted_at: new Date(),
      coach_agreement_version: AGREEMENT_VERSION,
      plan: 'legend',
      pending_plan: null,
      payment_pending: false,
      payment_approved: true,
      date_of_birth: new Date('1986-01-11'),
      dob_set_at: new Date(),
    },
  });
}

export async function prepareCoachUatAccounts() {
  console.log('Preparing coach UAT accounts...');
  console.log(`Email domain: ${EMAIL_DOMAIN}`);
  console.log(`Fixture password: ${PASSWORD}`);
  console.log(`Fan-mode state: ${FAN_MODE_STATUS}`);

  const owner = await createPaidByOwnerOwner();
  const fixtureFan = await upsertFixtureFan();
  const fixtureManager = await upsertFixtureManager();
  const fixtureAthlete = await upsertFixtureAthlete();

  // Team to hang the non-coach manager + athlete fixtures on (the rookie team).
  let fixtureTeamId: string | null = null;

  const summary: Array<Record<string, string>> = [];

  for (let index = 0; index < coachStates.length; index += 1) {
    const seed = coachStates[index];
    const zipCode = `10${String(index + 1).padStart(3, '0')}`;
    const orgName = `Coach UAT ${slugTitle(seed.key)} Org`;
    const teamName = `Coach UAT ${slugTitle(seed.key)} Team`;

    let organizationId: string | null = null;
    let teamId: string | null = null;

    if (seed.approvalStatus === 'APPROVED') {
      if (seed.paidByOwner) {
        const org = await upsertOrganization({
          name: orgName,
          zipCode,
          leagueOwnerId: owner.id,
          adminApproved: true,
        });
        const team = await upsertTeam({ organizationId: org.id, name: teamName });
        organizationId = org.id;
        teamId = team.id;
        await ensureOrgMembership(org.id, owner.id, 'owner');
      }
    }

    const coach = await upsertCoachUser(seed, organizationId, orgName);

    if (seed.approvalStatus === 'APPROVED') {
      if (seed.paidByOwner) {
        const org = await upsertOrganization({
          name: orgName,
          zipCode,
          leagueOwnerId: owner.id,
          adminApproved: true,
        });
        const team = await upsertTeam({ organizationId: org.id, name: teamName });
        organizationId = org.id;
        teamId = team.id;
        await prisma.user.update({
          where: { id: coach.id },
          data: {
            organization_id: org.id,
            preferences: {
              ...(getPreferencesObject((await prisma.user.findUnique({
                where: { id: coach.id },
                select: { preferences: true },
              }))?.preferences)),
              organization_id: org.id,
              organization_name: org.name,
            },
          },
        });
        await ensureOrgMembership(org.id, owner.id, 'owner');
        await ensureOrgMembership(org.id, coach.id, 'manager');
        await ensureTeamMembership(team.id, coach.id, 'manager');
      } else {
        const org = await upsertOrganization({
          name: orgName,
          zipCode,
          leagueOwnerId: coach.id,
          adminApproved: true,
        });
        const team = await upsertTeam({ organizationId: org.id, name: teamName });
        organizationId = org.id;
        teamId = team.id;
        await prisma.user.update({
          where: { id: coach.id },
          data: {
            organization_id: org.id,
            preferences: {
              ...(getPreferencesObject((await prisma.user.findUnique({
                where: { id: coach.id },
                select: { preferences: true },
              }))?.preferences)),
              organization_id: org.id,
              organization_name: org.name,
            },
          },
        });
        await ensureOrgMembership(org.id, coach.id, 'owner');
        await ensureTeamMembership(team.id, coach.id, 'owner');
      }
    }

    if (seed.key === 'rookie' && teamId) {
      await ensureFixtureEvent(teamId, fixtureFan.id);
      await ensureFixtureGame(teamId, fixtureFan.id);
      fixtureTeamId = teamId;
    }

    summary.push({
      state: seed.label,
      email: seed.email,
      password: PASSWORD,
      team: teamId ? teamName : 'n/a',
      expectation: seed.expectation,
    });
  }

  // Attach the non-coach authorized manager + the athlete to the rookie team so
  // the gating flows have stable role-membership accounts to log in as.
  if (fixtureTeamId) {
    await ensureTeamMembership(fixtureTeamId, fixtureManager.id, 'manager');
    await ensureTeamMembership(fixtureTeamId, fixtureAthlete.id, 'player');
    summary.push({
      state: 'Non-coach manager (authorized, should ACCESS)',
      email: `coach-uat-manager@${EMAIL_DOMAIN}`,
      password: PASSWORD,
      team: 'rookie team (manager)',
      expectation: 'Admitted to manage-teams / approvals',
    });
    summary.push({
      state: 'Athlete (roster, should be BOUNCED)',
      email: `coach-uat-athlete@${EMAIL_DOMAIN}`,
      password: PASSWORD,
      team: 'rookie team (player)',
      expectation: 'Bounced from management surfaces to feed',
    });
  }

  console.log('\nCoach UAT accounts ready:\n');
  console.table(summary);
  console.log('Checklist: docs/COACH_DEVICE_UAT.md');
  console.log('Results template: docs/COACH_DEVICE_UAT_RESULTS_TEMPLATE.md');
}

export async function disconnectCoachUatAccountsPrisma() {
  await prisma.$disconnect();
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  prepareCoachUatAccounts()
    .catch((error) => {
      console.error('Failed to prepare coach UAT accounts:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectCoachUatAccountsPrisma();
    });
}
