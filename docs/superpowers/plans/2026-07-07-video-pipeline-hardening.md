# Video Pipeline Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make video capture → trim → compress → upload work reliably on every surface, make every failure observable in production, and make the release process unable to silently break the native/JS seam again.

**Architecture:** The app already has ONE video pipeline (verified — no duplication): `expo-image-picker` capture → `components/VideoTrimmer.tsx` (native `react-native-video-trim`) → `utils/compressVideo.ts` (native `react-native-compressor`) → `api/upload.ts` direct-to-Cloudinary signed upload (signature from `GET /uploads/cloudinary-signature`; videos have NO server-proxy fallback by design — server returns 415). This plan does not restructure that pipeline; it closes the gaps a forensic audit found: zero client telemetry, silent compression failure, missing size gates on 2 of 3 video surfaces, rate-limit UX, timeout math, trim-mismatch dishonesty, OTA-from-dirty-tree publishing, and cleanup of an orphaned capture component and split picker idioms.

**Tech Stack:** React Native / Expo SDK 54, expo-image-picker, react-native-video-trim@^6.0.13 (upstream now ships the ffmpeg fixes — the old install-time patch was deleted), react-native-compressor, Cloudinary signed direct upload, Sentry via `@/utils/sentry` (`captureException`), Jest source-string contract tests (this repo's standard idiom).

## Global Constraints

- **Never run `eas build` or `eas submit`** — provide commands for the user to run (CLAUDE.md hard rule).
- **Railway auto-deploys from `main`** — server changes are live on merge.
- **A client fix is NOT live until `eas update --branch production` runs** (and for native changes, until a new binary ships).
- **The working tree contains unrelated legal-pages WIP (~60 files).** Every commit must stage ONLY the files named in its task — never `git add -A` / `git add .`.
- Text colors must use theme constants — never hardcode `#000`/`#111827`/etc. (not expected in these tasks, but the pre-commit hook enforces it).
- Client tests: `npx jest <path>` from repo root. Server tests: `cd server && npm test -- --testPathPattern="<pattern>"` (bare `npx jest` on the full server suite breaks on ESM).
- TypeScript gates after each phase: `npx tsc --noEmit` and `npx tsc --noEmit --project server/tsconfig.json` — 0 new errors.
- All Sentry reporting on the client goes through `captureException` from `@/utils/sentry` with a `tags: { context, stage, ... }` shape (see `components/VideoTrimmer.tsx:74-87` for the reference pattern).
- Constants come from `constants/video.ts`: `VIDEO_CAPTURE_PRESET`, `STORY_MAX_DURATION_S = 30`, `MAX_VIDEO_SIZE_MB = 150`, `MAX_VIDEO_SIZE_BYTES`, `VIDEO_COMPRESSION_THRESHOLD_BYTES`.

## Phase 0 — Ship what is already fixed (operational; user runs these, no code)

These are prerequisites. The code fixes for the two active outages already exist; they just haven't reached users.

1. **Merge [PR #131](https://github.com/xsantcastx/VarsityHubMobile/pull/131)** (server-only: stop signing `max_bytes`). Railway auto-deploys → video uploads work again for every user, no app update needed.
   - `gh pr checks 131` then `gh pr merge 131 --squash --delete-branch`
   - Verify: Railway logs show `[uploads] Cloudinary signature issued`, and an in-app video upload succeeds.
2. **Ship a binary containing the July 6 native modules** (react-native-compressor reinstall + react-native-video-trim behavior). The build pipeline is unblocked (obsolete `patch-video-trim.js` deleted in `f6d7fcc6`). From the repo **root** (never `server/` — a stray `server/eas.json` let a build run from the wrong directory once already):
   - `eas build --platform ios --profile production` then `eas submit --platform ios --latest`
   - Until this binary is live, trim shows "outdated native module" on old binaries — uploads still work without trimming.
3. **Do not publish another OTA from a dirty tree** (Task 10 makes this impossible via the npm script).

---

### Task 1: Sentry telemetry in the client upload path

The entire `api/upload.ts` module has zero Sentry coverage. Since video never touches our server, production video-upload failures are currently invisible (console is stripped in prod). This was why the `max_bytes` 401 outage went undiagnosed.

**Files:**

- Modify: `api/upload.ts` (imports at top; the two video hard-fail blocks at ~`:582-600` in `uploadFile` and ~`:667-685` in `uploadFileWithProgress`)
- Test: `app/__tests__/upload-telemetry.contract.test.ts` (create)

**Interfaces:**

- Consumes: `captureException(error: Error, ctx?: { tags?: Record<string, string> })` from `@/utils/sentry`.
- Produces: nothing new for later tasks; the contract test bans regression.

- [ ] **Step 1: Write the failing contract test**

```ts
// app/__tests__/upload-telemetry.contract.test.ts
/**
 * Production video uploads go phone → Cloudinary directly, so the server never
 * sees the failure and client console logs are stripped. Without Sentry in
 * api/upload.ts, video-upload outages are invisible (this is how the max_bytes
 * "Invalid Signature" 401 outage went undiagnosed). These assertions pin the
 * telemetry in place.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const uploadSrc = readFileSync(join(process.cwd(), 'api', 'upload.ts'), 'utf8');

describe('client upload telemetry contract', () => {
  it('api/upload.ts imports captureException from the shared sentry util', () => {
    expect(uploadSrc).toMatch(/import \{ captureException \} from '@\/utils\/sentry'/);
  });

  it('video direct-upload hard failures are reported with context tags', () => {
    // One capture per hard-fail site (uploadFile + uploadFileWithProgress).
    const captures = uploadSrc.match(/captureException\(/g) || [];
    expect(captures.length).toBeGreaterThanOrEqual(2);
    expect(uploadSrc).toContain("context: 'video_upload'");
    expect(uploadSrc).toContain("stage: 'direct_upload_failed'");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/__tests__/upload-telemetry.contract.test.ts`
Expected: FAIL — `captureException` import not found.

- [ ] **Step 3: Add the import and the two capture calls**

At the top of `api/upload.ts`, with the other `@/` imports:

```ts
import { captureException } from '@/utils/sentry';
```

In `uploadFile`, the video hard-fail block currently reads (~`:588`):

```ts
const videoUploadErr: any = new Error(
  directErr?.message || 'Video upload failed. Please check your connection and try again.'
);
videoUploadErr.code = 'VIDEO_DIRECT_UPLOAD_FAILED';
videoUploadErr.cause = directErr;
throw videoUploadErr;
```

Insert the capture immediately before the `throw`:

```ts
const videoUploadErr: any = new Error(
  directErr?.message || 'Video upload failed. Please check your connection and try again.'
);
videoUploadErr.code = 'VIDEO_DIRECT_UPLOAD_FAILED';
videoUploadErr.cause = directErr;
// Video has no server fallback, so this is the ONLY place the failure can
// be observed in production. Tag with the underlying message so signature
// vs network vs timeout failures are distinguishable in Sentry.
captureException(directErr instanceof Error ? directErr : videoUploadErr, {
  tags: {
    context: 'video_upload',
    stage: 'direct_upload_failed',
    code: String(directErr?.code || 'unknown'),
  },
});
throw videoUploadErr;
```

Apply the identical insertion in the matching block inside `uploadFileWithProgress` (~`:674`).

- [ ] **Step 4: Run test + typecheck**

Run: `npx jest app/__tests__/upload-telemetry.contract.test.ts` → PASS
Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors

- [ ] **Step 5: Commit**

```bash
git add api/upload.ts app/__tests__/upload-telemetry.contract.test.ts
git commit -m "feat(uploads): report video direct-upload failures to Sentry"
```

---

### Task 2: Fix compressVideoSafe silent failure + post-compression size enforcement

`utils/compressVideo.ts:25-28` has a fully empty `catch {}` — "native module missing" and "compression crashed" are indistinguishable and invisible (this hid a 3-month compression outage after the module was removed on 2026-03-28). And `prepareVideoForUpload` never re-checks size after compression: a file that compresses _larger_, or is still over 150MB, uploads anyway. The 150MB gate elsewhere runs pre-compression on the original.

**Files:**

- Modify: `utils/compressVideo.ts`
- Test: `utils/__tests__/compressVideo.test.ts` (extend existing suite)

**Interfaces:**

- Consumes: `captureException` from `@/utils/sentry`; `MAX_VIDEO_SIZE_BYTES`, `MAX_VIDEO_SIZE_MB` from `@/constants/video`.
- Produces: `prepareVideoForUpload(uri, options?) → Promise<{ uri, originalSizeBytes, finalSizeBytes, wasCompressed }>` — same signature as today, PLUS it now throws `Error & { code: 'VIDEO_TOO_LARGE' }` when the final asset exceeds `MAX_VIDEO_SIZE_BYTES`. Callers (Task 3/4 surfaces, and existing create-post/GameDetails) surface that via `showUploadErrorAlert` — the message contains "too large" so the existing `isSize` branch in `utils/uploadErrorAlert.ts` matches it.

- [ ] **Step 1: Write the failing tests**

Append to `utils/__tests__/compressVideo.test.ts` (follow the existing suite's mocking style for `expo-file-system/legacy` and `react-native-compressor` — read the file first; it already mocks both):

```ts
describe('compression hardening', () => {
  it('keeps the ORIGINAL uri when compression produces a larger file', async () => {
    // Arrange mocks: original size 20MB, compressed size 25MB
    // (use the suite's existing getInfoAsync mock, keyed by uri)
    const result = await prepareVideoForUpload('file:///video.mp4');
    expect(result.uri).toBe('file:///video.mp4');
    expect(result.wasCompressed).toBe(false);
  });

  it('throws VIDEO_TOO_LARGE when the final asset exceeds MAX_VIDEO_SIZE_BYTES', async () => {
    // Arrange mocks: original 200MB, compressed 180MB — both over the 150MB cap
    await expect(prepareVideoForUpload('file:///huge.mp4')).rejects.toMatchObject({
      code: 'VIDEO_TOO_LARGE',
    });
  });

  it('module-missing fallback reports to Sentry exactly once', async () => {
    // Arrange: make require('react-native-compressor') throw via the suite's mock,
    // spy on captureException from @/utils/sentry
    await compressVideoSafe('file:///a.mp4');
    await compressVideoSafe('file:///b.mp4');
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
    expect(captureExceptionSpy.mock.calls[0][1].tags.stage).toBe('module_missing');
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest utils/__tests__/compressVideo.test.ts`
Expected: existing tests PASS, the three new tests FAIL.

- [ ] **Step 3: Rewrite `utils/compressVideo.ts`**

Replace `compressVideoSafe` and `prepareVideoForUpload` with:

```ts
import * as FileSystem from 'expo-file-system/legacy';

import {
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEO_SIZE_MB,
  VIDEO_COMPRESSION_THRESHOLD_BYTES,
  VIDEO_COMPRESSION_THRESHOLD_MB,
} from '@/constants/video';
import { captureException } from '@/utils/sentry';

// Module-level dynamic require (OfflineBanner pattern): resolves at bundle
// time, never crashes binaries that predate the native module.
let CompressorVideo: { compress: (uri: string, opts: object) => Promise<string> } | null = null;
try {
  CompressorVideo = require('react-native-compressor').Video;
} catch {
  CompressorVideo = null;
}

// Report the missing module once per session, not per call — old binaries
// would otherwise spam Sentry on every upload.
let reportedModuleMissing = false;

export async function compressVideoSafe(uri: string): Promise<string> {
  if (!CompressorVideo) {
    if (!reportedModuleMissing) {
      reportedModuleMissing = true;
      captureException(new Error('react-native-compressor native module unavailable'), {
        tags: { context: 'video_compress', stage: 'module_missing' },
      });
    }
    return uri;
  }
  try {
    const compressed: string = await CompressorVideo.compress(uri, {
      compressionMethod: 'auto', // picks the best available codec
      minimumFileSizeForCompress: 1, // compress any video (value is in MB)
    });
    return compressed ?? uri;
  } catch (e) {
    // Compression failed mid-way — fall back to the original, but make the
    // failure visible (an empty catch here hid a 3-month compression outage).
    captureException(e instanceof Error ? e : new Error(String(e)), {
      tags: { context: 'video_compress', stage: 'compress_failed' },
    });
    return uri;
  }
}
```

Keep `getVideoFileSize` unchanged. Replace the tail of `prepareVideoForUpload` (after the early small-file return) with:

```ts
const compressedUri = await compressVideoSafe(uri);
let finalUri = compressedUri;
let finalSizeBytes =
  compressedUri !== uri ? await getVideoFileSize(compressedUri) : originalSizeBytes;

// Re-encoding already-compressed input can produce a LARGER file. Never
// upload a worse asset than the one we started with.
if (
  compressedUri !== uri &&
  originalSizeBytes > 0 &&
  finalSizeBytes > 0 &&
  finalSizeBytes >= originalSizeBytes
) {
  finalUri = uri;
  finalSizeBytes = originalSizeBytes;
}

// The pick-time 150MB gate ran on the ORIGINAL file. Re-validate the asset
// we are actually about to upload. "too large" in the message routes this
// through uploadErrorAlert's isSize branch.
if (finalSizeBytes > MAX_VIDEO_SIZE_BYTES) {
  const err: any = new Error(
    `Video is too large after processing (${Math.round(finalSizeBytes / (1024 * 1024))}MB) — the limit is ${MAX_VIDEO_SIZE_MB}MB. Trim it shorter and try again.`
  );
  err.code = 'VIDEO_TOO_LARGE';
  throw err;
}

return {
  uri: finalUri,
  originalSizeBytes,
  finalSizeBytes,
  wasCompressed: finalUri !== uri,
};
```

- [ ] **Step 4: Run the suite + typecheck**

Run: `npx jest utils/__tests__/compressVideo.test.ts` → all PASS
Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors

- [ ] **Step 5: Verify callers handle the new throw**

The two current callers wrap upload prep in try/catch and route errors to an alert — confirm, don't assume:

- `app/(tabs)/create-post.tsx:739` — the call is inside the submit try/catch that ends in `showUploadErrorAlert` (verify by reading the enclosing function).
- `app/game-details/GameDetailsScreen.tsx:1393` — same check.
  If either caller lacks a catch that surfaces the message, wrap that call site: `catch (e) { showUploadErrorAlert(e, { logTag: 'video' }); return; }`.

- [ ] **Step 6: Commit**

```bash
git add utils/compressVideo.ts utils/__tests__/compressVideo.test.ts
git commit -m "fix(video): compression telemetry + post-compression size enforcement"
```

---

### Task 3: Capture parity — team-contacts chat video

`app/(tabs)/team-contacts.tsx` accepts video (`:1108`, `mediaTypes: All`) but sets no export preset, never size-checks, and never compresses — the only video surface that skips all three.

**Files:**

- Modify: `app/(tabs)/team-contacts.tsx` (picker at `:1108-1112`, video branch at `:1116-1125`, `confirmVideoSend` at `:1141-1158`)
- Test: covered by Task 5's parity contract test (written after so it locks in both surfaces)

**Interfaces:**

- Consumes: `VIDEO_CAPTURE_PRESET`, `MAX_VIDEO_SIZE_BYTES`, `MAX_VIDEO_SIZE_MB` from `@/constants/video`; `prepareVideoForUpload` from `@/utils/compressVideo` (Task 2 semantics — may throw `VIDEO_TOO_LARGE`).
- Produces: nothing consumed later.

- [ ] **Step 1: Add imports**

The file already imports from `@/utils/uploadUtils` at `:37`. Add:

```ts
import { MAX_VIDEO_SIZE_BYTES, MAX_VIDEO_SIZE_MB, VIDEO_CAPTURE_PRESET } from '@/constants/video';
import { prepareVideoForUpload } from '@/utils/compressVideo';
```

- [ ] **Step 2: Add the preset and the size gate at pick time**

Change the picker call at `:1108`:

```ts
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.All,
  allowsEditing: false,
  quality: 0.8,
  videoExportPreset: VIDEO_CAPTURE_PRESET,
});
```

In the video branch (currently `setVideoToTrim({...})`), gate on size first:

```ts
            } else {
              const pickedSize = result.assets[0].fileSize || 0;
              if (pickedSize > MAX_VIDEO_SIZE_BYTES) {
                showToast(
                  `Video is too large (${Math.round(pickedSize / (1024 * 1024))}MB). The limit is ${MAX_VIDEO_SIZE_MB}MB.`,
                  'error'
                );
                return;
              }
              // Show trim preview for video files
              setVideoToTrim({
                uri: result.assets[0].uri,
                name: `video_${Date.now()}.mp4`,
                size: pickedSize,
              });
              setVideoTrimmedUri(null);
              return; // Upload happens via confirmVideoSend
            }
```

- [ ] **Step 3: Compress in `confirmVideoSend`**

Replace the body of the `try` in `confirmVideoSend` (`:1144-1150`):

```ts
const prepared = await prepareVideoForUpload(videoTrimmedUri ?? videoToTrim.uri);
await sendFileMessage({
  uri: prepared.uri,
  name: videoToTrim.name,
  size: prepared.finalSizeBytes || videoToTrim.size,
  mimeType: 'video/mp4',
});
```

And make the `catch` show the real reason instead of a fixed string:

```ts
    } catch (e: any) {
      showToast(e?.message || 'Failed to send video', 'error');
    }
```

- [ ] **Step 4: Typecheck + smoke test**

Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors
Run: `npx jest app/__tests__/team-contacts.smoke.test.tsx` — NOTE: this suite currently fails on main with `Cannot read properties of undefined (reading 'MediumQuality')` (jest mock for `ImagePicker.VideoExportPreset` is missing). If it fails with that exact error, fix the mock in the suite's `jest.mock('expo-image-picker', ...)` block by adding `VideoExportPreset: { MediumQuality: 1 }` — do not skip the test.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/team-contacts.tsx" app/__tests__/team-contacts.smoke.test.tsx
git commit -m "fix(video): chat video gets preset, size gate, and compression parity"
```

---

### Task 4: Capture parity — GameDetailsScreen size gate

GameDetails stories compress and trim but never size-check; a 300MB screen recording only fails after minutes of upload.

**Files:**

- Modify: `app/game-details/GameDetailsScreen.tsx` (the story-capture result handler — locate with `grep -n "videoExportPreset" app/game-details/GameDetailsScreen.tsx`, currently `:1228`; the accepted-asset handling directly follows)

**Interfaces:**

- Consumes: `MAX_VIDEO_SIZE_BYTES`, `MAX_VIDEO_SIZE_MB` from `@/constants/video` (file already imports `VIDEO_CAPTURE_PRESET` from there at `:2`); `getVideoFileSize` from `@/utils/compressVideo` (file already imports `prepareVideoForUpload` at `:4` — extend that import).

- [ ] **Step 1: Extend imports**

```ts
import {
  isNativeVideoTrimSupported,
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEO_SIZE_MB,
  VIDEO_CAPTURE_PRESET,
} from '@/constants/video';
import { getVideoFileSize, prepareVideoForUpload } from '@/utils/compressVideo';
```

- [ ] **Step 2: Insert the gate where the captured video asset is accepted**

In the handler that receives `result.assets[0]` from the `:1228` picker, before the asset is stored as the story preview (i.e., before any `setStoryPreview`/equivalent state write for a video asset), insert:

```ts
if (asset.type === 'video') {
  const pickedSize = asset.fileSize || (await getVideoFileSize(asset.uri));
  if (pickedSize > MAX_VIDEO_SIZE_BYTES) {
    Alert.alert(
      'File Too Large',
      `This video is ${Math.round(pickedSize / (1024 * 1024))}MB — the limit is ${MAX_VIDEO_SIZE_MB}MB. Record a shorter clip and try again.`
    );
    return;
  }
}
```

(Adjust the local variable name to match the handler — read the surrounding 30 lines first. The message text mirrors `create-post.tsx:469-474` so users see one consistent rule.)

- [ ] **Step 3: Typecheck + targeted tests**

Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors
Run: `npx jest app/game-details/__tests__ --silent 2>&1 | tail -5` → all suites that passed before still pass.

- [ ] **Step 4: Commit**

```bash
git add app/game-details/GameDetailsScreen.tsx
git commit -m "fix(video): size gate on game-details story capture"
```

---

### Task 5: Capture-parity contract test (locks Tasks 3–4 in place)

A source-string contract test in this repo's standard idiom: every surface that can pick/capture video MUST size-gate, compress, and set the shared preset — and no new video surface can appear without joining the allowlist.

**Files:**

- Create: `app/__tests__/video-capture-parity.contract.test.ts`

**Interfaces:**

- Consumes: source text of the three video surfaces.
- Produces: the enforcement gate — the "one system, every case" guarantee.

- [ ] **Step 1: Write the test (it should PASS immediately if Tasks 3–4 are done — run it to confirm; if any assertion fails, the corresponding task is incomplete)**

```ts
/**
 * Capture-parity contract: every surface that accepts VIDEO must
 *   (a) set the shared export preset (VIDEO_CAPTURE_PRESET),
 *   (b) size-gate against MAX_VIDEO_SIZE (pick-time),
 *   (c) compress via prepareVideoForUpload (upload-time).
 * And no file outside the allowlist may accept video at all — a new video
 * surface must be added here deliberately, with all three guarantees.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const VIDEO_SURFACES = [
  'app/(tabs)/create-post.tsx',
  'app/game-details/GameDetailsScreen.tsx',
  'app/(tabs)/team-contacts.tsx',
];

const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('video capture parity', () => {
  for (const surface of VIDEO_SURFACES) {
    describe(surface, () => {
      const src = read(surface);
      it('uses the shared capture preset', () => {
        expect(src).toContain('VIDEO_CAPTURE_PRESET');
      });
      it('size-gates against the shared max', () => {
        expect(src).toContain('MAX_VIDEO_SIZE_BYTES');
      });
      it('compresses via prepareVideoForUpload', () => {
        expect(src).toContain('prepareVideoForUpload');
      });
    });
  }

  it('no file outside the allowlist accepts video from the picker', () => {
    // Both idioms that admit video: MediaTypeOptions.All / .Videos and the
    // SDK-54 array form MediaType.Videos / 'videos'.
    const videoPickerPattern =
      /MediaTypeOptions\.(All|Videos)|MediaType\.Videos|mediaTypes:\s*\[[^\]]*['"]videos['"]/;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(ROOT, dir))) {
        const rel = join(dir, entry);
        const full = join(ROOT, rel);
        if (statSync(full).isDirectory()) {
          if (!/node_modules|__tests__|\.git/.test(rel)) walk(rel);
        } else if (/\.tsx?$/.test(entry)) {
          const src = readFileSync(full, 'utf8');
          if (videoPickerPattern.test(src) && !VIDEO_SURFACES.includes(rel.replace(/\\/g, '/'))) {
            offenders.push(rel);
          }
        }
      }
    };
    walk('app');
    walk('components');
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest app/__tests__/video-capture-parity.contract.test.ts`
Expected: PASS. If the allowlist check flags `components/StoryCameraButton.tsx`, that is correct — it is deleted in Task 9; either do Task 9 first or temporarily note it, but do NOT add it to the allowlist. (Recommended order: run Task 9 before this step.)

- [ ] **Step 3: Commit**

```bash
git add app/__tests__/video-capture-parity.contract.test.ts
git commit -m "test(video): capture-parity contract — preset + size gate + compression on every video surface"
```

---

### Task 6: Rate-limit (429) UX + limit headroom

The signature endpoint allows 30/hr/user and every failed video burns 2 (initial + fresh-signature retry). During an incident, retrying users hit 429 shown as a generic "Upload Failed".

**Files:**

- Modify: `utils/uploadErrorAlert.ts` (add a 429 branch)
- Modify: `server/src/middleware/rateLimiters.ts` (`uploadLimiter`, currently `max: 30`)

**Interfaces:**

- Consumes: `error.status` — `api/upload.ts` already attaches `signatureErr.status = res.status` on non-OK signature responses.
- Produces: nothing consumed later.

- [ ] **Step 1: Add the 429 branch to `showUploadErrorAlert`**

In `utils/uploadErrorAlert.ts`, after the `isSessionExpired` early-return and BEFORE the `isUpstreamFailure` branch, add:

```ts
const isRateLimited = status === 429 || /too many requests|rate limit/i.test(rawMessage);
if (isRateLimited) {
  Alert.alert(
    'Too Many Uploads',
    'You have hit the hourly upload limit. Wait a few minutes and try again.'
  );
  return;
}
```

(Also add `isRateLimited` handling requires no other changes — `status` and `rawMessage` are already computed above that point.)

- [ ] **Step 2: Raise the server limit**

In `server/src/middleware/rateLimiters.ts`, the upload limiter:

```ts
export const uploadLimiter = createLimiter({
  name: 'upload',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: rateLimitingDisabled ? 100000 : 60, // was 30 — each failed video burns 2 signature calls
});
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors
Run: `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -3` → 0 errors
Run: `cd server && npm test -- --testPathPattern="rate-limit" --no-coverage 2>&1 | tail -5; cd ..` → if any suite pins `max: 30` for the upload limiter, update that assertion to 60 in the same commit (it is a deliberate change, not drift).

- [ ] **Step 4: Commit**

```bash
git add utils/uploadErrorAlert.ts server/src/middleware/rateLimiters.ts
git commit -m "fix(uploads): surface 429 as rate-limit message; double signature limit headroom"
```

---

### Task 7: Size-aware upload timeout

`api/upload.ts` uses a fixed 5-minute XHR timeout for video. 150MB in 300s requires ≥4 Mbps sustained — mathematically impossible on slow cellular, guaranteeing timeout-retry-timeout for large files.

**Files:**

- Modify: `utils/compressVideo.ts` (export a helper — single source for the policy)
- Modify: `app/(tabs)/create-post.tsx:744` and `app/game-details/GameDetailsScreen.tsx:1397` (pass `timeoutMs`)
- Test: `utils/__tests__/compressVideo.test.ts` (extend)

**Interfaces:**

- Consumes: `UploadOptions.timeoutMs` — already supported by `uploadFile`/`uploadFileWithProgress` (`api/upload.ts:449`: `options?.timeoutMs ?? (isVideo ? 300000 : 120000)`). No api/upload.ts change needed.
- Produces: `uploadTimeoutMsForSize(sizeBytes: number): number` from `@/utils/compressVideo`.

- [ ] **Step 1: Write the failing test**

```ts
describe('uploadTimeoutMsForSize', () => {
  it('keeps the 5-minute floor for small files', () => {
    expect(uploadTimeoutMsForSize(8 * 1024 * 1024)).toBe(300_000);
  });
  it('scales ~6s per MB for large files', () => {
    expect(uploadTimeoutMsForSize(100 * 1024 * 1024)).toBe(600_000);
  });
  it('caps at 15 minutes', () => {
    expect(uploadTimeoutMsForSize(500 * 1024 * 1024)).toBe(900_000);
  });
  it('falls back to the floor when size is unknown (0)', () => {
    expect(uploadTimeoutMsForSize(0)).toBe(300_000);
  });
});
```

Run: `npx jest utils/__tests__/compressVideo.test.ts` → new tests FAIL.

- [ ] **Step 2: Implement in `utils/compressVideo.ts`**

```ts
/**
 * Size-aware upload timeout: 6s per MB (≈1.4 Mbps sustained), floored at the
 * historical 5-minute default and capped at 15 minutes. A fixed 5-minute
 * timeout made 150MB uploads mathematically impossible on slow cellular.
 */
export function uploadTimeoutMsForSize(sizeBytes: number): number {
  if (!sizeBytes || sizeBytes <= 0) return 300_000;
  const scaled = Math.round(sizeBytes / (1024 * 1024)) * 6_000;
  return Math.min(900_000, Math.max(300_000, scaled));
}
```

- [ ] **Step 3: Pass it at both video call sites**

`app/(tabs)/create-post.tsx` — the submit path already holds the `prepareVideoForUpload` result (`:739`). Capture it and thread the timeout:

```ts
const prepared = media === 'video' ? await prepareVideoForUpload(sourceUri) : null;
const uploadUri = prepared ? prepared.uri : sourceUri;
// ...
const mainUpload = uploadFile(base, uploadUri, name, mime, {
  ...existingOptions,
  ...(prepared ? { timeoutMs: uploadTimeoutMsForSize(prepared.finalSizeBytes) } : {}),
});
```

(Adapt to the exact current shape at `:739-744` — the key change: keep the `prepared` result instead of destructuring only `.uri`, and add `timeoutMs` to the options object.) Same pattern at `GameDetailsScreen.tsx:1393-1397`, where `prepared` already exists as `(await prepareVideoForUpload(rawUri))` — bind it to a variable and pass `timeoutMs: uploadTimeoutMsForSize(prepared.finalSizeBytes)` as the options argument of the `uploadFile` call.

- [ ] **Step 4: Verify + commit**

Run: `npx jest utils/__tests__/compressVideo.test.ts` → PASS; `npx tsc --noEmit` → 0 errors.

```bash
git add utils/compressVideo.ts utils/__tests__/compressVideo.test.ts "app/(tabs)/create-post.tsx" app/game-details/GameDetailsScreen.tsx
git commit -m "fix(video): size-aware upload timeout — large clips no longer guaranteed to time out"
```

---

### Task 8: Trim honesty — mismatch consent + thumbnail telemetry

Two `components/VideoTrimmer.tsx` issues: (a) when the native trim silently no-ops (output duration ≠ requested), it reports to Sentry but **still hands the untrimmed clip to `onTrimComplete`** — the user posts a video they explicitly tried to shorten; (b) filmstrip thumbnail failures are `__DEV__`-only.

**Files:**

- Modify: `components/VideoTrimmer.tsx` (`:334-348` mismatch block; `:205-208` thumbnail catch)

**Interfaces:**

- Consumes: existing `reportTrimFailure(stage, error, uri?)` in the same file.
- Produces: nothing consumed later.

- [ ] **Step 1: Make the duration mismatch ask the user**

Replace the mismatch block (currently: report → fall through to `onTrimComplete`):

```ts
if (actualMs !== null && Math.abs(actualMs - requestedMs) > 500) {
  if (__DEV__) {
    console.warn(
      `[VideoTrimmer] Native trim duration mismatch — requested ${requestedMs}ms, got ${actualMs}ms`
    );
  }
  reportTrimFailure(
    'trim_duration_mismatch',
    new Error(
      `Native trim returned success but output duration (${actualMs}ms) does not match requested range (${requestedMs}ms, start=${startMs} end=${endMs})`
    ),
    processableUri ?? undefined
  );
  // Do NOT silently deliver an untrimmed clip — let the user decide.
  const outputPath = result.outputPath;
  Alert.alert(
    'Trim May Not Have Applied',
    'The trimmed clip does not match the length you selected. Use it anyway, or try trimming again.',
    [
      { text: 'Try Again', style: 'cancel' },
      { text: 'Use Anyway', onPress: () => onTrimComplete(outputPath) },
    ]
  );
  return;
}
onTrimComplete(result.outputPath);
```

- [ ] **Step 2: Add thumbnail-failure telemetry**

In the `generateThumbnailsAsync` `.catch` (`:205-208`):

```ts
          .catch(e => {
            if (__DEV__) console.warn('[VideoTrimmer] Thumbnail generation failed:', e);
            reportTrimFailure('thumbnail_gen', e, uri);
            setLoading(false);
          });
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors. Manual reasoning check: `trimming` state still clears via the existing `finally`, and the mismatch path returns before `onTrimComplete`, so no double-complete.

```bash
git add components/VideoTrimmer.tsx
git commit -m "fix(trim): ask before delivering a mismatched trim; report thumbnail failures"
```

---

### Task 9: Delete the orphaned StoryCameraButton

`components/StoryCameraButton.tsx` is imported by nothing (only referenced in one test). It duplicates capture+trim logic with no size validation or compression — dead code that will drift and confuse future audits.

**Files:**

- Delete: `components/StoryCameraButton.tsx`
- Modify or delete: `components/__tests__/story-video-platform-foundation.test.ts` (inspect first)

- [ ] **Step 1: Confirm it is still orphaned (do not assume)**

Run: `grep -rn "StoryCameraButton" app/ components/ --include="*.tsx" --include="*.ts" | grep -v __tests__ | grep -v "components/StoryCameraButton"`
Expected: no output. If ANY import appears, STOP — the component got wired up since the audit; skip this task and note it.

- [ ] **Step 2: Handle the test**

Read `components/__tests__/story-video-platform-foundation.test.ts`. If its assertions ONLY concern `StoryCameraButton`, delete the whole file. If it also pins other story-video invariants (e.g., `GameDetailsScreen` story behavior), delete only the `StoryCameraButton` describe/assertions and keep the rest.

- [ ] **Step 3: Delete, verify, commit**

```bash
rm components/StoryCameraButton.tsx
```

Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors; `npx jest components/__tests__ --silent 2>&1 | tail -5` → remaining suites pass.

```bash
git add components/StoryCameraButton.tsx components/__tests__/story-video-platform-foundation.test.ts
git commit -m "chore(video): remove orphaned StoryCameraButton capture surface"
```

---

### Task 10: OTA guard — refuse to publish from a dirty tree

OTA updates were published from uncommitted working trees (the "outdated video trim native module" alert string in user screenshots exists in NO git commit — unreproducible production state). Make the npm publish path physically refuse.

**Files:**

- Create: `scripts/guard-ota-clean-tree.js`
- Modify: `package.json` (`update:production` script)

- [ ] **Step 1: Write the guard**

```js
#!/usr/bin/env node
/**
 * OTA publish guard: every published JS bundle must be reproducible from a
 * commit. Publishing from a dirty tree already shipped un-debuggable states
 * (error strings that exist in no commit). Refuses when the tree is dirty.
 */
const { execSync } = require('child_process');

const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (dirty) {
  console.error('[ota-guard] REFUSING to publish an OTA from a dirty working tree.');
  console.error(
    '[ota-guard] Commit (or stash) everything first — published bundles must be reproducible from a commit.'
  );
  console.error('[ota-guard] Dirty files (first 15):');
  console.error(
    dirty
      .split('\n')
      .slice(0, 15)
      .map(l => `  ${l}`)
      .join('\n')
  );
  process.exit(1);
}

const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
console.log(`[ota-guard] Clean tree at ${sha} — OK to publish.`);
```

- [ ] **Step 2: Wire it into the publish script**

In `package.json`, change:

```json
"update:production": "node scripts/guard-ota-clean-tree.js && cross-env SENTRY_DISABLE_AUTO_UPLOAD= eas update --branch production"
```

- [ ] **Step 3: Live-verify both branches of the guard**

Run: `node scripts/guard-ota-clean-tree.js`
Expected right now: exit 1 with the refusal message (the tree currently has legal-pages WIP — a real positive test).
Then: `git stash --include-untracked && node scripts/guard-ota-clean-tree.js && git stash pop` — expected: `OK to publish` between the stashes. (If the repo rule "never run git stash apply directly" concerns you, note `git stash pop` after `git stash` in the same command is the sanctioned round-trip here; alternatively verify the clean branch in a temp worktree.)

- [ ] **Step 4: Commit**

```bash
git add scripts/guard-ota-clean-tree.js package.json
git commit -m "guard(ota): refuse to publish updates from a dirty working tree"
```

Note in the commit body or PR: the guard protects `npm run update:production`; raw `eas update` bypasses it. Team convention: always publish through the npm script.

---

### Task 11: Unify picker idioms (deprecated MediaTypeOptions → shared helpers)

Three idioms coexist (deprecated enum, new string array, version-safe helpers in `utils/picker.ts`). The deprecated enum breaks on a future expo-image-picker major — a time bomb across 12 files.

**Files:**

- Modify: `utils/picker.ts` (add an "all media" helper)
- Modify (mechanical, same pattern each): `app/(tabs)/edit-event.tsx:188,205` · `app/(tabs)/edit-profile.tsx:275,298,371` · `app/(tabs)/edit-team.tsx:208` · `app/(tabs)/team-contacts.tsx:748,1109` · `app/create-fan-event.tsx:462,495` · `app/game-details/GameDetailsScreen.tsx:1226` · `components/EventPreviewImageField.tsx:84,109` · `components/QuickAddGameModal.tsx:674,704` · `app/report-abuse.tsx:85` · `app/onboarding/step-3-league.tsx:1432` · `app/(tabs)/create-post.tsx:527-529` (hand-rolled fallback → helper)
- Create: `app/__tests__/picker-idiom.contract.test.ts`

**Interfaces:**

- Consumes: existing `pickerMediaTypesProp()` (images-only) and `pickerMediaTypeFor(media)` from `utils/picker.ts`.
- Produces: `pickerAllMediaTypesProp()` from `utils/picker.ts`.

- [ ] **Step 1: Add the missing helper to `utils/picker.ts`**

```ts
// Build version-safe props for photo+video selection
export function pickerAllMediaTypesProp() {
  const anyIP = ImagePicker as any;
  if (anyIP?.MediaType) {
    return { mediaTypes: [anyIP.MediaType.Images, anyIP.MediaType.Videos] } as any;
  }
  return { mediaTypes: (ImagePicker as any).MediaTypeOptions?.All } as any;
}
```

- [ ] **Step 2: Write the ban test (fails until the sweep is done)**

```ts
// app/__tests__/picker-idiom.contract.test.ts
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
```

Run: `npx jest app/__tests__/picker-idiom.contract.test.ts` → FAIL (listing every offender — your working checklist).

- [ ] **Step 3: Sweep each file (identical mechanical change)**

Pattern — replace:

```ts
mediaTypes: ImagePicker.MediaTypeOptions.Images,
```

with a spread of the helper (add the import `import { pickerMediaTypesProp } from '@/utils/picker';`):

```ts
...pickerMediaTypesProp(),
```

For `MediaTypeOptions.All` sites (team-contacts `:1109`) use `...pickerAllMediaTypesProp()`. For video-only sites use `...pickerMediaTypeFor('video')`. For `create-post.tsx:527-529`, delete the hand-rolled `MediaType`-vs-`MediaTypeOptions` fallback and use the helpers. Preserve every other picker option (quality, allowsEditing, aspect, videoExportPreset, videoMaxDuration) unchanged.

- [ ] **Step 4: Verify**

Run: `npx jest app/__tests__/picker-idiom.contract.test.ts` → PASS
Run: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors
Run: `npx jest app/__tests__ components/__tests__ --silent 2>&1 | tail -5` → no new failures vs the pre-existing baseline (this branch has known-stale contract suites unrelated to pickers; compare failure lists before/after, don't demand a fully green run).

- [ ] **Step 5: Commit**

```bash
git add utils/picker.ts app/__tests__/picker-idiom.contract.test.ts "app/(tabs)/edit-event.tsx" "app/(tabs)/edit-profile.tsx" "app/(tabs)/edit-team.tsx" "app/(tabs)/team-contacts.tsx" app/create-fan-event.tsx app/game-details/GameDetailsScreen.tsx components/EventPreviewImageField.tsx components/QuickAddGameModal.tsx app/report-abuse.tsx app/onboarding/step-3-league.tsx "app/(tabs)/create-post.tsx"
git commit -m "refactor(pickers): unify on version-safe picker helpers; ban deprecated MediaTypeOptions"
```

---

### Task 12: Small consistency fixes (one commit)

**Files:**

- Modify: `constants/video.ts` (add shared image cap)
- Modify: `app/(tabs)/create-post.tsx:64` (use it), `components/BannerUpload.tsx:166` (use it)
- Modify: `components/VideoPlayer.tsx` (null-uri guard)
- Modify: `components/PostCard.tsx:331-338`, `components/MasonryPostCard.tsx:162-169` (video-preview `onError` fallback)
- Modify: `server/src/routes/uploads.ts:636` area (fix the misleading "Maximum size is 100MB" message on the proxy path — the multer limit there is 25MB and video never reaches it)

- [ ] **Step 1: Shared image cap**

In `constants/video.ts`:

```ts
/** Image upload cap — shared by create-post and BannerUpload (was two independent 10MB literals). */
export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
```

Replace `create-post.tsx:64`'s local `MAX_IMAGE_SIZE` and `BannerUpload.tsx:166`'s inline `10 * 1024 * 1024` with imports of `MAX_IMAGE_SIZE_BYTES` (keep local alias `MAX_IMAGE_SIZE = MAX_IMAGE_SIZE_BYTES` in create-post if it reduces diff churn).

- [ ] **Step 2: VideoPlayer null guard**

In `components/VideoPlayer.tsx`, widen the prop and pre-empt the error overlay:

```ts
uri?: string | null;
```

At the top of the component body:

```ts
  if (!uri) {
    // Callers pass mediaUrl! assertions; a missing URL should show the error
    // state immediately instead of mounting a player against undefined.
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>Video unavailable</Text>
      </View>
    );
  }
```

(Reuse the component's existing error-state styles — read `:114-128` and mirror that JSX rather than inventing new styles. Hooks caveat: `useVideoPlayer` is called unconditionally today; if the early return would skip hooks, instead pass a sentinel `null` source to `useVideoPlayer(uri ?? null, ...)` and render the error overlay when `!uri` — expo-video accepts a null source. Choose whichever keeps hook order stable; do not conditionally call hooks.)

- [ ] **Step 3: Preview-image onError**

In `PostCard.tsx` video-preview branch, mirror the retry/fallback already used by the image branch at `:315`; in `MasonryPostCard.tsx`, add `onError` switching to the videocam-placeholder branch that already exists for null previews. Read both components' existing null-preview fallback JSX and reuse it — the deliverable: a dead `preview_url` renders the placeholder, never a broken image.

- [ ] **Step 4: Server message honesty**

At `server/src/routes/uploads.ts` (~`:636`), the proxy-path file-too-large message claims "Maximum size is 100MB". The proxy multer limit is 25MB (`:176`) and video is 415-rejected before it. Change the message to match reality:

```ts
'File too large. Images up to 25MB upload through the app; videos upload directly and support up to 150MB.';
```

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit`, `npx tsc --noEmit --project server/tsconfig.json` → 0 errors each.
Run: `npx jest app/__tests__/video-upload-limits.contract.test.ts components/__tests__ --silent 2>&1 | tail -5` → no new failures.

```bash
git add constants/video.ts "app/(tabs)/create-post.tsx" components/BannerUpload.tsx components/VideoPlayer.tsx components/PostCard.tsx components/MasonryPostCard.tsx server/src/routes/uploads.ts
git commit -m "fix(media): shared image cap, VideoPlayer null guard, preview onError, honest proxy size message"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx tsc --noEmit --project server/tsconfig.json` → 0 errors
- [ ] `npx jest app/__tests__/upload-telemetry.contract.test.ts app/__tests__/video-capture-parity.contract.test.ts app/__tests__/picker-idiom.contract.test.ts app/__tests__/video-upload-limits.contract.test.ts utils/__tests__/compressVideo.test.ts components/__tests__/video-trim-native-patch.contract.test.ts` → all PASS
- [ ] `cd server && npm test -- --testPathPattern="cloudinary|api-uploads|rate-limit" --no-coverage` → PASS
- [ ] `npm run test:regressions` → passes
- [ ] `npm run audit:navigation` → no new REVIEW items
- [ ] Remind the user: client tasks reach users only after `npm run update:production` (now guarded — requires a clean tree) **and** the Phase 0 binary ships for the native trim fix.

## Deliberately out of scope (decisions needed or bigger than this plan)

- **Chunked/resumable uploads** (Cloudinary `X-Unique-Upload-Id` protocol): the right long-term fix for very large files on bad networks, but a significant client rework. The size-aware timeout (Task 7) removes the guaranteed-failure case first.
- **True server-side video size/duration enforcement**: Cloudinary has no signable `max_bytes`; real enforcement means an upload preset with an incoming size limit configured in the Cloudinary console (ops change, not code) or post-upload validation+delete via webhook. Recommend the preset — but it's a console setting the user must make.
- **Vertical-feed autoplay sound**: code autoplays UNMUTED while its own comment claims muted-by-default, and the mute button was removed (`GameVerticalFeedScreen.tsx:316` vs `:578`). Whether scroll-feed videos should be silent-until-tapped is a product decision — do not change silently. If muted-autoplay is chosen, that's a small follow-up task (set `p.muted = true`, add a tap-to-unmute affordance).
- **Restoring a video proxy fallback**: the 415 direct-only policy was a deliberate perf decision (June 6). Reversing it trades Cloudinary-outage resilience for server bandwidth costs — a product/infra call, not a bug fix.
