const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, isUniqueConstraintError } = require('../database/db');
const { authenticate, generateToken } = require('../middleware/auth');

const router = express.Router();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// POST /api/auth/register
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').trim().notEmpty().withMessage('Full name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const db = getDatabase();
    const { email, password, full_name, student_id, department, semester } = req.body;

    // Check if email exists
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await db.transaction(async (tx) => {
      await tx.run(`
        INSERT INTO users (id, email, password_hash, full_name, student_id, department, semester)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, id, email, password_hash, full_name, student_id || null, department || null, semester || 1);

      await tx.run(`
        INSERT INTO user_settings (id, user_id) VALUES (?, ?)
      `, uuidv4(), id);
    });

    const user = { id, email, full_name, student_id, department, semester: semester || 1 };
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Valid email and password required' });
    }

    const db = getDatabase();
    const { email, password } = req.body;

    const user = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { password_hash, ...safeUser } = user;
    const token = generateToken(user);

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const db = getDatabase();
    const user = await db.get('SELECT id, email, full_name, student_id, department, semester, profile_image, created_at FROM users WHERE id = ?', req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// PUT /api/auth/me
router.put('/me', authenticate, [
  body('full_name').optional().trim().notEmpty(),
  body('student_id').optional().trim(),
  body('department').optional().trim(),
  body('semester').optional().isInt({ min: 1, max: 12 })
], async (req, res) => {
  try {
    const db = getDatabase();
    const { full_name, student_id, department, semester } = req.body;

    await db.run(`
      UPDATE users SET
        full_name = COALESCE(?, full_name),
        student_id = COALESCE(?, student_id),
        department = COALESCE(?, department),
        semester = COALESCE(?, semester),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, full_name, student_id, department, semester, req.user.id);

    const user = await db.get('SELECT id, email, full_name, student_id, department, semester, profile_image, created_at FROM users WHERE id = ?', req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], (req, res) => {
  // In production, send a reset email via configured SMTP provider.
  res.json({ message: 'If an account with that email exists, password reset instructions would be sent. For this demo, please register a new account or contact the administrator.' });
});

// DELETE /api/auth/me - Permanently delete account and all associated data
router.delete('/me', authenticate, async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.run('DELETE FROM users WHERE id = ?', req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Account and all associated data permanently deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
