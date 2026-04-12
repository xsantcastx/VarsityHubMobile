/**
 * Deep Linking Handler
 *
 * Parses incoming deep links and universal links, routing users
 * to the appropriate screen in the app.
 *
 * Supports:
 * - varsityhubmobile://post/123
 * - varsityhubmobile://game/456
 * - varsityhubmobile://team/789
 * - varsityhubmobile://profile/abc
 * - https://varsityhub.app/posts/123
 * - https://varsityhub.com/share?type=post&id=123
 *
 * @module utils/deepLinks
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { getConfig } from '@/config/env';

// App scheme and web domain (must match app.json scheme and shared URLs)
const APP_SCHEME = getConfig().appScheme || 'varsityhubmobile';
const WEB_DOMAINS = [
  'varsityhub.com',
  'www.varsityhub.com',
  'varsityhub.app',
  'www.varsityhub.app',
];

/**
 * Parsed deep link result
 */
interface ParsedDeepLink {
  screen: string;
  params: Record<string, string>;
  source?: 'scheme' | 'universal' | 'unknown';
  utmParams?: Record<string, string>;
}

/**
 * Route mappings from content type to screen path
 */
const ROUTE_MAP: Record<string, string> = {
  post: '/post-detail',
  posts: '/post-detail', // /posts/:id (web URL format)
  game: '/game-detail',
  event: '/event-detail',
  team: '/team-profile',
  'team-profile': '/team-profile',
  'team-page': '/team-profile',
  profile: '/user-profile',
  user: '/user-profile',
  'user-profile': '/user-profile',
  invites: '/team-invites',
  'team-invites': '/team-invites',
  'payment-success': '/payment-success',
  'payment-cancel': '/payment-cancel',
  // Auth-related routes
  'reset-password': '/reset-password',
  'verify-email': '/verify-email',
  verify: '/verify',
};

function extractStringParams(
  queryParams?: Linking.ParsedURL['queryParams']
): Record<string, string> {
  const params: Record<string, string> = {};
  if (!queryParams) return params;

  for (const [key, value] of Object.entries(queryParams)) {
    if (typeof value === 'string') params[key] = value;
  }

  return params;
}

/**
 * Parse a deep link URL into screen and params
 */
export function parseDeepLink(url: string): ParsedDeepLink | null {
  try {
    const parsed = Linking.parse(url);

    // App scheme: varsityhubmobile://post/123
    if (parsed.scheme === APP_SCHEME) {
      return parseSchemeLink(parsed);
    }

    // Universal link on one of our domains: https://varsityhub.app/...
    if (parsed.scheme === 'https' || parsed.scheme === 'http') {
      if (!parsed.hostname || !WEB_DOMAINS.includes(parsed.hostname)) {
        console.warn('[DeepLinks] Rejected link from untrusted host:', parsed.hostname);
        return null;
      }
      return parseUniversalLink(parsed);
    }

    // Anything else — including schemeless paths or exotic schemes like
    // `javascript:` / `data:` — is rejected. The previous fall-through to
    // parsePathLink was a phishing vector: a malicious page could hand the
    // app a URL that pattern-matched a known route and bypass every other
    // check. Fail closed.
    console.warn('[DeepLinks] Rejected link with untrusted scheme:', parsed.scheme);
    return null;
  } catch (error) {
    console.error('[DeepLinks] Parse error:', error);
    return null;
  }
}

/**
 * Parse app scheme link (varsityhub://type/id)
 */
function parseSchemeLink(parsed: Linking.ParsedURL): ParsedDeepLink | null {
  const pathParts = parsed.path?.split('/').filter(Boolean) || [];

  if (pathParts.length === 1) {
    const [type] = pathParts;
    const screen = ROUTE_MAP[type];
    if (!screen) {
      console.warn('[DeepLinks] Unknown content type:', type);
      return null;
    }
    return {
      screen,
      params: extractStringParams(parsed.queryParams),
      source: 'scheme',
    };
  }

  if (pathParts.length < 2) {
    return null;
  }

  const [type, id] = pathParts;
  const screen = ROUTE_MAP[type];

  if (!screen) {
    console.warn('[DeepLinks] Unknown content type:', type);
    return null;
  }

  return {
    screen,
    params: { id },
    source: 'scheme',
  };
}

