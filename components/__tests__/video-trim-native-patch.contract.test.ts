import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const iosTrimSource = readFileSync(
  join(process.cwd(), 'node_modules', 'react-native-video-trim', 'ios', 'VideoTrim.swift'),
  'utf8'
);
const androidTrimSource = readFileSync(
  join(
    process.cwd(),
    'node_modules',
    'react-native-video-trim',
    'android',
    'src',
    'main',
    'java',
    'com',
    'videotrim',
    'BaseVideoTrimModule.kt'
  ),
  'utf8'
);
const androidTrimUtilSource = readFileSync(
  join(
    process.cwd(),
    'node_modules',
    'react-native-video-trim',
    'android',
    'src',
    'main',
    'java',
    'com',
    'videotrim',
    'utils',
    'VideoTrimmerUtil.java'
  ),
  'utf8'
);
const androidStorageSource = readFileSync(
  join(
    process.cwd(),
    'node_modules',
    'react-native-video-trim',
    'android',
    'src',
    'main',
    'java',
    'com',
    'videotrim',
    'utils',
    'StorageUtil.java'
  ),
  'utf8'
);

// react-native-video-trim@6.0.13 adopted these ffmpeg corrections upstream
// (unique ms-timestamp output names, `-y` overwrite, `-t` duration instead of
// `-to`), so the old install-time patch (scripts/patch-video-trim.js) is gone.
// These tests now guard the real invariant: the INSTALLED native source emits
// correct ffmpeg commands — whether from upstream or a future patch. If a
// version bump ever regresses these, the suite fails loudly and we re-pin/patch.
describe('video trim native source contract', () => {
  it('iOS trim commands overwrite and clip by duration', () => {
    expect(iosTrimSource).toContain('let timestamp = Int(Date().timeIntervalSince1970 * 1000)');
    expect(iosTrimSource).toContain(
      'let durationMs = max(1, ((endTime - startTime) * 1000).rounded())'
    );
    expect(iosTrimSource).toContain('let durationMs = max(1, endTime - startTime)');
    expect(iosTrimSource).toContain('"-y"');
    expect(iosTrimSource).toContain('"-t"');
    expect(iosTrimSource).not.toContain('"-to"');
  });

  it('Android trim commands and output naming clip by duration the same way', () => {
    expect(androidTrimSource).toContain('val durationMs = maxOf(1.0, endTime - startTime)');
    expect(androidTrimSource).toContain('"-y"');
    expect(androidTrimSource).toContain('"-t"');
    expect(androidTrimSource).not.toContain('"-to"');

    expect(androidTrimUtilSource).toContain('long durationMs = Math.max(1L, endMs - startMs);');
    expect(androidTrimUtilSource).toContain('cmds.add("-y");');
    expect(androidTrimUtilSource).toContain('cmds.add("-t");');
    expect(androidTrimUtilSource).not.toContain('cmds.add("-to");');

    expect(androidStorageSource).toContain('System.currentTimeMillis();');
    expect(androidStorageSource).not.toContain('System.currentTimeMillis() / 1000');
  });
});
