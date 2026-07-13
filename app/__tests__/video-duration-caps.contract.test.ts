/**
 * Contract test: video duration caps (2026-07-13 product decision).
 *
 * Highlights-first rule: feed posts cap at 90s, game stories at 20s, team-chat
 * clips at 90s. Over-limit picks are force-trimmed, never rejected — each
 * surface passes its cap to VideoTrimmer (which clamps the selectable window)
 * and gates submit until a trim is applied.
 *
 * Checked as file content (same pattern as video-upload-limits.contract) so a
 * surface can't silently drop its cap or gate.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

describe('video duration caps', () => {
  it('constants/video.ts declares the agreed caps: posts 90s, stories 20s, chat 90s', () => {
    const src = read('constants', 'video.ts');
    expect(src).toMatch(/POST_MAX_DURATION_S\s*=\s*90/);
    expect(src).toMatch(/STORY_MAX_DURATION_S\s*=\s*20/);
    expect(src).toMatch(/CHAT_VIDEO_MAX_DURATION_S\s*=\s*90/);
  });

  it('VideoTrimmer supports maxDurationS and clamps the selection window to it', () => {
    const src = read('components', 'VideoTrimmer.tsx');
    expect(src).toMatch(/maxDurationS\?:\s*number/);
    // The cap expressed as handle distance, applied in both pan gestures.
    expect(src).toMatch(/maxGapPx/);
    expect(src).toMatch(/rightX\.value - maxGapPx/);
    expect(src).toMatch(/leftX\.value \+ maxGapPx/);
  });

  it('create-post passes the post cap to the trimmer and gates submit on it', () => {
    const src = read('app', '(tabs)', 'create-post.tsx');
    expect(src).toMatch(/maxDurationS=\{POST_MAX_DURATION_S\}/);
    expect(src).toMatch(/durationS > POST_MAX_DURATION_S/);
    // Camera recording stops at the cap.
    expect(src).toMatch(/videoMaxDuration: POST_MAX_DURATION_S/);
  });

  it('game stories pass the story cap to the trimmer and gate upload on it', () => {
    const src = read('app', 'game-details', 'GameDetailsScreen.tsx');
    expect(src).toMatch(/maxDurationS=\{STORY_MAX_DURATION_S\}/);
    expect(src).toMatch(/durationS > STORY_MAX_DURATION_S/);
    expect(src).toMatch(/videoMaxDuration: STORY_MAX_DURATION_S/);
  });

  it('team chat passes the chat cap to the trimmer and gates send on it', () => {
    const src = read('app', '(tabs)', 'team-contacts.tsx');
    expect(src).toMatch(/maxDurationS=\{CHAT_VIDEO_MAX_DURATION_S\}/);
    expect(src).toMatch(/durationS > CHAT_VIDEO_MAX_DURATION_S/);
  });

  it('every gate skips enforcement once a trimmed uri exists (trim output is capped by construction)', () => {
    // Each surface's condition must be "no trimmed uri AND over cap" — a
    // trimmed clip is already within the window the trimmer allowed.
    expect(read('app', '(tabs)', 'create-post.tsx')).toMatch(/!trimmedUri &&/);
    expect(read('app', 'game-details', 'GameDetailsScreen.tsx')).toMatch(/!storyTrimmedUri &&/);
    expect(read('app', '(tabs)', 'team-contacts.tsx')).toMatch(/!videoTrimmedUri &&/);
  });
});
