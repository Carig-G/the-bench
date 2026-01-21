import { Router } from 'express';
import authRoutes from './auth.js';
import storiesRoutes from './stories.js';
import nodesRoutes from './nodes.js';
import votesRoutes from './votes.js';
import conversationsRoutes from './conversations.js';
import messagesRoutes from './messages.js';
import paymentsRoutes from './payments.js';
import pairsRoutes from './pairs.js';

const router = Router();

// Auth routes
router.use('/auth', authRoutes);

// Legacy routes (stories)
router.use('/stories', storiesRoutes);
router.use('/nodes', nodesRoutes);
router.use('/votes', votesRoutes);

// New routes (conversations - The Bench)
router.use('/conversations', conversationsRoutes);
router.use('/messages', messagesRoutes);
router.use('/payments', paymentsRoutes);
router.use('/pairs', pairsRoutes);

export default router;
