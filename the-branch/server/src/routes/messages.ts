import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { Conversation, Message } from '../types/index.js';

const router = Router();

// Add a message to a conversation
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, content, parentMessageId } = req.body;

    if (!conversationId || !content) {
      res.status(400).json({ error: 'Conversation ID and content are required' });
      return;
    }

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as Conversation | undefined;

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    if (conversation.status !== 'active' && conversation.status !== 'matching') {
      res.status(400).json({ error: 'Cannot add messages to this conversation' });
      return;
    }

    // Check if user is a participant
    const participant = db.prepare(
      'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(conversationId, req.user!.userId);

    if (!participant) {
      res.status(403).json({ error: 'Only participants can add messages' });
      return;
    }

    // Get current message count to determine order and public status
    const messageCount = db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?'
    ).get(conversationId) as { count: number };

    const messageOrder = messageCount.count;
    // First 2 messages (indexes 0 and 1) are public
    const isPublic = messageOrder < 2 ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO messages (conversation_id, author_id, parent_message_id, content, is_public, message_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(conversationId, req.user!.userId, parentMessageId || null, content, isPublic, messageOrder);

    // Update conversation timestamp
    db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);

    const message = db.prepare(`
      SELECT m.*, u.username as author_username, cp.role as author_role
      FROM messages m
      JOIN users u ON m.author_id = u.id
      LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
      WHERE m.id = ?
    `).get(result.lastInsertRowid) as Message & { author_username: string; author_role: string };

    res.status(201).json({
      message: { ...message, is_public: !!message.is_public }
    });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Get messages for a conversation (respects paywall)
router.get('/conversation/:conversationId', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.userId;

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as Conversation | undefined;

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Check if user is a participant
    let isParticipant = false;
    if (userId) {
      const participant = db.prepare(
        'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
      ).get(conversationId, userId);
      isParticipant = !!participant;
    }

    // Check if user has paid
    let hasPaid = false;
    if (userId) {
      const payment = db.prepare(
        'SELECT id FROM payments WHERE conversation_id = ? AND reader_id = ? AND status = ?'
      ).get(conversationId, userId, 'completed');
      hasPaid = !!payment;
    }

    let messages;
    if (isParticipant || hasPaid) {
      messages = db.prepare(`
        SELECT m.*, u.username as author_username, cp.role as author_role
        FROM messages m
        JOIN users u ON m.author_id = u.id
        LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
        WHERE m.conversation_id = ?
        ORDER BY m.message_order ASC, m.created_at ASC
      `).all(conversationId);
    } else {
      // Only public messages
      messages = db.prepare(`
        SELECT m.*, u.username as author_username, cp.role as author_role
        FROM messages m
        JOIN users u ON m.author_id = u.id
        LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
        WHERE m.conversation_id = ? AND m.is_public = 1
        ORDER BY m.message_order ASC, m.created_at ASC
      `).all(conversationId);
    }

    // Convert is_public from SQLite integer to boolean
    messages = messages.map((m: any) => ({ ...m, is_public: !!m.is_public }));

    res.json({ messages, has_paid: hasPaid, is_participant: isParticipant });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Edit a message (author only)
router.patch('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message | undefined;

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to edit this message' });
      return;
    }

    if (content) {
      db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, id);
    }

    const updated = db.prepare(`
      SELECT m.*, u.username as author_username, cp.role as author_role
      FROM messages m
      JOIN users u ON m.author_id = u.id
      LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
      WHERE m.id = ?
    `).get(id);

    res.json({ message: updated });
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Delete a message (author only)
router.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Message | undefined;

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to delete this message' });
      return;
    }

    db.prepare('DELETE FROM messages WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
