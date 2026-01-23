import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { Story } from '../types/index.js';

const router = Router();

// Get all stories (paginated)
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const storiesResult = await db.pool.query(`
      SELECT s.*, u.username as creator_username,
        (SELECT COUNT(*) FROM story_nodes WHERE story_id = s.id) as node_count,
        (SELECT COUNT(*) FROM votes WHERE story_id = s.id AND vote_type = 'complete') as complete_votes
      FROM stories s
      JOIN users u ON s.creator_id = u.id
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM stories');
    const total = parseInt(countResult!.count);

    res.json({
      stories: storiesResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ error: 'Failed to get stories' });
  }
});

// Get single story with full tree structure
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const story = await db.queryOne<Story & { creator_username: string; complete_votes: number }>(`
      SELECT s.*, u.username as creator_username,
        (SELECT COUNT(*) FROM votes WHERE story_id = s.id AND vote_type = 'complete') as complete_votes
      FROM stories s
      JOIN users u ON s.creator_id = u.id
      WHERE s.id = $1
    `, [id]);

    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    // Get all nodes for this story
    const nodesResult = await db.pool.query(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.story_id = $1
      ORDER BY sn.position, sn.created_at
    `, [id]);

    // Get unique contributors count
    const contributorsResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(DISTINCT author_id) as count FROM story_nodes WHERE story_id = $1',
      [id]
    );

    res.json({
      story,
      nodes: nodesResult.rows,
      contributors: parseInt(contributorsResult!.count),
    });
  } catch (error) {
    console.error('Get story error:', error);
    res.status(500).json({ error: 'Failed to get story' });
  }
});

// Create new story with first chapter
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, firstChapter, maxBranches, maxContributors } = req.body;

    if (!title || !firstChapter) {
      res.status(400).json({ error: 'Title and first chapter required' });
      return;
    }

    if (title.length > 255) {
      res.status(400).json({ error: 'Title must be under 255 characters' });
      return;
    }

    const result = await db.transaction(async (client) => {
      // Create story
      const storyResult = await client.query(`
        INSERT INTO stories (title, description, creator_id, max_branches, max_contributors)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        title,
        description || null,
        req.user!.userId,
        maxBranches || 3,
        maxContributors || 10
      ]);

      const story = storyResult.rows[0] as Story;

      // Create root node (first chapter)
      const nodeResult = await client.query(`
        INSERT INTO story_nodes (story_id, parent_node_id, content, author_id, position)
        VALUES ($1, NULL, $2, $3, 0)
        RETURNING *
      `, [story.id, firstChapter, req.user!.userId]);

      const rootNode = nodeResult.rows[0];

      return { story, rootNode };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Update story (creator only)
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, description, maxBranches, maxContributors } = req.body;

    // Check ownership
    const existing = await db.queryOne<Story>('SELECT * FROM stories WHERE id = $1', [id]);

    if (!existing) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    if (existing.creator_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to edit this story' });
      return;
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (maxBranches !== undefined) {
      updates.push(`max_branches = $${paramIndex++}`);
      values.push(maxBranches);
    }
    if (maxContributors !== undefined) {
      updates.push(`max_contributors = $${paramIndex++}`);
      values.push(maxContributors);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(parseInt(id));
    await db.pool.query(`UPDATE stories SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);

    const story = await db.queryOne('SELECT * FROM stories WHERE id = $1', [id]);
    res.json({ story });
  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Delete story (creator only)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await db.queryOne<Story>('SELECT * FROM stories WHERE id = $1', [id]);

    if (!existing) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    if (existing.creator_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to delete this story' });
      return;
    }

    await db.pool.query('DELETE FROM stories WHERE id = $1', [id]);

    res.json({ message: 'Story deleted' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;
