import type { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  buildAuthStateColumns,
  getPreferencesObject,
  mergeAuthStateIntoPreferences,
} from './userAuthState.js';
import {
  buildBillingStateColumns,
  mergeBillingStateIntoPreferences,
} from './userBillingState.js';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const APP_REVIEW_EMAIL = 'demo@varsityhub.app';
export const APP_REVIEW_USERNAME = 'appledemo';
export const APP_REVIEW_DISPLAY_NAME = 'VarsityHub Review Demo';
export const APP_REVIEW_PLAN = 'rookie' as const;
export const APP_REVIEW_SUBSCRIPTION_TIER = 'free' as const;
export const APP_REVIEW_ORG_NAME = 'VarsityHub Review League';
export const APP_REVIEW_TEAM_NAME = 'VarsityHub Review Team';
export const APP_REVIEW_AD_NAME = 'VarsityHub Review Coach Demo Ad';
export const APP_REVIEW_AGREEMENT_VERSION = 1;
export const APP_REVIEW_MAX_TEAMS = 3;

const BASE_PREFERENCES = {
  affiliation: 'school',
  dob: '1990-06-15',
  notifications: {
    game_event_reminders: true,
    team_updates: true,
    comments_upvotes: true,
    follows_notifications: true,
    messages_notifications: true,
  },
};

function buildCoachPreferences(input: {
  organizationId?: string;
  organizationName?: string;
  coachAgreementAcceptedAt: Date;
}) {
  let preferences = getPreferencesObject(BASE_PREFERENCES);
  preferences = mergeAuthStateIntoPreferences(preferences, {
    role: 'coach',
    onboarding_completed: true,
    proceeding_as_fan: false,
    coach_agreement_accepted_at: input.coachAgreementAcceptedAt,
    coach_agreement_version: APP_REVIEW_AGREEMENT_VERSION,
    organization_id: input.organizationId,
  });
  preferences = mergeBillingStateIntoPreferences(preferences, {
    plan: APP_REVIEW_PLAN,
    pending_plan: null,
    payment_pending: false,
    payment_approved: false,
  });
  if (input.organizationName) {
    preferences.organization_name = input.organizationName;
  } else {
    delete preferences.organization_name;
  }
  return preferences;
}

async function upsertReviewAd(prisma: PrismaLike, userId: string) {
  const existing = await prisma.ad.findFirst({
    where: { user_id: userId, business_name: APP_REVIEW_AD_NAME },
    select: { id: true },
  });

  const adData = {
    user_id: userId,
    contact_name: 'VarsityHub Review',
    contact_email: APP_REVIEW_EMAIL,
    business_name: APP_REVIEW_AD_NAME,
    banner_url: null,
    banner_fit_mode: 'cover',
    target_url: 'https://www.varsityhub.app',
    target_zip_code: '10001',
    target_lat: 40.7506,
    target_lng: -73.9972,
    radius: 9,
    description:
      'Review-ready approved ad used to verify iOS in-app purchase checkout during App Review.',
    status: 'approved' as const,
    payment_status: 'unpaid' as const,
    admin_note:
      'System-seeded review demo ad. Approved to expose ad booking checkout during App Review.',
  };

  if (existing) {
    await prisma.ad.update({
      where: { id: existing.id },
      data: adData,
    });
    return;
  }

  await prisma.ad.create({ data: adData });
}

