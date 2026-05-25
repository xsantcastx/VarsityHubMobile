import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const contactScreen = readFileSync(join(ROOT, 'app/settings/contact.tsx'), 'utf8');
const requestHostEventScreen = readFileSync(
  join(ROOT, 'app/settings/request-host-event.tsx'),
  'utf8'
);

describe('settings profile prefill contracts', () => {
  it('contact form prefills from auth state instead of a separate profile hook', () => {
    expect(contactScreen).toContain("const { user } = useAuth();");
    expect(contactScreen).toContain("const displayName = user?.display_name || '';");
    expect(contactScreen).toContain("const profileEmail = user?.email || '';");
    expect(contactScreen).not.toContain('useUserProfile(');
  });

  it('host-event request prefills from auth state instead of a separate profile hook', () => {
    expect(requestHostEventScreen).toContain("const { user } = useAuth();");
    expect(requestHostEventScreen).toContain("const displayName = user?.display_name || '';");
    expect(requestHostEventScreen).toContain("const profileEmail = user?.email || '';");
    expect(requestHostEventScreen).not.toContain('useUserProfile(');
  });
});
