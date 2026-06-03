import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { prisma } from '../server/src/lib/prisma';

const API_URL = process.env.API_URL || 'http://localhost:4000';
const RUN_ID = `prelaunch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'SmokeTest123!';
const NEW_PASSWORD = 'SmokeReset123!';
const ADULT_DOB = '1990-01-01';
const SUPPORTING_DOC_URL = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

type TestUser = {
  id: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
};

type CreatedIds = {
  userIds: string[];
  organizationIds: string[];
  teamIds: string[];
  postIds: string[];
};

const created: CreatedIds = {
  userIds: [],
  organizationIds: [],
  teamIds: [],
  postIds: [],
};

function uniqueEmail(label: string) {
  return `${RUN_ID}-${label}@varsityhub-test.app`.toLowerCase();
}

function uniqueUsername(label: string) {
  return `${label}-${RUN_ID}`
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '_')
    .slice(0, 20);
}

async function expectJson(response: APIResponse) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Expected JSON response, got status ${response.status()}: ${text}`);
  }
}

async function expectOk(response: APIResponse) {
  const body = await expectJson(response);
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

async function registerVerifiedUser(
  request: APIRequestContext,
  label: string,
  options: { onboardAsFan?: boolean } = {}
): Promise<TestUser> {
  const email = uniqueEmail(label);
  const registerResponse = await request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: PASSWORD,
      display_name: `Smoke ${label}`,
      dob: ADULT_DOB,
    },
  });
  const registerBody = await expectOk(registerResponse);
  const accessToken = registerBody.access_token as string;
  const userId = registerBody.user?.id as string;
  expect(userId).toBeTruthy();
  created.userIds.push(userId);

  const verificationCode = registerBody.dev_verification_code as string | undefined;
  if (!verificationCode) {
    test.skip(true, 'ENABLE_DEV_CODES=1 is required for pre-launch smoke auth flows.');
  }

  const verifyResponse = await request.post(`${API_URL}/auth/verify/confirm`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { code: verificationCode },
  });
  await expectOk(verifyResponse);

  if (options.onboardAsFan) {
    await completeFanOnboarding(request, accessToken, label);
  }

  return {
    id: userId,
    email,
    accessToken,
    refreshToken: registerBody.refresh_token,
  };
}

async function completeFanOnboarding(
  request: APIRequestContext,
  accessToken: string,
  label: string
) {
  const response = await request.post(`${API_URL}/auth/me/complete-onboarding`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      role: 'fan',
      username: uniqueUsername(label),
      display_name: `Smoke ${label}`,
      dob: ADULT_DOB,
      affiliation: 'none',
      sports_interests: ['basketball'],
      primary_intents: ['follow_teams'],
      location_enabled: false,
      notifications_enabled: false,
      messaging_policy_accepted: true,
    },
  });
  await expectOk(response);
}

async function createOrganizationFixture(owner: TestUser, label: string) {
  const organization = await prisma.organization.create({
    data: {
      name: `${RUN_ID} ${label} League`,
      sport: 'Basketball',
      org_type: 'school',
      location: 'Test City, CA',
      zip_code: '90210',
      admin_approved: true,
      approved_at: new Date(),
      league_owner_id: owner.id,
      supporting_document_url: SUPPORTING_DOC_URL,
    },
    select: { id: true },
  });
  created.organizationIds.push(organization.id);

  await prisma.organizationMembership.upsert({
    where: { organization_id_user_id: { organization_id: organization.id, user_id: owner.id } },
    update: { role: 'owner', status: 'active' },
    create: {
      organization_id: organization.id,
      user_id: owner.id,
      role: 'owner',
      status: 'active',
    },
  });

  return organization;
}

async function approveCoachFixture(user: TestUser, organizationId?: string) {
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { preferences: true },
  });
  const prefs =
    current?.preferences && typeof current.preferences === 'object'
      ? { ...(current.preferences as Record<string, unknown>) }
      : {};

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      organization_id: organizationId ?? null,
      proceeding_as_fan: false,
      plan: 'rookie',
      pending_plan: null,
      payment_pending: false,
      payment_approved: false,
      preferences: {
        ...prefs,
        role: 'coach',
        onboarding_completed: true,
        plan: 'rookie',
        payment_pending: false,
        payment_approved: false,
        ...(organizationId ? { organization_id: organizationId } : {}),
      },
    },
  });
}

