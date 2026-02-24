# Content & Safety, COPPA, and Report Flow Audit

**Date:** February 23, 2026  
**Scope:** Text content validation, COPPA compliance, and report flow from fan tap to admin action

---

## 1. Content & Safety Audit — User-Submitted Text

### Where Users Submit Text

| Location | Content Type | Profanity Filter | Spam Detection | Length Validation | XSS/Script Protection |
|----------|--------------|------------------|----------------|-------------------|------------------------|
| **Posts** | title, content | ✅ Yes | ✅ Yes | ✅ title max 200, content max 4000 | ⚠️ Basic (formUtils.sanitizeText strips `<>`) |
| **Comments** | content | ✅ Yes | ✅ Yes | ✅ max 1000 | ⚠️ Basic |
| **Events** | title, description | ✅ Yes | ✅ Yes | ⚠️ No explicit max (zod min(1) only) | ⚠️ Basic |
| **Team names** | name, description | ❌ No | ❌ No | ✅ name min 2; description optional | ⚠️ Basic |
| **User bio** | bio | ❌ No | ❌ No | ✅ max 1000 | ⚠️ Basic |
| **Messages** | content | ❌ No | ❌ No | ⚠️ No explicit max | ⚠️ Basic |
| **Organization** | name, description | ❌ No | ❌ No | ✅ name max 255, description max 1000 | ⚠️ Basic |
| **Report details** | details | ❌ No | ❌ No | ✅ max 2000 | ⚠️ Basic |

### Content Filter Implementation (`server/src/lib/contentFilter.ts`)

- **Profanity:** Curated blocklist (asshole, bitch, fuck, n-word, slurs, etc.) + obfuscation detection (pr0fanity → profanity)
- **Bullying/harm:** Regex patterns for "kill yourself", "go die", "kys", "you're worthless", etc. — **blocks submission**
- **Spam:** Excessive caps (>70%), repeated characters (5+), URLs in titles, promotional phrases ("free now", "click here")
- **Trolling:** Flagged but **not blocked** (possible_trolling flag)
- **Applied to:** Posts (create, update), post comments, events (create)

### Gaps

1. **Team names, bios, messages** — No profanity/spam filter. Malicious or inappropriate content can be saved.
2. **Event titles** — No explicit max length (only min 1).
3. **XSS/script injection** — `formUtils.sanitizeText` strips `<>` on sign-up; no server-side HTML/script sanitization for posts, comments, bios. React escapes by default, but stored content could be risky if ever rendered as HTML.
4. **Messages** — No content filter; no length limit on message body.

---

## 2. COPPA Compliance Audit

### Age Gate During Signup

| Question | Answer |
|----------|--------|
| **Is there an age gate?** | ⚠️ Partial — DOB is collected in onboarding step 2, but **not validated for minimum age** |
| **If user is under 13, are they blocked?** | ❌ **No** — No check for age < 13. Users can enter any DOB (e.g. 2015) and continue |
| **Where is DOB collected?** | `app/onboarding/step-2-basic.tsx` — required for all users |
| **DOB validation** | Only checks: year ≥ 1920 and date ≤ today. No minimum age (13) check |

### Under-18 Messaging Restrictions (Current)

| Rule | Enforced? | Location |
|------|-----------|----------|
| Minor (under 18) can only message accounts they **follow** | ✅ Yes (server) | `server/src/routes/messages.ts` |
| Adult cannot message minor (unless verified coach) | ⚠️ **Frontend only** | `utils/dmRestrictions.ts` + `message-thread.tsx` |
| Minor cannot message adult (unless verified coach) | ⚠️ **Frontend only** | Same |

**Critical gap:** The server (`messages.ts`) only checks when the **sender** is under 18. When an **adult** sends to a **minor**, there is **no server-side check**. The frontend `checkDMRestriction()` blocks/warns, but a direct API call could bypass it.

### Terms / Policy vs. Code

- `app/core-values.tsx` and terms mention "age-appropriate messaging restrictions" and "Users aged 13–17 must have parental consent"
- **No code enforces** parental consent or under-13 block

### COPPA Summary

| Requirement | Status |
|-------------|--------|
| Age gate (block under 13) | ❌ **Not implemented** |
| Parental consent for 13–17 | ❌ Policy only, not enforced |
| Under-18 messaging restrictions | ⚠️ Partial — minor→non-followed blocked; adult→minor not enforced server-side |

---

## 3. Report Flow Audit — Fan Tap to Admin Action

### Two Report Flows

| Flow | Trigger | Endpoint | Storage | Admin Visibility |
|------|---------|----------|---------|-------------------|
| **Report Abuse** (generic) | Settings → Report Abuse, or Message thread → Report user | `POST /support/contact` | `AbuseReport` table | Admin dashboard + email |
| **Content Report** (structured) | N/A — **no UI** | `POST /reports` | `AbuseReport` (via workaround) | Admin dashboard |

**Note:** The `reportsRouter` (POST /reports) is **not mounted** in `app.ts`. The content reporting API exists but is unreachable.

### Report Abuse Flow (What Actually Works)

1. **Fan taps "Report"** → Settings → Report Abuse, or Message thread → Safety → Report user
2. **Form** → Name, email, subject, details, optional accused user, optional evidence images
3. **Submit** → `Support.contact()` → `POST /support/contact`
4. **Server** → Creates `AbuseReport` row, calls `sendAbuseReportNotification()` → email to `CUSTOMER_SERVICE_EMAIL`
5. **Admin sees it** → Via email (if SendGrid configured) and/or `GET /admin/reports` (admin dashboard)

### How Long Until Admin Notices?

| Channel | Latency |
|---------|---------|
| **Email** | Depends on SendGrid delivery + admin inbox checking. Typically minutes to hours. |
| **Admin dashboard** | Admin must manually open `/admin/reports` (or equivalent). No push, no in-app notification to admins. |

**No auto-moderation.** Reports are human-reviewed only. No automatic hiding, no ML-based triage.

### Report Abuse Form Bug

- `report-abuse.tsx` sends `email: 'support@varsityhub.app'` to `Support.contact` — this overwrites the reporter's email in the stored report. The reporter's actual email is in `from_email` but the support route uses `email` from body for `reporter_email`.

---

## 4. Recommendations

### Content & Safety

1. Extend `validateContent()` to team names, bios, and messages (or add equivalent checks).
2. Add explicit max length for event title and description.
3. Consider server-side HTML/script sanitization (e.g. DOMPurify or similar) for any user content that could be rendered as HTML.

### COPPA

1. **Add age gate:** Before allowing signup/onboarding to complete, reject DOB indicating age < 13. Show message: "You must be at least 13 years old to use VarsityHub."
2. **Enforce adult→minor messaging on server:** Add the same checks as `dmRestrictions.ts` to `messages.ts` so adult→minor DMs are blocked server-side unless sender is verified coach.

### Reports

1. **Mount reports router:** Add `app.use('/reports', reportsRouter)` in `app.ts` so structured content reports (post, user, comment, message) are reachable.
2. **Add in-post Report option:** PostCard and post-detail should offer "Report" for non-authors, calling `POST /reports` with `target_type: 'post'`, `target_id`, `reason`.
3. **Fix Report Abuse email bug:** Use reporter's email (e.g. `from_email` or `email` from form) as `reporter_email` in the support payload.
4. **Admin notifications:** Consider push or email to admins when new reports arrive, so response time is not dependent on manual dashboard checks.
