# Development Tools

This folder contains development utilities, patches, and compatibility fixes for the VarsityHub project.

## Folder Structure

### 📁 patches/
React Native and Expo compatibility patches.

- **`patch-logbox-all.js`** - Comprehensive LogBox patches
- **`patch-logbox-button.js`** - LogBox button styling fixes  
- **`patch-logbox-data.js`** - LogBox data handling patches
- **`patch-router-sitemap.js`** - Expo Router sitemap patches

### 📁 shims/
Compatibility shims for third-party packages.

- **`is-arrayish.js`** - Array detection compatibility shim

### 🛠️ Utility Scripts

- **`ensure-debug-index.js`** - Ensures debug index files exist
- **`ensure-is-arrayish.js`** - Ensures arrayish compatibility
- **`ensure-simple-swizzle.js`** - Ensures swizzle compatibility
- **`reset-project.js`** - Resets project to clean state

### 🐍 Python Scripts
Legacy utility scripts for code transformation.

- **`fix_entities_indentation.py`** - Fixes code indentation
- **`update_entities_game_votes.py`** - Updates entity voting code
- **`update_games_routes_votes.py`** - Updates game routes
- **`update_http_delete.py`** - Updates HTTP DELETE methods

## Usage

Most patch scripts are automatically applied during build. Manual usage:

```bash
# Apply patches
node tools/patches/patch-logbox-all.js

# Reset project
node tools/reset-project.js

# Python utilities (legacy)
python tools/fix_entities_indentation.py
```

## Notes

- Patch scripts modify node_modules - may need reapplication after installs
- Python scripts are legacy - consider migrating to Node.js
- Ensure scripts are for development environment only