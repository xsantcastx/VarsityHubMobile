Find and fix all hardcoded dark text colors in the specified file or directory.

Search for these violations:
- #000, #111, #222, #333, #374151, #111827, #1a1a, black
- In text color contexts (color:, style={{ color:)
- Exclude: backgroundColor, borderColor, overlay/shadow contexts, intentional dark backgrounds

For each hit show: file, line number, current color, and what it should be replaced with using useColorScheme().

The app uses useColorScheme() from @/hooks/useColorScheme. Text colors must adapt:
- Light mode text: use theme-aware values
- Dark mode text: automatically handled by the hook

Fix all violations found. If the file doesn't already import useColorScheme, add the import and hook call.

$ARGUMENTS
