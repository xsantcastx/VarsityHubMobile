import { useEffect, useMemo, useState } from 'react';

import { Organization } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import { canAccessCreateTeamSurface, getCoachAccessState } from '@/utils/roleChecks';

const REVIEW_SUMMARY_CACHE_TTL_MS = 30_000;
const managedOrganizationAccessCache = new Map<string, { value: boolean; expiresAt: number }>();

export function useCreateTeamAccess() {
  const { user, loading } = useAuth();
  const coachAccess = useMemo(() => getCoachAccessState(user as any), [user]);
  const [hasManagedOrganizationAccess, setHasManagedOrganizationAccess] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    let mounted = true;

    if (loading)
      return () => {
        mounted = false;
      };

    if (!user) {
      setHasManagedOrganizationAccess(false);
      return () => {
        mounted = false;
      };
    }

    const cacheKey = typeof user.id === 'string' ? user.id : null;

    if (
      coachAccess.canAccessCoachTools ||
      coachAccess.needsPaidPlanCheckout ||
      coachAccess.isCoach
    ) {
      setHasManagedOrganizationAccess(false);
      return () => {
        mounted = false;
      };
    }

    if (cacheKey) {
      const cached = managedOrganizationAccessCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        setHasManagedOrganizationAccess(cached.value);
        return () => {
          mounted = false;
        };
      }
    }

    void Organization.reviewSummaries()
      .then((summaries: any) => {
        if (!mounted) return;
        const hasManagedOrg =
          Array.isArray(summaries) &&
          summaries.some(
            (entry: any) =>
              entry?.permissions?.can_manage === true &&
              typeof entry?.organization?.id === 'string' &&
              entry.organization.id.trim().length > 0
          );
        if (cacheKey) {
          managedOrganizationAccessCache.set(cacheKey, {
            value: hasManagedOrg,
            expiresAt: Date.now() + REVIEW_SUMMARY_CACHE_TTL_MS,
          });
        }
        setHasManagedOrganizationAccess(hasManagedOrg);
      })
      .catch(() => {
        if (cacheKey) {
          managedOrganizationAccessCache.set(cacheKey, {
            value: false,
            expiresAt: Date.now() + REVIEW_SUMMARY_CACHE_TTL_MS,
          });
        }
        if (mounted) setHasManagedOrganizationAccess(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    coachAccess.canAccessCoachTools,
    coachAccess.isCoach,
    coachAccess.needsPaidPlanCheckout,
    loading,
    user,
  ]);

  const checkingManagedOrganizations = Boolean(
    !loading &&
    user &&
    !coachAccess.canAccessCoachTools &&
    !coachAccess.needsPaidPlanCheckout &&
    !coachAccess.isCoach &&
    hasManagedOrganizationAccess === null
  );

  return {
    loading: loading || checkingManagedOrganizations,
    coachAccess,
    hasManagedOrganizationAccess: hasManagedOrganizationAccess === true,
    canAccessCreateTeam: canAccessCreateTeamSurface(user as any, {
      hasManagedOrganizationAccess: hasManagedOrganizationAccess === true,
    }),
  };
}
