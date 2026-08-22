-- Adds MLS NEXT Pro to the ProLeague enum. Additive and backward-compatible:
-- no existing rows change, and the value is only referenced by new ProTeam
-- seeds + ingested Events once the seed/adapter ship. ADD VALUE is safe here
-- because the new value is not used elsewhere in this migration.
ALTER TYPE "ProLeague" ADD VALUE IF NOT EXISTS 'mls_next_pro';
