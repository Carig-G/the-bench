import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { Conversation } from '../types/index.js';

const router = Router();

// Get all conversations (paginated)
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const topic = req.query.topic as string;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND c.status = $${paramIndex++}`;
      params.push(status);
    }

    if (topic) {
      whereClause += ` AND c.topic LIKE $${paramIndex++}`;
      params.push(`%${topic}%`);
    }

    const conversationsResult = await db.pool.query(`
      SELECT c.*, u.username as creator_username,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT COUNT(*) FROM payments WHERE conversation_id = c.id AND status = 'completed') as reader_count
      FROM conversations c
      JOIN users u ON c.creator_id = u.id
      ${whereClause}
      ORDER BY c.updated_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);

    const countResult = await db.pool.query(
      `SELECT COUNT(*) as count FROM conversations c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      conversations: conversationsResult.rows,
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
router.get('/mine', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const conversationsResult = await db.pool.query(`
      SELECT c.*, u.username as creator_username,
        cp.role as my_role,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
        (SELECT COUNT(*) FROM payments WHERE conversation_id = c.id AND status = 'completed') as reader_count,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY message_order DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY message_order DESC LIMIT 1) as last_message_at
      FROM conversations c
      JOIN users u ON c.creator_id = u.id
      JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
      ORDER BY
        CASE c.status
          WHEN 'active' THEN 1
          WHEN 'matching' THEN 2
          WHEN 'completed' THEN 3
          ELSE 4
        END,
        c.updated_at DESC
    `, [userId]);

    res.json({ conversations: conversationsResult.rows });
  } catch (error) {
    console.error('Get my conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Get matching queue - MUST be before /:id route
router.get('/queue/browse', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const topic = req.query.topic as string;
    const userId = req.user?.userId;

    let whereClause = 'WHERE mq.matched = 0 AND c.status = $1';
    const params: (string | number)[] = ['matching'];
    let paramIndex = 2;

    // Exclude user's own conversations
    if (userId) {
      whereClause += ` AND mq.user_id != $${paramIndex++}`;
      params.push(userId);
    }

    if (topic) {
      whereClause += ` AND mq.topic LIKE $${paramIndex++}`;
      params.push(`%${topic}%`);
    }

    const queueResult = await db.pool.query(`
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
    `, params);

    res.json({ conversations: queueResult.rows });
  } catch (error) {
    console.error('Get matching queue error:', error);
    res.status(500).json({ error: 'Failed to get matching queue' });
  }
});

// Get trending tags (last 7 days) - MUST be before /:id route
router.get('/trending-tags', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 15, 30);

    const tagsResult = await db.pool.query(`
      SELECT
        ct.tag,
        COUNT(DISTINCT ct.conversation_id) as conversation_count
      FROM conversation_tags ct
      JOIN conversations c ON ct.conversation_id = c.id
      WHERE ct.created_at >= NOW() - INTERVAL '7 days'
        AND c.status IN ('matching', 'active')
      GROUP BY ct.tag
      ORDER BY conversation_count DESC, ct.tag ASC
      LIMIT $1
    `, [limit]);

    res.json({ tags: tagsResult.rows });
  } catch (error) {
    console.error('Get trending tags error:', error);
    res.status(500).json({ error: 'Failed to get trending tags' });
  }
});

// Browse endpoint - returns Open Benches and Active Conversations with opening post
router.get('/browse', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tag = req.query.tag as string;
    const userId = req.user?.userId;

    // Build tag filter clause
    let tagJoin = '';
    let tagWhere = '';
    const tagParams: string[] = [];

    if (tag) {
      tagJoin = 'JOIN conversation_tags ct ON ct.conversation_id = c.id';
      tagWhere = 'AND ct.tag = $TAG_PARAM';
      tagParams.push(tag.toLowerCase());
    }

    // Open Benches (status='matching')
    let matchingParams: (string | number)[] = ['matching', ...tagParams];
    let paramIndex = 2 + tagParams.length;
    let matchingWhere = 'WHERE c.status = $1';

    // Exclude user's own conversations
    if (userId) {
      matchingWhere += ` AND c.creator_id != $${paramIndex++}`;
      matchingParams.push(userId);
    }

    // Replace $TAG_PARAM with actual parameter index
    const matchingTagWhere = tagWhere.replace('$TAG_PARAM', `$${tagParams.length > 0 ? 2 : paramIndex}`);

    const openBenchesResult = await db.pool.query(`
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
        (SELECT STRING_AGG(tag, ',') FROM conversation_tags WHERE conversation_id = c.id) as tags_csv
      FROM conversations c
      ${tagJoin}
      ${matchingWhere} ${matchingTagWhere}
      ORDER BY c.created_at DESC
      LIMIT 6
    `, matchingParams);

    // Active Conversations (status='active')
    const activeParams: (string | number)[] = ['active', ...tagParams];
    const activeTagWhere = tagWhere.replace('$TAG_PARAM', tagParams.length > 0 ? '$2' : '$2');

    const activeConversationsResult = await db.pool.query(`
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
        (SELECT STRING_AGG(tag, ',') FROM conversation_tags WHERE conversation_id = c.id) as tags_csv
      FROM conversations c
      ${tagJoin}
      WHERE c.status = $1 ${activeTagWhere}
      ORDER BY reader_count DESC, c.updated_at DESC
      LIMIT 10
    `, activeParams);

    // Parse tags_csv into arrays
    const parseTagsCsv = (row: any) => ({
      ...row,
      tags: row.tags_csv ? row.tags_csv.split(',') : [],
      tags_csv: undefined
    });

    res.json({
      openBenches: openBenchesResult.rows.map(parseTagsCsv),
      activeConversations: activeConversationsResult.rows.map(parseTagsCsv),
    });
  } catch (error) {
    console.error('Browse conversations error:', error);
    res.status(500).json({ error: 'Failed to browse conversations' });
  }
});

// Get single conversation with messages
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const conversationResult = await db.pool.query(`
      SELECT c.*, u.username as creator_username,
        (SELECT COUNT(*) FROM payments WHERE conversation_id = c.id AND status = 'completed') as reader_count
      FROM conversations c
      JOIN users u ON c.creator_id = u.id
      WHERE c.id = $1
    `, [id]);

    const conversation = conversationResult.rows[0] as Conversation & { creator_username: string; reader_count: number } | undefined;

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Get participants
    const participantsResult = await db.pool.query(`
      SELECT cp.*, u.username
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id = $1
    `, [id]);

    const participants = participantsResult.rows;

    // Check if current user is a participant
    const isParticipant = participants.some((p: any) => p.user_id === userId);

    // Check if user has paid
    let hasPaid = false;
    if (userId) {
      const payment = await db.queryOne(
        'SELECT id FROM payments WHERE conversation_id = $1 AND reader_id = $2 AND status = $3',
        [id, userId, 'completed']
      );
      hasPaid = !!payment;
    }

    // Get messages - public ones for everyone, all for participants/paid users
    let messagesResult;
    if (isParticipant || hasPaid) {
      messagesResult = await db.pool.query(`
        SELECT m.*, u.username as author_username, cp.role as author_role
        FROM messages m
        JOIN users u ON m.author_id = u.id
        LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
        WHERE m.conversation_id = $1
        ORDER BY m.message_order ASC, m.created_at ASC
      `, [id]);
    } else {
      // Only public messages (first 2)
      messagesResult = await db.pool.query(`
        SELECT m.*, u.username as author_username, cp.role as author_role
        FROM messages m
        JOIN users u ON m.author_id = u.id
        LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = m.author_id
        WHERE m.conversation_id = $1 AND m.is_public = 1
        ORDER BY m.message_order ASC, m.created_at ASC
      `, [id]);
    }

    // Convert is_public from integer to boolean
    const messages = messagesResult.rows.map((m: any) => ({ ...m, is_public: !!m.is_public }));

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
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
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

    const result = await db.transaction(async (client) => {
      // Create conversation
      const convResult = await client.query(`
        INSERT INTO conversations (title, topic, description, creator_id, status)
        VALUES ($1, $2, $3, $4, 'matching')
        RETURNING *
      `, [title, topic, description || null, req.user!.userId]);

      const conversation = convResult.rows[0] as Conversation;

      // Add creator as initiator participant
      await client.query(`
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES ($1, $2, 'initiator')
      `, [conversation.id, req.user!.userId]);

      // Create opening message (public)
      await client.query(`
        INSERT INTO messages (conversation_id, author_id, content, is_public, message_order)
        VALUES ($1, $2, $3, 1, 0)
      `, [conversation.id, req.user!.userId, openingMessage]);

      // Add to matching queue
      await client.query(`
        INSERT INTO matching_queue (user_id, conversation_id, topic, description)
        VALUES ($1, $2, $3, $4)
      `, [req.user!.userId, conversation.id, topic, description || null]);

      // Add tags if provided (limit to 5)
      if (tags && Array.isArray(tags)) {
        for (const tag of tags.slice(0, 5)) {
          if (typeof tag === 'string' && tag.trim()) {
            await client.query(`
              INSERT INTO conversation_tags (conversation_id, tag) VALUES ($1, $2)
              ON CONFLICT (conversation_id, tag) DO NOTHING
            `, [conversation.id, tag.trim().toLowerCase()]);
          }
        }
      }

      return conversation;
    });

    res.status(201).json({ conversation: result });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Join a conversation as responder (for manual matching by admin or matching system)
router.post('/:id/join', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await db.queryOne<Conversation>('SELECT * FROM conversations WHERE id = $1', [id]);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    if (conversation.status !== 'matching') {
      res.status(400).json({ error: 'Conversation is not available for joining' });
      return;
    }

    // Check if user is already a participant
    const existingParticipant = await db.queryOne(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [id, req.user!.userId]
    );

    if (existingParticipant) {
      res.status(400).json({ error: 'You are already a participant in this conversation' });
      return;
    }

    const result = await db.transaction(async (client) => {
      // Add user as responder
      await client.query(`
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES ($1, $2, 'responder')
      `, [id, req.user!.userId]);

      // Update conversation status to active
      await client.query(`
        UPDATE conversations SET status = 'active', updated_at = NOW() WHERE id = $1
      `, [id]);

      // Mark matching queue entry as matched
      await client.query(`
        UPDATE matching_queue SET matched = 1 WHERE conversation_id = $1
      `, [id]);

      // Track conversation pair for reveal feature
      const initiatorId = conversation.creator_id;
      const responderId = req.user!.userId;

      // Ensure user_a_id < user_b_id for consistent ordering
      const userAId = Math.min(initiatorId, responderId);
      const userBId = Math.max(initiatorId, responderId);

      // Check if pair exists
      const existingPairResult = await client.query(
        'SELECT * FROM conversation_pairs WHERE user_a_id = $1 AND user_b_id = $2',
        [userAId, userBId]
      );
      const existingPair = existingPairResult.rows[0] as { id: number; conversation_count: number } | undefined;

      let pairId: number;
      if (existingPair) {
        // Increment conversation count
        await client.query(`
          UPDATE conversation_pairs
          SET conversation_count = conversation_count + 1, updated_at = NOW()
          WHERE id = $1
        `, [existingPair.id]);
        pairId = existingPair.id;
      } else {
        // Create new pair
        const pairResult = await client.query(`
          INSERT INTO conversation_pairs (user_a_id, user_b_id, conversation_count)
          VALUES ($1, $2, 1)
          RETURNING id
        `, [userAId, userBId]);
        pairId = pairResult.rows[0].id;
      }

      // Link this conversation to the pair
      await client.query(`
        INSERT INTO pair_conversations (pair_id, conversation_id)
        VALUES ($1, $2)
      `, [pairId, id]);

      const updatedResult = await client.query('SELECT * FROM conversations WHERE id = $1', [id]);
      return updatedResult.rows[0];
    });

    res.json({ conversation: result });
  } catch (error) {
    console.error('Join conversation error:', error);
    res.status(500).json({ error: 'Failed to join conversation' });
  }
});

// Update conversation status
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const conversation = await db.queryOne<Conversation>('SELECT * FROM conversations WHERE id = $1', [id]);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Check if user is a participant
    const participant = await db.queryOne(
      'SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [id, req.user!.userId]
    );

    if (!participant) {
      res.status(403).json({ error: 'Not authorized to update this conversation' });
      return;
    }

    if (status && ['matching', 'active', 'completed', 'archived'].includes(status)) {
      await db.pool.query('UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
    }

    const updated = await db.queryOne('SELECT * FROM conversations WHERE id = $1', [id]);
    res.json({ conversation: updated });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

export default router;
