DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamStatus') THEN
    CREATE TYPE "TeamStatus" AS ENUM ('active', 'archived');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationStatus') THEN
    CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'rejected');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationRole') THEN
    CREATE TYPE "OrganizationRole" AS ENUM ('owner', 'manager', 'member', 'coach');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationJoinRequestStatus') THEN
    CREATE TYPE "OrganizationJoinRequestStatus" AS ENUM ('pending', 'approved', 'denied');
  END IF;
END
$$;

ALTER TABLE "Organization"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrganizationStatus" USING ("status"::text::"OrganizationStatus"),
  ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "Team"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "TeamStatus" USING ("status"::text::"TeamStatus"),
  ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "OrganizationMembership"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "OrganizationRole" USING ("role"::text::"OrganizationRole"),
  ALTER COLUMN "role" SET DEFAULT 'member',
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "MembershipStatus" USING ("status"::text::"MembershipStatus"),
  ALTER COLUMN "status" SET DEFAULT 'active';

ALTER TABLE "OrganizationInvite"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "OrganizationRole" USING ("role"::text::"OrganizationRole"),
  ALTER COLUMN "role" SET DEFAULT 'member',
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "InviteStatus" USING ("status"::text::"InviteStatus"),
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "OrganizationJoinRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrganizationJoinRequestStatus" USING ("status"::text::"OrganizationJoinRequestStatus"),
  ALTER COLUMN "status" SET DEFAULT 'pending';
