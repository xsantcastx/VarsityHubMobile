import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'app', '(tabs)', 'team-contacts.tsx'), 'utf8');

describe('team contacts video platform foundation', () => {
  it('keeps web on the send flow without mounting the native trimmer', () => {
    expect(source).toContain('const canTrimVideo = isNativeVideoTrimSupported(Platform.OS);');
    expect(source).toContain('Web uploads the selected video as-is.');
  });
});
