# Video Capture & Upload Quality — Design

**Date:** 2026-07-06
**Status:** Approved (pending user spec review)
**Scope:** Sub-project 1 of 3 in the video-quality initiative. Delivery-side
optimization (Cloudinary transforms) and save/share/export are separate
follow-up specs, in that order.

## Problem

Video quality handling is inconsistent and partly broken today:

1. **Three capture surfaces disagree by accident, not design:**
   - `app/(tabs)/create-post.tsx:463-470, 561-568` — `VideoExportPreset.MediumQuality`, 30s cap
   - `components/StoryCameraButton.tsx:85-91` — forced `H264_960x540` downscale, 60s cap
   - `app/game-details/GameDetailsScreen.tsx:1217-1221` — no preset at all (OS default), 30s cap
2. **Client-side compression is dead code.** `utils/compressVideo.ts` calls
   `react-native-compressor`, but that package is not installed — every call
   silently falls into the catch block and returns the original URI. Only
   create-post even calls it; Stories and GameDetailsScreen skip it entirely.
3. **Live size-limit bug:** client `MAX_VIDEO_SIZE` is 100MB
   (`create-post.tsx:85`) but the server-signed Cloudinary upload enforces
   `max_bytes: 52428800` (50MB) (`server/src/routes/uploads.ts:254`). Videos
   between 50–100MB pass client validation and then fail at Cloudinary.

## Decisions

| Decision | Choice |
|---|---|
| Quality preset | `VideoExportPreset.MediumQuality` everywhere, centralized for a later one-line swap to 1080p |
| Codec | H.264 (implied by MediumQuality; explicit H.264 presets when 1080p upgrade happens) |
| Stories duration cap | 30s (down from 60s) |
| Feed post duration cap | none (was 30s) |
| Game-page story (GameDetailsScreen) duration cap | none (was 30s) — user-confirmed despite being a story flow |
| Client compression | Install `react-native-compressor` for real; wire into all three surfaces |
| Size cap | 150MB, matched client + server |

## Design

### 1. Centralized video capture constants — `constants/video.ts` (new)

```ts
import * as ImagePicker from 'expo-image-picker';

// Single knob for capture quality. Swap to H264_1920x1080 when moving to 1080p.
export const VIDEO_CAPTURE_PRESET = ImagePicker.VideoExportPreset.MediumQuality;

export const STORY_MAX_DURATION_S = 30;      // StoryCameraButton
// Feed posts and game-page stories: no videoMaxDuration (uncapped)

export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024; // 150MB — must equal server max_bytes
```

All three surfaces import from here. No other file hardcodes a preset,
video duration cap, or video size cap.

### 2. Per-surface changes

- **create-post.tsx** (both `launchImageLibraryAsync` and `launchCameraAsync`):
  use `VIDEO_CAPTURE_PRESET`, remove `videoMaxDuration`, drop the `quality`
  float for video paths (it only affects photos once `videoExportPreset` is
  explicit; keeping it is misleading). `MAX_VIDEO_SIZE` const replaced by
  `MAX_VIDEO_SIZE_BYTES` import.
- **StoryCameraButton.tsx**: preset `H264_960x540` → `VIDEO_CAPTURE_PRESET`;
  `videoMaxDuration: 60` → `STORY_MAX_DURATION_S`. Add `compressVideoSafe()`
  call before handing the URI onward (currently no compression here).
- **GameDetailsScreen.tsx** story picker: add
  `videoExportPreset: VIDEO_CAPTURE_PRESET` (currently absent → OS default);
  remove `videoMaxDuration: 30`. Add `compressVideoSafe()` on the video path
  before upload (currently no compression here).

### 3. Real compression

- Add `react-native-compressor` to `package.json` (native module).
- `compressVideoSafe()` keeps its existing contract: dynamic `require`,
  try/catch, return original URI on any failure. This preserves OTA safety for
  binaries that predate the module (same pattern as
  `@react-native-community/netinfo` in `OfflineBanner.tsx`).
- Existing options retained: `compressionMethod: 'auto'`,
  `minimumFileSizeForCompress: 1`.

### 4. Size cap alignment (bug fix)

- Client: `MAX_VIDEO_SIZE_BYTES = 150MB` (was 100MB, `create-post.tsx:85`).
- Server: `maxBytes = '157286400'` in the Cloudinary signature
  (`server/src/routes/uploads.ts:254`, was `'52428800'`).
- Both sides now agree; the signature is the enforcing side.

### 5. Error handling

- Compression failure → fall back to the OS-transcoded original (never block
  the post on compression).
- Post-compression file still > 150MB → client-side error before upload
  attempt: "Video is too large. Try trimming it to a shorter clip." Surfaced
  at the same place the size check already lives in create-post; added to the
  other two surfaces alongside their new compression calls.

## Constraints & deployment notes

- **New native module ⇒ new binary.** `react-native-compressor` requires a
  fresh dev-client build for local testing and an EAS build + App Store
  submission to reach production. The dynamic-require fallback keeps older
  binaries safe if the JS ships via OTA first.
- Server `max_bytes` change deploys via Railway on push to main —
  independent of the client build, and safe to ship first (it only widens the
  accepted range).
- Per repo rules: do not run `eas build`/`eas submit`; provide commands for
  the user.

## Testing & verification

- **Manual, real-device (required — native module + camera):** capture a video
  on each of the three surfaces; confirm output plays, is H.264, and file size
  shrinks after compression; confirm a >50MB video now uploads successfully
  (previously rejected by Cloudinary signature); confirm Stories rejects
  >30s recordings and feed/game-story flows accept longer ones.
- **Automated regression test (new):** assert the client
  `MAX_VIDEO_SIZE_BYTES` equals the server signature's `max_bytes`
  (import both, or contract-test the literal), so the limits cannot silently
  diverge again.
- **Existing suites:** `npx tsc --noEmit` (client + server), client jest, and
  the PR checklist gates.

## Out of scope (later sub-projects)

- Delivery-side Cloudinary transforms for video playback (q_auto, resolution
  ladder) — sub-project 2.
- Save-to-device / share-video-file flows — sub-project 3.
- 1080p preset upgrade — deliberately deferred; single-constant change when
  wanted.
