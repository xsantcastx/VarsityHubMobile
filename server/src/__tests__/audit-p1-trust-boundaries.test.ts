/**
 * P1 audit regression guards — six trust-boundary fixes from the
 * architecture audit that landed on top of the P0 hardening.
 *
 * Each test is a source-grep against the post-fix file so that an
 * accidental rewrite (or a prettier reformat that drops an exempt
 * comment) re-opens the gap and the suite fails before it ships.
 *
 * Findings covered:
 *   #2 — /payments/subscription/cancel and /resume verify the Stripe
 *        customer owns the subscription before mutating.
 *   #3 — buildNativeHandoffUrlFromQuery() uses a strict allowlist for
 *        query params forwarded into the native scheme URL.
 *   #5 — env.ts treats missing REDIS_URL as FATAL in production
 *        (review-token replay protection requires a shared store).
 *   #6 — PUT /teams Zod schema does NOT accept null for organization_id
 *        (DB column is non-nullable; null would crash Prisma at 500).
 *   #7 — Org invite member count includes 'owner' so the per-plan
 *        authorized-user cap counts the owner's seat.
 *   #8 — PUT /teams reassignment calls isOrganizationApproved on the
 *        target org, matching the create-path approval gate.
 *   #9 — PUT /auth/me mention rewrite uses parameterized executeRaw,
 *        not executeRawUnsafe, on the request path.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const payments = read('routes/payments.ts');
const teams = read('routes/teams.ts');
const organizations = read('routes/organizations.ts');
const handoff = read('routes/publicAppHandoff.ts');
const env = read('lib/env.ts');
const auth = read('routes/auth.ts');

describe('audit P1 — trust-boundary regression guards', () => {
  describe('#2 subscription cancel/resume verify Stripe customer ownership', () => {
    it('cancel selects stripe_customer_id from the user record', () => {
      const block =
        payments.match(/paymentsRouter\.post\(\s*'\/subscription\/cancel'[\s\S]{0,3500}/)?.[0] ||
        '';
      expect(block).toMatch(
        /select:\s*\{\s*preferences:\s*true,\s*stripe_customer_id:\s*true\s*\}/
      );
    });

    it('cancel retrieves the Stripe subscription and checks customer match before mutating', () => {
      const block =
        payments.match(/paymentsRouter\.post\(\s*'\/subscription\/cancel'[\s\S]{0,3500}/)?.[0] ||
        '';
      expect(block).toMatch(/stripe\.subscriptions\.retrieve\(subscriptionId\)/);
      expect(block).toMatch(/String\(subCustomerId\) !== String\(user\.stripe_customer_id\)/);
      expect(block).toMatch(/refusing to mutate subscription owned by another customer/);
    });

    it('resume verifies Stripe customer ownership before un-cancelling', () => {
      const block =
        payments.match(/paymentsRouter\.post\(\s*'\/subscription\/resume'[\s\S]{0,3500}/)?.[0] ||
        '';
      expect(block).toMatch(/stripe_customer_id:\s*true/);
      expect(block).toMatch(/String\(resumeSubCustomerId\) !== String\(user\.stripe_customer_id\)/);
    });
  });

  describe('#3 publicAppHandoff allowlists query params before forwarding into native scheme', () => {
    it('declares an explicit allowlist set', () => {
      expect(handoff).toMatch(
        /ALLOWED_HANDOFF_QUERY_PARAMS\s*=\s*new Set\(\[[\s\S]*?'token'[\s\S]*?'email'[\s\S]*?'code'[\s\S]*?'delivery'[\s\S]*?'session_id'[\s\S]*?'type'[\s\S]*?\]\)/
      );
    });

    it('skips any query param that is not in the allowlist', () => {
      const block =
        handoff.match(/function buildNativeHandoffUrlFromQuery[\s\S]{0,800}/)?.[0] || '';
      expect(block).toMatch(/!ALLOWED_HANDOFF_QUERY_PARAMS\.has\(key\)/);
      expect(block).toMatch(/continue/);
    });
  });

  describe('#5 env.ts treats REDIS_URL as fatal in production', () => {
    it('throws if REDIS_URL is missing in production', () => {
      const block = env.match(/if \(!env\.REDIS_URL\)[\s\S]{0,800}/)?.[0] || '';
      expect(block).toMatch(/throw new Error/);
      expect(block).toMatch(/FATAL: REDIS_URL is not set/);
    });

    it('does not list REDIS_URL as a soft warning anymore', () => {
      // Locate the warnings.push block — REDIS_URL must not appear there.
      const warningsBlock =
        env.match(/const warnings: string\[\][\s\S]+?warnings\.length/)?.[0] || '';
      expect(warningsBlock).not.toMatch(/warnings\.push\(['"`]REDIS_URL/);
    });
  });

  describe('#6 PUT /teams schema rejects null organization_id', () => {
    it('schema declares organization_id as optional but NOT nullable', () => {
      // Match the field definition in the updateSchema. Allow either the
      // single-line or multi-line prettier formatting.
      const updateSchemaBlock =
        teams.match(/const updateSchema = z\.object\(\{[\s\S]+?\}\)/)?.[0] || '';
      expect(updateSchemaBlock).toMatch(
        /organization_id:\s*z\.string\(\)\.optional\(\)(?!\.nullable)/
      );
      expect(updateSchemaBlock).not.toMatch(
        /organization_id:\s*z\.string\(\)\.optional\(\)\.nullable\(\)/
      );
    });

    it('PUT handler no longer has a null branch that would write null to Prisma', () => {
      const putBlock = teams.match(/teamsRouter\.put\(\s*'\/:id'[\s\S]+?^\)/m)?.[0] || '';
      expect(putBlock).not.toMatch(/parsed\.data\.organization_id === null/);
    });
  });

  describe('#7 org invite cap counts owner seats', () => {
    it('organizationMembership.count includes owner in the role filter', () => {
      const block =
        organizations.match(/tx\.organizationMembership\.count\(\{[\s\S]{0,400}/)?.[0] || '';
      expect(block).toMatch(/role:\s*\{\s*in:\s*\[[^\]]*'owner'[^\]]*\]/);
    });
  });

  describe('#8 PUT /teams reassignment requires admin-approved target org', () => {
    it('calls isOrganizationApproved on the reassignment target', () => {
      const putBlock = teams.match(/teamsRouter\.put\(\s*'\/:id'[\s\S]+?^\)/m)?.[0] || '';
      expect(putBlock).toMatch(/isOrganizationApproved\(targetOrganizationId/);
      expect(putBlock).toMatch(/ORGANIZATION_NOT_APPROVED/);
    });
  });

  describe('#9 PUT /auth/me mention rewrite avoids executeRawUnsafe', () => {
    it('uses executeRaw with bound params for mention rewrites', () => {
      const putMeBlock = auth.match(/authRouter\.put\(\s*'\/me'[\s\S]+?return res\.json\(sanitizeUser\(user\)\);[\s\S]+?\)\s*\)/m)?.[0] || '';
      expect(putMeBlock).toMatch(/\$executeRaw\(mentionRewriteSql\('Post'\)\)/);
      expect(putMeBlock).toMatch(/\$executeRaw\(mentionRewriteSql\('Comment'\)\)/);
      expect(putMeBlock).not.toMatch(/\$executeRawUnsafe/);
    });
  });
});
