const GAME_CARD_GRADIENTS: [string, string][] = [
  ['#1e293b', '#0f172a'],
  ['#0f172a', '#1e293b'],
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getDeterministicGameCardGradient(
  gameId: string | number | null | undefined,
  title?: string | null
): [string, string] {
  const seed = String(gameId ?? title ?? 'varsityhub-game-card');
  return GAME_CARD_GRADIENTS[hashSeed(seed) % GAME_CARD_GRADIENTS.length];
}

/** Accepts `#RGB` / `#RRGGBB`, returns a normalized `#RRGGBB` or null. */
function normalizeHex(color?: string | null): string | null {
  if (!color) return null;
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3)
    hex = hex
      .split('')
      .map(c => c + c)
      .join('');
  return `#${hex.toLowerCase()}`;
}

/** Darken a hex color by `amount` (0–1) — used to pair a lone team color. */
function darken(hex: string, amount = 0.45): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * (1 - amount));
  const g = Math.round(((n >> 8) & 0xff) * (1 - amount));
  const b = Math.round((n & 0xff) * (1 - amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Branded gradient for a pro game from its two teams' accent colors, so a
 * banner-less pro card reads as intentional instead of an empty dark box. Falls
 * back to null (→ deterministic gradient) when neither color is a valid hex.
 * Pro teams carry no logos (trademark), so color is the only brand signal.
 */
export function proGameCardGradient(
  homeColor?: string | null,
  awayColor?: string | null
): [string, string] | null {
  const a = normalizeHex(awayColor);
  const b = normalizeHex(homeColor);
  if (a && b) return [a, b];
  if (b) return [darken(b), b];
  if (a) return [a, darken(a)];
  return null;
}

/**
 * Google Static Maps image of a pro game's home stadium (hybrid = satellite
 * imagery + labels, so the actual ballpark is recognizable from above). Used as
 * the pro card backdrop — the real "stadium preview". Returns null when coords
 * are missing or the maps key isn't configured, so the caller falls back to the
 * team-color gradient. Requires the "Maps Static API" to be enabled on
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY; if it isn't, the image 404s and the card
 * gracefully shows the gradient instead.
 */
export function stadiumMapImageUrl(lat?: number | null, lng?: number | null): string | null {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const center = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${center}` +
    `&zoom=16&size=640x360&scale=2&maptype=hybrid` +
    `&markers=color:0xEF4444%7C${center}&key=${key}`
  );
}
