# Legal Documents — Canonical Sources

The old static HTML copies that lived here (dated January 2025) drifted badly from
reality and were archived to `docs/archive/legal-2025-01/`. Do not edit or link them.

The live legal pages are code, not standalone documents:

| Document         | Canonical source (edit here)        | Public URL                              |
| ---------------- | ----------------------------------- | --------------------------------------- |
| Privacy Policy   | `app/settings/privacy-policy.tsx`   | https://varsityhub.app/privacy-policy   |
| Terms of Service | `app/settings/terms-of-service.tsx` | https://varsityhub.app/terms-of-service |
| Copyright & DMCA | `app/settings/dmca.tsx`             | https://varsityhub.app/dmca             |
| Account Deletion | `app/account-deletion.tsx`          | https://varsityhub.app/account-deletion |

The Terms of Service and DMCA screens were reinstated in-app (bridges
`app/terms-of-service.tsx` / `app/dmca.tsx`; fallback HTML in `publicSite.ts`).
Signup links the ToS next to the Privacy Policy, and registration records
`User.terms_accepted_at` + `terms_version` (bump `CURRENT_TERMS_VERSION` in
`server/src/routes/auth.ts` when the ToS changes materially). This supersedes the
earlier "reduce in-app legal to privacy policy only" decision.

The privacy policy public URL is an Expo Router bridge route (`app/privacy-policy.tsx`)
re-exporting the settings screen so one implementation renders in-app and on the web
export that Vercel serves.

`server/src/routes/publicSite.ts` carries fallback HTML copies of the same content for
the API domain. When you change the policy text, update both sides —
`app/settings/__tests__/legal-pages-consistency.test.ts` enforces that they stay in sync.

After editing: the web pages deploy on push (Vercel rebuilds the export); the in-app
screens additionally need `eas update --branch production`. If disclosures change
materially, also update the App Store privacy nutrition labels and the Play Store
data-safety form.
