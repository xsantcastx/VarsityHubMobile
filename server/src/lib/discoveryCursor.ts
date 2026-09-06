import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type DiscoveryPosition = { date: string; id: string };
export type DiscoveryCursor = {
  version: 1;
  anchor: string;
  fingerprint: string;
  games: DiscoveryPosition | null;
  events: DiscoveryPosition | null;
};

export class InvalidDiscoveryCursor extends Error {
  constructor() {
    super('Invalid or expired discovery cursor. Refresh to continue.');
  }
}

function key() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for discovery pagination');
  return createHash('sha256').update(`event-discovery-v1:${secret}`).digest();
}

// Encrypt as well as authenticate: continuation positions can refer to private
// candidates skipped by authorization and must not expose their IDs to viewers.
export function encodeDiscoveryCursor(cursor: DiscoveryCursor): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(cursor)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function decodeDiscoveryCursor(
  value: string,
  fingerprint: string,
  now: Date
): DiscoveryCursor {
  try {
    if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const bytes = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const cursor = JSON.parse(
      Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()
    );
    const age = now.getTime() - Date.parse(cursor.anchor);
    if (
      cursor.version !== 1 ||
      cursor.fingerprint !== fingerprint ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > 15 * 60_000
    )
      throw new Error();
    for (const position of [cursor.games, cursor.events]) {
      if (
        position !== null &&
        (!position ||
          typeof position.id !== 'string' ||
          position.id.length > 200 ||
          !Number.isFinite(Date.parse(position.date)))
      )
        throw new Error();
    }
    return cursor;
  } catch {
    throw new InvalidDiscoveryCursor();
  }
}

export function discoveryAfter(position?: DiscoveryPosition | null) {
  return position
    ? {
        OR: [
          { date: { gt: new Date(position.date) } },
          { date: new Date(position.date), id: { gt: position.id } },
        ],
      }
    : {};
}
