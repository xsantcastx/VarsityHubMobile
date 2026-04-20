-- Parental consent admin-override audit trail.
-- Append-only table: every admin action that changes parental_consent_status
-- writes a row. COPPA compliance + chargeback / dispute defense.

CREATE TABLE IF NOT EXISTS "ParentalConsentAudit" (
    "id"              TEXT                    NOT NULL,
    "user_id"         TEXT                    NOT NULL,
    "actor_admin_id"  TEXT                    NOT NULL,
    "from_state"      "ParentalConsentStatus" NOT NULL,
    "to_state"        "ParentalConsentStatus" NOT NULL,
    "reason"          TEXT                    NOT NULL,
    "created_at"      TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentalConsentAudit_pkey" PRIMARY KEY ("id")
);

-- Subject FK: cascade so audit rows for a deleted user go with them.
ALTER TABLE "ParentalConsentAudit"
    ADD CONSTRAINT "ParentalConsentAudit_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Actor FK: restrict so a deleted admin doesn't silently destroy the audit
-- record of what they did. Admin accounts must be transferred / replaced
-- rather than deleted (matches typical compliance posture).
ALTER TABLE "ParentalConsentAudit"
    ADD CONSTRAINT "ParentalConsentAudit_actor_admin_id_fkey"
    FOREIGN KEY ("actor_admin_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ParentalConsentAudit_user_id_created_at_idx"
    ON "ParentalConsentAudit"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "ParentalConsentAudit_actor_admin_id_created_at_idx"
    ON "ParentalConsentAudit"("actor_admin_id", "created_at");
