import { useCallback, useEffect, useState } from 'react';

// @ts-ignore runtime JS export
import { Organization } from '@/api/entities';
import { httpGet } from '@/api/http';

type SearchMode = 'list' | 'nearby';

export interface OrganizationSearchOptions {
  query?: string;
  limit?: number;
  mode?: SearchMode;
  sport?: string;
  orgType?: string;
}

interface UseOrganizationSearchResult<T = any> {
  organizations: T[];
  loading: boolean;
  error: string | null;
  search: (options?: OrganizationSearchOptions) => Promise<void>;
  clear: () => void;
}

export function useOrganizationSearch<T = any>(
  autoLoad: boolean = false,
  defaultQuery?: string
): UseOrganizationSearchResult<T> {
  const [organizations, setOrganizations] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    setOrganizations([]);
    setError(null);
  }, []);

  const search = useCallback(async (options: OrganizationSearchOptions = {}) => {
    const {
      query = '',
      limit = 20,
      mode = 'list',
      sport,
      orgType,
    } = options;

    setLoading(true);
    try {
      let result: any;
      if (mode === 'nearby') {
        if (!query.trim()) {
          setOrganizations([]);
          setLoading(false);
          return;
        }
        const params = new URLSearchParams();
        params.set('query', query.trim());
        params.set('limit', String(limit));
        if (sport) params.set('sport', sport);
        if (orgType) params.set('org_type', orgType);
        result = await httpGet(`/organizations/search/nearby?${params.toString()}`);
        const count = Array.isArray(result) ? result.length : Array.isArray(result?.items) ? result.items.length : 0;
        // If no results, broaden: first drop filters, then global list search
        if (count === 0) {
          const broadenedParams = new URLSearchParams();
          broadenedParams.set('query', query.trim());
          broadenedParams.set('limit', String(limit));
          // retry nearby without orgType/sport filters
          const broadenedNearby = await httpGet(`/organizations/search/nearby?${broadenedParams.toString()}`);
          const broadenedCount = Array.isArray(broadenedNearby) ? broadenedNearby.length : Array.isArray(broadenedNearby?.items) ? broadenedNearby.items.length : 0;
          if (broadenedCount > 0) {
            result = broadenedNearby;
          } else {
            // final fallback: global list search
            result = await Organization.list(query.trim() || undefined, limit);
          }
        }
      } else {
        result = await Organization.list(query.trim() || undefined, limit);
      }

      const items = Array.isArray(result)
        ? result
        : Array.isArray(result?.items)
          ? result.items
          : [];
      setOrganizations(items as T[]);
      setError(null);
    } catch (err: any) {
      console.error('[useOrganizationSearch] failed', err);
      setError(err?.message || 'Unable to load organizations');
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      search({ query: defaultQuery, mode: 'list' }).catch(() => {});
    }
  }, [autoLoad, defaultQuery, search]);

  return { organizations, loading, error, search, clear };
}

export default useOrganizationSearch;
