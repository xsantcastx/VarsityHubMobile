# Video Capture & Upload Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify video capture quality (MediumQuality preset) across all three capture surfaces, wire up real client-side compression, and fix the client(100MB)/server(50MB) upload size-limit mismatch at 150MB.

**Architecture:** A new `constants/video.ts` becomes the single source of truth for the capture preset, story duration cap, and size cap. The three capture surfaces (`create-post.tsx`, `StoryCameraButton.tsx`, `GameDetailsScreen.tsx`) import from it. `react-native-compressor` gets installed for real (the existing `utils/compressVideo.ts` wrapper already handles its absence safely). The server's Cloudinary signature `max_bytes` is raised to match. A file-content contract test keeps client and server limits in lockstep.

**Tech Stack:** Expo SDK 54 / React Native, expo-image-picker, react-native-compressor (new native module), Express server (Cloudinary signed uploads), Jest.

**Spec:** `docs/superpowers/specs/2026-07-06-video-capture-upload-quality-design.md`

## Global Constraints

- Quality preset: `ImagePicker.VideoExportPreset.MediumQuality` everywhere (1080p deferred; must remain a one-constant change).
- Duration caps: Stories (StoryCameraButton) = 30s; feed posts (create-post) and game-page stories (GameDetailsScreen) = uncapped (omit `videoMaxDuration`).
- Size cap: 150MB exactly, matched: client `150 * 1024 * 1024` bytes, server `'157286400'` string.
- `compressVideoSafe()` contract unchanged: dynamic require, try/catch, return original URI on any failure (OTA safety for old binaries).
- Never run `eas build` / `eas submit` — provide commands for the user.
- After server changes: `npx tsc --noEmit --project server/tsconfig.json`. After client changes: `npx tsc --noEmit`.
- Repo rule: run `npm run check:conflicts` before committing; format only changed files (never repo-wide `npm run format`).

---

### Task 1: Centralized video constants + limit-parity contract test

**Files:**

- Create: `constants/video.ts`
- Create: `app/__tests__/video-upload-limits.contract.test.ts`
- Modify: `server/src/routes/uploads.ts:254` (maxBytes `'52428800'` → `'157286400'`)

**Interfaces:**

- Produces: `constants/video.ts` exporting `VIDEO_CAPTURE_PRESET` (ImagePicker.VideoExportPreset), `STORY_MAX_DURATION_S` (number, 30), `MAX_VIDEO_SIZE_BYTES` (number, 157286400), `MAX_VIDEO_SIZE_MB` (number, 150). Tasks 2–4 import these.

- [ ] **Step 1: Write the failing contract test**

Create `app/__tests__/video-upload-limits.contract.test.ts`:

```ts
/**
 * Contract test: the client-side video size cap and the server-signed
 * Cloudinary max_bytes MUST stay equal. They live in different compilation
 * units (client TS vs server TS) and diverged once before (client 100MB vs
 * server 50MB — uploads between 50–100MB passed client validation and were
 * rejected by Cloudinary signature enforcement).
 *
 * Checked as file content because the two sides can't import each other.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

describe('video upload size limit parity', () => {
  it('client constants/video.ts declares 150MB in bytes', () => {
    const src = fs.readFileSync(path.join(ROOT, 'constants', 'video.ts'), 'utf8');
    expect(src).toMatch(/MAX_VIDEO_SIZE_BYTES\s*=\s*150 \* 1024 \* 1024/);
    expect(src).toMatch(/MAX_VIDEO_SIZE_MB\s*=\s*150/);
  });

  it('server cloudinary signature max_bytes equals 150MB', () => {
    const src = fs.readFileSync(path.join(ROOT, 'server', 'src', 'routes', 'uploads.ts'), 'utf8');
    expect(src).toMatch(/maxBytes = '157286400'/);
    // The old 50MB literal must be gone
    expect(src).not.toMatch(/maxBytes = '52428800'/);
  });

  it('150MB in bytes is 157286400 (sanity)', () => {
    expect(150 * 1024 * 1024).toBe(157286400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/__tests__/video-upload-limits.contract.test.ts --no-coverage`
