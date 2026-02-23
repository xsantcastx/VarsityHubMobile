/**
 * useOrganization - Fetches a single organization by ID
 * Encapsulates API calls for organizations/[id].tsx
 */

import { Organization as OrgEntity } from '@/api/entities';
import { useCallback, useEffect, useState } from 'react';

export interface OrganizationPayload {
  id: string;
  name: string;
  description?: string | null;
  formatted_address?: string | null;
  place_id?: string | null;
  zip_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  _count?: { teams?: number; memberships?: number };
}

export interface UseOrganizationResult {
  org: OrganizationPayload | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export function useOrganization(
  id: string | undefined | null,
  seedData?: OrganizationPayload | null
): UseOrganizationResult {
  const [org, setOrg] = useState<OrganizationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setOrg(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (seedData) {
      setOrg(seedData);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await OrgEntity.get(id);
      setOrg(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load organization');
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [id, seedData]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await load();
      if (cancelled) return;
    };
    void run();
    return () => { cancelled = true; };
  }, [load]);

  return { org, loading, error, load };
}
