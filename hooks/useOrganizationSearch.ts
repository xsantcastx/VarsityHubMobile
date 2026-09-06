import { useCallback, useEffect, useRef, useState } from 'react';

// @ts-ignore runtime JS export
import { Organization } from '@/api/entities';
import { httpGet } from '@/api/http';
import { captureException } from '@/utils/sentry';
import { toUserMessage } from '@/utils/toUserMessage';

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

  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    []
  );

  const clear = useCallback(() => {
    generation.current += 1;
    setLoading(false);
    setOrganizations([]);
    setError(null);
  }, []);

  const search = useCallback(async (options: OrganizationSearchOptions = {}) => {
    const request = ++generation.current;
    setError(null);
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

      if (request !== generation.current) return;
      if (!Array.isArray(result) && !Array.isArray(result?.items)) {
        const error = new Error('Invalid organization search response');
        captureException(error, { tags: { context: 'organization_search_schema' } });
        throw error;
      }
      const items = Array.isArray(result)
        ? result
        : Array.isArray(result?.items)
          ? result.items
          : [];
      setOrganizations(items as T[]);
      setError(null);
    } catch (err: any) {
      if (request !== generation.current) return;
      if (__DEV__) console.error('[useOrganizationSearch] failed', err);
      setError(toUserMessage(err, 'Unable to load organizations'));
      setOrganizations([]);
    } finally {
      if (request === generation.current) setLoading(false);
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