async function createCoachWithTeam(request: APIRequestContext, label: string) {
  const coach = await registerVerifiedUser(request, `coach-${label}`);
  const organization = await createOrganizationFixture(coach, label);
  await approveCoachFixture(coach, organization.id);

  const teamResponse = await request.post(`${API_URL}/teams/create`, {
    headers: { Authorization: `Bearer ${coach.accessToken}` },
    data: {
      name: `${RUN_ID} ${label} Team`,
      sport: 'Basketball',
      club_type: 'sport',
      organization_id: organization.id,
      season_start: '2026-01-01',
      season_end: '2026-12-31',
    },
  });
  const teamBody = await expectOk(teamResponse);
  const teamId = teamBody.team?.id as string;
  expect(teamId).toBeTruthy();
  created.teamIds.push(teamId);

  return { coach, organizationId: organization.id, teamId };
}

async function cleanupCreatedData() {
  const { userIds, organizationIds, teamIds, postIds } = created;

  await prisma.notification
    .deleteMany({
      where: {
        OR: [
          userIds.length ? { user_id: { in: userIds } } : undefined,
          userIds.length ? { actor_id: { in: userIds } } : undefined,
          postIds.length ? { post_id: { in: postIds } } : undefined,
        ].filter(Boolean) as any[],
      },
    })
    .catch(() => {});

  if (postIds.length) {
    await prisma.post.deleteMany({ where: { id: { in: postIds } } }).catch(() => {});
  }
  if (teamIds.length || userIds.length) {
    await prisma.teamFollow
      .deleteMany({
        where: {
          OR: [
            teamIds.length ? { team_id: { in: teamIds } } : undefined,
            userIds.length ? { user_id: { in: userIds } } : undefined,
          ].filter(Boolean) as any[],
        },
      })
      .catch(() => {});
    await prisma.teamJoinRequest
      .deleteMany({ where: { OR: teamIds.map(team_id => ({ team_id })) } })
      .catch(() => {});
    await prisma.teamInvite
      .deleteMany({ where: { OR: teamIds.map(team_id => ({ team_id })) } })
      .catch(() => {});
    await prisma.teamMembership
      .deleteMany({
        where: {
          OR: [
            teamIds.length ? { team_id: { in: teamIds } } : undefined,
            userIds.length ? { user_id: { in: userIds } } : undefined,
          ].filter(Boolean) as any[],
        },
      })
      .catch(() => {});
  }
  if (teamIds.length) {
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } }).catch(() => {});
  }
  if (organizationIds.length || userIds.length) {
    await prisma.organizationInvite
      .deleteMany({ where: { OR: organizationIds.map(organization_id => ({ organization_id })) } })
      .catch(() => {});
    await prisma.organizationJoinRequest
      .deleteMany({ where: { OR: organizationIds.map(organization_id => ({ organization_id })) } })
      .catch(() => {});
    await prisma.organizationMembership
      .deleteMany({
        where: {
          OR: [
            organizationIds.length ? { organization_id: { in: organizationIds } } : undefined,
            userIds.length ? { user_id: { in: userIds } } : undefined,
          ].filter(Boolean) as any[],
        },
      })
      .catch(() => {});
    await prisma.user
      .updateMany({
        where: { id: { in: userIds } },
        data: { organization_id: null },
      })
      .catch(() => {});
  }
  if (organizationIds.length) {
    await prisma.organization
      .deleteMany({ where: { id: { in: organizationIds } } })
      .catch(() => {});
  }
  if (userIds.length) {
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  }

  created.userIds.length = 0;
  created.organizationIds.length = 0;
  created.teamIds.length = 0;
  created.postIds.length = 0;
}

