/**
 * useOrganizations - Fetches organizations list (with seed fallback)
 * Encapsulates API calls for organizations/index.tsx
 */

import { Organization as OrgEntity } from '@/api/entities';
import { ensureSeededOrganizations } from '@/data/seedOrganizations';
import { useCallback, useEffect, useState } from 'react';

export interface OrganizationSummary {
  id: string;
  name: string;
  description?: string | null;
  formatted_address?: string | null;
  org_type?: string | null;
  _count?: { teams: number; memberships: number };
}

export interface UseOrganizationsResult {
  orgs: OrganizationSummary[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export function useOrganizations(limit = 20): UseOrganizationsResult {
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await OrgEntity.list(undefined, limit);
      const orgList = Array.isArray(data) ? data : (data as any).items || [];
      const combined = ensureSeededOrganizations(orgList as OrganizationSummary[]);
      setOrgs(combined);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load organizations');
      const fallback = ensureSeededOrganizations<OrganizationSummary>([]);
      setOrgs(fallback);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { orgs, loading, error, load };
}
