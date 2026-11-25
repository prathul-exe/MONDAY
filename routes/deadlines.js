const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/deadlines
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    let query = `
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d
      LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.user_id = ?
    `;
    const params = [req.user.id];

    if (req.query.subject_id) {
      query += ' AND d.subject_id = ?';
      params.push(req.query.subject_id);
    }
    if (req.query.is_completed !== undefined) {
      query += ' AND d.is_completed = ?';
      params.push(req.query.is_completed === 'true' || req.query.is_completed === '1' ? 1 : 0);
    }

    query += ' ORDER BY d.is_completed ASC, d.due_date ASC, d.due_time ASC';
    const deadlines = db.prepare(query).all(...params);
    res.json(deadlines);
  } catch (err) {
    console.error('Get deadlines error:', err);
    res.status(500).json({ error: 'Failed to fetch deadlines' });
  }
});

// POST /api/deadlines
router.post('/', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('due_date').notEmpty().withMessage('Due date is required'),
  body('category').optional().isIn(['assignment', 'tp_lab', 'project', 'exam_quiz', 'reading', 'custom'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const db = getDatabase();
    const id = uuidv4();
    const {
      title, description, subject_id, category,
      due_date, due_time, grade_weight, platform, reminder_before
    } = req.body;

    if (subject_id) {
      const subj = db.prepare('SELECT id FROM subjects WHERE id = ? AND user_id = ?').get(subject_id, req.user.id);
      if (!subj) return res.status(404).json({ error: 'Subject not found' });
    }

    db.prepare(`
      INSERT INTO deadlines (id, user_id, subject_id, title, description, category, due_date, due_time, grade_weight, platform, reminder_before)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.user.id, subject_id || null, title, description || null,
      category || 'assignment', due_date, due_time || '23:59',
      grade_weight || 0, platform || null, reminder_before || null
    );

    const created = db.prepare(`
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = ?
    `).get(id);

    res.status(201).json(created);
  } catch (err) {
    console.error('Create deadline error:', err);
    res.status(500).json({ error: 'Failed to create deadline' });
  }
});

// PUT /api/deadlines/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM deadlines WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Deadline not found' });

    const { title, description, subject_id, category, due_date, due_time, grade_weight, platform, reminder_before } = req.body;

    db.prepare(`
      UPDATE deadlines SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        subject_id = COALESCE(?, subject_id),
        category = COALESCE(?, category),
        due_date = COALESCE(?, due_date),
        due_time = COALESCE(?, due_time),
        grade_weight = COALESCE(?, grade_weight),
        platform = COALESCE(?, platform),
        reminder_before = COALESCE(?, reminder_before),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(title, description, subject_id, category, due_date, due_time, grade_weight, platform, reminder_before, req.params.id, req.user.id);

    const updated = db.prepare(`
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = ?
    `).get(req.params.id);

    res.json(updated);
  } catch (err) {
    console.error('Update deadline error:', err);
    res.status(500).json({ error: 'Failed to update deadline' });
  }
});

// PUT /api/deadlines/:id/complete
router.put('/:id/complete', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare(`
      UPDATE deadlines SET is_completed = 1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Deadline not found' });

    const updated = db.prepare(`
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Complete deadline error:', err);
    res.status(500).json({ error: 'Failed to mark deadline complete' });
  }
});

// PUT /api/deadlines/:id/uncomplete
router.put('/:id/uncomplete', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare(`
      UPDATE deadlines SET is_completed = 0, completed_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Deadline not found' });

    const updated = db.prepare(`
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Uncomplete deadline error:', err);
    res.status(500).json({ error: 'Failed to reopen deadline' });
  }
});

// DELETE /api/deadlines/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM deadlines WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Deadline not found' });
    res.json({ message: 'Deadline deleted' });
  } catch (err) {
    console.error('Delete deadline error:', err);
    res.status(500).json({ error: 'Failed to delete deadline' });
  }
});

module.exports = router;
