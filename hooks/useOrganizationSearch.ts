import { useCallback, useState } from 'react';

export function useOrganizationSearch(_enabled: boolean) {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const search = useCallback(async (_input: string | { query: string; limit?: number; mode?: string; orgType?: string }) => {
    setLoading(true);
    try {
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, []);
  const clear = useCallback(() => setOrganizations([]), []);
  return { organizations, loading, search, clear };
}
