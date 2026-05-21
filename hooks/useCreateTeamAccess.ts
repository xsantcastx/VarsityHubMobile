import { useEffect, useMemo, useState } from 'react';

import { Organization } from '@/api/entities';
import { useAuth } from '@/context/AuthProvider';
import {
  canAccessCreateTeamSurface,
  getCoachAccessState,
} from '@/utils/roleChecks';

export function useCreateTeamAccess() {
  const { user, loading } = useAuth();
  const coachAccess = useMemo(() => getCoachAccessState(user as any), [user]);
  const [hasManagedOrganizationAccess, setHasManagedOrganizationAccess] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    if (loading) return () => { mounted = false; };

    if (!user) {
      setHasManagedOrganizationAccess(false);
      return () => { mounted = false; };
    }

    if (coachAccess.canAccessCoachTools || coachAccess.needsPaidPlanCheckout || coachAccess.isCoach) {
      setHasManagedOrganizationAccess(false);
      return () => { mounted = false; };
    }

    void Organization.reviewSummaries()
      .then((summaries: any) => {
        if (!mounted) return;
        const hasManagedOrg = Array.isArray(summaries)
          && summaries.some(
            (entry: any) =>
              entry?.permissions?.can_manage === true
              && typeof entry?.organization?.id === 'string'
              && entry.organization.id.trim().length > 0
          );
        setHasManagedOrganizationAccess(hasManagedOrg);
      })
      .catch(() => {
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
    !loading
      && user
      && !coachAccess.canAccessCoachTools
      && !coachAccess.needsPaidPlanCheckout
      && !coachAccess.isCoach
      && hasManagedOrganizationAccess === null
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
