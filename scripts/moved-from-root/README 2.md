# Scripts Moved From Root Directory

This directory contains shell scripts (`.sh`) and JavaScript modules (`.mjs`) that were moved from the root directory to improve organization.

**Date:** January 12, 2025  
**Reason:** Clean up root directory clutter for better code organization

## Contents

All `.sh` and `.mjs` files from the root directory have been moved here.

## Usage

To run these scripts, use:
```bash
# From project root
./scripts/moved-from-root/script-name.sh

# Or navigate to the directory
cd scripts/moved-from-root
./script-name.sh
```

## Important Notes

- Scripts in `scripts/` (main scripts directory) take precedence
- Some scripts may need path updates if they reference files by relative paths
- Check `package.json` scripts section for npm commands that wrap these scripts
