# Email Triggers Implementation Guide

**Status:** Planning Phase  
**Date:** December 13, 2025  
**Objective:** Wire high-signal transactional emails to existing backend events without new instrumentation

---

## 📊 Quick Priority Matrix

| Tier | Email Type | Impact | Effort | Backend Event | Status |
|------|-----------|--------|--------|---------------|--------|
| 🔴 **P0** | Reservation Received | High revenue signal | Low | `ads.reservations.created` | Ready |
| 🔴 **P0** | Payment Required / Link Expired | Recover abandoned checkouts | Low | `payments.checkout.abandoned` | Ready |
| 🔴 **P0** | Ad Goes Live | Advertiser confidence | Medium | `ads.status` → `active` | Ready |
| 🟡 **P1** | Roster Threshold Alert | Reduce support tickets | Low | `teams.created` (count logic) | Ready |
| 🟡 **P1** | New Staff Added | Onboarding velocity | Low | `staff.invited` | Ready |
| 🟡 **P1** | Report Resolution | Trust signal | Medium | `reports.status` → `resolved` | Ready |
| 🟢 **P2** | Season Wrap-Up | Retention hook | Medium | `seasons.locked` | Ready |
| 🟢 **P2** | Post Highlight | Creator engagement | Medium | `posts.reactions` threshold | Ready |
| 🟢 **P2** | Fan Follows Athlete | Social graph signal | Low | `follows.created` | Ready |
| 🟢 **P2** | Account Recovery | Security trust | Low | `auth.password_reset`, `auth.email_change` | Ready |
| 🟢 **P2** | Profile Incomplete Nudge | Onboarding completion | Low | `users.created` + 3-day wait | Ready |
| 🟢 **P2** | Dormant User Digest | Reactivation | Medium | `sessions.created` (inverse) | Ready |

---

## 🔴 P0: Revenue & Advertiser Lifecycle

### 1. **Reservation Received**

**Trigger Event:** `ads.reservations.created`

**When:** Immediately after advertiser selects dates and submits reservation

**Backend Hook Location:**
```
server/src/routes/ads.ts → POST /ads/reservations
```

**Data Available:**
```typescript
{
  ad_id: uuid,
  advertiser_id: uuid,
  advertiser_email: string,
  reserved_dates: string[],  // ISO dates
  cost: number,              // dollars
  target_zip_code: string,
  created_at: timestamp
}
```

**Email Template Variables:**
- `{{advertiser_name}}`
- `{{reserved_dates}}` (formatted as "Mon, Dec 16 - Fri, Dec 20")
- `{{cost}}` (e.g., "$13.00")
- `{{target_zip}}` (e.g., "90210")
- `{{checkout_link}}` (with 24-hour expiration)
- `{{ad_preview_url}}`

**Implementation Steps:**
1. After `createMany(reserved_dates)` succeeds in `ads.ts`, emit event:
   ```typescript
   await emailQueue.add('ads.reservation_received', {
     advertiser_id,
     advertiser_email,
     reserved_dates,
     cost,
     target_zip_code,
     ad_id
   });
   ```

2. Create template in `server/src/email/templates/ads/reservation-received.mjml`

3. Hook in email worker to handle `ads.reservation_received` and call SendGrid API

---

### 2. **Payment Required / Link Expired**

**Trigger Event:** `payments.checkout.abandoned` (inferred from timeout)

**When:** N hours after reservation without completed payment

**Backend Implementation:**
- Add job queue task (Bull/Redis) that fires 6-12 hours after reservation if payment not completed
- Check `payments.status` is still `pending` or `abandoned`

**Data Available:**
```typescript
{
  ad_id: uuid,
  advertiser_id: uuid,
  advertiser_email: string,
  reserved_dates: string[],
  cost: number,
  checkout_link: string,
  hours_until_expiry: number,
  original_reservation_time: timestamp
}
```

**Email Template Variables:**
- `{{advertiser_name}}`
- `{{cost}}`
- `{{hours_remaining}}` (e.g., "6 hours")
- `{{checkout_link_with_utm}}`
- `{{cancellation_policy_url}}`

**Implementation Steps:**
1. In `payments.ts`, after checkout session created:
   ```typescript
   const delayMs = 6 * 60 * 60 * 1000; // 6 hours
   await emailQueue.add(
     'payments.checkout_abandoned',
     { ad_id, advertiser_id, cost, checkout_link },
     { delay: delayMs, attempts: 1 }
   );
   ```

2. Job checks if payment still pending before sending

