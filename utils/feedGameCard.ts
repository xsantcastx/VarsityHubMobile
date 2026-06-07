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
