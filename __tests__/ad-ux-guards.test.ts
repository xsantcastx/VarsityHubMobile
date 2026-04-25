import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const adCalendar = read('app/ad-calendar.tsx');
const myAds = read('app/my-ads.tsx');
const submitAd = read('app/submit-ad.tsx');
const submitAdWeb = read('app/submit-ad.web.tsx');
const leaguePendingApproval = read('app/onboarding/league-pending-approval.tsx');

describe('ad and coach UX guards', () => {
  describe('alternative zip recovery', () => {
    it('ad-calendar routes nearby-zip recovery through submit-ad with the chosen zip', () => {
      expect(adCalendar).toMatch(/router\.replace\(`\/submit-ad\?zip=\$\{alt\.zip\}`\)/);
    });

    it('native submit-ad hydrates zip from route params', () => {
      expect(submitAd).toMatch(/useLocalSearchParams/);
      expect(submitAd).toMatch(/const params = useLocalSearchParams<\{ zip\?: string \}>/);
      expect(submitAd).toMatch(/setZip\(nextZip\.trim\(\)\)/);
    });

    it('web submit-ad hydrates zip from route params', () => {
      expect(submitAdWeb).toMatch(/useLocalSearchParams/);
      expect(submitAdWeb).toMatch(/const params = useLocalSearchParams<\{ zip\?: string \}>/);
      expect(submitAdWeb).toMatch(/setZip\(nextZip\.trim\(\)\)/);
    });
  });

  describe('non-runnable ad states', () => {
    it('my-ads sends rejected or archived ads to edit flow instead of scheduling flow', () => {
      expect(myAds).toMatch(/requiresEditBeforeScheduling = item\.status === 'rejected' \|\| item\.status === 'archived'/);
      expect(myAds).toMatch(/router\.push\(\{ pathname: '\/edit-ad', params: \{ id: item\.id \} \}\)/);
    });

    it('ad-calendar blocks rejected and archived ads from date selection', () => {
      expect(adCalendar).toMatch(/if \(adStatus === 'rejected'\)/);
      expect(adCalendar).toMatch(/if \(adStatus === 'archived'\)/);
      expect(adCalendar).toMatch(/Edit Required/);
      expect(adCalendar).toMatch(/Campaign Ended/);
    });

    it('ad-calendar exposes an edit CTA for rejected or archived ads', () => {
      expect(adCalendar).toMatch(/isRejected \|\| isArchived/);
      expect(adCalendar).toMatch(/Edit Ad to Resubmit/);
      expect(adCalendar).toMatch(/Edit Ad to Run Again/);
      expect(adCalendar).toMatch(/pathname: '\/edit-ad'/);
    });
  });

  describe('league rejection recovery', () => {
    it('league pending approval screen offers a real retry or setup path on rejection', () => {
      expect(leaguePendingApproval).toMatch(/isApplicationFlow \? 'Try Again' : 'Back to Organization Setup'/);
      expect(leaguePendingApproval).toMatch(/await User\.reapplyCoach\(\)/);
      expect(leaguePendingApproval).toMatch(/router\.replace\('\/onboarding\/coach-application'/);
    });
  });
});