3. Include link to cancellation/refund policy for transparency

---

### 3. **Ad Goes Live**

**Trigger Event:** `ads.status` transitions to `active`

**When:** First time ad's date range enters "current date" and banner appears in feeds

**Backend Hook Location:**
```
server/src/cron/ad-status-updater.ts (runs daily at midnight)
```

**Data Available:**
```typescript
{
  ad_id: uuid,
  advertiser_id: uuid,
  advertiser_email: string,
  ad_title: string,
  target_zip_code: string,
  live_until: date,
  impressions_link: string  // analytics dashboard
}
```

**Email Template Variables:**
- `{{advertiser_name}}`
- `{{ad_title}}`
- `{{target_zip}}` (e.g., "Miami, FL 33139")
- `{{go_live_date}}`
- `{{live_until}}`
- `{{analytics_dashboard_url}}`
- `{{support_contact}}`

**Implementation Steps:**
1. In cron job, after updating ad status to `active`:
   ```typescript
   await emailQueue.add('ads.goes_live', {
     ad_id,
     advertiser_id,
     advertiser_email,
     ad_title,
     target_zip_code,
     live_until
   });
   ```

2. Template emphasizes real-time tracking and mentions impressions/CTR dashboard

3. Optional: Include screenshot/preview of what the banner looks like in feed

---

## 🟡 P1: Membership & Team Management

### 4. **Roster Threshold Alert**

**Trigger Event:** `teams.created` (count=2 already exists for user)

**When:** Coach creates 3rd team (triggers paid tier)

**Backend Hook Location:**
```
server/src/routes/teams.ts → POST /teams
```

**Logic:**
```typescript
const teamCount = await Team.count({ where: { coach_id: req.user.id } });
if (teamCount === 2) {
  // This is the 3rd team
  await emailQueue.add('teams.roster_threshold_alert', {
    coach_id,
    coach_email,
    coach_name,
    upcoming_billing_date,
    veteran_rate_per_team
  });
}
```

**Email Template Variables:**
- `{{coach_name}}`
- `{{new_team_name}}`
- `{{veteran_rate}}` (e.g., "$49/month")
- `{{billing_date}}`
- `{{manage_billing_url}}`
- `{{pricing_page_url}}`

**Implementation Steps:**
1. Add team count check before `create()` succeeds
2. Emit event with clear messaging about billing cycle
3. Include link to manage teams/pause a team if they want to stay on free tier

---

### 5. **New Staff Added**

**Trigger Event:** `staff.invited` (both before and after acceptance)

**When:** Head coach invites assistant coach/staff member

**Backend Hook Location:**
```
server/src/routes/staff.ts → POST /staff/invite
```

**Two Emails:**

**A) Invitation Email (to invitee)**
```typescript
await emailQueue.add('staff.invited_to_team', {
  invitee_email,
  invitee_name,
  inviter_name,
  team_name,
  invite_token,
  invite_link_with_token,
  onboarding_docs_url
});
```

**B) Confirmation Email (to head coach)**
```typescript
await emailQueue.add('staff.invitation_sent', {
  coach_id,
  coach_email,
  coach_name,
  invitee_name,
  invitee_email,
  team_name
});
```

**Email Template Variables (Invitation):**
- `{{inviter_name}}`
- `{{team_name}}`
- `{{invite_link}}`
- `{{onboarding_url}}`
- `{{expiry_days}}` (e.g., "7 days")

**Email Template Variables (Confirmation):**
- `{{invitee_name}}`
- `{{invitee_email}}`
- `{{team_name}}`
- `{{manage_staff_url}}`

**Implementation Steps:**
1. In `staff.ts`, immediately after creating invitation record:
   ```typescript
   const invite = await StaffInvite.create({ ... });
   await emailQueue.add('staff.invited_to_team', { ... });
   await emailQueue.add('staff.invitation_sent', { ... });
   ```

2. Include invite link that auto-fills email + team context

3. Head coach email includes "resend invite" link if needed

---

### 6. **Report Resolution**

**Trigger Event:** `reports.status` transitions to `resolved` or `dismissed`

**When:** Trust & Safety team closes an abuse/violation report

**Backend Hook Location:**
```
server/src/routes/reports.ts → PATCH /reports/:id
```

**Data Available:**
```typescript
{
  report_id: uuid,
  reporter_id: uuid,
  reporter_email: string,
  reported_user_id: uuid,
  resolution_type: 'upheld' | 'dismissed' | 'action_taken',
  resolution_message: string,
  appeal_url: string
}
```

