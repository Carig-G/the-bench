import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import db from '../db/config.js';
import { generateToken, AuthRequest, authenticateToken } from '../middleware/auth.js';
import { User } from '../types/index.js';

const router = Router();

// Register new user
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    if (username.length < 3 || username.length > 50) {
      res.status(400).json({ error: 'Username must be 3-50 characters' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Check if username exists
    const existing = await db.queryOne<{ id: number }>('SELECT id FROM users WHERE username = $1', [username]);

    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );

    const user = result.rows[0] as User;
    const token = generateToken({ userId: user.id, username: user.username });

    res.status(201).json({
      user: { id: user.id, username: user.username, created_at: user.created_at },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    const user = await db.queryOne<User>('SELECT * FROM users WHERE username = $1', [username]);

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({ userId: user.id, username: user.username });

    res.json({
      user: { id: user.id, username: user.username, created_at: user.created_at },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.queryOne<User & { display_name: string | null; contact_info: string | null }>(
      'SELECT id, username, display_name, contact_info, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile (display name and contact info for reveals)
router.patch('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { display_name, contact_info } = req.body;
    const userId = req.user!.userId;

    // Build update query dynamically
    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    let paramIndex = 1;

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      params.push(display_name || null);
    }

    if (contact_info !== undefined) {
      updates.push(`contact_info = $${paramIndex++}`);
      params.push(contact_info || null);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(userId);
    await db.pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);

    const user = await db.queryOne(
      'SELECT id, username, display_name, contact_info, created_at FROM users WHERE id = $1',
      [userId]
    );

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
