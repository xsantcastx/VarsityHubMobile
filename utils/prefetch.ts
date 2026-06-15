import { User } from '@/api/entities';
import { queryClient } from '@/lib/queryClient';

/**
 * Prefetch-on-intent helpers.
 *
 * Call these on `onPressIn` (or when a row scrolls into view) so the
 * destination screen's own `fetchQuery`/`useQuery` resolves from a warm cache
 * the moment the navigation transition settles — no loading wheel.
 *
 * Keys MUST match the keys the destination screen reads. `prefetchQuery` is a
 * no-op when the cache entry is still fresh (within `staleTime`), so calling
 * these liberally is cheap and self-deduping.
 */

/** Warms `['public-user', id]` — read by the profile screen (app/profile.tsx). */
export function prefetchUserProfile(id?: string | null): void {
  if (!id) return;
  void queryClient.prefetchQuery({
    queryKey: ['public-user', String(id)],
    queryFn: () => User.getPublic(String(id)),
  });
}
