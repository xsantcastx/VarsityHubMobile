import { httpGet, httpPost } from './http';

export const Notification = {
  listPage: async (cursor?: string | null, limit: number = 20, unreadOnly: boolean = false) => {
    try {
      const params: string[] = [];
      params.push('limit=' + encodeURIComponent(String(limit)));
      if (cursor) params.push('cursor=' + encodeURIComponent(cursor));
      if (unreadOnly) params.push('unread=1');
      const qs = params.length ? '?' + params.join('&') : '';
      const timeout = limit === 1 && unreadOnly ? 10000 : 30000;
      return await httpGet('/notifications' + qs, {}, timeout, 0);
    } catch (error: any) {
      if (error?.message?.includes('Unauthorized') || error?.status === 401) {
        if (__DEV__) console.log('[Notification.listPage] Not authenticated, returning empty results');
        return { items: [], cursor: null, nextCursor: null };
      }
      if (limit === 1 && unreadOnly && (error?.message?.includes('timeout') || error?.message?.includes('Aborted'))) {
        if (__DEV__) console.warn('[Notification.listPage] Poll timeout, returning empty results');
        return { items: [], cursor: null, nextCursor: null };
      }
      throw error;
    }
  },
  markRead: (id: string) => httpPost(`/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllRead: () => httpPost('/notifications/mark-read-all', {}),
};
