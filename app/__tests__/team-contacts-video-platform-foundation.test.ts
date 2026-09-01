import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'app', '(tabs)', 'team-contacts.tsx'), 'utf8');

describe('team contacts video platform foundation', () => {
  it('keeps web on the send flow without mounting the native trimmer', () => {
    expect(source).toContain('const canTrimVideo = isNativeVideoTrimSupported(Platform.OS);');
    expect(source).toContain('Web uploads the selected video as-is.');
  });

  it('uses expo-audio directly instead of the retired expo-av-style stub', () => {
    expect(source).toContain("} from 'expo-audio';");
    expect(source).toContain('requestRecordingPermissionsAsync()');
    expect(source).toContain('new AudioModule.AudioRecorder');
    expect(source).toContain('createAudioPlayer');
    expect(source).not.toContain('Temporary Audio stub');
    expect(source).not.toContain('Voice recording temporarily disabled');
  });
});