**Email Template Variables (Reporter):**
- `{{reporter_name}}`
- `{{resolution_status}}` (e.g., "We reviewed your report and took action")
- `{{resolution_detail}}`
- `{{appeal_link}}`
- `{{support_contact}}`

**Email Template Variables (Reported User - if action taken):**
- `{{user_name}}`
- `{{violation_type}}` (e.g., "Harassment")
- `{{action_taken}}` (e.g., "Account warning", "Temporary suspension")
- `{{appeal_process_url}}`

**Implementation Steps:**
1. In reports route, after status update:
   ```typescript
   await emailQueue.add('reports.resolved', {
     report_id,
     resolution_type,
     reporter_id,
     reported_user_id
   });
   ```

2. Different templates for:
   - Reporter notification (thanking them, explaining outcome)
   - Reported user notification (if action taken, explain it + appeal path)

3. Include clear T&S policy link and appeal instructions

---

## 🟢 P2: Content, Onboarding & Retention

### 7. **Season Wrap-Up**

**Trigger Event:** `seasons.locked` (status changes from `in_progress` → `completed`)

**When:** Admin or automated process marks season as finished

**Backend Hook Location:**
```
server/src/cron/season-closer.ts (seasonal, run on defined date)
```

**Data Available:**
```typescript
{
  season_id: uuid,
  team_id: uuid,
  coach_id: uuid,
  coach_email: string,
  season_name: string,
  final_record: { wins, losses, ties },
  key_stats: {
    total_games: number,
    avg_attendance: number,
    top_performers: Array<{ name, stats }>
  },
  next_season_signup_link: string
}
```

**Email Template Variables:**
- `{{coach_name}}`
- `{{team_name}}`
- `{{season_name}}` (e.g., "Fall 2025")
- `{{final_record}}` (e.g., "12-2")
- `{{top_performers}}`
- `{{next_season_link}}`
- `{{archive_stats_link}}`

**Implementation Steps:**
1. In season-closer cron:
   ```typescript
   const season = await Season.findByPk(id);
   const stats = await calculateSeasonStats(id);
   await emailQueue.add('seasons.wrap_up', {
     season_id,
     coach_id,
     coach_email,
     stats,
     next_season_signup_link
   });
   ```

2. Highlight player/team achievements to encourage sharing

3. Strong CTA to start next season signup

---

### 8. **Post Highlight**

**Trigger Event:** `posts.reactions` count reaches threshold (e.g., 100)

**When:** Post from an athlete/creator hits 100 reactions (first time)

**Backend Hook Location:**
```
server/src/routes/posts.ts → reaction handling
```

**Logic:**
```typescript
// After reaction created/updated
const reactionCount = await Reaction.count({ where: { post_id } });
if (reactionCount === 100 && !post.milestone_100_email_sent) {
  await emailQueue.add('posts.milestone_reached', {
    post_id,
    creator_id,
    creator_email,
    reaction_count: 100,
    post_preview_url
  });
  await post.update({ milestone_100_email_sent: true });
}
```

**Email Template Variables:**
- `{{creator_name}}`
- `{{milestone_number}}` (e.g., "100")
- `{{post_preview}}` (image/text excerpt)
- `{{share_external_link}}`
- `{{view_reactions_link}}`
- `{{next_milestone}}` (e.g., "250 reactions")

**Implementation Steps:**
1. Track milestones at: 100, 250, 500, 1000 reactions

2. Template emphasizes social proof (e.g., "Your post is trending!")

3. Include share buttons for Twitter/Instagram to amplify reach

4. Flag in UI that post hit milestone (badge or notification)

---

### 9. **Fan Follows Athlete**

**Trigger Event:** `follows.created` (user_id follows athlete_id)

**When:** A fan/follower follows an athlete

**Backend Hook Location:**
```
server/src/routes/follows.ts → POST /follows
```

**Data Available:**
```typescript
{
  follow_id: uuid,
  follower_id: uuid,
  follower_name: string,
  athlete_id: uuid,
  athlete_email: string,
  athlete_name: string,
  mutual_follow: boolean,
  athlete_profile_url: string,
  dm_link: string
}
```

**Email Template Variables (Athlete):**
- `{{athlete_name}}`
- `{{follower_name}}`
- `{{follower_profile_url}}`
- `{{follow_back_link}}`
- `{{dm_link}}`
- `{{follower_stats}}` (e.g., "joined 3 months ago, follows 45 athletes")

