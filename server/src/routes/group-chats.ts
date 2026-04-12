import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { validateContent } from '../lib/contentFilter.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

const groupChatsRouter = Router();

// Get all group chats for the current user. The list view intentionally
// returns ONLY the data needed for the chat list row: last message, unread
// count, member count, and up to N avatars. Full member rosters (and emails)
// belong in /:chatId/members; previously this route over-fetched every
// member with their email on every poll.
const MAX_MEMBER_PREVIEWS = 3;

groupChatsRouter.get('/', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    const memberships = await prisma.groupChatMember.findMany({
      where: { user_id: userId },
      include: {
        chat: {
          include: {
            team: true,
            _count: { select: { members: true } },
            members: {
              take: MAX_MEMBER_PREVIEWS,
              include: {
                user: {
                  select: {
                    id: true,
                    display_name: true,
                    avatar_url: true,
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { created_at: 'desc' },
              include: {
                sender: {
                  select: {
                    id: true,
                    display_name: true,
                    avatar_url: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { joined_at: 'desc' },
    });

    const chatIds = memberships.map(m => m.chat_id);
    const unreadRows = chatIds.length
      ? await prisma.$queryRaw<Array<{ chat_id: string; unread_count: number }>>(
          Prisma.sql`
            SELECT
              gcm.chat_id,
              COUNT(m.id)::int AS unread_count
            FROM "GroupChatMember" gcm
            LEFT JOIN "GroupChatMessage" m
              ON m.chat_id = gcm.chat_id
             AND m.sender_id <> gcm.user_id
             AND m.created_at > COALESCE(gcm.last_read_at, to_timestamp(0))
            WHERE gcm.user_id = ${userId}
              AND gcm.chat_id IN (${Prisma.join(chatIds)})
            GROUP BY gcm.chat_id
          `
        )
      : [];
    const unreadByChat = new Map(unreadRows.map(r => [r.chat_id, Number(r.unread_count)]));

    const chats = memberships.map(m => {
      const lastMessage = m.chat.messages[0] || null;
      const unreadCount = unreadByChat.get(m.chat_id) ?? 0;

      const { _count, ...chatRest } = m.chat as typeof m.chat & { _count: { members: number } };
      return {
        ...chatRest,
        memberCount: _count.members,
        lastMessage,
        unreadCount,
      };
    });

    return res.json(chats);
  } catch (error: any) {
    console.error('Error fetching group chats:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch group chats' });
  }
});

// Get messages for a specific group chat
groupChatsRouter.get('/:chatId/messages', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { chatId } = req.params;

    // Verify user is a member of this chat
    const membership = await prisma.groupChatMember.findFirst({
      where: {
        chat_id: chatId,
        user_id: req.user.id,
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    const messages = await prisma.groupChatMessage.findMany({
      where: { chat_id: chatId },
      include: {
        sender: {
          select: {
            id: true,
            display_name: true,
            avatar_url: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
      take: 100, // Limit to last 100 messages
    });

    return res.json(messages);
  } catch (error: any) {
    console.error('Error fetching group chat messages:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch messages' });
  }
});

// Send a message to a group chat
groupChatsRouter.post('/:chatId/messages', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { chatId } = req.params;
    const { content } = req.body;

    // SECURITY: Type validation for content (must be string)
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Message content required' });
    }

    const filterResult = validateContent({ content });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error, code: filterResult.code });
    }

    // Verify user is a member of this chat
    const membership = await prisma.groupChatMember.findFirst({
      where: {
        chat_id: chatId,
        user_id: req.user.id,
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    const message = await prisma.groupChatMessage.create({
      data: {
        chat_id: chatId,
        sender_id: req.user.id,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            display_name: true,
            avatar_url: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json(message);
  } catch (error: any) {
    console.error('Error sending group chat message:', error);
    return res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Mark messages as read
groupChatsRouter.post('/:chatId/read', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { chatId } = req.params;

    // Update last_read_at for this user's membership
    await prisma.groupChatMember.updateMany({
      where: {
        chat_id: chatId,
        user_id: req.user.id,
      },
      data: {
        last_read_at: new Date(),
      },
    });

    return res.json({ ok: true });
  } catch (error: any) {
    console.error('Error marking messages as read:', error);
    return res.status(500).json({ error: error.message || 'Failed to mark as read' });
  }
});

// Create a group chat (usually for a team)
groupChatsRouter.post('/', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, teamId, memberIds } = req.body;

    // SECURITY: Type validation for name (must be string)
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Chat name required' });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'At least one member required' });
    }

    if (typeof teamId !== 'string' || !teamId.trim()) {
      return res.status(400).json({ error: 'teamId is required' });
    }

    const trimmedTeamId = teamId.trim();

    const membership = await prisma.teamMembership.findFirst({
      where: {
        team_id: trimmedTeamId,
        user_id: req.user.id,
        role: {
          in: ['owner', 'manager', 'coach', 'assistant_coach'],
        },
        status: 'active',
      },
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: 'Only active team coaches or managers can create team chats' });
    }

    const requestedMemberIds = Array.from(
      new Set(
        memberIds
          .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id: string) => id.trim())
          .filter((id: string) => id !== req.user!.id)
      )
    );

    const validTeamMembers = requestedMemberIds.length
      ? await prisma.teamMembership.findMany({
          where: {
            team_id: trimmedTeamId,
            user_id: { in: requestedMemberIds },
            status: 'active',
          },
          select: { user_id: true },
        })
      : [];
    const validMemberIds = new Set(validTeamMembers.map(member => member.user_id));
    const invalidMemberIds = requestedMemberIds.filter((id: string) => !validMemberIds.has(id));

    if (invalidMemberIds.length > 0) {
      return res
        .status(400)
        .json({ error: 'All chat members must be active members of the selected team' });
    }

    // Create the group chat
    const chat = await prisma.groupChat.create({
      data: {
        name: name.trim(),
        team_id: trimmedTeamId,
        created_by: req.user!.id,
        members: {
          create: [
            { user_id: req.user!.id }, // Add creator
            ...requestedMemberIds.map((id: string) => ({ user_id: id })),
          ],
        },
      },
      include: {
        team: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                avatar_url: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return res.status(201).json(chat);
  } catch (error: any) {
    console.error('Error creating group chat:', error);
    return res.status(500).json({ error: error.message || 'Failed to create group chat' });
  }
});

export { groupChatsRouter };
