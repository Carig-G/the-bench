import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { StoryNode, Story } from '../types/index.js';

const router = Router();

// Get a single node with its children
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const node = db.prepare(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.id = ?
    `).get(id);

    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    // Get children (branches)
    const children = db.prepare(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.parent_node_id = ?
      ORDER BY sn.created_at
    `).all(id);

    res.json({ node, children });
  } catch (error) {
    console.error('Get node error:', error);
    res.status(500).json({ error: 'Failed to get node' });
  }
});

// Get path from root to a specific node
router.get('/:id/path', optionalAuth, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // SQLite supports recursive CTEs
    const path = db.prepare(`
      WITH RECURSIVE node_path AS (
        SELECT sn.*, u.username as author_username, 1 as depth
        FROM story_nodes sn
        JOIN users u ON sn.author_id = u.id
        WHERE sn.id = ?

        UNION ALL

        SELECT sn.*, u.username as author_username, np.depth + 1
        FROM story_nodes sn
        JOIN users u ON sn.author_id = u.id
        JOIN node_path np ON sn.id = np.parent_node_id
      )
      SELECT * FROM node_path ORDER BY depth DESC
    `).all(id);

    if (path.length === 0) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    res.json({ path });
  } catch (error) {
    console.error('Get node path error:', error);
    res.status(500).json({ error: 'Failed to get node path' });
  }
});

// Create a branch (add continuation to a node)
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { storyId, parentNodeId, content } = req.body;

    if (!storyId || !parentNodeId || !content) {
      res.status(400).json({ error: 'storyId, parentNodeId, and content required' });
      return;
    }

    // Get story and parent node
    const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(storyId) as Story | undefined;

    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    const parentNode = db.prepare(
      'SELECT * FROM story_nodes WHERE id = ? AND story_id = ?'
    ).get(parentNodeId, storyId) as StoryNode | undefined;

    if (!parentNode) {
      res.status(404).json({ error: 'Parent node not found' });
      return;
    }

    // Check branch limit
    const branchCountResult = db.prepare(
      'SELECT COUNT(*) as count FROM story_nodes WHERE parent_node_id = ?'
    ).get(parentNodeId) as { count: number };

    if (branchCountResult.count >= story.max_branches) {
      res.status(400).json({
        error: `Maximum branches (${story.max_branches}) reached for this node`
      });
      return;
    }

    // Check contributor limit
    const contributorResult = db.prepare(
      'SELECT COUNT(DISTINCT author_id) as count FROM story_nodes WHERE story_id = ?'
    ).get(storyId) as { count: number };

    // Check if user is already a contributor
    const isContributor = db.prepare(
      'SELECT 1 FROM story_nodes WHERE story_id = ? AND author_id = ? LIMIT 1'
    ).get(storyId, req.user!.userId);

    if (!isContributor && contributorResult.count >= story.max_contributors) {
      res.status(400).json({
        error: `Maximum contributors (${story.max_contributors}) reached for this story`
      });
      return;
    }

    // Create the new node
    const newPosition = parentNode.position + 1;
    const result = db.prepare(`
      INSERT INTO story_nodes (story_id, parent_node_id, content, author_id, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(storyId, parentNodeId, content, req.user!.userId, newPosition);

    // Get with author username
    const node = db.prepare(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ node });
  } catch (error) {
    console.error('Create node error:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// Update a node (author only)
router.patch('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content required' });
      return;
    }

    const existing = db.prepare('SELECT * FROM story_nodes WHERE id = ?').get(id) as StoryNode | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    if (existing.author_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized to edit this node' });
      return;
    }

    db.prepare('UPDATE story_nodes SET content = ? WHERE id = ?').run(content, id);

    const node = db.prepare(`
      SELECT sn.*, u.username as author_username
      FROM story_nodes sn
      JOIN users u ON sn.author_id = u.id
      WHERE sn.id = ?
    `).get(id);

    res.json({ node });
  } catch (error) {
    console.error('Update node error:', error);
    res.status(500).json({ error: 'Failed to update node' });
  }
});

// Delete a node and all its children (author only)
router.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM story_nodes WHERE id = ?').get(id) as StoryNode | undefined;

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
    const otherAuthorsChildren = db.prepare(
      'SELECT 1 FROM story_nodes WHERE parent_node_id = ? AND author_id != ? LIMIT 1'
    ).get(id, req.user!.userId);

    if (otherAuthorsChildren) {
      res.status(400).json({
        error: 'Cannot delete node with branches from other authors'
      });
      return;
    }

    // Delete node (CASCADE will handle children)
    db.prepare('DELETE FROM story_nodes WHERE id = ?').run(id);

    res.json({ message: 'Node deleted' });
  } catch (error) {
    console.error('Delete node error:', error);
    res.status(500).json({ error: 'Failed to delete node' });
  }
});

export default router;
