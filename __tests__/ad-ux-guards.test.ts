import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
// Collapse runs of whitespace so these assertions survive prettier reflow —
// JSX copy and long ternaries get re-wrapped on format without any behavior
// change. Without this, `npm run format` alone can turn CI red.
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

const adCalendar = read('app/ad-calendar.tsx');
const myAds = read('app/my-ads.tsx');
const submitAd = read('app/submit-ad.tsx');
const submitAdRoute = read('components/SubmitAdRouteScreen.tsx');
const submitAdWeb = read('app/submit-ad.web.tsx');
const leaguePendingApproval = read('app/onboarding/league-pending-approval.tsx');

describe('ad and coach UX guards', () => {
  describe('alternative zip recovery', () => {
    it('ad-calendar routes nearby-zip recovery through submit-ad with the chosen zip', () => {
      expect(adCalendar).toMatch(/router\.replace\(`\/submit-ad\?zip=\$\{alt\.zip\}`\)/);
    });

    it('native and web submit-ad routes share the param-hydrating screen', () => {
      // Both platform routes are thin wrappers; zip hydration lives once in
      // SubmitAdRouteScreen.
      expect(submitAd).toContain('SubmitAdRouteScreen');
      expect(submitAdWeb).toContain('SubmitAdRouteScreen');
      expect(submitAdRoute).toMatch(/const params = useLocalSearchParams<\{ zip\?: string \}>/);
      expect(submitAdRoute).toMatch(/setZip\(nextZip\.trim\(\)\)/);
    });
  });

  describe('non-runnable ad states', () => {
    it('my-ads sends rejected ads to edit flow instead of scheduling flow', () => {
      // A rejected ad comes back as status:'draft' WITH an admin_note — the
      // server deliberately never emits status:'rejected' for ads (pinned
      // server-side by ad-state-invariants.test.ts, "no ad approval path uses
      // status=rejected"). So `item.status === 'rejected'` would be dead code:
      // rejection MUST be derived from the (draft + admin_note) pair.
      expect(myAds).toMatch(
        /const rejectionReason\s*=\s*item\.status === 'draft' && item\.admin_note/
      );
      expect(myAds).toMatch(/const isRejected = rejectionReason\.length > 0/);
      expect(myAds).toMatch(/const requiresEditBeforeScheduling = isRejected/);
      expect(myAds).not.toMatch(/requiresEditBeforeScheduling = item\.status === 'rejected'/);
      expect(myAds).toMatch(
        /router\.push\(\{ pathname: '\/edit-ad', params: \{ id: item\.id \} \}\)/
      );
    });

    it('my-ads lets archived ads be booked again without forcing edit flow', () => {
      expect(myAds).toMatch(/\? 'Run Again'/);
      // requiresEditBeforeScheduling tracks rejection ONLY — an archived ad has
      // already-approved creative and must reach scheduling without a re-edit.
      expect(myAds).toMatch(/const requiresEditBeforeScheduling = isRejected;/);
      expect(myAds).not.toMatch(/requiresEditBeforeScheduling =[^;]*'archived'/);
    });

    it('ad-calendar only preselects still-bookable approved dates and blocks stale past dates before checkout', () => {
      expect(adCalendar).toMatch(/function getCurrentBookableDates\(datesISO: Iterable<string>\)/);
      expect(adCalendar).toMatch(/const bookableDates = getCurrentBookableDates\(dates\)/);
      expect(adCalendar).toMatch(/const invalidDates = getDatesOutsideBookingWindow\(selected\)/);
      expect(adCalendar).toMatch(
        /Alert\.alert\('Date Unavailable', 'Ad dates must be today or in the future\.'\)/
      );
    });

    it('ad-calendar blocks rejected ads from date selection', () => {
      expect(adCalendar).toMatch(/if \(adStatus === 'rejected'\)/);
      expect(adCalendar).toMatch(/Edit Required/);
    });

    it('ad-calendar exposes an edit CTA for rejected ads only', () => {
      expect(adCalendar).toMatch(/isRejected &&/);
      expect(adCalendar).toMatch(/Edit Ad to Resubmit/);
      expect(adCalendar).toMatch(/pathname: '\/edit-ad'/);
    });

    it('ad-calendar treats archived ads as reusable approved media', () => {
      expect(adCalendar).toMatch(/const canPay = isApproved \|\| isActive \|\| isArchived/);
      expect(adCalendar).toMatch(/Approved Media Ready to Run Again/);
      expect(adCalendar).toMatch(/Select new dates above to book it again/);
    });
  });

  describe('league rejection recovery', () => {
    it('league pending approval screen offers a real retry or setup path on rejection', () => {
      expect(leaguePendingApproval).toMatch(
        /isApplicationFlow \? 'Try Again' : 'Back to Organization Setup'/
      );
      expect(leaguePendingApproval).toMatch(/void reapplyCoachApplication\(\{/);
      expect(leaguePendingApproval).toMatch(/router\.replace\('\/onboarding\/coach-application'/);
    });
  });
});
