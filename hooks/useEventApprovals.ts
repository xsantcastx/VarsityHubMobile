/**
 * useEventApprovals - Fetches and manages pending event approvals
 * Encapsulates API calls for event-approvals.tsx
 */

import { httpGet, httpPut } from '@/api/http';
import { useCallback, useEffect, useState } from 'react';

export type PendingEvent = {
  id: number;
  title: string;
  description?: string;
  event_type: string;
  location: string;
  date: string;
  linked_league?: string;
  max_attendees?: number;
  contact_info?: string;
  creator?: {
    id: number;
    display_name: string;
    avatar_url?: string;
  };
};

export interface UseEventApprovalsResult {
  events: PendingEvent[];
  loading: boolean;
  error: string | null;
  processingId: number | null;
  load: () => Promise<void>;
  approve: (eventId: number) => Promise<void>;
  reject: (eventId: number) => Promise<void>;
}

export function useEventApprovals(): UseEventApprovalsResult {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await httpGet('/events/pending');
      const pending = Array.isArray(data)
        ? data.filter((e: any) => e && e.approval_status === 'pending')
        : [];
      setEvents(pending);
    } catch (e: any) {
      console.warn('[useEventApprovals] Failed to load:', e?.message || e);
      setError(e?.message ?? 'Failed to load pending events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const approve = useCallback(async (eventId: number) => {
    setProcessingId(eventId);
    try {
      await httpPut(`/events/${eventId}/approve`, {});
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } finally {
      setProcessingId(null);
    }
  }, []);

  const reject = useCallback(async (eventId: number) => {
    setProcessingId(eventId);
    try {
      await httpPut(`/events/${eventId}/reject`, {});
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } finally {
      setProcessingId(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { events, loading, error, processingId, load, approve, reject };
}
