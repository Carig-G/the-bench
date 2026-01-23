import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { StoryNode, Story } from '../types/index.js';

const router = Router();

// Get a single node with its children
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const node = await db.queryOne(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.id = $1
    `, [id]);

    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    // Get children (branches)
    const childrenResult = await db.pool.query(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.parent_node_id = $1
      ORDER BY sn.created_at
    `, [id]);

    res.json({ node, children: childrenResult.rows });
  } catch (error) {
    console.error('Get node error:', error);
    res.status(500).json({ error: 'Failed to get node' });
  }
});

// Get path from root to a specific node
router.get('/:id/path', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // PostgreSQL also supports recursive CTEs
    const pathResult = await db.pool.query(`
      WITH RECURSIVE node_path AS (
        SELECT sn.*, u.username as author_username, 1 as depth
        FROM story_nodes sn
        JOIN users u ON sn.author_id = u.id
        WHERE sn.id = $1

        UNION ALL

        SELECT sn.*, u.username as author_username, np.depth + 1
        FROM story_nodes sn
        JOIN users u ON sn.author_id = u.id
        JOIN node_path np ON sn.id = np.parent_node_id
      )
      SELECT * FROM node_path ORDER BY depth DESC
    `, [id]);

    if (pathResult.rows.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    res.json({ path: pathResult.rows });
  } catch (error) {
    console.error('Get node path error:', error);
    res.status(500).json({ error: 'Failed to get node path' });
  }
});

// Create a branch (add continuation to a node)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { storyId, parentNodeId, content } = req.body;

    if (!storyId || !parentNodeId || !content) {
      res.status(400).json({ error: 'storyId, parentNodeId, and content required' });
      return;
    }

    // Get story and parent node
    const story = await db.queryOne<Story>('SELECT * FROM stories WHERE id = $1', [storyId]);

    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    const parentNode = await db.queryOne<StoryNode>(
      'SELECT * FROM story_nodes WHERE id = $1 AND story_id = $2',
      [parentNodeId, storyId]
    );

    if (!parentNode) {
      res.status(404).json({ error: 'Parent node not found' });
      return;
    }

    // Check branch limit
    const branchCountResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM story_nodes WHERE parent_node_id = $1',
      [parentNodeId]
    );

    if (parseInt(branchCountResult!.count) >= story.max_branches) {
      res.status(400).json({
        error: `Maximum branches (${story.max_branches}) reached for this node`
      });
      return;
    }

    // Check contributor limit
    const contributorResult = await db.queryOne<{ count: string }>(
      'SELECT COUNT(DISTINCT author_id) as count FROM story_nodes WHERE story_id = $1',
      [storyId]
    );

    // Check if user is already a contributor
    const isContributor = await db.queryOne(
      'SELECT 1 FROM story_nodes WHERE story_id = $1 AND author_id = $2 LIMIT 1',
      [storyId, req.user!.userId]
    );

    if (!isContributor && parseInt(contributorResult!.count) >= story.max_contributors) {
      res.status(400).json({
        error: `Maximum contributors (${story.max_contributors}) reached for this story`
      });
      return;
    }

    // Create the new node
    const newPosition = parentNode.position + 1;
    const result = await db.pool.query(`
      INSERT INTO story_nodes (story_id, parent_node_id, content, author_id, position)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [storyId, parentNodeId, content, req.user!.userId, newPosition]);

    // Get with author username
    const node = await db.queryOne(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.id = $1
    `, [result.rows[0].id]);

    res.status(201).json({ node });
  } catch (error) {
    console.error('Create node error:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Update a node (author only)
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content required' });
      return;
    }

    const existing = await db.queryOne<StoryNode>('SELECT * FROM story_nodes WHERE id = $1', [id]);

    if (!existing) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    if (existing.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to edit this node' });
      return;
    }

    await db.pool.query('UPDATE story_nodes SET content = $1 WHERE id = $2', [content, id]);

    const node = await db.queryOne(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.id = $1
    `, [id]);

    res.json({ node });
  } catch (error) {
    console.error('Update node error:', error);
    res.status(500).json({ error: 'Failed to update node' });
  }
});

// Delete a node and all its children (author only)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await db.queryOne<StoryNode>('SELECT * FROM story_nodes WHERE id = $1', [id]);

    if (!existing) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    if (existing.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to delete this node' });
      return;
    }

    // Check if this is the root node
    if (existing.parent_node_id === null) {
      res.status(400).json({ error: 'Cannot delete the root node. Delete the story instead.' });
      return;
    }

    // Check if node has children from other authors
    const otherAuthorsChildren = await db.queryOne(
      'SELECT 1 FROM story_nodes WHERE parent_node_id = $1 AND author_id != $2 LIMIT 1',
      [id, req.user!.userId]
    );

    if (otherAuthorsChildren) {
      res.status(400).json({
        error: 'Cannot delete node with branches from other authors'
      });
      return;
    }

    // Delete node (CASCADE will handle children)
    await db.pool.query('DELETE FROM story_nodes WHERE id = $1', [id]);

    res.json({ message: 'Node deleted' });
  } catch (error) {
    console.error('Delete node error:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

export default router;
