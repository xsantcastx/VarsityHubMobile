import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const adCalendar = read('app/ad-calendar.tsx');
const myAds = read('app/my-ads.tsx');
const editAd = read('app/edit-ad.tsx');
const editAdWeb = read('app/edit-ad.web.tsx');
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
    it('submit-ad copy explains approval happens before scheduling', () => {
      expect(submitAd).toMatch(/review first, then you choose dates after approval/);
      expect(submitAdWeb).toMatch(/review first, then you choose dates after approval/);
    });

    it('all ad create and edit flows normalize and validate target links consistently', () => {
      expect(submitAd).toMatch(/normalizeAdTargetUrl/);
      expect(submitAdWeb).toMatch(/normalizeAdTargetUrl/);
      expect(editAd).toMatch(/normalizeAdTargetUrl/);
      expect(editAdWeb).toMatch(/normalizeAdTargetUrl/);
      expect(submitAd).toMatch(/isValidAdTargetUrl/);
      expect(submitAdWeb).toMatch(/isValidAdTargetUrl/);
      expect(editAd).toMatch(/isValidAdTargetUrl/);
      expect(editAdWeb).toMatch(/isValidAdTargetUrl/);
    });

    it('my-ads sends rejected or archived ads to edit flow instead of scheduling flow', () => {
      expect(myAds).toMatch(/requiresEditBeforeScheduling = item\.status === 'rejected' \|\| item\.status === 'archived'/);
      expect(myAds).toMatch(/router\.push\(\{ pathname: '\/edit-ad', params: \{ id: item\.id \} \}\)/);
    });

    it('my-ads labels draft ads as a review step instead of a scheduling step', () => {
      expect(myAds).toMatch(/item\.status === 'draft'/);
      expect(myAds).toMatch(/'Submit for Review'/);
    });

    it('ad-calendar blocks pre-approved and non-runnable ads from date selection', () => {
      expect(adCalendar).toMatch(/if \(adStatus == null \|\| adStatus === 'draft'\)/);
      expect(adCalendar).toMatch(/if \(adStatus === 'pending'\)/);
      expect(adCalendar).toMatch(/if \(adStatus === 'rejected'\)/);
      expect(adCalendar).toMatch(/if \(adStatus === 'archived'\)/);
      expect(adCalendar).toMatch(/Approval Required/);
      expect(adCalendar).toMatch(/Review In Progress/);
      expect(adCalendar).toMatch(/Edit Required/);
      expect(adCalendar).toMatch(/Campaign Ended/);
    });

    it('ad-calendar exposes an edit CTA for rejected or archived ads', () => {
      expect(adCalendar).toMatch(/isRejected \|\| isArchived/);
      expect(adCalendar).toMatch(/Edit Ad to Resubmit/);
      expect(adCalendar).toMatch(/Edit Ad to Run Again/);
      expect(adCalendar).toMatch(/pathname: '\/edit-ad'/);
    });

    it('ad-calendar submits drafts for review without requiring date selection', () => {
      expect(adCalendar).toMatch(/const submitForApprovalDisabled = submitting;/);
      expect(adCalendar).toMatch(/await Advertisement\.submitForApproval\(String\(adId\)\);/);
      expect(adCalendar).toMatch(/No charge and no date selection until your ad is approved/);
    });

    it('edit-ad surfaces rejection feedback for rejected ads on native and web', () => {
      expect(editAd).toMatch(/const \[reviewNote, setReviewNote\] = useState<string \| null>\(null\);/);
      expect(editAdWeb).toMatch(/const \[reviewNote, setReviewNote\] = useState<string \| null>\(null\);/);
      expect(editAd).toMatch(/ad\?\.admin_note/);
      expect(editAdWeb).toMatch(/ad\?\.admin_note/);
      expect(editAd).toMatch(/status === 'rejected' && reviewNote/);
      expect(editAdWeb).toMatch(/status === 'rejected' && reviewNote/);
      expect(editAd).toMatch(/Review Feedback/);
      expect(editAdWeb).toMatch(/Review Feedback/);
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
