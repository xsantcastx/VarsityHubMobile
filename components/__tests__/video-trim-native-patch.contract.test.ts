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

// These ffmpeg corrections (unique ms-timestamp output names, `-y` overwrite,
// `-t` duration instead of input-side `-to`) are NOT upstream — pristine
// 6.0.13 (and even 8.1.9) still uses `-to` before `-i` and second-resolution
// names (verified against the npm tarballs 2026-07-15; an earlier note here
// wrongly claimed 6.0.13 shipped them, having checked a hand-edited
// node_modules). They are applied by patches/react-native-video-trim+*.patch
// via patch-package in postinstall (scripts/apply-patches.js, warn-and-skip on
// drift so a failed apply can never brick `npm ci`/EAS builds). This suite is
// the hard gate: the INSTALLED native source must emit correct ffmpeg
// commands. If it fails, the patch didn't apply — re-generate it against the
// installed version.
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
