// Patch expo-router Sitemap.js to remove shadow* and elevation on web
// so react-native-web does not emit deprecation warnings.
// Safe to run multiple times.

const fs = require('fs');
const path = require('path');

const sitemapTarget = path.join(__dirname, '..', '..', 'node_modules', 'expo-router', 'build', 'views', 'Sitemap.js');
const tutorialTarget = path.join(__dirname, '..', '..', 'node_modules', 'expo-router', 'build', 'onboard', 'Tutorial.js');

try {
  // Patch Sitemap.js
  if (!fs.existsSync(sitemapTarget)) {
    console.log('[patch-router-sitemap] Sitemap target not found, skipping:', sitemapTarget);
  } else {
    let src = fs.readFileSync(sitemapTarget, 'utf8');
    const before = src;

    // Remove individual shadow/elevation lines in styles.header
    src = src.replace(/\n\s*shadowColor:\s*['\"][^'\"]+['\"],?/g, '\n');
    src = src.replace(/\n\s*shadowOffset:\s*\{[^}]*\},?/g, '\n');
    src = src.replace(/\n\s*shadowOpacity:\s*[^,]+,?/g, '\n');
    src = src.replace(/\n\s*shadowRadius:\s*[^,]+,?/g, '\n');
    src = src.replace(/\n\s*elevation:\s*[^,]+,?/g, '\n');

    // Remove problematic image require() calls that reference missing assets
    src = src.replace(/return <react_native_1\.Image style=\{styles\.image\} source=\{require\(['"]expo-router\/assets\/pkg\.png['"]\)\}\/>;/g, 'return null;');
    src = src.replace(/return <react_native_1\.Image style=\{styles\.image\} source=\{require\(['"]expo-router\/assets\/forward\.png['"]\)\}\/>;/g, 'return null;');

    if (src !== before) {
      fs.writeFileSync(sitemapTarget, src, 'utf8');
      console.log('[patch-router-sitemap] Patched Sitemap.js');
    } else {
      console.log('[patch-router-sitemap] Sitemap.js - no changes needed');
    }
  }

  // Patch Tutorial.js to remove missing asset
  if (!fs.existsSync(tutorialTarget)) {
    console.log('[patch-router-sitemap] Tutorial target not found, skipping:', tutorialTarget);
  } else {
    let tutSrc = fs.readFileSync(tutorialTarget, 'utf8');
    const tutBefore = tutSrc;

    // Remove the logotype image require - replace with null
    tutSrc = tutSrc.replace(
      /<react_native_1\.Image style=\{styles\.logotype\} source=\{require\(['"]expo-router\/assets\/logotype\.png['"]\)\}\/>/g,
      '<react_native_1.View style={styles.logotype} />'
    );

    if (tutSrc !== tutBefore) {
      fs.writeFileSync(tutorialTarget, tutSrc, 'utf8');
      console.log('[patch-router-sitemap] Removed logotype image from Tutorial');
    } else {
      console.log('[patch-router-sitemap] Tutorial.js - no changes needed');
    }
  }
} catch (err) {
  console.warn('[patch-router-sitemap] Failed to patch:', err.message);
}

