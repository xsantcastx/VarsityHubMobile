import type { Request } from 'express';

const DEVICE_ID_HEADER = 'x-varsityhub-device-id';
const DEVICE_ID_PREFIX = 'vh1:';
const USER_AGENT_PREFIX = 'ua:';
const MAX_USER_AGENT_LENGTH = 255;

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

export function getRequestDeviceId(req: Request): string | null {
  const raw = firstHeaderValue(req.headers[DEVICE_ID_HEADER])?.trim() ?? '';
  if (!raw) return null;
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(raw)) return null;
  return raw;
}

export function getRequestUserAgent(req: Request): string | null {
  const raw = firstHeaderValue(req.headers['user-agent'])?.trim() ?? '';
  if (!raw) return null;
  return raw.slice(0, MAX_USER_AGENT_LENGTH);
}

export function buildSessionFingerprint(req: Request): string | null {
  const deviceId = getRequestDeviceId(req);
  if (deviceId) return `${DEVICE_ID_PREFIX}${deviceId}`;

  const userAgent = getRequestUserAgent(req);
  return userAgent ? `${USER_AGENT_PREFIX}${userAgent}` : null;
}

export function verifyStoredSessionFingerprint(
  storedFingerprint: string | null | undefined,
  req: Request
): {
  matches: boolean;
  enforce: boolean;
  currentFingerprint: string | null;
  storedFingerprintType: 'missing' | 'device_id' | 'legacy';
  reason:
    | 'missing_stored'
    | 'device_id_match'
    | 'device_id_mismatch'
    | 'device_id_missing'
    | 'legacy_match'
    | 'legacy_mismatch'
    | 'legacy_missing_current';
} {
  if (!storedFingerprint) {
    return {
      matches: true,
      enforce: false,
      currentFingerprint: buildSessionFingerprint(req),
      storedFingerprintType: 'missing',
      reason: 'missing_stored',
    };
  }

  if (storedFingerprint.startsWith(DEVICE_ID_PREFIX)) {
    const deviceId = getRequestDeviceId(req);
    const currentFingerprint = deviceId ? `${DEVICE_ID_PREFIX}${deviceId}` : null;
    if (!currentFingerprint) {
      return {
        matches: false,
        enforce: true,
        currentFingerprint: null,
        storedFingerprintType: 'device_id',
        reason: 'device_id_missing',
      };
    }
    return {
      matches: storedFingerprint === currentFingerprint,
      enforce: true,
      currentFingerprint,
      storedFingerprintType: 'device_id',
      reason: storedFingerprint === currentFingerprint ? 'device_id_match' : 'device_id_mismatch',
    };
  }

  const userAgent = getRequestUserAgent(req);
  const currentFingerprint = userAgent ? `${USER_AGENT_PREFIX}${userAgent}` : null;
  if (!userAgent) {
    return {
      matches: true,
      enforce: false,
      currentFingerprint: null,
      storedFingerprintType: 'legacy',
      reason: 'legacy_missing_current',
    };
  }

  const storedLegacyValue = storedFingerprint.startsWith(USER_AGENT_PREFIX)
    ? storedFingerprint.slice(USER_AGENT_PREFIX.length)
    : storedFingerprint;
  const matches = storedLegacyValue === userAgent;
  return {
    matches,
    enforce: false,
    currentFingerprint,
    storedFingerprintType: 'legacy',
    reason: matches ? 'legacy_match' : 'legacy_mismatch',
  };
}
