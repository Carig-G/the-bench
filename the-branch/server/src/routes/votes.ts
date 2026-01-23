import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get votes for a story
router.get('/story/:storyId', async (req, res: Response) => {
  try {
    const { storyId } = req.params;

    const result = await db.pool.query(`
      SELECT vote_type, COUNT(*) as count
      FROM votes
      WHERE story_id = $1
      GROUP BY vote_type
    `, [storyId]);

    const votes: Record<string, number> = {};
    for (const row of result.rows as { vote_type: string; count: string }[]) {
      votes[row.vote_type] = parseInt(row.count);
    }

    res.json({ votes });
  } catch (error) {
    console.error('Get votes error:', error);
    res.status(500).json({ error: 'Failed to get votes' });
  }
});

// Get user's vote for a story
router.get('/story/:storyId/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { storyId } = req.params;

    const result = await db.pool.query(
      'SELECT * FROM votes WHERE story_id = $1 AND user_id = $2',
      [storyId, req.user!.userId]
    );

    res.json({ votes: result.rows });
  } catch (error) {
    console.error('Get user vote error:', error);
    res.status(500).json({ error: 'Failed to get vote' });
  }
});

// Add a vote
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { storyId, voteType } = req.body;

    if (!storyId || !voteType) {
      res.status(400).json({ error: 'storyId and voteType required' });
      return;
    }

    if (!['complete', 'favorite'].includes(voteType)) {
      res.status(400).json({ error: 'voteType must be "complete" or "favorite"' });
      return;
    }

    // Check story exists
    const storyExists = await db.queryOne('SELECT 1 FROM stories WHERE id = $1', [storyId]);

    if (!storyExists) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    // Check if vote already exists
    const existingVote = await db.queryOne(
      'SELECT 1 FROM votes WHERE story_id = $1 AND user_id = $2 AND vote_type = $3',
      [storyId, req.user!.userId, voteType]
    );

    if (existingVote) {
      res.status(200).json({ message: 'Vote already exists' });
      return;
    }

    // Insert vote
    const result = await db.pool.query(
      'INSERT INTO votes (story_id, user_id, vote_type) VALUES ($1, $2, $3) RETURNING id',
      [storyId, req.user!.userId, voteType]
    );

    const vote = await db.queryOne('SELECT * FROM votes WHERE id = $1', [result.rows[0].id]);

    res.status(201).json({ vote });
  } catch (error) {
    console.error('Add vote error:', error);
    res.status(500).json({ error: 'Failed to add vote' });
  }
});

// Remove a vote
router.delete('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { storyId, voteType } = req.body;

    if (!storyId || !voteType) {
      res.status(400).json({ error: 'storyId and voteType required' });
      return;
    }

    const result = await db.pool.query(
      'DELETE FROM votes WHERE story_id = $1 AND user_id = $2 AND vote_type = $3',
      [storyId, req.user!.userId, voteType]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Vote not found' });
      return;
    }

    res.json({ message: 'Vote removed' });
  } catch (error) {
    console.error('Remove vote error:', error);
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

export default router;
