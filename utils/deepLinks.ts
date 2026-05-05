/**
 * Deep Linking Handler
 *
 * Parses incoming deep links and universal links, routing users
 * to the appropriate screen in the app.
 *
 * SECURITY: Deep links to protected screens (posts, games, teams, profiles)
 * are deferred until AuthProvider confirms the user is authenticated and
 * has completed onboarding. Only public routes (verify, reset-password)
 * navigate immediately.
 *
 * Supports:
 * - varsityhubmobile://post/123
 * - varsityhubmobile://game/456
 * - varsityhubmobile://team/789
 * - varsityhubmobile://profile/abc
 * - https://varsityhub.app/posts/123
 * - https://varsityhub.app/share?type=post&id=123
 *
 * @module utils/deepLinks
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { getConfig } from '@/config/env';

// App scheme and web domain (must match app.json scheme and shared URLs)
const APP_SCHEME = getConfig().appScheme || 'varsityhubmobile';
const WEB_DOMAINS = [
  'varsityhub.app',
  'www.varsityhub.app',
  'app.varsityhub.app',
  'varsityhub.com',
  'www.varsityhub.com',
];

// Routes that don't require authentication — safe to navigate immediately
const PUBLIC_DEEP_LINK_ROUTES = new Set([
  '/reset-password',
  '/verify',
  '/verify-email',
  '/payment-success',
  '/payment-cancel',
  '/organizations/[id]',
]);

// Pending deep link URL — deferred until auth settles. Stored with a
// timestamp so a URL the user set 20 minutes ago (e.g., set during a
// payment-success → sign-in flow they then abandoned) doesn't get
// silently consumed by an unrelated later auth event.
let _pendingDeepLinkUrl: string | null = null;
let _pendingDeepLinkSetAt = 0;
const PENDING_DEEP_LINK_TTL_MS = 5 * 60 * 1000;
const devConsole = globalThis.console;

const deepLinkLog = (...args: unknown[]) => {
  if (__DEV__) {
    devConsole.log(...args);
  }
};

const deepLinkWarn = (...args: unknown[]) => {
  if (__DEV__) {
    devConsole.warn(...args);
  }
};

const deepLinkError = (...args: unknown[]) => {
  if (__DEV__) {
    devConsole.error(...args);
  }
};

/** Validate deep link ID — alphanumeric, dash, underscore; 3–64 chars (cuid/uuid compatible) */
function isValidDeepLinkId(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  return trimmed.length >= 3 && trimmed.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/** Store a deep link to be processed after auth completes */
export function setPendingDeepLink(url: string) {
  _pendingDeepLinkUrl = url;
  _pendingDeepLinkSetAt = Date.now();
}

/**
 * Get and clear the pending deep link. Returns null if the stored URL
 * is older than PENDING_DEEP_LINK_TTL_MS — e.g., a payment-success
 * recovery URL the user set then abandoned, which would otherwise
 * fire on the next unrelated auth completion event.
 */
export function consumePendingDeepLink(): string | null {
  const url = _pendingDeepLinkUrl;
  const setAt = _pendingDeepLinkSetAt;
  _pendingDeepLinkUrl = null;
  _pendingDeepLinkSetAt = 0;
  if (!url) return null;
  if (Date.now() - setAt > PENDING_DEEP_LINK_TTL_MS) {
    deepLinkLog('[DeepLinks] Discarding stale pending URL (>5min old)');
    return null;
  }
  return url;
}

/** Check if a parsed deep link points to a public (no-auth) route */
function isPublicRoute(parsed: ParsedDeepLink | null): boolean {
  if (!parsed) return false;
  return PUBLIC_DEEP_LINK_ROUTES.has(parsed.screen);
}

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
  games: '/game-detail', // /games/:id matches the server's shareLanding plural form
  event: '/event-detail',
  events: '/event-detail', // /events/:id (server + email links)
  team: '/team-page',
  teams: '/team-page', // /teams/:id (server + share URLs)
  organizations: '/organizations/[id]', // /organizations/:id public org pages
  profile: '/user-profile',
  user: '/user-profile',
  users: '/user-profile', // /users/:id (server's plural form)
  // Auth-related routes
  'reset-password': '/reset-password',
  'verify-email': '/verify',
  'verify': '/verify',
  // Onboarding continuation (after coach approval)
  'onboarding': '/onboarding',
  'approvals': '/organization',
  'admin-dashboard': '/admin-dashboard',
  'admin-ads': '/admin-ads',
  'event-approvals': '/event-approvals',
  'organization': '/organization',
  'organization-join-requests': '/organization-join-requests',
  'organization-invites': '/organization-invites',
  'team-hub': '/organization',
  'create-fan-event': '/create-fan-event',
  'event-detail': '/event-detail',
  'settings': '/settings',
  'manage-subscription': '/settings/manage-subscription',
  // Multi-segment routes without a resource ID (e.g., billing emails link to /settings/manage-subscription directly)
  'settings/manage-subscription': '/settings/manage-subscription',
  // Payment redirect routes
  'payment-success': '/payment-success',
  'payment-cancel': '/payment-cancel',
  // Invite deep links
  'join/org': '/organization-invites',
  'join/team': '/team-invites',
};

