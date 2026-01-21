import { Router, Response } from 'express';
import db from '../db/config.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { Conversation } from '../types/index.js';

const router = Router();

// Check if user has paid for a conversation
router.get('/check/:conversationId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;

    const payment = db.prepare(
      'SELECT * FROM payments WHERE conversation_id = ? AND reader_id = ? AND status = ?'
    ).get(conversationId, req.user!.userId, 'completed');

    res.json({ has_paid: !!payment, payment: payment || null });
  } catch (error) {
    console.error('Check payment error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// Create payment (MVP: just mark as paid, no real payment processing)
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, amount } = req.body;

    if (!conversationId) {
      res.status(400).json({ error: 'Conversation ID is required' });
      return;
    }

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as Conversation | undefined;

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Check if user is a participant (participants don't need to pay)
    const participant = db.prepare(
      'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(conversationId, req.user!.userId);

    if (participant) {
      res.status(400).json({ error: 'Participants do not need to pay to read the conversation' });
      return;
    }

    // Check if already paid
    const existingPayment = db.prepare(
      'SELECT id FROM payments WHERE conversation_id = ? AND reader_id = ?'
    ).get(conversationId, req.user!.userId);

    if (existingPayment) {
      res.status(400).json({ error: 'You have already paid for this conversation' });
      return;
    }

    // MVP: Create payment record (in production, this would integrate with Stripe)
    const paymentAmount = amount || 1.99; // Default price

    const result = db.prepare(`
      INSERT INTO payments (conversation_id, reader_id, amount, payment_type, status)
      VALUES (?, ?, ?, 'single', 'completed')
    `).run(conversationId, req.user!.userId, paymentAmount);

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ payment, message: 'Payment successful! You now have full access to this conversation.' });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Get user's payment history
router.get('/history', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, c.title as conversation_title, c.topic as conversation_topic
      FROM payments p
      JOIN conversations c ON p.conversation_id = c.id
      WHERE p.reader_id = ?
      ORDER BY p.created_at DESC
    `).all(req.user!.userId);

    res.json({ payments });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

// Get conversation revenue (for participants)
router.get('/revenue/:conversationId', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;

    // Check if user is a participant
    const participant = db.prepare(
      'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(conversationId, req.user!.userId);

    if (!participant) {
      res.status(403).json({ error: 'Only participants can view revenue' });
      return;
    }

    const revenueResult = db.prepare(`
      SELECT
        COUNT(*) as total_readers,
        SUM(amount) as total_revenue
      FROM payments
      WHERE conversation_id = ? AND status = 'completed'
    `).get(conversationId) as { total_readers: number; total_revenue: number | null };

    const totalRevenue = revenueResult.total_revenue || 0;
    const yourShare = totalRevenue / 2; // 50/50 split

    res.json({
      total_readers: revenueResult.total_readers,
      total_revenue: totalRevenue,
      your_share: yourShare,
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({ error: 'Failed to get revenue' });
  }
});

export default router;