export async function ensureAppReviewFixture(prisma: PrismaLike, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const coachAgreementAcceptedAt = new Date();

  const initialPreferences = buildCoachPreferences({ coachAgreementAcceptedAt });
  const initialUser = await prisma.user.upsert({
    where: { email: APP_REVIEW_EMAIL },
    update: {
      password_hash: passwordHash,
      display_name: APP_REVIEW_DISPLAY_NAME,
      username: APP_REVIEW_USERNAME,
      email_verified: true,
      approval_status: 'APPROVED',
      subscription_tier: APP_REVIEW_SUBSCRIPTION_TIER,
      subscription_status: 'active',
      max_teams: APP_REVIEW_MAX_TEAMS,
      paid_by_owner: false,
      ...buildAuthStateColumns({
        role: 'coach',
        onboarding_completed: true,
        proceeding_as_fan: false,
        coach_agreement_accepted_at: coachAgreementAcceptedAt,
        coach_agreement_version: APP_REVIEW_AGREEMENT_VERSION,
      }),
      ...buildBillingStateColumns({
        plan: APP_REVIEW_PLAN,
        pending_plan: null,
        payment_pending: false,
        payment_approved: false,
      }),
      preferences: initialPreferences,
    },
    create: {
      email: APP_REVIEW_EMAIL,
      password_hash: passwordHash,
      display_name: APP_REVIEW_DISPLAY_NAME,
      username: APP_REVIEW_USERNAME,
      email_verified: true,
      approval_status: 'APPROVED',
      subscription_tier: APP_REVIEW_SUBSCRIPTION_TIER,
      subscription_status: 'active',
      max_teams: APP_REVIEW_MAX_TEAMS,
      paid_by_owner: false,
      ...buildAuthStateColumns({
        role: 'coach',
        onboarding_completed: true,
        proceeding_as_fan: false,
        coach_agreement_accepted_at: coachAgreementAcceptedAt,
        coach_agreement_version: APP_REVIEW_AGREEMENT_VERSION,
      }),
      ...buildBillingStateColumns({
        plan: APP_REVIEW_PLAN,
        pending_plan: null,
        payment_pending: false,
        payment_approved: false,
      }),
      preferences: initialPreferences,
    },
    select: { id: true },
  });

  const existingOrg = await prisma.organization.findFirst({
    where: { name: APP_REVIEW_ORG_NAME, zip_code: '10001' },
    select: { id: true },
  });
  const reviewOrg = existingOrg
    ? await prisma.organization.update({
        where: { id: existingOrg.id },
        data: {
          league_owner_id: initialUser.id,
          admin_approved: true,
          approved_at: new Date(),
          approved_by: initialUser.id,
          sport: 'basketball',
          org_type: 'school',
          location: 'New York, NY',
          zip_code: '10001',
          status: 'active',
          contact_info: 'App Review fixture organization',
        },
        select: { id: true },
      })
    : await prisma.organization.create({
        data: {
          name: APP_REVIEW_ORG_NAME,
          league_owner_id: initialUser.id,
          admin_approved: true,
          approved_at: new Date(),
          approved_by: initialUser.id,
          sport: 'basketball',
          org_type: 'school',
          location: 'New York, NY',
          zip_code: '10001',
          status: 'active',
          contact_info: 'App Review fixture organization',
        },
        select: { id: true },
      });

  const finalPreferences = buildCoachPreferences({
    organizationId: reviewOrg.id,
    organizationName: APP_REVIEW_ORG_NAME,
    coachAgreementAcceptedAt,
  });

  const coachUser = await prisma.user.update({
    where: { id: initialUser.id },
    data: {
      ...buildAuthStateColumns({
        organization_id: reviewOrg.id,
      }),
      preferences: finalPreferences,
    },
    select: { id: true },
  });

  await prisma.organizationMembership.upsert({
    where: {
      organization_id_user_id: {
        organization_id: reviewOrg.id,
        user_id: coachUser.id,
      },
    },
    update: {
      role: 'owner',
      status: 'active',
    },
    create: {
      organization_id: reviewOrg.id,
      user_id: coachUser.id,
      role: 'owner',
      status: 'active',
    },
  });

  const existingTeam = await prisma.team.findFirst({
    where: {
      organization_id: reviewOrg.id,
      name: APP_REVIEW_TEAM_NAME,
    },
    select: { id: true },
  });
  const reviewTeam = existingTeam
    ? await prisma.team.update({
        where: { id: existingTeam.id },
        data: {
          sport: 'Basketball',
          description: 'Seeded team for App Review coach and fan verification.',
          status: 'active',
          city: 'New York',
          state: 'NY',
          league: APP_REVIEW_ORG_NAME,
        },
        select: { id: true },
      })
    : await prisma.team.create({
        data: {
          organization_id: reviewOrg.id,
          name: APP_REVIEW_TEAM_NAME,
          sport: 'Basketball',
          description: 'Seeded team for App Review coach and fan verification.',
          status: 'active',
          city: 'New York',
          state: 'NY',
          league: APP_REVIEW_ORG_NAME,
        },
        select: { id: true },
      });

  await prisma.teamMembership.upsert({
    where: {
      team_id_user_id: {
        team_id: reviewTeam.id,
        user_id: coachUser.id,
      },
    },
    update: {
      role: 'owner',
      status: 'active',
    },
    create: {
      team_id: reviewTeam.id,
      user_id: coachUser.id,
      role: 'owner',
      status: 'active',
    },
  });

  await prisma.teamFollow.upsert({
    where: {
      user_id_team_id: {
        user_id: coachUser.id,
        team_id: reviewTeam.id,
      },
    },
    update: {},
    create: {
      user_id: coachUser.id,
      team_id: reviewTeam.id,
    },
  });

  await prisma.organizationFollow.upsert({
    where: {
      user_id_organization_id: {
        user_id: coachUser.id,
        organization_id: reviewOrg.id,
      },
    },
    update: {},
    create: {
      user_id: coachUser.id,
      organization_id: reviewOrg.id,
    },
  });

  const approvedEventDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const approvedGameDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const pendingEventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pendingGameDate = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000);

  const approvedPost = await prisma.post.findFirst({
    where: {
      author_id: coachUser.id,
      title: 'VarsityHub Review Schedule Update',
    },
    select: { id: true },
  });
  if (approvedPost) {
    await prisma.post.update({
      where: { id: approvedPost.id },
      data: {
        team_id: reviewTeam.id,
        type: 'update',
        content:
          'Welcome to the App Review fixture team. This post is seeded so reviewers can verify the feed, team page, and coach publishing surfaces from one login.',
        country_code: 'US',
        lat: 40.7506,
        lng: -73.9972,
      },
    });
  } else {
    await prisma.post.create({
      data: {
        author_id: coachUser.id,
        team_id: reviewTeam.id,
        title: 'VarsityHub Review Schedule Update',
        type: 'update',
        content:
          'Welcome to the App Review fixture team. This post is seeded so reviewers can verify the feed, team page, and coach publishing surfaces from one login.',
        country_code: 'US',
        lat: 40.7506,
        lng: -73.9972,
      },
    });
  }

  const approvedEvent = await prisma.event.findFirst({
    where: { title: 'VarsityHub Review Home Opener', team_id: reviewTeam.id },
    select: { id: true },
  });
  if (approvedEvent) {
    await prisma.event.update({
      where: { id: approvedEvent.id },
      data: {
        date: approvedEventDate,
        location: 'VarsityHub Review Gym',
        status: 'approved',
        approval_status: 'approved',
        creator_id: coachUser.id,
        creator_role: 'coach',
        event_type: 'game',
        description: 'Seeded approved event for App Review.',
        linked_league: APP_REVIEW_ORG_NAME,
      },
    });
  } else {
    await prisma.event.create({
      data: {
        title: 'VarsityHub Review Home Opener',
        date: approvedEventDate,
        location: 'VarsityHub Review Gym',
        team_id: reviewTeam.id,
        status: 'approved',
        approval_status: 'approved',
        creator_id: coachUser.id,
        creator_role: 'coach',
        event_type: 'game',
        description: 'Seeded approved event for App Review.',
        linked_league: APP_REVIEW_ORG_NAME,
      },
    });
  }

  const approvedGame = await prisma.game.findFirst({
    where: { title: 'VarsityHub Review Showcase Game', home_team_id: reviewTeam.id },
    select: { id: true },
  });
  if (approvedGame) {
    await prisma.game.update({
      where: { id: approvedGame.id },
      data: {
        date: approvedGameDate,
        location: 'VarsityHub Review Arena',
        approval_status: 'approved',
        created_by_id: coachUser.id,
        approved_by_id: coachUser.id,
        approved_at: new Date(),
        home_team: APP_REVIEW_TEAM_NAME,
        away_team: 'Review Opponent Academy',
        away_team_name: 'Review Opponent Academy',
      },
    });
  } else {
    await prisma.game.create({
      data: {
        title: 'VarsityHub Review Showcase Game',
        date: approvedGameDate,
        location: 'VarsityHub Review Arena',
        approval_status: 'approved',
        home_team_id: reviewTeam.id,
        created_by_id: coachUser.id,
        approved_by_id: coachUser.id,
        approved_at: new Date(),
        home_team: APP_REVIEW_TEAM_NAME,
        away_team: 'Review Opponent Academy',
        away_team_name: 'Review Opponent Academy',
      },
    });
  }

  const pendingEvent = await prisma.event.findFirst({
    where: { title: 'VarsityHub Review Pending Event', team_id: reviewTeam.id },
    select: { id: true },
  });
  if (pendingEvent) {
    await prisma.event.update({
      where: { id: pendingEvent.id },
      data: {
        date: pendingEventDate,
        location: 'VarsityHub Review Gym',
        status: 'approved',
        approval_status: 'pending',
        creator_id: coachUser.id,
        creator_role: 'coach',
        event_type: 'watch_party',
        description: 'Pending fixture so the Approvals surface is not empty during review.',
        linked_league: APP_REVIEW_ORG_NAME,
      },
    });
  } else {
    await prisma.event.create({
      data: {
        title: 'VarsityHub Review Pending Event',
        date: pendingEventDate,
        location: 'VarsityHub Review Gym',
        team_id: reviewTeam.id,
        status: 'approved',
        approval_status: 'pending',
        creator_id: coachUser.id,
        creator_role: 'coach',
        event_type: 'watch_party',
        description: 'Pending fixture so the Approvals surface is not empty during review.',
        linked_league: APP_REVIEW_ORG_NAME,
      },
    });
  }

  const pendingGame = await prisma.game.findFirst({
    where: { title: 'VarsityHub Review Pending Game', home_team_id: reviewTeam.id },
    select: { id: true },
  });
  if (pendingGame) {
    await prisma.game.update({
      where: { id: pendingGame.id },
      data: {
        date: pendingGameDate,
        location: 'VarsityHub Review Court',
        approval_status: 'pending',
        created_by_id: coachUser.id,
        home_team: APP_REVIEW_TEAM_NAME,
        away_team: 'Pending Review Opponent',
        away_team_name: 'Pending Review Opponent',
      },
    });
  } else {
    await prisma.game.create({
      data: {
        title: 'VarsityHub Review Pending Game',
        date: pendingGameDate,
        location: 'VarsityHub Review Court',
        approval_status: 'pending',
        home_team_id: reviewTeam.id,
        created_by_id: coachUser.id,
        home_team: APP_REVIEW_TEAM_NAME,
        away_team: 'Pending Review Opponent',
        away_team_name: 'Pending Review Opponent',
      },
    });
  }

  await upsertReviewAd(prisma, coachUser.id);

  return {
    email: APP_REVIEW_EMAIL,
    username: APP_REVIEW_USERNAME,
    organizationName: APP_REVIEW_ORG_NAME,
    teamName: APP_REVIEW_TEAM_NAME,
    adName: APP_REVIEW_AD_NAME,
  };
}
