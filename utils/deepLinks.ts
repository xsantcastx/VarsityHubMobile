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
const WEB_DOMAINS = ['varsityhub.app', 'www.varsityhub.app', 'varsityhub.com', 'www.varsityhub.com'];

// Routes that don't require authentication — safe to navigate immediately
const PUBLIC_DEEP_LINK_ROUTES = new Set([
  '/reset-password',
  '/verify',
  '/verify-email',
]);

// Pending deep link URL — deferred until auth settles
let _pendingDeepLinkUrl: string | null = null;

/** Validate deep link ID — alphanumeric, dash, underscore; 3–64 chars (cuid/uuid compatible) */
function isValidDeepLinkId(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  return trimmed.length >= 3 && trimmed.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/** Store a deep link to be processed after auth completes */
export function setPendingDeepLink(url: string) {
  _pendingDeepLinkUrl = url;
}

/** Get and clear the pending deep link */
export function consumePendingDeepLink(): string | null {
  const url = _pendingDeepLinkUrl;
  _pendingDeepLinkUrl = null;
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
  event: '/event-detail',
  team: '/team-page',
  profile: '/user-profile',
  user: '/user-profile',
  // Auth-related routes
  'reset-password': '/reset-password',
  'verify-email': '/verify',
  'verify': '/verify',
  // Onboarding continuation (after coach approval)
  'onboarding': '/onboarding',
  'approvals': '/approvals',
  // Invite deep links
  'join/org': '/request-join-organization',
  'join/team': '/team-invites',
};

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
    
    if (__DEV__) console.warn('[DeepLinks] Unable to parse URL:', url);
    return null;
  } catch (error) {
    if (__DEV__) console.error('[DeepLinks] Parse error:', error);
    return null;
  }
}

/**
 * Parse app scheme link (varsityhub://type/id)
 */
function parseSchemeLink(parsed: Linking.ParsedURL): ParsedDeepLink | null {
  const pathParts = parsed.path?.split('/').filter(Boolean) || [];

  // Handle single-segment auth/public routes where params come from query string
  // e.g., varsityhubmobile://reset-password?code=123456&email=user@example.com
  if (pathParts.length === 1) {
    const type = pathParts[0];
    const screen = ROUTE_MAP[type];
    if (screen && PUBLIC_DEEP_LINK_ROUTES.has(screen)) {
      const queryParams = parsed.queryParams || {};
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(queryParams)) {
        if (typeof value === 'string') params[key] = value;
      }
      return { screen, params, source: 'scheme' };
    }
    if (__DEV__) console.warn('[DeepLinks] Single-segment path not a known public route:', pathParts[0]);
    return null;
  }

  if (pathParts.length < 2) {
    return null;
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
    id = pathParts[1];
  }
  const screen = ROUTE_MAP[type];

  if (!screen) {
    if (__DEV__) console.warn('[DeepLinks] Unknown content type:', type);
    return null;
  }
  if (!isValidDeepLinkId(id)) {
    if (__DEV__) console.warn('[DeepLinks] Invalid ID format:', type);
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
      if (__DEV__) console.warn('[DeepLinks] Missing type or id in share link');
      return null;
    }
    
    const screen = ROUTE_MAP[type];
    if (!screen) {
      if (__DEV__) console.warn('[DeepLinks] Unknown content type:', type);
      return null;
    }
    if (!isValidDeepLinkId(id)) {
      if (__DEV__) console.warn('[DeepLinks] Invalid ID format in share link:', type);
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

  if (pathParts.length < 2) {
    return null;
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
    if (__DEV__) console.log('[DeepLinks] Could not parse URL:', url);
    return false;
  }

  // Log UTM params for analytics if present
  if (parsed.utmParams) {
    if (__DEV__) console.log('[DeepLinks] UTM params:', parsed.utmParams);
  }

  try {
    router.push({
      pathname: parsed.screen as any,
      params: parsed.params,
    });
    return true;
  } catch (error) {
    if (__DEV__) console.error('[DeepLinks] Navigation failed:', error);
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
    if (__DEV__) console.log('[DeepLinks] Could not parse URL:', url);
    return false;
  }

  if (isPublicRoute(parsed)) {
    if (__DEV__) console.log('[DeepLinks] Public route — navigating immediately:', parsed.screen);
    return handleDeepLink(url);
  }

  // Protected route — defer until auth settles
  if (__DEV__) console.log('[DeepLinks] Protected route — deferring until auth:', parsed.screen);
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
    if (__DEV__) console.log('[DeepLinks] Received URL while app is open:', url);
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
      if (__DEV__) console.log('[DeepLinks] App launched with URL:', url);
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
    if (__DEV__) console.error('[DeepLinks] Error getting initial URL:', error);
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

