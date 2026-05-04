DROP INDEX IF EXISTS "Organization_name_zip_code_key";

CREATE OR REPLACE FUNCTION normalize_org_name_for_dedupe(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              lower(replace(input, '&', 'and')),
              '\mst\.?\M', 'saint', 'g'
            ),
            '\mhs\M', 'highschool', 'g'
          ),
          '\mhigh school\M', 'highschool', 'g'
        ),
        '\mclub\M|\mleague\M|\mschool\M', '', 'g'
      ),
      '[^a-z0-9]', '', 'g'
    ),
    '\s+', '', 'g'
  );
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_active_norm_name_zip_key"
  ON "Organization" (normalize_org_name_for_dedupe("name"), "zip_code")
  WHERE "status" = 'active'::"OrganizationStatus" AND "zip_code" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_active_norm_name_null_zip_key"
  ON "Organization" (normalize_org_name_for_dedupe("name"))
  WHERE "status" = 'active'::"OrganizationStatus" AND "zip_code" IS NULL;