Expected: FAIL — `constants/video.ts` does not exist (ENOENT) and server still has `'52428800'`.

- [ ] **Step 3: Create `constants/video.ts`**

```ts
import * as ImagePicker from 'expo-image-picker';

/**
 * Single source of truth for video capture/upload settings.
 *
 * Quality: MediumQuality across all capture surfaces (deliberate, consistent).
 * To move to 1080p later, change VIDEO_CAPTURE_PRESET to
 * ImagePicker.VideoExportPreset.H264_1920x1080 — nothing else.
 */
export const VIDEO_CAPTURE_PRESET = ImagePicker.VideoExportPreset.MediumQuality;

/** Stories are short-form: hard cap at 30 seconds. */
export const STORY_MAX_DURATION_S = 30;

/**
 * Upload size cap. MUST equal the server-signed Cloudinary max_bytes in
 * server/src/routes/uploads.ts (enforced by
 * app/__tests__/video-upload-limits.contract.test.ts).
 */
export const MAX_VIDEO_SIZE_MB = 150;
export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024;
```

- [ ] **Step 4: Update the server signature limit**

In `server/src/routes/uploads.ts`, change line 254:

```ts
// Before:
const maxBytes = '52428800'; // 50 MB — videos are the largest legitimate uploads
// After:
const maxBytes = '157286400'; // 150 MB — must equal client MAX_VIDEO_SIZE_BYTES (constants/video.ts)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest app/__tests__/video-upload-limits.contract.test.ts --no-coverage`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck both sides**

Run: `npx tsc --noEmit 2>&1 | tail -5` and `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
npm run check:conflicts
git add constants/video.ts app/__tests__/video-upload-limits.contract.test.ts server/src/routes/uploads.ts
git commit -m "feat(video): centralize capture constants; raise Cloudinary max_bytes to 150MB

Fixes the live mismatch where client allowed 100MB but the signed
Cloudinary upload rejected anything over 50MB."
```

Note: the server change auto-deploys to production via Railway on push to main. It only widens the accepted range — safe to ship independently of the client work.

---

### Task 2: create-post.tsx — uncapped duration, centralized constants

**Files:**

- Modify: `app/(tabs)/create-post.tsx` (const at :85, library picker at :463-470, camera picker at :561-569, size checks at :487-500 and :590-601)

**Interfaces:**

- Consumes: `VIDEO_CAPTURE_PRESET`, `MAX_VIDEO_SIZE_BYTES`, `MAX_VIDEO_SIZE_MB` from `constants/video.ts` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace the local size constant with the shared one**

At the top of `app/(tabs)/create-post.tsx`, add the import (near the existing `@/utils/compressVideo` import at line 35):

```ts
import { MAX_VIDEO_SIZE_BYTES, MAX_VIDEO_SIZE_MB, VIDEO_CAPTURE_PRESET } from '@/constants/video';
```

Delete line 85:

```ts
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
```

- [ ] **Step 2: Update the library picker options (~line 463)**

```ts
// Before:
const r = await ImagePicker.launchImageLibraryAsync({
  ...pickerMediaTypeFor(media),
  allowsEditing: false, // Don't crop - preserve original photo
  quality: media === 'image' ? 0.85 : undefined,
  exif: false,
  videoMaxDuration: 30,
  videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
} as any);

// After (no videoMaxDuration — feed posts are uncapped):
const r = await ImagePicker.launchImageLibraryAsync({
  ...pickerMediaTypeFor(media),
  allowsEditing: false, // Don't crop - preserve original photo
  quality: media === 'image' ? 0.85 : undefined,
  exif: false,
  videoExportPreset: VIDEO_CAPTURE_PRESET,
} as any);
```

- [ ] **Step 3: Update the camera picker options (~line 561)**

```ts
// Before:
const r = await ImagePicker.launchCameraAsync({
  mediaTypes: cameraMediaTypes,
  allowsEditing: false,
  quality: 0.85,
  exif: false,
  videoMaxDuration: 30,
  videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
  legacy: false,
} as any);

// After:
const r = await ImagePicker.launchCameraAsync({
  mediaTypes: cameraMediaTypes,
  allowsEditing: false,
  quality: 0.85,
  exif: false,
  videoExportPreset: VIDEO_CAPTURE_PRESET,
  legacy: false,
} as any);
```

