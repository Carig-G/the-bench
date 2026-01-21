import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { Conversation } from '../types/index.js';

const router = Router();

// Get all conversations (paginated)
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const topic = req.query.topic as string;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }

    if (topic) {
      whereClause += ' AND c.topic LIKE ?';
      params.push(`%${topic}%`);
    }

    const conversations = db.prepare(`
      SELECT c.*, u.username as creator_username,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT COUNT(*) FROM payments WHERE conversation_id = c.id AND status = 'completed') as reader_count
      FROM conversations c
      JOIN users u ON c.creator_id = u.id
      ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const countResult = db.prepare(`SELECT COUNT(*) as count FROM conversations c ${whereClause}`).get(...params) as { count: number };
    const total = countResult.count;

    res.json({
      conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Get current user's conversations - MUST be before /:id route
router.get('/mine', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const conversations = db.prepare(`
      SELECT c.*, u.username as creator_username,
        cp.role as my_role,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT COUNT(*) FROM payments WHERE conversation_id = c.id AND status = 'completed') as reader_count,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY message_order DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY message_order DESC LIMIT 1) as last_message_at
      FROM conversations c
      JOIN users u ON c.creator_id = u.id
      JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = ?
      ORDER BY
        CASE c.status
          WHEN 'active' THEN 1
          WHEN 'matching' THEN 2
          WHEN 'completed' THEN 3
          ELSE 4
        END,
        c.updated_at DESC
    `).all(userId);

    res.json({ conversations });
  } catch (error) {
    console.error('Get my conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Get matching queue - MUST be before /:id route
router.get('/queue/browse', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const topic = req.query.topic as string;
    const userId = req.user?.userId;

    let whereClause = 'WHERE mq.matched = 0 AND c.status = ?';
    const params: (string | number)[] = ['matching'];

    // Exclude user's own conversations
    if (userId) {
      whereClause += ' AND mq.user_id != ?';
      params.push(userId);
    }

    if (topic) {
      whereClause += ' AND mq.topic LIKE ?';
      params.push(`%${topic}%`);
    }

    const queue = db.prepare(`
      SELECT
        c.id,
        c.title,
        c.topic,
        c.description,
        c.created_at,
        u.username as creator_username,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY message_order ASC LIMIT 1) as opening_message
      FROM matching_queue mq
      JOIN conversations c ON mq.conversation_id = c.id
      JOIN users u ON mq.user_id = u.id
      ${whereClause}
      ORDER BY mq.created_at DESC
      LIMIT 50
    `).all(...params);

    res.json({ conversations: queue });
  } catch (error) {
    console.error('Get matching queue error:', error);
    res.status(500).json({ error: 'Failed to get matching queue' });
  }
});

// Get trending tags (last 7 days) - MUST be before /:id route
router.get('/trending-tags', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 15, 30);

    const tags = db.prepare(`
      SELECT
        ct.tag,
        COUNT(DISTINCT ct.conversation_id) as conversation_count
      FROM conversation_tags ct
      JOIN conversations c ON ct.conversation_id = c.id
      WHERE ct.created_at >= datetime('now', '-7 days')
        AND c.status IN ('matching', 'active')
      GROUP BY ct.tag
      ORDER BY conversation_count DESC, ct.tag ASC
      LIMIT ?
    `).all(limit);

    res.json({ tags });
  } catch (error) {
    console.error('Get trending tags error:', error);
    res.status(500).json({ error: 'Failed to get trending tags' });
  }
});

// Browse endpoint - returns Open Benches and Active Conversations with opening post
router.get('/browse', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const tag = req.query.tag as string;
    const userId = req.user?.userId;

    // Build tag filter clause
    let tagJoin = '';
    let tagWhere = '';
    const tagParams: string[] = [];

    if (tag) {
      tagJoin = 'JOIN conversation_tags ct ON ct.conversation_id = c.id';
      tagWhere = 'AND ct.tag = ?';
      tagParams.push(tag.toLowerCase());
    }

    // Open Benches (status='matching')
    let matchingWhere = 'WHERE c.status = ?';
    const matchingParams: (string | number)[] = ['matching', ...tagParams];

    // Exclude user's own conversations
    if (userId) {
      matchingWhere += ' AND c.creator_id != ?';
      matchingParams.push(userId);
    }

    const openBenches = db.prepare(`
      SELECT DISTINCT
        c.id,
        c.title,
        c.topic,
        c.description,
        c.status,
        c.created_at,
        c.updated_at,
        (SELECT content FROM messages WHERE conversation_id = c.id AND message_order = 0 LIMIT 1) as opening_post,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT COUNT(*) FROM payments WHERE conversation_id = c.id AND status = 'completed') as reader_count,
        (SELECT GROUP_CONCAT(tag, ',') FROM conversation_tags WHERE conversation_id = c.id) as tags_csv
      FROM conversations c
      ${tagJoin}
      ${matchingWhere} ${tagWhere}
      ORDER BY c.created_at DESC
      LIMIT 6
    `).all(...matchingParams);

    // Active Conversations (status='active')
    const activeParams: (string | number)[] = ['active', ...tagParams];

    const activeConversations = db.prepare(`
      SELECT DISTINCT
        c.id,
        c.title,
        c.topic,
        c.description,
        c.status,
        c.created_at,
        c.updated_at,
        (SELECT content FROM messages WHERE conversation_id = c.id AND message_order = 0 LIMIT 1) as opening_post,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT COUNT(*) FROM payments WHERE conversation_id = c.id AND status = 'completed') as reader_count,
        (SELECT GROUP_CONCAT(tag, ',') FROM conversation_tags WHERE conversation_id = c.id) as tags_csv
      FROM conversations c
      ${tagJoin}
      WHERE c.status = ? ${tagWhere}
      ORDER BY reader_count DESC, c.updated_at DESC
      LIMIT 10
    `).all(...activeParams);

    // Parse tags_csv into arrays
    const parseTagsCsv = (row: any) => ({
      ...row,
      tags: row.tags_csv ? row.tags_csv.split(',') : [],
      tags_csv: undefined
    });

    res.json({
      openBenches: openBenches.map(parseTagsCsv),
      activeConversations: activeConversations.map(parseTagsCsv),
    });
  } catch (error) {
    console.error('Browse conversations error:', error);
    res.status(500).json({ error: 'Failed to browse conversations' });
  }
});

// Get single conversation with messages
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const conversation = db.prepare(`
      SELECT c.*, u.username as creator_username,
        (SELECT COUNT(*) FROM payments WHERE conversation_id = c.id AND status = 'completed') as reader_count
      FROM conversations c
      JOIN users u ON c.creator_id = u.id
      WHERE c.id = ?
    `).get(id) as Conversation & { creator_username: string; reader_count: number } | undefined;

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Get participants
    const participants = db.prepare(`
      SELECT cp.*, u.username
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id = ?
    `).all(id);

    // Check if current user is a participant
    const isParticipant = participants.some((p: any) => p.user_id === userId);

    // Check if user has paid
    let hasPaid = false;
    if (userId) {
      const payment = db.prepare(
        'SELECT id FROM payments WHERE conversation_id = ? AND reader_id = ? AND status = ?'
      ).get(id, userId, 'completed');
      hasPaid = !!payment;
    }

    // Get messages - public ones for everyone, all for participants/paid users
    let messages;
    if (isParticipant || hasPaid) {
      messages = db.prepare(`
        SELECT m.*, u.username as author_username, cp.role as author_role
        FROM messages m
        JOIN users u ON m.author_id = u.id
        LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
        WHERE m.conversation_id = ?
        ORDER BY m.message_order ASC, m.created_at ASC
      `).all(id);
    } else {
      // Only public messages (first 2)
      messages = db.prepare(`
        SELECT m.*, u.username as author_username, cp.role as author_role
        FROM messages m
        JOIN users u ON m.author_id = u.id
        LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
        WHERE m.conversation_id = ? AND m.is_public = 1
        ORDER BY m.message_order ASC, m.created_at ASC
      `).all(id);
    }

    // Convert is_public from SQLite integer to boolean
    messages = messages.map((m: any) => ({ ...m, is_public: !!m.is_public }));

    res.json({
      conversation,
      participants,
      messages,
      has_paid: hasPaid,
      is_participant: isParticipant,
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Start a new conversation (creates and puts in matching queue)
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { title, topic, description, openingMessage, tags } = req.body;

    if (!title || !topic || !openingMessage) {
      res.status(400).json({ error: 'Title, topic, and opening message are required' });
      return;
    }

    if (title.length > 255) {
      res.status(400).json({ error: 'Title must be under 255 characters' });
      return;
    }

    const transaction = db.transaction(() => {
      // Create conversation
      const convResult = db.prepare(`
        INSERT INTO conversations (title, topic, description, creator_id, status)
        VALUES (?, ?, ?, ?, 'matching')
      `).run(title, topic, description || null, req.user!.userId);

      const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convResult.lastInsertRowid) as Conversation;

      // Add creator as initiator participant
      db.prepare(`
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES (?, ?, 'initiator')
      `).run(conversation.id, req.user!.userId);

      // Create opening message (public)
      db.prepare(`
        INSERT INTO messages (conversation_id, author_id, content, is_public, message_order)
        VALUES (?, ?, ?, 1, 0)
      `).run(conversation.id, req.user!.userId, openingMessage);

      // Add to matching queue
      db.prepare(`
        INSERT INTO matching_queue (user_id, conversation_id, topic, description)
        VALUES (?, ?, ?, ?)
      `).run(req.user!.userId, conversation.id, topic, description || null);

      // Add tags if provided (limit to 5)
      if (tags && Array.isArray(tags)) {
        const insertTag = db.prepare(`
          INSERT OR IGNORE INTO conversation_tags (conversation_id, tag) VALUES (?, ?)
        `);

        for (const tag of tags.slice(0, 5)) {
          if (typeof tag === 'string' && tag.trim()) {
            insertTag.run(conversation.id, tag.trim().toLowerCase());
          }
        }
      }

      return conversation;
    });

    const result = transaction();
    res.status(201).json({ conversation: result });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Join a conversation as responder (for manual matching by admin or matching system)
router.post('/:id/join', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined;

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    if (conversation.status !== 'matching') {
      res.status(400).json({ error: 'Conversation is not available for joining' });
      return;
    }

    // Check if user is already a participant
    const existingParticipant = db.prepare(
      'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(id, req.user!.userId);

    if (existingParticipant) {
      res.status(400).json({ error: 'You are already a participant in this conversation' });
      return;
    }

    const transaction = db.transaction(() => {
      // Add user as responder
      db.prepare(`
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES (?, ?, 'responder')
      `).run(id, req.user!.userId);

      // Update conversation status to active
      db.prepare(`
        UPDATE conversations SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(id);

      // Mark matching queue entry as matched
      db.prepare(`
        UPDATE matching_queue SET matched = 1 WHERE conversation_id = ?
      `).run(id);

      // Track conversation pair for reveal feature
      const initiatorId = conversation.creator_id;
      const responderId = req.user!.userId;

      // Ensure user_a_id < user_b_id for consistent ordering
      const userAId = Math.min(initiatorId, responderId);
      const userBId = Math.max(initiatorId, responderId);

      // Check if pair exists
      const existingPair = db.prepare(
        'SELECT * FROM conversation_pairs WHERE user_a_id = ? AND user_b_id = ?'
      ).get(userAId, userBId) as { id: number; conversation_count: number } | undefined;

      let pairId: number;
      if (existingPair) {
        // Increment conversation count
        db.prepare(`
          UPDATE conversation_pairs
          SET conversation_count = conversation_count + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(existingPair.id);
        pairId = existingPair.id;
      } else {
        // Create new pair
        const pairResult = db.prepare(`
          INSERT INTO conversation_pairs (user_a_id, user_b_id, conversation_count)
          VALUES (?, ?, 1)
        `).run(userAId, userBId);
        pairId = pairResult.lastInsertRowid as number;
      }

      // Link this conversation to the pair
      db.prepare(`
        INSERT INTO pair_conversations (pair_id, conversation_id)
        VALUES (?, ?)
      `).run(pairId, id);

      return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    });

    const result = transaction();
    res.json({ conversation: result });
  } catch (error) {
    console.error('Join conversation error:', error);
    res.status(500).json({ error: 'Failed to join conversation' });
  }
});

// Update conversation status
router.patch('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined;

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Check if user is a participant
    const participant = db.prepare(
      'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(id, req.user!.userId);

    if (!participant) {
      res.status(403).json({ error: 'Not authorized to update this conversation' });
      return;
    }

    if (status && ['matching', 'active', 'completed', 'archived'].includes(status)) {
      db.prepare('UPDATE conversations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    }

    const updated = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    res.json({ conversation: updated });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

export default router;
