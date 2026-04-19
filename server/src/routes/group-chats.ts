import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { prisma } from '../lib/prisma.js';
import { groupMessageLimiter } from '../middleware/rateLimiters.js';
import { validateContent } from '../lib/contentFilter.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
const groupChatsRouter = Router();

// Get all group chats for the current user
groupChatsRouter.get('/', requireAuth as any, requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const memberships = await prisma.groupChatMember.findMany({
      where: { user_id: req.user.id },
      take: 100,
      include: {
        chat: {
          include: {
            team: true,
            members: {
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

    // v1.0.2 pass 11: previously unreadCount was derived from `messages: { take: 1 }`,
    // so the count was always 0 or 1, never the true unread total. Fixed with per-chat
    // counts (exclude own messages; if last_read_at is null, count all others' messages).
    // pass 11 follow-up: removed unused groupBy that duplicated work and hit DB every request.
    const chatIds = memberships.map((m: any) => m.chat_id);
    const lastReadByChat = new Map<string, Date | null>(
      memberships.map((m: any) => [m.chat_id, m.last_read_at ?? null])
    );

    const refinedUnread = await Promise.all(
      chatIds.map(async (chatId: string) => {
        const lastRead = lastReadByChat.get(chatId);
        const count = await prisma.groupChatMessage.count({
          where: {
            chat_id: chatId,
            sender_id: { not: req.user!.id },
            ...(lastRead ? { created_at: { gt: lastRead } } : {}),
          },
        });
        return [chatId, count] as const;
      })
    );
    const unreadByChat = new Map(refinedUnread);

    const chats = memberships.map((m: any) => ({
      ...m.chat,
      lastMessage: m.chat.messages[0] || null,
      unreadCount: unreadByChat.get(m.chat_id) ?? 0,
    }));

    return res.json(chats);
  } catch (error: any) {
    console.error('Error fetching group chats:', error);
    return res.status(500).json({ error: 'Failed to fetch group chats' });
  }
}));

// Get messages for a specific group chat
groupChatsRouter.get('/:chatId/messages', requireAuth as any, requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
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
          },
        },
      },
      orderBy: { created_at: 'asc' },
      take: 100, // Limit to last 100 messages
    });

    return res.json(messages);
  } catch (error: any) {
    console.error('Error fetching group chat messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
}));

// Send a message to a group chat
const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content required')
    .max(5000, 'Message too long (max 5000 characters)'),
});

groupChatsRouter.post(
  '/:chatId/messages',
  requireAuth as any,
  requireVerified as any,
  groupMessageLimiter as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { chatId } = req.params;
      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      const { content } = parsed.data;

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
            },
          },
        },
      });

      return res.status(201).json(message);
    } catch (error: any) {
      console.error('Error sending group chat message:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }
  })
);

// Mark messages as read
groupChatsRouter.post('/:chatId/read', requireAuth as any, requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
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
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
}));

// Create a group chat (usually for a team)
const createChatSchema = z.object({
  name: z.string().min(1, 'Chat name required').max(100),
  memberIds: z.array(z.string().min(1)).min(1, 'At least one member required'),
  teamId: z.string().min(1, 'teamId is required to create a group chat'),
});

groupChatsRouter.post('/', requireAuth as any, requireVerified as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = createChatSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    const { name, teamId, memberIds } = parsed.data;

    // Verify requester has permission (coach/manager/owner/assistant_coach)
    const membership = await prisma.teamMembership.findFirst({
      where: {
        team_id: teamId,
        user_id: req.user.id,
        role: {
          in: ['coach', 'assistant_coach', 'manager', 'owner'] as any,
        },
        status: 'active',
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'No permission to create team chat' });
    }

    // Verify all members are active on this team
    const teamMembers = await prisma.teamMembership.findMany({
      where: { team_id: teamId, user_id: { in: memberIds }, status: 'active' },
      select: { user_id: true },
    });
    const teamMemberIds = new Set(teamMembers.map(m => m.user_id));
    const invalidMembers = memberIds.filter(
      (id: string) => !teamMemberIds.has(id) && id !== req.user!.id
    );
    if (invalidMembers.length > 0) {
      return res
        .status(400)
        .json({ error: 'Some members are not on this team', invalid: invalidMembers });
    }

    // Create the group chat
    const chat = await prisma.groupChat.create({
      data: {
        name: name.trim(),
        team_id: teamId || null,
        created_by: req.user!.id,
        members: {
          create: [
            { user_id: req.user!.id }, // Add creator
            ...memberIds
              .filter((id: string) => id !== req.user!.id) // Avoid duplicates
              .map((id: string) => ({ user_id: id })),
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
              },
            },
          },
        },
      },
    });

    return res.status(201).json(chat);
  } catch (error: any) {
    console.error('Error creating group chat:', error);
    return res.status(500).json({ error: 'Failed to create group chat' });
  }
}));

// v1.0.2 pass 8: leave a group chat (any member) or remove another member (creator only).
// Previously there was no exit mechanism — members were trapped in chats forever.
groupChatsRouter.delete(
  '/:chatId/members/:userId',
  requireAuth as any,
  requireVerified as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const chatId = String(req.params.chatId);
      const targetUserId = String(req.params.userId);
      const meId = req.user.id;

      const chat = await prisma.groupChat.findUnique({
        where: { id: chatId },
        select: {
          id: true,
          created_by: true,
          members: { where: { user_id: meId }, select: { user_id: true } },
        },
      });
      if (!chat) return res.status(404).json({ error: 'Group chat not found' });

      // Self-leave is always allowed; removing another requires being the creator
      const isSelfLeave = targetUserId === meId;
      const isCreator = chat.created_by === meId;
      if (!isSelfLeave && !isCreator) {
        return res.status(403).json({ error: 'Only the chat creator can remove other members.' });
      }

      // Verify the target is actually a member
      const targetMembership = await prisma.groupChatMember.findFirst({
        where: { chat_id: chatId, user_id: targetUserId },
        select: { id: true },
      });
      if (!targetMembership)
        return res.status(404).json({ error: 'User is not a member of this chat.' });

      // Creators cannot remove themselves while there are other members — prevents orphan chats
      if (isSelfLeave && isCreator) {
        const otherMembers = await prisma.groupChatMember.count({
          where: { chat_id: chatId, NOT: { user_id: meId } },
        });
        if (otherMembers > 0) {
          return res.status(400).json({
            error: 'Chat creator must transfer ownership or delete the chat before leaving.',
            code: 'CREATOR_CANNOT_LEAVE',
          });
        }
        // Last member + creator → delete the whole chat
        await prisma.$transaction([
          prisma.groupChatMessage.deleteMany({ where: { chat_id: chatId } }),
          prisma.groupChatMember.deleteMany({ where: { chat_id: chatId } }),
          prisma.groupChat.delete({ where: { id: chatId } }),
        ]);
        return res.json({ ok: true, deleted: true });
      }

      await prisma.groupChatMember.delete({ where: { id: targetMembership.id } });
      return res.json({ ok: true, removed_user_id: targetUserId });
    } catch (error: any) {
      console.error('[group-chats] DELETE /:chatId/members/:userId error:', error?.message);
      return res.status(500).json({ error: 'Failed to remove member from group chat' });
    }
  })
);

export { groupChatsRouter };
