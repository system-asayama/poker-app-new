import express from 'express';
import { query } from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { User } from '@shared/types.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin' || req.user?.loginType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await query(
      'SELECT id, email, username, role, chips, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (admin only)
router.patch('/:userId/role', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin' || req.user?.loginType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['player', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent admin from demoting themselves
    if (parseInt(userId) === req.user.id && role === 'player') {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }

    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, username, role, chips, created_at',
      [role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete user (admin only)
router.delete('/:userId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin' || req.user?.loginType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
