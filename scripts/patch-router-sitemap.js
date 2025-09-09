// Patch expo-router Sitemap.js to remove shadow* and elevation on web
// so react-native-web does not emit deprecation warnings.
// Safe to run multiple times.

const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'expo-router', 'build', 'views', 'Sitemap.js');

try {
  if (!fs.existsSync(target)) {
    console.log('[patch-router-sitemap] Target not found, skipping:', target);
    process.exit(0);
  }
  let src = fs.readFileSync(target, 'utf8');
  const before = src;

  // Remove individual shadow/elevation lines in styles.header
  src = src.replace(/\n\s*shadowColor:\s*['\"][^'\"]+['\"],?/g, '\n');
  src = src.replace(/\n\s*shadowOffset:\s*\{[^}]*\},?/g, '\n');
  src = src.replace(/\n\s*shadowOpacity:\s*[^,]+,?/g, '\n');
  src = src.replace(/\n\s*shadowRadius:\s*[^,]+,?/g, '\n');
  src = src.replace(/\n\s*elevation:\s*[^,]+,?/g, '\n');

  if (src !== before) {
    fs.writeFileSync(target, src, 'utf8');
    console.log('[patch-router-sitemap] Patched expo-router Sitemap.js to remove shadows');
  } else {
    console.log('[patch-router-sitemap] No changes needed');
  }
} catch (err) {
  console.warn('[patch-router-sitemap] Failed to patch:', err.message);
}