**Implementation Steps:**
1. In follows.ts:
   ```typescript
   const follow = await Follow.create({ follower_id, athlete_id });
   await emailQueue.add('follows.athlete_followed', {
     follower_id,
     follower_name,
     athlete_id,
     athlete_email,
     athlete_name
   });
   ```

2. Include one-click "follow back" link to warm up DM channel

3. Optional: Highlight if follower is also a coach/recruiter (different messaging)

---

### 10. **Account Recovery Confirmation**

**Trigger Events:**
- `auth.password_reset` (user confirms password reset)
- `auth.email_change` (user confirms new email)

**Backend Hook Location:**
```
server/src/routes/auth.ts → password reset flow
server/src/routes/account.ts → email change flow
```

**Email A: Password Reset Confirmation**
```typescript
// After reset link clicked and new password saved
await emailQueue.add('auth.password_reset_complete', {
  user_id,
  user_email,
  user_name,
  reset_time: timestamp,
  ip_address: req.ip,
  support_url: 'https://varsityhub.com/support/security'
});
```

**Email B: Email Change Confirmation**
```typescript
// Send to OLD email address
await emailQueue.add('auth.email_change_old', {
  user_id,
  old_email,
  new_email,
  user_name,
  undo_link_with_token,
  undo_expiry_hours: 24
});

// Send to NEW email address
await emailQueue.add('auth.email_change_new', {
  user_id,
  new_email,
  user_name,
  confirm_link
});
```

**Email Template Variables (Password Reset):**
- `{{user_name}}`
- `{{reset_time}}`
- `{{ip_address}}`
- `{{device_info}}`
- `{{support_link}}`

**Email Template Variables (Email Change - Old):**
- `{{user_name}}`
- `{{old_email}}`
- `{{new_email}}`
- `{{undo_link}}`
- `{{undo_hours}}` (e.g., "24")

**Email Template Variables (Email Change - New):**
- `{{user_name}}`
- `{{new_email}}`
- `{{confirm_link}}`

**Implementation Steps:**
1. Always send recovery confirmation to **both** old and new email to catch unauthorized access

2. Password reset email includes IP + device info for security audit trail

3. Email change to old address includes undo link in case of compromise

---

### 11. **Profile Incomplete Nudge**

**Trigger Event:** `users.created` + 3-day delay

**When:** New user hasn't filled required profile fields after 3 days

**Backend Hook Location:**
```
server/src/cron/onboarding-incomplete-nudge.ts (runs daily)
```

**Logic:**
```typescript
const incompletePlayers = await User.findAll({
  where: {
    account_type: 'athlete',
    created_at: { [Op.lt]: moment().subtract(3, 'days') },
    // Missing key fields
    [Op.or]: [
      { bio: { [Op.is]: null } },
      { primary_sport: { [Op.is]: null } },
      { jersey_number: { [Op.is]: null } }
    ]
  }
});

for (const user of incompletePlayers) {
  await emailQueue.add('onboarding.profile_incomplete', {
    user_id: user.id,
    user_email: user.email,
    user_name: user.name,
    missing_fields: calculateMissingFields(user),
    profile_edit_link: `${APP_URL}/profile/edit`
  });
}
```

**Email Template Variables:**
- `{{user_name}}`
- `{{missing_fields_list}}` (e.g., "Bio, Jersey Number")
- `{{profile_edit_link}}`
- `{{why_complete}}` (e.g., "Helps recruiters find you")
- `{{estimated_time}}` (e.g., "2 minutes")

**Implementation Steps:**
1. Only send once to avoid spam (add `nudge_sent` flag to users table)

2. Template focuses on benefits (recruit discovery, follower growth)

3. Make profile edit link deep-link directly to incomplete field

4. Optional A/B: Try different messaging (urgency vs. benefit-driven)

---

### 12. **Dormant User Digest**

**Trigger Event:** User hasn't opened app in 14+ days

**When:** Cron job identifies inactive users daily

**Backend Hook Location:**
```
server/src/cron/dormant-user-digest.ts (runs daily)
```

