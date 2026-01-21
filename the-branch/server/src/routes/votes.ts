import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get votes for a story
router.get('/story/:storyId', (req, res: Response) => {
  try {
    const { storyId } = req.params;

    const rows = db.prepare(`
      SELECT vote_type, COUNT(*) as count
      FROM votes
      WHERE story_id = ?
      GROUP BY vote_type
    `).all(storyId) as { vote_type: string; count: number }[];

    const votes: Record<string, number> = {};
    for (const row of rows) {
      votes[row.vote_type] = row.count;
    }

    res.json({ votes });
  } catch (error) {
    console.error('Get votes error:', error);
    res.status(500).json({ error: 'Failed to get votes' });
  }
});

// Get user's vote for a story
router.get('/story/:storyId/me', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { storyId } = req.params;

    const votes = db.prepare(
      'SELECT * FROM votes WHERE story_id = ? AND user_id = ?'
    ).all(storyId, req.user!.userId);

    res.json({ votes });
  } catch (error) {
    console.error('Get user vote error:', error);
    res.status(500).json({ error: 'Failed to get vote' });
  }
});

// Add a vote
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
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
    const storyExists = db.prepare('SELECT 1 FROM stories WHERE id = ?').get(storyId);

    if (!storyExists) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }

    // Check if vote already exists
    const existingVote = db.prepare(
      'SELECT 1 FROM votes WHERE story_id = ? AND user_id = ? AND vote_type = ?'
    ).get(storyId, req.user!.userId, voteType);

    if (existingVote) {
      res.status(200).json({ message: 'Vote already exists' });
      return;
    }

    // Insert vote
    const result = db.prepare(
      'INSERT INTO votes (story_id, user_id, vote_type) VALUES (?, ?, ?)'
    ).run(storyId, req.user!.userId, voteType);

    const vote = db.prepare('SELECT * FROM votes WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ vote });
  } catch (error) {
    console.error('Add vote error:', error);
    res.status(500).json({ error: 'Failed to add vote' });
  }
});

// Remove a vote
router.delete('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { storyId, voteType } = req.body;

    if (!storyId || !voteType) {
      res.status(400).json({ error: 'storyId and voteType required' });
      return;
    }

    const result = db.prepare(
      'DELETE FROM votes WHERE story_id = ? AND user_id = ? AND vote_type = ?'
    ).run(storyId, req.user!.userId, voteType);

    if (result.changes === 0) {
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
