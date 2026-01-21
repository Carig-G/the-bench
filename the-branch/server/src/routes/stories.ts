import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { Story } from '../types/index.js';

const router = Router();

// Get all stories (paginated)
router.get('/', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const stories = db.prepare(`
      SELECT s.*, u.username as creator_username,
        (SELECT COUNT(*) FROM story_nodes WHERE story_id = s.id) as node_count,
        (SELECT COUNT(*) FROM votes WHERE story_id = s.id AND vote_type = 'complete') as complete_votes
      FROM stories s
      JOIN users u ON s.creator_id = u.id
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const countResult = db.prepare('SELECT COUNT(*) as count FROM stories').get() as { count: number };
    const total = countResult.count;

    res.json({
      stories,
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
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const story = db.prepare(`
      SELECT s.*, u.username as creator_username,
        (SELECT COUNT(*) FROM votes WHERE story_id = s.id AND vote_type = 'complete') as complete_votes
      FROM stories s
      JOIN users u ON s.creator_id = u.id
      WHERE s.id = ?
    `).get(id) as Story | undefined;

    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    // Get all nodes for this story
    const nodes = db.prepare(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.story_id = ?
      ORDER BY sn.position, sn.created_at
    `).all(id);

    // Get unique contributors count
    const contributorsResult = db.prepare(
      'SELECT COUNT(DISTINCT author_id) as count FROM story_nodes WHERE story_id = ?'
    ).get(id) as { count: number };

    res.json({
      story,
      nodes,
      contributors: contributorsResult.count,
    });
  } catch (error) {
    console.error('Get story error:', error);
    res.status(500).json({ error: 'Failed to get story' });
  }
});

// Create new story with first chapter
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
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

    const transaction = db.transaction(() => {
      // Create story
      const storyResult = db.prepare(`
        INSERT INTO stories (title, description, creator_id, max_branches, max_contributors)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        title,
        description || null,
        req.user!.userId,
        maxBranches || 3,
        maxContributors || 10
      );

      const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(storyResult.lastInsertRowid) as Story;

      // Create root node (first chapter)
      const nodeResult = db.prepare(`
        INSERT INTO story_nodes (story_id, parent_node_id, content, author_id, position)
        VALUES (?, NULL, ?, ?, 0)
      `).run(story.id, firstChapter, req.user!.userId);

      const rootNode = db.prepare('SELECT * FROM story_nodes WHERE id = ?').get(nodeResult.lastInsertRowid);

      return { story, rootNode };
    });

    const result = transaction();
    res.status(201).json(result);
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Update story (creator only)
router.patch('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, description, maxBranches, maxContributors } = req.body;

    // Check ownership
    const existing = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as Story | undefined;

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

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (maxBranches !== undefined) {
      updates.push('max_branches = ?');
      values.push(maxBranches);
    }
    if (maxContributors !== undefined) {
      updates.push('max_contributors = ?');
      values.push(maxContributors);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(parseInt(id));
    db.prepare(`UPDATE stories SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(id);
    res.json({ story });
  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Delete story (creator only)
router.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as Story | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    if (existing.creator_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to delete this story' });
      return;
    }

    db.prepare('DELETE FROM stories WHERE id = ?').run(id);

    res.json({ message: 'Story deleted' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;
