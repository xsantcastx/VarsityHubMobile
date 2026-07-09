-- Record Terms of Service acceptance at registration. Fully additive and
-- nullable: existing users get NULL (no recorded acceptance) and are unaffected;
-- new registrations stamp terms_accepted_at + terms_version server-side.
ALTER TABLE "User"
ADD COLUMN "terms_accepted_at" TIMESTAMP(3),
ADD COLUMN "terms_version" INTEGER;
