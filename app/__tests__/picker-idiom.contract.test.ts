/**
 * expo-image-picker's MediaTypeOptions enum is deprecated. All picker
 * mediaTypes must go through utils/picker.ts helpers so the next SDK
 * migration is a one-file change instead of a 12-file hunt.
 */
import { execSync } from 'node:child_process';

describe('picker idiom', () => {
  it('MediaTypeOptions appears nowhere outside utils/picker.ts', () => {
    let out = '';
    try {
      out = execSync(
        `grep -rn "MediaTypeOptions" app components --include="*.tsx" --include="*.ts" | grep -v "__tests__"`,
        { encoding: 'utf8', cwd: process.cwd() }
      );
    } catch {
      out = ''; // grep exits 1 on no matches — that is the passing case
    }
    expect(out.trim()).toBe('');
  });
});