// These route keys represent exact destinations, not resource collections.
// They must never fall through to the generic `type/:id` parser.
const EXACT_MATCH_ROUTE_KEYS = new Set([
  'reset-password',
  'verify-email',
  'verify',
  'onboarding',
  'approvals',
  'admin-dashboard',
  'admin-ads',
  'event-approvals',
  'organization',
  'organization-join-requests',
  'organization-invites',
  'team-hub',
  'create-fan-event',
  'event-detail',
  'settings',
  'payment-success',
  'payment-cancel',
]);

const DEFAULT_ROUTE_PARAMS: Record<string, Record<string, string>> = {
  approvals: { tab: 'requests' },
  'team-hub': { tab: 'teams' },
};

function buildRouteParams(type: string, queryParams: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {
    ...(DEFAULT_ROUTE_PARAMS[type] || {}),
  };
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
    
    // Handle app scheme links (varsityhub://post/123)
    if (parsed.scheme === APP_SCHEME) {
      return parseSchemeLink(parsed);
    }
    
    // Handle universal links (https://varsityhub.app/share?...)
    if (parsed.scheme === 'https' || parsed.scheme === 'http') {
      if (parsed.hostname && WEB_DOMAINS.includes(parsed.hostname)) {
        return parseUniversalLink(parsed);
      }
    }
    
    // Try parsing as relative path
    if (parsed.path) {
      return parsePathLink(parsed);
    }
    
    deepLinkWarn('[DeepLinks] Unable to parse URL:', url);
    return null;
  } catch (error) {
    deepLinkError('[DeepLinks] Parse error:', error);
    return null;
  }
}

/**
 * Parse app scheme link (varsityhub://type/id)
 */
function parseSchemeLink(parsed: Linking.ParsedURL): ParsedDeepLink | null {
  const pathParts = parsed.path?.split('/').filter(Boolean) || [];
  const queryParams = parsed.queryParams || {};

  // Handle single-segment routes where params come from query string
  // e.g., varsityhubmobile://reset-password?code=123456&email=user@example.com
  // or varsityhubmobile://admin-dashboard?coach_id=123&action=approve
  if (pathParts.length === 1) {
    const type = pathParts[0];
    const screen = ROUTE_MAP[type];
    if (screen) {
      const params = buildRouteParams(type, queryParams);
      return { screen, params, source: 'scheme' };
    }
    deepLinkWarn('[DeepLinks] Single-segment path not a known route:', pathParts[0]);
    return null;
  }

  if (pathParts.length < 2) {
    return null;
  }

  // Multi-segment routes that have NO resource ID — same handling as the path-link parser.
  const wholePathKey = pathParts.join('/');
  if (ROUTE_MAP[wholePathKey]) {
    const params = buildRouteParams(wholePathKey, queryParams);
    return { screen: ROUTE_MAP[wholePathKey], params, source: 'scheme' };
  }

  // Support multi-segment types like 'join/org' (3 parts: join, org, id)
  let type: string;
  let id: string;
  const twoSegmentType = pathParts.length >= 3 ? `${pathParts[0]}/${pathParts[1]}` : '';
  if (twoSegmentType && ROUTE_MAP[twoSegmentType]) {
    type = twoSegmentType;
    id = pathParts[2];
  } else {
    type = pathParts[0];
    if (EXACT_MATCH_ROUTE_KEYS.has(type)) {
      deepLinkWarn('[DeepLinks] Exact-match route cannot consume an ID:', type);
      return null;
    }
    id = pathParts[1];
  }
  const screen = ROUTE_MAP[type];

  if (!screen) {
    deepLinkWarn('[DeepLinks] Unknown content type:', type);
    return null;
  }
  if (!isValidDeepLinkId(id)) {
    deepLinkWarn('[DeepLinks] Invalid ID format:', type);
    return null;
  }

  return {
    screen,
    params: { id },
    source: 'scheme',
  };
}

/**
 * Parse universal link (https://varsityhub.app/share?type=post&id=123)
 */
