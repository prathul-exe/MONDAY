const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, isInvalidInputError, emptyToNull } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/timetable
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const entries = await db.all(`
      SELECT t.*, s.name as subject_name, s.code as subject_code, s.color as subject_color
      FROM timetable_entries t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.user_id = ? AND t.is_active = 1
      ORDER BY t.day_of_week ASC, t.start_time ASC
    `, req.user.id);

    const grouped = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const entry of entries) {
      if (grouped[entry.day_of_week]) {
        grouped[entry.day_of_week].push(entry);
      }
    }

    res.json({ entries, grouped });
  } catch (err) {
    console.error('Get timetable error:', err);
    res.status(500).json({ error: 'Failed to fetch timetable' });
  }
});

// GET /api/timetable/today
router.get('/today', async (req, res) => {
  try {
    const db = getDatabase();
    const todayDow = new Date().getDay();
    const entries = await db.all(`
      SELECT t.*, s.name as subject_name, s.code as subject_code, s.color as subject_color
      FROM timetable_entries t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.user_id = ? AND t.day_of_week = ? AND t.is_active = 1
      ORDER BY t.start_time ASC
    `, req.user.id, todayDow);
    res.json(entries);
  } catch (err) {
    console.error('Get today timetable error:', err);
    res.status(500).json({ error: 'Failed to fetch today schedule' });
  }
});

// POST /api/timetable
router.post('/', [
  body('day_of_week').isInt({ min: 0, max: 6 }).withMessage('Day of week must be 0-6'),
  body('start_time').notEmpty().withMessage('Start time is required'),
  body('end_time').notEmpty().withMessage('End time is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const db = getDatabase();
    const { subject_id, day_of_week, start_time, end_time, session_type, room } = req.body;
    const isBreak = session_type === 'lunch' || session_type === 'break';

    if (!isBreak) {
      if (!subject_id) return res.status(400).json({ error: 'Subject is required' });
      const subject = await db.get('SELECT id FROM subjects WHERE id = ? AND user_id = ?', subject_id, req.user.id);
      if (!subject) return res.status(404).json({ error: 'Subject not found' });
    }

    const id = uuidv4();
    await db.run(`
      INSERT INTO timetable_entries (id, user_id, subject_id, day_of_week, start_time, end_time, session_type, room)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, id, req.user.id, isBreak ? null : subject_id, day_of_week, start_time, end_time, session_type || 'lecture', room || null);

    const created = await db.get(`
      SELECT t.*, s.name as subject_name, s.code as subject_code
      FROM timetable_entries t LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.id = ? AND t.user_id = ?
    `, id, req.user.id);

    res.status(201).json(created);
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Subject not found' });
    console.error('Create timetable error:', err);
    res.status(500).json({ error: 'Failed to add timetable slot' });
  }
});

// PUT /api/timetable/:id
router.put('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const existing = await db.get('SELECT * FROM timetable_entries WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Timetable entry not found' });

    const { subject_id, day_of_week, start_time, end_time, session_type, room } = req.body;
    if (subject_id) {
      const subject = await db.get('SELECT id FROM subjects WHERE id = ? AND user_id = ?', subject_id, req.user.id);
      if (!subject) return res.status(404).json({ error: 'Subject not found' });
    }

    await db.run(`
      UPDATE timetable_entries SET
        subject_id = COALESCE(?, subject_id),
        day_of_week = COALESCE(?, day_of_week),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        session_type = COALESCE(?, session_type),
        room = COALESCE(?, room)
      WHERE id = ? AND user_id = ?
    `, subject_id, emptyToNull(day_of_week), emptyToNull(start_time), emptyToNull(end_time), session_type, room, req.params.id, req.user.id);

    const updated = await db.get(`
      SELECT t.*, s.name as subject_name, s.code as subject_code
      FROM timetable_entries t LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.id = ? AND t.user_id = ?
    `, req.params.id, req.user.id);

    res.json(updated);
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Timetable entry not found' });
    console.error('Update timetable error:', err);
    res.status(500).json({ error: 'Failed to update timetable entry' });
  }
});

// DELETE /api/timetable/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.run('DELETE FROM timetable_entries WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Timetable entry not found' });
    res.json({ message: 'Timetable entry deleted' });
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Timetable entry not found' });
    console.error('Delete timetable error:', err);
    res.status(500).json({ error: 'Failed to delete timetable entry' });
  }
});

module.exports = router;
