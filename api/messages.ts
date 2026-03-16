import { httpGet, httpPost } from './http';

export const Message = {
  unreadCount: () => httpGet('/messages/unread-count'),
  list: (sort: string = '-created_at', limit: number = 50) => {
    const q = [`sort=${encodeURIComponent(sort)}`, `limit=${limit}`];
    const options = {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'If-None-Match': '',
      },
    };
    return httpGet('/messages?' + q.join('&'), options);
  },
  listAll: (limit: number = 200) => httpGet('/messages?all=1&limit=' + String(limit)),
  filter: (_where: any = {}, sort: string = '-created_at') => {
    const options = {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'If-None-Match': '',
      },
    };
    return httpGet('/messages?sort=' + encodeURIComponent(sort), options);
  },
  threadByConversation: (conversationId: string, limit: number = 100) => {
    const q = [`conversation_id=${encodeURIComponent(conversationId)}`, `sort=${encodeURIComponent('-created_at')}`, `limit=${limit}`];
    return httpGet('/messages?' + q.join('&'));
  },
  threadWith: (email: string, limit: number = 100) => {
    const q = [`with=${encodeURIComponent(email)}`, `sort=${encodeURIComponent('-created_at')}`, `limit=${limit}`];
    return httpGet('/messages?' + q.join('&'));
  },
  send: (data: { content: string; conversation_id?: string; recipient_id?: string; recipient_email?: string }) => httpPost('/messages', data),
  markReadByConversation: (conversationId: string) => httpPost('/messages/mark-read', { conversation_id: conversationId }),
  markReadWith: (email: string) => httpPost('/messages/mark-read', { with: email }),
};
