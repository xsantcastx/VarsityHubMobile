import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

const prisma = new PrismaClient();
const groupChatsRouter = Router();

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
                    email: true,
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

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content required' });
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

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Chat name required' });
    }

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'At least one member required' });
    }

    // If teamId provided, verify user has permission (coach, manager, admin)
    if (teamId) {
      const membership = await prisma.teamMembership.findFirst({
        where: {
          team_id: teamId,
          user_id: req.user.id,
          role: {
            in: ['coach', 'manager', 'admin', 'owner'],
          },
        },
      });

      if (!membership) {
        return res.status(403).json({ error: 'No permission to create team chat' });
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