**Logic:**
```typescript
const dormantUsers = await User.findAll({
  include: [{
    association: 'sessions',
    where: { created_at: { [Op.lt]: moment().subtract(14, 'days') } },
    separate: true,
    limit: 1
  }],
  where: {
    account_type: 'athlete',
    // Only athletes - coaches stay engaged
  }
});

for (const user of dormantUsers) {
  const nearbyGames = await Game.findAll({
    where: {
      location: {
        [Op.within]: calcDistance(user.location, 25) // 25 mile radius
      },
      game_date: { [Op.gte]: moment() },
      [Op.limit]: 3
    }
  });

  const topHighlights = await Post.findAll({
    where: {
      visibility: 'public',
      created_at: { [Op.gte]: moment().subtract(14, 'days') }
    },
    order: [['reactions', 'DESC']],
    limit: 5
  });

  await emailQueue.add('onboarding.dormant_user_digest', {
    user_id: user.id,
    user_email: user.email,
    user_name: user.name,
    nearby_games: nearbyGames,
    trending_highlights: topHighlights,
    open_app_link: `varsityhub://home?source=dormant-digest`
  });
}
```

**Email Template Variables:**
- `{{user_name}}`
- `{{days_absent}}` (e.g., "14")
- `{{nearby_games_count}}`
- `{{nearby_games_list}}` (with dates, teams, locations)
- `{{trending_posts}}` (with preview images)
- `{{open_app_link}}`
- `{{explore_link}}`

**Implementation Steps:**
1. Only send once per 14-day dormancy window

2. Surface location-relevant games (what's happening near them)

3. Show trending posts from their sport/region to build FOMO

4. Deep-link directly to home feed to minimize friction

5. Optional: Include coach updates if user follows teams

---

## 🛠️ Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up SendGrid integration (already started in EMAIL_HOOKS_INTEGRATION_SUMMARY.md)
- [ ] Create shared email template engine
- [ ] Implement queue worker (Bull/Redis) for async processing
- [ ] Add logging/monitoring for email delivery

### Phase 2: P0 Emails (Week 2-3)
- [ ] Wire `Reservation Received`
- [ ] Wire `Payment Required / Link Expired` (with delay logic)
- [ ] Wire `Ad Goes Live` (connect to cron)
- [ ] Create all 3 templates

### Phase 3: P1 Emails (Week 3-4)
- [ ] Wire `Roster Threshold Alert`
- [ ] Wire `New Staff Added` (dual emails)
- [ ] Wire `Report Resolution` (conditional logic)
- [ ] Create all templates + test flows

### Phase 4: P2 Emails (Week 4-6)
- [ ] Wire remaining 6 emails
- [ ] Build all templates
- [ ] Add admin UI for testing/replay
- [ ] Analytics dashboard

---

## 📧 SendGrid Template Structure

Each email will follow this pattern:

```
server/src/email/templates/
├── shared/
│   ├── header.mjml (logo, brand color)
│   ├── footer.mjml (unsubscribe, social links)
│   └── button.mjml (reusable CTA button)
├── ads/
│   ├── reservation-received.mjml
│   ├── payment-required.mjml
│   └── goes-live.mjml
├── teams/
│   ├── roster-threshold-alert.mjml
│   ├── staff-invited.mjml
│   └── staff-invitation-sent.mjml
├── reports/
│   └── resolution.mjml
├── content/
│   ├── season-wrap-up.mjml
│   ├── post-highlight.mjml
│   └── fan-follows-athlete.mjml
├── onboarding/
│   ├── profile-incomplete.mjml
│   └── dormant-user-digest.mjml
└── auth/
    ├── password-reset-complete.mjml
    ├── email-change-old.mjml
    └── email-change-new.mjml
```

---

## 🔍 Monitoring & Metrics

Track these per-email KPIs:

| Email | Key Metric | Success Target |
|-------|-----------|-----------------|
| Reservation Received | Checkout completion rate | > 80% within 24h |
| Payment Required | Retry conversion | > 15% |
| Ad Goes Live | CTR (click to analytics) | > 25% |
| Roster Threshold | Read rate | > 60% |
| New Staff Added | Invite acceptance | > 85% |
| Report Resolution | Support ticket reduction | -20% related tickets |
| Season Wrap-Up | Signup for next season | > 40% |
| Post Highlight | External shares | > 5% |
| Fan Follows | DM engagement | > 30% |
| Account Recovery | Fraudulent access reports | 0 (ideal) |
| Profile Incomplete | Profile completion | > 40% within 48h |
| Dormant Digest | App reopen | > 25% within 7 days |

---

## 🚀 Next Steps

1. **Decide P0 order:** Start with `Reservation Received` (immediate revenue impact)
2. **Create SendGrid account templates** for all 3 P0 emails
3. **Build email queue worker** with retry logic
4. **Add tracking pixels** for open/click rates
5. **Wire first trigger** and test end-to-end with staging account

Which email would you like to wire up first?
