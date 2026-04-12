import net from 'node:net';

function normalizeHostname(rawHostname: string): string {
  const hostname = rawHostname.trim().toLowerCase();
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

function isBlockedHostname(hostname: string): boolean {
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.localdomain')) return true;
  if (hostname.endsWith('.internal') || hostname.endsWith('.home.arpa')) return true;
  return false;
}

function isPrivateOrReservedIPv4(hostname: string): boolean {
  const octets = hostname.split('.').map(part => Number.parseInt(part, 10));
  if (
    octets.length !== 4 ||
    octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b] = octets;
  if (a === 0) return true; // unspecified
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true; // IETF protocol assignments incl 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark testing
  if (a === 198 && b === 51) return true; // TEST-NET-2
  if (a === 203 && b === 0) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateOrReservedIPv6(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
  if (normalized.startsWith('ff')) return true; // multicast
  if (normalized.startsWith('2001:db8:')) return true; // documentation
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (net.isIP(mapped) === 4) {
      return isPrivateOrReservedIPv4(mapped);
    }
  }
  return false;
}

export function isPublicHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;

    const hostname = normalizeHostname(url.hostname);
    if (isBlockedHostname(hostname)) return false;

    const ipVersion = net.isIP(hostname);
    if (ipVersion === 4) return !isPrivateOrReservedIPv4(hostname);
    if (ipVersion === 6) return !isPrivateOrReservedIPv6(hostname);

    return true;
  } catch {
    return false;
  }
}