function parseUniversalLink(parsed: Linking.ParsedURL): ParsedDeepLink | null {
  const queryParams = parsed.queryParams || {};
  
  // Handle /share endpoint
  if (parsed.path?.startsWith('/share')) {
    const type = queryParams.type as string;
    const id = queryParams.id as string;
    
    if (!type || !id) {
      deepLinkWarn('[DeepLinks] Missing type or id in share link');
      return null;
    }
    
    const screen = ROUTE_MAP[type];
    if (!screen) {
      deepLinkWarn('[DeepLinks] Unknown content type:', type);
      return null;
    }
    if (!isValidDeepLinkId(id)) {
      deepLinkWarn('[DeepLinks] Invalid ID format in share link:', type);
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
  const pathLink = parsePathLink(parsed);
  return pathLink ? { ...pathLink, source: 'universal' } : null;
}

/**
 * Parse path-based link (/post/123)
 */
function parsePathLink(parsed: Linking.ParsedURL): ParsedDeepLink | null {
  const pathParts = parsed.path?.split('/').filter(Boolean) || [];
  const queryParams = parsed.queryParams || {};

  if (pathParts.length === 1) {
    const type = pathParts[0];
    const screen = ROUTE_MAP[type];
    if (!screen) {
      return null;
    }
    const params = buildRouteParams(type, queryParams);
    return {
      screen,
      params,
      source: parsed.scheme === 'https' || parsed.scheme === 'http' ? 'universal' : 'unknown',
    };
  }

  if (pathParts.length < 2) {
    return null;
  }

  // Multi-segment routes that have NO resource ID (e.g., /settings/manage-subscription).
  // Match the full joined path against ROUTE_MAP first; only fall through to the
  // type+id pattern if no whole-path key exists.
  const wholePathKey = pathParts.join('/');
  if (ROUTE_MAP[wholePathKey]) {
    const params = buildRouteParams(wholePathKey, queryParams);
    return {
      screen: ROUTE_MAP[wholePathKey],
      params,
      source: parsed.scheme === 'https' || parsed.scheme === 'http' ? 'universal' : 'unknown',
    };
  }

  // Support multi-segment types like 'join/org' (3 parts: join, org, id)
  let type: string;
  let id: string;
  const twoSegmentType = pathParts.length >= 3 ? `${pathParts[0]}/${pathParts[1]}` : '';
  if (twoSegmentType && ROUTE_MAP[twoSegmentType]) {
    type = twoSegmentType;
    id = pathParts[2];
  } else {
    type = pathParts[0];
    if (EXACT_MATCH_ROUTE_KEYS.has(type)) {
      return null;
    }
    id = pathParts[1];
  }
  const screen = ROUTE_MAP[type];

  if (!screen) {
    return null;
  }
  if (!isValidDeepLinkId(id)) {
    return null;
  }

  return {
    screen,
    params: { id },
    source: 'unknown',
  };
}

/**
 * Handle a deep link by navigating to the appropriate screen.
 * Protected routes are deferred — call handleDeepLinkAuthAware from _layout
 * and flushPendingDeepLink from AuthProvider after auth settles.
 */
export function handleDeepLink(url: string): boolean {
  const parsed = parseDeepLink(url);

  if (!parsed) {
    deepLinkLog('[DeepLinks] Could not parse URL:', url);
    return false;
  }

  // Log UTM params for analytics if present
  if (parsed.utmParams) {
    deepLinkLog('[DeepLinks] UTM params:', parsed.utmParams);
  }

  try {
    router.push({
      pathname: parsed.screen as never,
      params: parsed.params,
    });
    return true;
  } catch (error) {
    deepLinkError('[DeepLinks] Navigation failed:', error);
    return false;
  }
}

/**
 * Auth-aware deep link handler: navigates immediately for public routes,
 * defers protected routes until AuthProvider confirms authentication.
 */
export function handleDeepLinkAuthAware(url: string): boolean {
  const parsed = parseDeepLink(url);

  if (!parsed) {
    deepLinkLog('[DeepLinks] Could not parse URL:', url);
    return false;
  }

  if (isPublicRoute(parsed)) {
    deepLinkLog('[DeepLinks] Public route — navigating immediately:', parsed.screen);
    return handleDeepLink(url);
  }

  // Protected route — defer until auth settles
  deepLinkLog('[DeepLinks] Protected route — deferring until auth:', parsed.screen);
  setPendingDeepLink(url);
  return true;
}

/**
 * Setup deep link listener for when app is already open
 */
export function setupDeepLinkListener(
  onLink?: (url: string, parsed: ParsedDeepLink | null) => void
): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    deepLinkLog('[DeepLinks] Received URL while app is open:', url);
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
      deepLinkLog('[DeepLinks] App launched with URL:', url);
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
    deepLinkError('[DeepLinks] Error getting initial URL:', error);
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

export {
    APP_SCHEME, ROUTE_MAP, WEB_DOMAINS, type ParsedDeepLink
};
