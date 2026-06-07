export const GUEST_HOME_ROUTE = '/(tabs)/feed' as const;

const AUTH_PUBLIC_ROUTE_SEGMENTS = [
  'sign-in',
  'sign-up',
  'verify-email',
  'verify',
  'verify-identity',
  'forgot-password',
  'reset-password',
  'reset',
  'payment-success',
  'payment-cancel',
] as const;

const GUEST_BROWSE_ROUTE_SEGMENTS = [
  'create',
  'feed',
  'highlights',
  'post-detail',
  'public-event',
  'event-detail',
  'game',
  'game-detail',
  'game-map',
  'user-profile',
  'team-page',
  'team-profile',
  'organization',
  'organizations',
  'league',
] as const;

export const PUBLIC_ROUTE_SEGMENTS = new Set<string>([
  ...AUTH_PUBLIC_ROUTE_SEGMENTS,
  ...GUEST_BROWSE_ROUTE_SEGMENTS,
]);

export function isPublicRouteSegment(segment: string | null | undefined): boolean {
  if (!segment) return false;
  return PUBLIC_ROUTE_SEGMENTS.has(String(segment));
}
