import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { Conversation, Message } from '../types/index.js';

const router = Router();

// Add a message to a conversation
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, content, parentMessageId } = req.body;

    if (!conversationId || !content) {
      res.status(400).json({ error: 'Conversation ID and content are required' });
      return;
    }

    const conversation = await db.queryOne<Conversation>('SELECT * FROM conversations WHERE id = $1', [conversationId]);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    if (conversation.status !== 'active' && conversation.status !== 'matching') {
      res.status(400).json({ error: 'Cannot add messages to this conversation' });
      return;
    }

    // Check if user is a participant
    const participant = await db.queryOne(
      'SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user!.userId]
    );

    if (!participant) {
      res.status(403).json({ error: 'Only participants can add messages' });
      return;
    }

    // Get current message count to determine order and public status
    const messageCount = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1',
      [conversationId]
    );

    const messageOrder = parseInt(messageCount!.count);
    // First 2 messages (indexes 0 and 1) are public
    const isPublic = messageOrder < 2 ? 1 : 0;

    const result = await db.pool.query(`
      INSERT INTO messages (conversation_id, author_id, parent_message_id, content, is_public, message_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [conversationId, req.user!.userId, parentMessageId || null, content, isPublic, messageOrder]);

    const newMessageId = result.rows[0].id;

    // Update conversation timestamp
    await db.pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    const messageResult = await db.pool.query(`
      SELECT m.*, u.username as author_username, cp.role as author_role
      FROM messages m
      JOIN users u ON m.author_id = u.id
      LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
      WHERE m.id = $1
    `, [newMessageId]);

    const message = messageResult.rows[0] as Message & { author_username: string; author_role: string };

    res.status(201).json({
      message: { ...message, is_public: !!message.is_public }
    });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Get messages for a conversation (respects paywall)
router.get('/conversation/:conversationId', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.userId;

    const conversation = await db.queryOne<Conversation>('SELECT * FROM conversations WHERE id = $1', [conversationId]);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Check if user is a participant
    let isParticipant = false;
    if (userId) {
      const participant = await db.queryOne(
        'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId]
      );
      isParticipant = !!participant;
    }

    // Check if user has paid
    let hasPaid = false;
    if (userId) {
      const payment = await db.queryOne(
        'SELECT id FROM payments WHERE conversation_id = $1 AND reader_id = $2 AND status = $3',
        [conversationId, userId, 'completed']
      );
      hasPaid = !!payment;
    }

    let messagesResult;
    if (isParticipant || hasPaid) {
      messagesResult = await db.pool.query(`
        SELECT m.*, u.username as author_username, cp.role as author_role
        FROM messages m
        JOIN users u ON m.author_id = u.id
        LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
        WHERE m.conversation_id = $1
        ORDER BY m.message_order ASC, m.created_at ASC
      `, [conversationId]);
    } else {
      // Only public messages
      messagesResult = await db.pool.query(`
        SELECT m.*, u.username as author_username, cp.role as author_role
        FROM messages m
        JOIN users u ON m.author_id = u.id
        LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
        WHERE m.conversation_id = $1 AND m.is_public = 1
        ORDER BY m.message_order ASC, m.created_at ASC
      `, [conversationId]);
    }

    // Convert is_public from integer to boolean
    const messages = messagesResult.rows.map((m: any) => ({ ...m, is_public: !!m.is_public }));

    res.json({ messages, has_paid: hasPaid, is_participant: isParticipant });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Edit a message (author only)
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const message = await db.queryOne<Message>('SELECT * FROM messages WHERE id = $1', [id]);

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to edit this message' });
      return;
    }

    if (content) {
      await db.pool.query('UPDATE messages SET content = $1 WHERE id = $2', [content, id]);
    }

    const updatedResult = await db.pool.query(`
      SELECT m.*, u.username as author_username, cp.role as author_role
      FROM messages m
      JOIN users u ON m.author_id = u.id
      LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
      WHERE m.id = $1
    `, [id]);

    res.json({ message: updatedResult.rows[0] });
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Delete a message (author only)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const message = await db.queryOne<Message>('SELECT * FROM messages WHERE id = $1', [id]);

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to delete this message' });
      return;
    }

    await db.pool.query('DELETE FROM messages WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