(`quality: 0.85` stays: this is a mixed image+video camera picker and the float still governs photo compression.)

- [ ] **Step 4: Update both size checks (library ~line 487, camera ~line 590)**

Both blocks currently read:

```ts
const maxSize = media === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
const maxSizeMB = media === 'image' ? 10 : 100;
```

Change both to:

```ts
const maxSize = media === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE_BYTES;
const maxSizeMB = media === 'image' ? 10 : MAX_VIDEO_SIZE_MB;
```

The existing alert copy already interpolates `maxSizeMB` and suggests trimming ("Trim it shorter or record at a lower resolution and try again.") — no copy change needed.

- [ ] **Step 5: Verify no stragglers and typecheck**

Run: `grep -n "MAX_VIDEO_SIZE\b" "app/(tabs)/create-post.tsx"`
Expected: no hits (only `MAX_VIDEO_SIZE_BYTES`/`MAX_VIDEO_SIZE_MB` remain).

Run: `grep -n "videoMaxDuration" "app/(tabs)/create-post.tsx"`
Expected: no hits.

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 6: Run the create-post test suite**

Run: `npx jest create-post --no-coverage 2>&1 | tail -10`
Expected: existing suites pass (no behavior they assert has changed).

- [ ] **Step 7: Commit**

```bash
npm run check:conflicts
git add "app/(tabs)/create-post.tsx"
git commit -m "feat(video): uncap feed-post video duration, use shared capture constants"
```

---

### Task 3: StoryCameraButton — 30s cap, MediumQuality, real compression call

**Files:**

- Modify: `components/StoryCameraButton.tsx` (picker options ~lines 84-91, `confirmVideoTrim` ~lines 118-123)

**Interfaces:**

- Consumes: `VIDEO_CAPTURE_PRESET`, `STORY_MAX_DURATION_S` from `constants/video.ts` (Task 1); `compressVideoSafe(uri: string): Promise<string>` from `utils/compressVideo.ts` (existing).
- Produces: nothing consumed by later tasks. `onCapture(uri, 'video')` contract with parent screens is unchanged.

- [ ] **Step 1: Add imports**

At the top of `components/StoryCameraButton.tsx`:

```ts
import { STORY_MAX_DURATION_S, VIDEO_CAPTURE_PRESET } from '@/constants/video';
import { compressVideoSafe } from '@/utils/compressVideo';
```