/**
 * Parse universal link (https://varsityhub.com/share?type=post&id=123)
 */
function parseUniversalLink(parsed: Linking.ParsedURL): ParsedDeepLink | null {
  const queryParams = parsed.queryParams || {};

  // Handle /share endpoint
  if (parsed.path?.startsWith('/share')) {
    const type = queryParams.type as string;
    const id = queryParams.id as string;

    if (!type || !id) {
      console.warn('[DeepLinks] Missing type or id in share link');
      return null;
    }

    const screen = ROUTE_MAP[type];
    if (!screen) {
      console.warn('[DeepLinks] Unknown content type:', type);
      return null;
    }

    // Extract UTM parameters
    const utmParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (key.startsWith('utm_') && typeof value === 'string') {
        utmParams[key] = value;
      }
    }

    return {
      screen,
      params: { id },
      source: 'universal',
      utmParams: Object.keys(utmParams).length > 0 ? utmParams : undefined,
    };
  }

  // Handle direct path links (/post/123, /game/456, etc.)
  return parsePathLink(parsed);
}

/**
 * Parse path-based link (/post/123)
 */
function parsePathLink(parsed: Linking.ParsedURL): ParsedDeepLink | null {
  const pathParts = parsed.path?.split('/').filter(Boolean) || [];

  if (pathParts.length === 1) {
    const [type] = pathParts;
    const screen = ROUTE_MAP[type];
    if (!screen) return null;
    return {
      screen,
      params: extractStringParams(parsed.queryParams),
      source: 'unknown',
    };
  }

  if (pathParts.length < 2) {
    return null;
  }

  const [type, id] = pathParts;
  const screen = ROUTE_MAP[type];

  if (!screen) {
    return null;
  }

  return {
    screen,
    params: { id },
    source: 'unknown',
  };
}

/**
 * Handle a deep link by navigating to the appropriate screen
 */
export function handleDeepLink(url: string): boolean {
  const parsed = parseDeepLink(url);

  if (!parsed) {
    console.log('[DeepLinks] Could not parse URL:', url);
    return false;
  }

  console.log('[DeepLinks] Navigating to:', parsed.screen, parsed.params);

  // Log UTM params for analytics if present
  if (parsed.utmParams) {
    console.log('[DeepLinks] UTM params:', parsed.utmParams);
    // TODO: Send to analytics service
  }

  try {
    router.push({
      pathname: parsed.screen as any,
      params: parsed.params,
    });
    return true;
  } catch (error) {
    console.error('[DeepLinks] Navigation failed:', error);
    return false;
  }
}

/**
 * Setup deep link listener for when app is already open
 */
export function setupDeepLinkListener(
  onLink?: (url: string, parsed: ParsedDeepLink | null) => void
): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    console.log('[DeepLinks] Received URL while app is open:', url);
    const parsed = parseDeepLink(url);

    if (onLink) {
      onLink(url, parsed);
    } else {
      handleDeepLink(url);
    }
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Check for initial URL when app launches from deep link
 */
export async function handleInitialDeepLink(
  onLink?: (url: string, parsed: ParsedDeepLink | null) => void
): Promise<boolean> {
  try {
    const url = await Linking.getInitialURL();

    if (url) {
      console.log('[DeepLinks] App launched with URL:', url);
      const parsed = parseDeepLink(url);

      if (onLink) {
        onLink(url, parsed);
        return true;
      } else {
        return handleDeepLink(url);
      }
    }

    return false;
  } catch (error) {
    console.error('[DeepLinks] Error getting initial URL:', error);
    return false;
  }
}

/**
 * Validate if a URL is a valid VarsityHub deep link
 */
export function isValidDeepLink(url: string): boolean {
  const parsed = parseDeepLink(url);
  return parsed !== null;
}

/**
 * Get the content type from a deep link URL
 */
export function getContentTypeFromUrl(url: string): string | null {
  const parsed = parseDeepLink(url);
  if (!parsed) return null;

  // Reverse lookup the type from the screen path
  for (const [type, screen] of Object.entries(ROUTE_MAP)) {
    if (screen === parsed.screen) {
      return type;
    }
  }

  return null;
}

export { APP_SCHEME, ROUTE_MAP, WEB_DOMAINS, type ParsedDeepLink };
