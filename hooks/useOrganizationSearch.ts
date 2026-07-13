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
    const { query = '', limit = 20, mode = 'list', sport, orgType } = options;

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
      if (__DEV__) console.error('[useOrganizationSearch] failed', err);
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