(Match the file's existing import style — it already imports from `@/`-prefixed paths; if it uses relative paths, use `../constants/video` and `../utils/compressVideo` instead.)

- [ ] **Step 2: Update picker options (~line 84)**

```ts
// Before:
const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.All,
  allowsEditing: false,
  quality: 0.9,
  exif: false,
  videoMaxDuration: 60, // 60 second max for Stories
  videoExportPreset: ImagePicker.VideoExportPreset.H264_960x540, // Force transcode
});

// After:
const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.All,
  allowsEditing: false,
  quality: 0.9,
  exif: false,
  videoMaxDuration: STORY_MAX_DURATION_S,
  videoExportPreset: VIDEO_CAPTURE_PRESET,
});
```

- [ ] **Step 3: Compress the video before handing it to onCapture**

`confirmVideoTrim` currently:

```ts
const confirmVideoTrim = useCallback(() => {
  if (!videoToTrim) return;
  onCapture(trimmedUri ?? videoToTrim, 'video');
  setVideoToTrim(null);
  setTrimmedUri(null);
}, [videoToTrim, trimmedUri, onCapture]);
```

Change to (async; compressVideoSafe falls back to the original URI on any failure, so this cannot block the story):

```ts
const confirmVideoTrim = useCallback(async () => {
  if (!videoToTrim) return;
  const sourceUri = trimmedUri ?? videoToTrim;
  const uri = await compressVideoSafe(sourceUri);
  onCapture(uri, 'video');
  setVideoToTrim(null);
  setTrimmedUri(null);
}, [videoToTrim, trimmedUri, onCapture]);
```

Check the call site of `confirmVideoTrim` in this file (it is an `onPress` handler): `onPress={confirmVideoTrim}` accepts an async function as-is — no change needed there.

- [ ] **Step 4: Typecheck and existing tests**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors.

Run: `npx jest StoryCameraButton --no-coverage 2>&1 | tail -5`
Expected: pass (or "no tests found" — there is no dedicated suite today; that's acceptable, this is picker-config + a passthrough call).

- [ ] **Step 5: Commit**

```bash
npm run check:conflicts
git add components/StoryCameraButton.tsx
git commit -m "feat(video): stories capture at MediumQuality/30s with real compression"
```

---

### Task 4: GameDetailsScreen — explicit preset, uncapped duration, compression on story upload

**Files:**

- Modify: `app/game-details/GameDetailsScreen.tsx` (pickerOptions ~lines 1217-1221, `confirmStoryUpload` ~lines 1377-1391)

**Interfaces:**

- Consumes: `VIDEO_CAPTURE_PRESET` from `constants/video.ts` (Task 1); `compressVideoSafe` from `utils/compressVideo.ts` (existing).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add imports**

This file uses relative dynamic imports (`../../utils/ensureUploadableUri`). Add static imports near the top, matching its existing static-import style:

```ts
import { VIDEO_CAPTURE_PRESET } from '../../constants/video';
import { compressVideoSafe } from '../../utils/compressVideo';
```

- [ ] **Step 2: Update pickerOptions (~line 1217)**

```ts
// Before:
const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.All,
  quality: 0.8,
  videoMaxDuration: 30,
};

// After (uncapped duration — user-confirmed; explicit preset instead of OS default):
const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ImagePicker.MediaTypeOptions.All,
  quality: 0.8,
  videoExportPreset: VIDEO_CAPTURE_PRESET,
};
```

- [ ] **Step 3: Compress the video in confirmStoryUpload (~line 1382)**

```ts
// Before:
const uploadUri = storyTrimmedUri || storyPreview.uri;
const ensured = await (
  await import('../../utils/ensureUploadableUri')
).ensureUploadableUri(uploadUri, storyPreview.mimeType);

// After — compress only the video path (this callback also never runs for
// images; images upload inline in the picker handler):
const rawUri = storyTrimmedUri || storyPreview.uri;
const uploadUri = await compressVideoSafe(rawUri);
const ensured = await (
  await import('../../utils/ensureUploadableUri')
).ensureUploadableUri(uploadUri, storyPreview.mimeType);
```

`confirmStoryUpload` only handles videos: the picker handler at ~line 1261 routes `asset.type === 'video'` to `setStoryPreview(...)` + this callback, while images upload directly inline. Verify that routing is still true when editing (look for `if (asset.type === 'video')` before `setStoryPreview`); if an image path also reaches `confirmStoryUpload`, gate the compression call on `storyPreview.type === 'video'`.

- [ ] **Step 4: Verify and typecheck**

Run: `grep -n "videoMaxDuration" app/game-details/GameDetailsScreen.tsx`
Expected: no hits.

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors.

Run: `npx jest GameDetailsScreen --no-coverage 2>&1 | tail -10`
Expected: existing suites pass (vote/caption/mapper tests don't touch picker config).

- [ ] **Step 5: Commit**

```bash
npm run check:conflicts
git add app/game-details/GameDetailsScreen.tsx
git commit -m "feat(video): game story capture gets explicit preset, uncapped duration, compression"
```

---

### Task 5: Install react-native-compressor (makes compression real)

**Files:**

- Modify: `package.json`, `package-lock.json` (via install command)

**Interfaces:**

- Consumes: nothing from earlier tasks (independent — the `compressVideoSafe` wrapper already exists and tolerates absence).
- Produces: the native module that makes every `compressVideoSafe()` call (Tasks 3–4 additions plus create-post's existing calls) actually compress instead of silently no-op.

- [ ] **Step 1: Install with Expo's version resolution**

Run: `npx expo install react-native-compressor`
Expected: adds a `react-native-compressor` entry to `package.json` dependencies and updates `package-lock.json`. (Use `expo install`, not `npm install`, so the SDK-54-compatible version is selected.)

- [ ] **Step 2: Confirm the wrapper resolves the module in JS**

Run: `node -e "const p=require('./node_modules/react-native-compressor/package.json'); console.log(p.name, p.version)"`
Expected: prints `react-native-compressor <version>`.

Note: `Video.compress()` still cannot run in Node/Jest (native module) — `compressVideoSafe`'s catch path covers that, which is exactly its contract. No unit test can exercise real compression; that's the manual device verification below.

- [ ] **Step 3: Confirm no config plugin is required**

Run: `grep -rn "compressor" node_modules/react-native-compressor/README.md | head -20` and check the README's installation section.
Expected: react-native-compressor is autolinked with no `app.config.js` plugin entry required (no permissions of its own). If the README for the installed version _does_ demand a config plugin, add it to the `plugins` array in `app.config.js` and note it in the commit message.

- [ ] **Step 4: Typecheck + full client test pass**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors.

Run: `npx jest app/__tests__/video-upload-limits.contract.test.ts --no-coverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run check:conflicts
git add package.json package-lock.json
git commit -m "feat(video): install react-native-compressor — compressVideoSafe now actually compresses

New native module: requires a new dev-client / EAS binary. Older binaries
are safe via compressVideoSafe's dynamic-require fallback."
```

---

### Task 6: Real-device verification (manual gate — cannot be automated)

**Files:** none (verification only).

**Interfaces:**

- Consumes: everything above, running on a device.

- [ ] **Step 1: Rebuild the dev client (user runs these — never run eas build yourself)**

Provide to the user:

```bash
npx expo run:ios
```

(Android when relevant: `npx expo run:android`.)

- [ ] **Step 2: Manual verification checklist (on device)**

1. **Feed post (create-post):** record a >30s video via camera — recording is NOT cut off at 30s; pick a long library video — accepted. Post it; video plays back.
2. **Story (StoryCameraButton):** camera recording stops at 30s; resulting story video looks ~MediumQuality (not the old 960×540 soft look at capture, and not raw 4K either).
3. **Game story (GameDetailsScreen):** add a story video >30s — accepted; plays after upload.
4. **Compression is real:** in Metro logs, confirm no silent-catch path; compare file size before/after (`compressVideoSafe` result differs from input URI, and upload progress reflects a smaller payload than the raw recording).
5. **Size-cap fix:** upload a video between 50MB and 150MB (a long high-motion clip). Previously: Cloudinary rejects at 50MB. Now: uploads succeed.
6. **Trim still works:** trim a story video (exercises the react-native-video-trim patch from the same branch) and confirm the posted video is the trimmed length.

- [ ] **Step 3: Ship-note for the user**

- Server side (`max_bytes`) goes live when merged to main (Railway auto-deploy).
- Client JS can ship via `eas update --branch production`, and is safe on old binaries (compression just no-ops there) — but **real compression and the new picker presets only reach users with the next App Store binary** (new native module).
- Remind the user: a code fix is NOT live until `eas update` is run, and the native part needs `eas build` + store submission.

---

## Self-Review

- **Spec coverage:** constants file (Task 1), per-surface preset/caps (Tasks 2–4), real compression install + wiring (Tasks 3–5), size-cap fix both sides (Task 1), parity regression test (Task 1), manual device verification incl. >50MB upload (Task 6). Error-handling requirements are satisfied by the unchanged `compressVideoSafe` fallback contract and the existing size-check alerts now referencing 150MB. No gaps found.
- **Placeholder scan:** none — every code step shows the exact before/after code.
- **Type consistency:** `VIDEO_CAPTURE_PRESET`, `STORY_MAX_DURATION_S`, `MAX_VIDEO_SIZE_BYTES`, `MAX_VIDEO_SIZE_MB` used with identical names in Tasks 1–4; `compressVideoSafe(uri: string): Promise<string>` matches the existing implementation in `utils/compressVideo.ts`.
