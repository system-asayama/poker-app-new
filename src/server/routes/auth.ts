import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../database/db.js';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';
import { User } from '@shared/types.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      'INSERT INTO users (email, username, password_hash, role, chips) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, username, role, chips, created_at',
      [email, username, passwordHash, 'player', 1000]
    );

    const user = result.rows[0] as User;
    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await query(
      'SELECT id, email, username, password_hash, role, chips, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Remove password hash from response
    delete user.password_hash;

    const token = generateToken(user as User);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Get current user
router.get('/me', authenticateToken, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

// Setup initial admin with master password
router.post('/setup-admin', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { masterPassword } = req.body;
    const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'admin-n-N31415926!!';

    if (!masterPassword) {
      return res.status(400).json({ error: 'Master password is required' });
    }

    // Check if master password is correct
    if (masterPassword !== MASTER_PASSWORD) {
      return res.status(403).json({ error: 'Invalid master password' });
    }

    // Check if any admin already exists
    const existingAdmins = await query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
    if (existingAdmins.rows.length > 0) {
      return res.status(400).json({ error: 'An admin already exists. Please contact the existing admin.' });
    }

    // Promote current user to admin
    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, username, role, chips, created_at',
      ['admin', req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0] as User;
    res.json({ user, message: 'Successfully promoted to admin' });
  } catch (error) {
    console.error('Setup admin error:', error);
    res.status(500).json({ error: 'Failed to setup admin' });
  }
});

export default router;
