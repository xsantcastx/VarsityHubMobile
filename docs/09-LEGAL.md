# Privacy Surfaces

This repo keeps one user-facing legal document live in product code:

- Privacy Policy: `app/settings/privacy-policy.tsx`
- Public URL: `https://varsityhub.app/privacy-policy`

Related privacy/compliance surfaces that stay live because stores require them:

- Account deletion page: `app/account-deletion.tsx`
- Public URL: `https://varsityhub.app/account-deletion`
- Support page: `server/src/routes/publicSite.ts` at `/support`

Implementation notes:

- `app/privacy-policy.tsx` bridges the in-app privacy screen to the public web route.
- `server/src/routes/publicSite.ts` carries the API-domain fallback HTML for privacy, support, and account deletion.
- `app/settings/__tests__/legal-pages-consistency.test.ts` keeps the privacy-policy screen and fallback HTML aligned.

Do not add a separate in-app terms or DMCA screen unless product direction changes. If privacy disclosures change materially, update:

- `app/settings/privacy-policy.tsx`
- `server/src/routes/publicSite.ts`
- App Store privacy metadata
- Play Store data safety / deletion listings
