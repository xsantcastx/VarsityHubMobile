import { Organization, Team } from '@/api/entities';
import { useEffect, useRef, useState } from 'react';

export interface UseProfileOrganizationsResult {
  organizations: any[];
  loading: boolean;
}

/**
 * Hook for loading user's organizations asynchronously
 * Fetches user's teams and hydrates their organizations in the background
 * Doesn't block profile rendering
 */
export function useProfileOrganizations(userId: string | null | undefined): UseProfileOrganizationsResult {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (!userId) {
      setOrganizations([]);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const loadOrganizations = async () => {
      if (requestInFlight.current) {
        return;
      }
      requestInFlight.current = true;
      setLoading(true);

      try {
        // Fetch user's teams with cancellation support
        const myTeams = await Team.list('', true); // mine=true

        // Check cancellation after each async operation
        if (cancelled || !Array.isArray(myTeams) || myTeams.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Extract unique organization IDs from teams
        const orgIds = new Set<string>();
        const orgNames = new Set<string>();

        myTeams.forEach((team: any) => {
          if (team.organization_id) {
            orgIds.add(team.organization_id);
          }
          // Also extract organization from team name (e.g., "SHS Men's Soccer" -> "SHS")
          if (team.name) {
            const nameParts = String(team.name).split(/\s+/);
            if (nameParts.length > 0) {
              orgNames.add(nameParts[0]);
            }
          }
        });

        // Try to fetch by ID first - batch fetch by organization IDs
        if (orgIds.size > 0) {
          const orgPromises = Array.from(orgIds).map(id =>
            Organization.get(id).catch(() => null)
          );

          const orgsData = await Promise.all(orgPromises);
          
          // Check cancellation after fetch
          if (cancelled) return;
          
          const validOrgs = orgsData.filter(org => org !== null);

          if (validOrgs.length > 0) {
            setOrganizations(validOrgs);
            setLoading(false);
            return;
          }
        }

        // If no orgs found by ID, try searching by name
        if (cancelled || (orgIds.size === 0 && orgNames.size === 0)) {
          if (!cancelled) setLoading(false);
          return;
        }

        if (orgNames.size > 0) {
          const searchPromises = Array.from(orgNames).map(name =>
            Organization.list(name, 5).catch(() => [])
          );

          const searchResults = await Promise.all(searchPromises);
          
          // Check cancellation after fetch
          if (cancelled) return;
          
          const flatResults = searchResults.flat();

          // Deduplicate by ID
          const uniqueOrgs = flatResults.filter((org: any, index: number, self: any[]) =>
            org && org.id && self.findIndex((o: any) => o?.id === org.id) === index
          );

          if (!cancelled) {
            setOrganizations(uniqueOrgs);
          }
        }
      } catch (error) {
        if (__DEV__) console.error('[useProfileOrganizations] Failed to load organizations:', error);
        // Don't throw - just log and leave organizations empty
      } finally {
        requestInFlight.current = false;
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrganizations();

    return () => {
      cancelled = true;
      abortController.abort();
      requestInFlight.current = false;
    };
  }, [userId]);

  return {
    organizations,
    loading,
  };
}
