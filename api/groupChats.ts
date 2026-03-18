/**
 * Group chats API — matches server routes in server/src/routes/group-chats.ts.
 * Use when building group-chat UI (team chats, etc.).
 */

import { httpGet, httpPost } from './http';

export const GroupChat = {
  /** List all group chats for the current user */
  list: () => httpGet('/group-chats'),

  /** Get messages for a group chat (last 100) */
  getMessages: (chatId: string) =>
    httpGet('/group-chats/' + encodeURIComponent(chatId) + '/messages'),

  /** Send a message to a group chat */
  sendMessage: (chatId: string, content: string) =>
    httpPost('/group-chats/' + encodeURIComponent(chatId) + '/messages', { content }),

  /** Mark a group chat as read */
  markRead: (chatId: string) =>
    httpPost('/group-chats/' + encodeURIComponent(chatId) + '/read', {}),

  /** Create a group chat (name required; teamId optional; memberIds required) */
  create: (data: { name: string; teamId?: string; memberIds: string[] }) =>
    httpPost('/group-chats', data),
};
