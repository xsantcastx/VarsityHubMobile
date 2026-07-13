import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const requireOnboardedSrc = readFileSync(
  join(process.cwd(), 'src', 'middleware', 'requireOnboarded.ts'),
  'utf8'
);

const uploadsRouteSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'uploads.ts'), 'utf8');

describe('uploads architecture — requireOnboarded is not an upload gate', () => {
  it('does not apply requireOnboarded to any upload route', () => {
    // Uploads are a verified utility (requireAuth + requireVerified), not onboarded content.
    // If this fails, someone re-introduced requireOnboarded on uploads — which dead-ends
    // mid-onboarding users on the supporting-document/avatar/header flows.
    expect(uploadsRouteSrc).not.toMatch(/requireOnboarded/);
  });

  it('does not ship an upload-specific bypass block in requireOnboarded', () => {
    // The historical bypass (organization_supporting_document / onboarding_avatar /
    // onboarding_header_image) only existed because requireOnboarded used to sit on
    // upload routes. Now that it doesn't, the bypass would be dead code — and a
    // signal of architectural drift if it reappears.
    expect(requireOnboardedSrc).not.toMatch(/isOnboardingSupportDocUpload/);
    expect(requireOnboardedSrc).not.toMatch(/onboardingUploadContexts/);
    expect(requireOnboardedSrc).not.toMatch(/organization_supporting_document/);
    expect(requireOnboardedSrc).not.toMatch(/onboarding_avatar/);
    expect(requireOnboardedSrc).not.toMatch(/onboarding_header_image/);
  });
});
