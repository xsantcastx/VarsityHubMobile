import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { prisma } from '../lib/prisma.js';
import { validateContent } from '../lib/contentFilter.js';
import { groupMessageLimiter } from '../middleware/rateLimiters.js';
const groupChatsRouter = Router();

const createGroupChatSchema = z.object({
  name: z.string().min(1).max(100),
  teamId: z.string().optional(),
  memberIds: z.array(z.string()).min(1).max(200),
});

// Get all group chats for the current user
groupChatsRouter.get('/', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const memberships = await prisma.groupChatMember.findMany({
      where: { user_id: req.user.id },
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

    const chats = memberships.map(m => {
      const lastMessage = m.chat.messages[0] || null;
      const unreadCount = m.last_read_at
        ? m.chat.messages.filter(msg => 
            msg.created_at > m.last_read_at! && msg.sender_id !== req.user!.id
          ).length
        : 0;

      return {
        ...m.chat,
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
groupChatsRouter.post('/:chatId/messages', requireAuth as any, groupMessageLimiter, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { chatId } = req.params;
    const { content } = req.body;

    // SECURITY: Type validation for content (must be string)
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Message content required' });
    }

    // SECURITY: Max length check
    if (content.length > 5000) {
      return res.status(400).json({ error: 'Message too long (max 5000 characters)' });
    }

    // SECURITY: Content filter
    const filterResult = validateContent({ content });
    if (!filterResult.valid) {
      return res.status(400).json({ error: filterResult.error || 'Message contains inappropriate content' });
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

    const parsed = createGroupChatSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { name, teamId, memberIds } = parsed.data;

    // Deduplicate and exclude creator
    const uniqueMemberIds = [...new Set(memberIds)].filter(id => id !== req.user!.id);

    // If teamId provided, verify user has permission and all members belong to the team
    if (teamId) {
      const membership = await prisma.teamMembership.findFirst({
        where: {
          team_id: teamId,
          user_id: req.user.id,
          role: {
            in: ['coach', 'manager', 'owner'] as any[],
          },
        },
      });

      if (!membership) {
        return res.status(403).json({ error: 'No permission to create team chat' });
      }

      // Verify all memberIds are actual members of the team
      const teamMembers = await prisma.teamMembership.findMany({
        where: { team_id: teamId, user_id: { in: uniqueMemberIds } },
        select: { user_id: true },
      });
      const validTeamUserIds = new Set(teamMembers.map(m => m.user_id));
      const invalidIds = uniqueMemberIds.filter(id => !validTeamUserIds.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ error: 'Some members are not part of this team' });
      }
    } else {
      // No teamId — verify all memberIds are real users
      const existingUsers = await prisma.user.findMany({
        where: { id: { in: uniqueMemberIds } },
        select: { id: true },
      });
      if (existingUsers.length !== uniqueMemberIds.length) {
        return res.status(400).json({ error: 'One or more member IDs are invalid' });
      }

      // Check none of the members have blocked the creator (or vice versa)
      const blocks = await prisma.blockedUser.findMany({
        where: {
          OR: [
            { blocker_id: req.user.id, blocked_id: { in: uniqueMemberIds } },
            { blocker_id: { in: uniqueMemberIds }, blocked_id: req.user.id },
          ],
        },
        select: { blocker_id: true, blocked_id: true },
      });
      if (blocks.length > 0) {
        return res.status(400).json({ error: 'Cannot add blocked users to chat' });
      }
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
            ...uniqueMemberIds.map((id: string) => ({ user_id: id })),
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
    return res.status(500).json({ error: error.message || 'Failed to create group chat' });
  }
});

export { groupChatsRouter };
