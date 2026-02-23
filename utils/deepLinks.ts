/**
 * Deep Linking Handler
 * 
 * Parses incoming deep links and universal links, routing users
 * to the appropriate screen in the app.
 * 
 * Supports:
 * - varsityhub://post/123
 * - varsityhub://game/456
 * - varsityhub://team/789
 * - varsityhub://profile/abc
 * - https://varsityhub.com/share?type=post&id=123
 * 
 * @module utils/deepLinks
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';

// App scheme and web domain
const APP_SCHEME = 'varsityhub';
const WEB_DOMAINS = ['varsityhub.com', 'www.varsityhub.com'];

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
  game: '/game-detail',
  event: '/event-detail',
  team: '/team-detail',
  profile: '/public-profile',
  user: '/public-profile',
  // Auth-related routes
  'reset-password': '/reset-password',
  'verify-email': '/verify-email',
  'verify': '/verify',
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
    
    // Handle universal links (https://varsityhub.com/share?...)
    if (parsed.scheme === 'https' || parsed.scheme === 'http') {
      if (parsed.hostname && WEB_DOMAINS.includes(parsed.hostname)) {
        return parseUniversalLink(parsed);
      }
    }
    
    // Try parsing as relative path
    if (parsed.path) {
      return parsePathLink(parsed);
    }
    
    console.warn('[DeepLinks] Unable to parse URL:', url);
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

export {
    APP_SCHEME, ROUTE_MAP, WEB_DOMAINS, type ParsedDeepLink
};

