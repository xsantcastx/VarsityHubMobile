// Apply patches/*.patch via patch-package (currently react-native-video-trim's
// ffmpeg corrections: -y overwrite, -t duration instead of input-side -to,
// ms-resolution output names — upstream 6.0.13 does NOT have these; verified
// against the pristine npm tarball 2026-07-15).
//
// MUST NOT hard-fail: this runs in postinstall, and a non-zero exit fails
// `npm ci` and therefore every EAS build (this exact outage happened when
// the old scripts/patch-video-trim.js threw on upstream drift — see f6d7fcc6).
// If a patch stops applying (e.g. the dep version is bumped), warn loudly and
// exit 0; the real gate is
// components/__tests__/video-trim-native-patch.contract.test.ts, which fails
// in CI and names the fix without bricking releases.
const { spawnSync } = require('child_process');

const result = spawnSync('npx', ['patch-package'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.warn(
    '[apply-patches] WARNING: patch-package failed (upstream drift?). ' +
      'Native patches were NOT applied — the video-trim contract test will fail in CI. ' +
      'Re-generate patches/ against the installed version instead of shipping unpatched.'
  );
}
process.exit(0);
