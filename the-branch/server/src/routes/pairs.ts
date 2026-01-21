import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { ConversationPair, UserStats } from '../types/index.js';

const router = Router();

// Get user stats dashboard
router.get('/stats', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Total conversations (as participant)
    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM conversation_participants WHERE user_id = ?
    `).get(userId) as { count: number };

    // Unique partners
    const partnersResult = db.prepare(`
      SELECT COUNT(DISTINCT
        CASE
          WHEN user_a_id = ? THEN user_b_id
          ELSE user_a_id
        END
      ) as count
      FROM conversation_pairs
      WHERE user_a_id = ? OR user_b_id = ?
    `).get(userId, userId, userId) as { count: number };

    // Closest to reveal (find pair with highest count < 10)
    const closestResult = db.prepare(`
      SELECT 10 - MAX(conversation_count) as remaining
      FROM conversation_pairs
      WHERE (user_a_id = ? OR user_b_id = ?) AND revealed = 0 AND conversation_count < 10
    `).get(userId, userId) as { remaining: number | null };

    // Pending reveals (pairs at 10+ awaiting mutual agreement)
    const pendingResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM conversation_pairs
      WHERE (user_a_id = ? OR user_b_id = ?)
        AND conversation_count >= 10
        AND revealed = 0
    `).get(userId, userId) as { count: number };

    const stats: UserStats = {
      total_conversations: totalResult.count,
      unique_partners: partnersResult.count,
      closest_to_reveal: closestResult.remaining ?? 10,
      pending_reveals: pendingResult.count,
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

// Get all pairs for current user
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const pairs = db.prepare(`
      SELECT cp.*,
        CASE WHEN cp.user_a_id = ? THEN u_b.username ELSE u_a.username END as partner_username,
        CASE WHEN cp.user_a_id = ? THEN cp.user_b_id ELSE cp.user_a_id END as partner_id,
        CASE WHEN cp.user_a_id = ? THEN cp.user_a_reveal_requested ELSE cp.user_b_reveal_requested END as i_requested_reveal,
        CASE WHEN cp.user_a_id = ? THEN cp.user_b_reveal_requested ELSE cp.user_a_reveal_requested END as partner_requested_reveal,
        CASE WHEN cp.revealed = 1 THEN
          CASE WHEN cp.user_a_id = ? THEN u_b.contact_info ELSE u_a.contact_info END
        END as partner_contact_info,
        CASE WHEN cp.revealed = 1 THEN
          CASE WHEN cp.user_a_id = ? THEN u_b.display_name ELSE u_a.display_name END
        END as partner_display_name
      FROM conversation_pairs cp
      JOIN users u_a ON cp.user_a_id = u_a.id
      JOIN users u_b ON cp.user_b_id = u_b.id
      WHERE cp.user_a_id = ? OR cp.user_b_id = ?
      ORDER BY cp.conversation_count DESC, cp.updated_at DESC
    `).all(userId, userId, userId, userId, userId, userId, userId, userId);

    res.json({ pairs });
  } catch (error) {
    console.error('Get pairs error:', error);
    res.status(500).json({ error: 'Failed to get pairs' });
  }
});

// Get eligible pairs for reveal (10+ conversations)
router.get('/reveal-eligible', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const pairs = db.prepare(`
      SELECT cp.*,
        CASE WHEN cp.user_a_id = ? THEN u_b.username ELSE u_a.username END as partner_username,
        CASE WHEN cp.user_a_id = ? THEN cp.user_b_id ELSE cp.user_a_id END as partner_id,
        CASE WHEN cp.user_a_id = ? THEN cp.user_a_reveal_requested ELSE cp.user_b_reveal_requested END as i_requested_reveal,
        CASE WHEN cp.user_a_id = ? THEN cp.user_b_reveal_requested ELSE cp.user_a_reveal_requested END as partner_requested_reveal
      FROM conversation_pairs cp
      JOIN users u_a ON cp.user_a_id = u_a.id
      JOIN users u_b ON cp.user_b_id = u_b.id
      WHERE (cp.user_a_id = ? OR cp.user_b_id = ?)
        AND cp.conversation_count >= 10
        AND cp.revealed = 0
      ORDER BY cp.conversation_count DESC
    `).all(userId, userId, userId, userId, userId, userId);

    res.json({ pairs });
  } catch (error) {
    console.error('Get reveal-eligible pairs error:', error);
    res.status(500).json({ error: 'Failed to get reveal-eligible pairs' });
  }
});