test.describe.serial('Pre-launch critical user journeys', () => {
  test.afterEach(async () => {
    await cleanupCreatedData();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('coach account creation and onboarding reaches coach state', async ({ request }) => {
    const coach = await registerVerifiedUser(request, 'coach-onboarding');

    const upgradeResponse = await request.post(`${API_URL}/auth/upgrade-to-coach`, {
      headers: { Authorization: `Bearer ${coach.accessToken}` },
      data: { plan: 'rookie' },
    });
    await expectOk(upgradeResponse);

    const organization = await createOrganizationFixture(coach, 'coach-onboarding');
    const completeResponse = await request.post(`${API_URL}/auth/me/complete-onboarding`, {
      headers: { Authorization: `Bearer ${coach.accessToken}` },
      data: {
        role: 'coach',
        username: uniqueUsername('coach_onboard'),
        display_name: 'Smoke Coach',
        dob: ADULT_DOB,
        organization_id: organization.id,
        organization_name: `${RUN_ID} Onboarding League`,
        affiliation: 'school',
        sports_interests: ['basketball'],
        primary_intents: ['manage_team'],
        messaging_policy_accepted: true,
      },
    });
    await expectOk(completeResponse);

    const meResponse = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${coach.accessToken}` },
    });
    const me = await expectOk(meResponse);
    expect(me.role).toBe('coach');
    expect(me.onboarding_completed).toBe(true);
    expect(me.organization_id).toBe(organization.id);
  });

  test('fan account creation can follow a team', async ({ request }) => {
    const { teamId } = await createCoachWithTeam(request, 'fan-follow');
    const fan = await registerVerifiedUser(request, 'fan-follow', { onboardAsFan: true });

    const followResponse = await request.post(`${API_URL}/teams/${teamId}/follow`, {
      headers: { Authorization: `Bearer ${fan.accessToken}` },
    });
    const followBody = await expectOk(followResponse);
    expect(followBody.is_following).toBe(true);

    const teamResponse = await request.get(`${API_URL}/teams/${teamId}`, {
      headers: { Authorization: `Bearer ${fan.accessToken}` },
    });
    const team = await expectOk(teamResponse);
    expect(team.is_following).toBe(true);
  });

  test('coach posting a team update appears in followed-team fan feed', async ({ request }) => {
    const { coach, teamId } = await createCoachWithTeam(request, 'team-update');
    const fan = await registerVerifiedUser(request, 'team-update-fan', { onboardAsFan: true });

    await expectOk(
      await request.post(`${API_URL}/teams/${teamId}/follow`, {
        headers: { Authorization: `Bearer ${fan.accessToken}` },
      })
    );

    const content = `Smoke team update ${RUN_ID}`;
    const postResponse = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${coach.accessToken}` },
      data: {
        content,
        type: 'team_update',
        team_id: teamId,
      },
    });
    const post = await expectOk(postResponse);
    created.postIds.push(post.id);
    expect(post.team_id).toBe(teamId);

    const feedResponse = await request.get(`${API_URL}/feed/bundle?posts_limit=10`, {
      headers: { Authorization: `Bearer ${fan.accessToken}` },
    });
    const feed = await expectOk(feedResponse);
    const followedTeamPosts = feed.posts_followed_teams?.items ?? [];
    expect(
      followedTeamPosts.some((item: any) => item.id === post.id || item.content === content)
    ).toBe(true);
  });

  test('Stripe paid-plan upgrade flow starts from a free account when configured', async ({
    request,
  }) => {
    const configResponse = await request.get(`${API_URL}/payments/config`);
    const config = await expectOk(configResponse);
    test.skip(!config.payments_enabled, 'Stripe is not configured in this environment.');

    const user = await registerVerifiedUser(request, 'stripe-upgrade', { onboardAsFan: true });
    const checkoutResponse = await request.post(`${API_URL}/payments/checkout`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
      data: { plan: 'legend' },
    });
    const body = await expectJson(checkoutResponse);
    expect(checkoutResponse.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body.url || body.session_id).toBeTruthy();

    const meResponse = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });
    const me = await expectOk(meResponse);
    expect(me.plan).toBe('rookie');
  });

  test('password reset flow issues a dev code and accepts the new password', async ({
    request,
  }) => {
    const user = await registerVerifiedUser(request, 'password-reset', { onboardAsFan: true });

    const forgotResponse = await request.post(`${API_URL}/auth/password/forgot`, {
      data: { email: user.email },
    });
    const forgotBody = await expectOk(forgotResponse);
    const resetCode = forgotBody.dev_reset_code as string | undefined;
    if (!resetCode) {
      test.skip(true, 'ENABLE_DEV_CODES=1 is required for password reset smoke flow.');
    }

    const resetResponse = await request.post(`${API_URL}/auth/password/reset`, {
      data: {
        email: user.email,
        code: resetCode,
        password: NEW_PASSWORD,
      },
    });
    await expectOk(resetResponse);

    const loginResponse = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: user.email,
        password: NEW_PASSWORD,
      },
    });
    const loginBody = await expectOk(loginResponse);
    expect(loginBody.access_token).toBeTruthy();
    expect(loginBody.user?.email).toBe(user.email);
  });
});
