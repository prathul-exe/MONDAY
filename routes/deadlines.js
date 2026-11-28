const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, isPostgres, isInvalidInputError, emptyToNull } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/deadlines
router.get('/', async (req, res) => {
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
      const completed = req.query.is_completed === 'true' || req.query.is_completed === '1';
      query += ' AND d.is_completed = ?';
      params.push(isPostgres() ? completed : (completed ? 1 : 0));
    }

    query += ' ORDER BY d.is_completed ASC, d.due_date ASC, d.due_time ASC';
    const deadlines = await db.all(query, ...params);
    res.json(deadlines);
  } catch (err) {
    if (isInvalidInputError(err)) return res.json([]);
    console.error('Get deadlines error:', err);
    res.status(500).json({ error: 'Failed to fetch deadlines' });
  }
});

// POST /api/deadlines
router.post('/', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('due_date').notEmpty().withMessage('Due date is required'),
  body('category').optional().isIn(['assignment', 'tp_lab', 'project', 'exam_quiz', 'reading', 'custom'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const db = getDatabase();
    const id = uuidv4();
    const {
      title, description, subject_id, category,
      due_date, due_time, platform, reminder_before
    } = req.body;

    const normalizedCategory = category || 'assignment';
    const normalizedDueTime = due_time || '23:59';
    const normalizedDescription = description ? String(description).trim() : null;

    if (normalizedCategory === 'custom' && !normalizedDescription) {
      return res.status(400).json({ error: 'Custom task name is required' });
    }

    if (subject_id) {
      const subj = await db.get('SELECT id FROM subjects WHERE id = ? AND user_id = ?', subject_id, req.user.id);
      if (!subj) return res.status(404).json({ error: 'Subject not found' });
    }

    const dupParams = [req.user.id, title, due_date, normalizedDueTime, normalizedCategory];
    let dupQuery = `
      SELECT id FROM deadlines
      WHERE user_id = ?
        AND LOWER(TRIM(title)) = LOWER(TRIM(?))
        AND due_date = ?
        AND COALESCE(due_time, '23:59') = ?
        AND category = ?
    `;
    if (subject_id) {
      dupQuery += ' AND subject_id = ?';
      dupParams.push(subject_id);
    } else {
      dupQuery += ' AND subject_id IS NULL';
    }
    const existingDup = await db.get(dupQuery, ...dupParams);
    if (existingDup) {
      return res.status(409).json({ error: 'A task with this title and due date already exists' });
    }

    await db.run(`
      INSERT INTO deadlines (id, user_id, subject_id, title, description, category, due_date, due_time, platform, reminder_before)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id, req.user.id, subject_id || null, title, normalizedDescription,
      normalizedCategory, due_date, normalizedDueTime,
      platform || null, reminder_before || null
    );

    const created = await db.get(`
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = ? AND d.user_id = ?
    `, id, req.user.id);

    res.status(201).json(created);
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Subject not found' });
    console.error('Create deadline error:', err);
    res.status(500).json({ error: 'Failed to create deadline' });
  }
});

// PUT /api/deadlines/:id
router.put('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const existing = await db.get('SELECT * FROM deadlines WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Deadline not found' });

    const { title, description, subject_id, category, due_date, due_time, platform, reminder_before } = req.body;

    const nextCategory = category !== undefined ? category : existing.category;
    const nextDescription = description !== undefined ? (description ? String(description).trim() : null) : existing.description;
    if (nextCategory === 'custom' && !nextDescription) {
      return res.status(400).json({ error: 'Custom task name is required' });
    }

    if (subject_id) {
      const subj = await db.get('SELECT id FROM subjects WHERE id = ? AND user_id = ?', subject_id, req.user.id);
      if (!subj) return res.status(404).json({ error: 'Subject not found' });
    }

    await db.run(`
      UPDATE deadlines SET
        title = COALESCE(?, title),
        description = ?,
        subject_id = COALESCE(?, subject_id),
        category = COALESCE(?, category),
        due_date = COALESCE(?, due_date),
        due_time = COALESCE(?, due_time),
        platform = COALESCE(?, platform),
        reminder_before = COALESCE(?, reminder_before),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, title, nextDescription, subject_id, category, emptyToNull(due_date), emptyToNull(due_time), platform, reminder_before, req.params.id, req.user.id);

    const updated = await db.get(`
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = ? AND d.user_id = ?
    `, req.params.id, req.user.id);

    res.json(updated);
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Deadline not found' });
    console.error('Update deadline error:', err);
    res.status(500).json({ error: 'Failed to update deadline' });
  }
});

// PUT /api/deadlines/:id/complete
router.put('/:id/complete', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.run(`
      UPDATE deadlines SET is_completed = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, isPostgres() ? true : 1, req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Deadline not found' });

    const updated = await db.get(`
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = ? AND d.user_id = ?
    `, req.params.id, req.user.id);
    res.json(updated);
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Deadline not found' });
    console.error('Complete deadline error:', err);
    res.status(500).json({ error: 'Failed to mark deadline complete' });
  }
});

// PUT /api/deadlines/:id/uncomplete
router.put('/:id/uncomplete', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.run(`
      UPDATE deadlines SET is_completed = ?, completed_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, isPostgres() ? false : 0, req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Deadline not found' });

    const updated = await db.get(`
      SELECT d.*, s.name as subject_name, s.code as subject_code
      FROM deadlines d LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = ? AND d.user_id = ?
    `, req.params.id, req.user.id);
    res.json(updated);
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Deadline not found' });
    console.error('Uncomplete deadline error:', err);
    res.status(500).json({ error: 'Failed to reopen deadline' });
  }
});

// DELETE /api/deadlines/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.run('DELETE FROM deadlines WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Deadline not found' });
    res.json({ message: 'Deadline deleted' });
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Deadline not found' });
    console.error('Delete deadline error:', err);
    res.status(500).json({ error: 'Failed to delete deadline' });
  }
});

module.exports = router;
