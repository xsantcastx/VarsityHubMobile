#!/usr/bin/env node

/**
 * Patch lottie-ios Swift files to add @unchecked Sendable conformance
 * This fixes Swift concurrency errors in newer Xcode versions
 */

const fs = require('fs');
const path = require('path');

const lottieBasePath = path.join(__dirname, '..', 'node_modules', 'lottie-ios');
const patches = [
  {
    file: 'Sources/Private/CoreAnimation/Animations/CombinedShapeAnimation.swift',
    pattern: /final class CombinedShapeItem: ShapeItem \{/,
    replacement: 'final class CombinedShapeItem: ShapeItem, @unchecked Sendable {',
  },
  {
    file: 'Sources/Private/Model/Assets/ImageAsset.swift',
    pattern: /public final class ImageAsset: Asset \{/,
    replacement: 'public final class ImageAsset: Asset, @unchecked Sendable {',
  },
  {
    file: 'Sources/Private/Model/Assets/PrecompAsset.swift',
    pattern: /final class PrecompAsset: Asset \{/,
    replacement: 'final class PrecompAsset: Asset, @unchecked Sendable {',
  },
  {
    file: 'Sources/Private/Model/LayerEffects/DropShadowEffect.swift',
    pattern: /final class DropShadowEffect: LayerEffect \{/,
    replacement: 'final class DropShadowEffect: LayerEffect, @unchecked Sendable {',
  },
  {
    file: 'Sources/Private/Model/LayerEffects/EffectValues/ColorEffectValue.swift',
    pattern: /final class ColorEffectValue: EffectValue \{/,
    replacement: 'final class ColorEffectValue: EffectValue, @unchecked Sendable {',
  },
  {
    file: 'Sources/Private/Model/LayerEffects/EffectValues/Vector1DEffectValue.swift',
    pattern: /final class Vector1DEffectValue: EffectValue \{/,
    replacement: 'final class Vector1DEffectValue: EffectValue, @unchecked Sendable {',
  },
  {
    file: 'Sources/Private/Model/Layers/ImageLayerModel.swift',
    pattern: /final class ImageLayerModel: LayerModel \{/,
    replacement: 'final class ImageLayerModel: LayerModel, @unchecked Sendable {',
  },
  {
    file: 'Sources/Private/Model/Layers/PreCompLayerModel.swift',
    pattern: /final class PreCompLayerModel: LayerModel \{/,
    replacement: 'final class PreCompLayerModel: LayerModel, @unchecked Sendable {',
  },
];

let patchedCount = 0;

patches.forEach(({ file, pattern, replacement }) => {
  const fullPath = path.join(lottieBasePath, file);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Skip if already patched
  if (content.includes('@unchecked Sendable')) {
    return;
  }

  if (pattern.test(content)) {
    content = content.replace(pattern, replacement);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Patched: ${file}`);
    patchedCount++;
  } else {
    console.log(`⚠️  Pattern not found in: ${file}`);
  }
});

if (patchedCount > 0) {
  console.log(`\n✅ Successfully patched ${patchedCount} lottie-ios files`);
} else {
  console.log('\n✅ All lottie-ios files are already patched');
}
