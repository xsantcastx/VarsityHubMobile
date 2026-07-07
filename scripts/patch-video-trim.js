#!/usr/bin/env node

/**
 * Patch react-native-video-trim's ffmpeg command construction (iOS + Android).
 *
 * The library places `-to <end>ms` before `-i <input>`, i.e. as an input
 * option. ffmpeg only documents `-to` as an output option ("-to position
 * (output)") — `-ss` and `-t` are input/output, but `-to` before `-i` is
 * not a supported input option and gets silently dropped by some ffmpeg
 * builds, so `trim()`/`showEditor()` report success but the output is the
 * untrimmed (or only start-trimmed) length. Moving `-to` after `-i` (as a
 * proper output option, alongside `-c copy`) fixes this without touching
 * `-ss`, which is valid as an input option.
 */

const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'node_modules', 'react-native-video-trim');
const MARKER = 'VarsityHub-patched: -to moved to output option';

let patchedCount = 0;

function patchFile(relPath, patches) {
  const fullPath = path.join(baseDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`[patch-video-trim] File not found, skipping: ${relPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes(MARKER)) {
    console.log(`[patch-video-trim] Already patched: ${relPath}`);
    return;
  }

  let changed = false;
  for (const { pattern, replacement } of patches) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    } else {
      console.warn(`[patch-video-trim] Pattern not found in ${relPath} — upstream source may have changed`);
    }
  }

  if (changed) {
    content = `// ${MARKER}\n${content}`;
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[patch-video-trim] Patched: ${relPath}`);
    patchedCount++;
  }
}

// iOS: ios/VideoTrim.swift has two ffmpeg command sites (interactive
// showEditor trim, and the promise-based trim() bridge).
patchFile('ios/VideoTrim.swift', [
  {
    pattern:
      /var cmds = \[\n {6}"-ss",\n {6}"\\\(startTime \* 1000\)ms",\n {6}"-to",\n {6}"\\\(endTime \* 1000\)ms",\n {4}\]([\s\S]*?)cmds\.append\(contentsOf: \[\n {6}"-i",\n {6}inputFile\.path,\n {6}"-c",\n {6}"copy",/,
    replacement:
      'var cmds = [\n      "-ss",\n      "\\(startTime * 1000)ms",\n    ]$1cmds.append(contentsOf: [\n      "-i",\n      inputFile.path,\n      "-c",\n      "copy",\n      "-to",\n      "\\(endTime * 1000)ms",',
  },
  {
    pattern:
      /var cmds = \[\n {6}"-ss",\n {6}"\\\(startTime\)ms",\n {6}"-to",\n {6}"\\\(endTime\)ms",\n {4}\]([\s\S]*?)cmds\.append\(contentsOf: \[\n {6}"-i",\n {6}destPath\.path,\n {6}"-c",\n {6}"copy",/,
    replacement:
      'var cmds = [\n      "-ss",\n      "\\(startTime)ms",\n    ]$1cmds.append(contentsOf: [\n      "-i",\n      destPath.path,\n      "-c",\n      "copy",\n      "-to",\n      "\\(endTime)ms",',
  },
]);

// Android: BaseVideoTrimModule.kt (promise-based trim() bridge)
patchFile('android/src/main/java/com/videotrim/BaseVideoTrimModule.kt', [
  {
    pattern:
      /var cmds = arrayOf\(\n {6}"-ss",\n {6}"\$\{startTime\}ms",\n {6}"-to",\n {6}"\$\{endTime\}ms",\n {4}\)([\s\S]*?)cmds \+= arrayOf\(\n {6}"-i",\n {6}url,\n {6}"-c",\n {6}"copy",/,
    replacement:
      'var cmds = arrayOf(\n      "-ss",\n      "${startTime}ms",\n    )$1cmds += arrayOf(\n      "-i",\n      url,\n      "-c",\n      "copy",\n      "-to",\n      "${endTime}ms",',
  },
]);

// Android: VideoTrimmerUtil.java (interactive showEditor path)
patchFile('android/src/main/java/com/videotrim/utils/VideoTrimmerUtil.java', [
  {
    pattern:
      /cmds\.add\("-ss"\);\n {4}cmds\.add\(startMs \+ "ms"\);\n {4}cmds\.add\("-to"\);\n {4}cmds\.add\(endMs \+ "ms"\);([\s\S]*?)cmds\.add\("-i"\);\n {4}cmds\.add\(inputFile\);\n {4}cmds\.add\("-c"\);\n {4}cmds\.add\("copy"\);/,
    replacement:
      'cmds.add("-ss");\n    cmds.add(startMs + "ms");$1cmds.add("-i");\n    cmds.add(inputFile);\n    cmds.add("-c");\n    cmds.add("copy");\n    cmds.add("-to");\n    cmds.add(endMs + "ms");',
  },
]);

if (patchedCount > 0) {
  console.log(`[patch-video-trim] Successfully patched ${patchedCount} file(s)`);
} else {
  console.log('[patch-video-trim] Nothing to do (already patched or files missing)');
}