// Request reveal for a pair
router.post('/:pairId/request-reveal', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { pairId } = req.params;
    const userId = req.user!.userId;

    const pair = db.prepare(
      'SELECT * FROM conversation_pairs WHERE id = ?'
    ).get(pairId) as ConversationPair | undefined;

    if (!pair) {
      res.status(404).json({ error: 'Pair not found' });
      return;
    }

    // Check if user is part of this pair
    if (pair.user_a_id !== userId && pair.user_b_id !== userId) {
      res.status(403).json({ error: 'Not authorized to request reveal for this pair' });
      return;
    }

    // Check if pair is eligible for reveal
    if (pair.conversation_count < 10) {
      res.status(400).json({
        error: `Need ${10 - pair.conversation_count} more conversations to reveal`
      });
      return;
    }

    if (pair.revealed) {
      res.status(400).json({ error: 'This pair has already been revealed' });
      return;
    }

    // Determine which column to update
    const isUserA = pair.user_a_id === userId;
    const revealColumn = isUserA ? 'user_a_reveal_requested' : 'user_b_reveal_requested';
    const otherRevealColumn = isUserA ? 'user_b_reveal_requested' : 'user_a_reveal_requested';
    const otherRequested = isUserA ? pair.user_b_reveal_requested : pair.user_a_reveal_requested;

    // If both users have now requested, reveal the pair
    if (otherRequested) {
      db.prepare(`
        UPDATE conversation_pairs
        SET ${revealColumn} = 1, revealed = 1, revealed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(pairId);

      // Fetch the revealed info
      const updatedPair = db.prepare(`
        SELECT cp.*,
          u_a.username as user_a_username, u_a.display_name as user_a_display_name, u_a.contact_info as user_a_contact_info,
          u_b.username as user_b_username, u_b.display_name as user_b_display_name, u_b.contact_info as user_b_contact_info
        FROM conversation_pairs cp
        JOIN users u_a ON cp.user_a_id = u_a.id
        JOIN users u_b ON cp.user_b_id = u_b.id
        WHERE cp.id = ?
      `).get(pairId);

      res.json({
        pair: updatedPair,
        revealed: true,
        message: 'Both users agreed to reveal! You can now see each other\'s contact info.'
      });
    } else {
      // Just mark this user's request
      db.prepare(`
        UPDATE conversation_pairs
        SET ${revealColumn} = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(pairId);

      const updatedPair = db.prepare('SELECT * FROM conversation_pairs WHERE id = ?').get(pairId);

      res.json({
        pair: updatedPair,
        revealed: false,
        message: 'Reveal requested! Waiting for your conversation partner to agree.'
      });
    }
  } catch (error) {
    console.error('Request reveal error:', error);
    res.status(500).json({ error: 'Failed to request reveal' });
  }
});

// Get revealed pairs (where both users agreed)
router.get('/revealed', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const pairs = db.prepare(`
      SELECT cp.*,
        CASE WHEN cp.user_a_id = ? THEN u_b.username ELSE u_a.username END as partner_username,
        CASE WHEN cp.user_a_id = ? THEN u_b.display_name ELSE u_a.display_name END as partner_display_name,
        CASE WHEN cp.user_a_id = ? THEN u_b.contact_info ELSE u_a.contact_info END as partner_contact_info,
        CASE WHEN cp.user_a_id = ? THEN cp.user_b_id ELSE cp.user_a_id END as partner_id
      FROM conversation_pairs cp
      JOIN users u_a ON cp.user_a_id = u_a.id
      JOIN users u_b ON cp.user_b_id = u_b.id
      WHERE (cp.user_a_id = ? OR cp.user_b_id = ?)
        AND cp.revealed = 1
      ORDER BY cp.revealed_at DESC
    `).all(userId, userId, userId, userId, userId, userId);

    res.json({ pairs });
  } catch (error) {
    console.error('Get revealed pairs error:', error);
    res.status(500).json({ error: 'Failed to get revealed pairs' });
  }
});

export default router;
