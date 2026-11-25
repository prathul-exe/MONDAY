const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, isPostgres, isInvalidInputError } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const engine = require('../services/attendance-engine');

const router = express.Router();
router.use(authenticate);

// GET /api/calendar - Get current academic calendar and holidays
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const calendar = await db.get('SELECT * FROM academic_calendar WHERE user_id = ? AND is_current = 1 LIMIT 1', req.user.id);
    const holidays = await db.all('SELECT * FROM holidays WHERE user_id = ? ORDER BY date ASC', req.user.id);
    res.json({ calendar: calendar || null, holidays });
  } catch (err) {
    console.error('Get calendar error:', err);
    res.status(500).json({ error: 'Failed to load academic calendar' });
  }
});

// PUT /api/calendar - Create or update current semester dates
router.put('/', [
  body('semester_name').trim().notEmpty().withMessage('Semester name is required'),
  body('start_date').notEmpty().withMessage('Start date is required'),
  body('end_date').notEmpty().withMessage('End date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const db = getDatabase();
    const { semester_name, semester_number, start_date, end_date } = req.body;
    const existing = await db.get('SELECT id FROM academic_calendar WHERE user_id = ? AND is_current = 1', req.user.id);

    if (existing) {
      await db.run(`
        UPDATE academic_calendar SET semester_name = ?, semester_number = ?, start_date = ?, end_date = ?
        WHERE id = ? AND user_id = ?
      `, semester_name, semester_number || null, start_date, end_date, existing.id, req.user.id);
      return res.json(await db.get('SELECT * FROM academic_calendar WHERE id = ? AND user_id = ?', existing.id, req.user.id));
    }

    const id = uuidv4();
    await db.run(`
      INSERT INTO academic_calendar (id, user_id, semester_name, semester_number, start_date, end_date, is_current)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, id, req.user.id, semester_name, semester_number || null, start_date, end_date, isPostgres() ? true : 1);

    res.status(201).json(await db.get('SELECT * FROM academic_calendar WHERE id = ? AND user_id = ?', id, req.user.id));
  } catch (err) {
    console.error('Save calendar error:', err);
    res.status(500).json({ error: 'Failed to save academic calendar' });
  }
});

// POST /api/calendar/holidays
router.post('/holidays', [
  body('name').trim().notEmpty(),
  body('date').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const db = getDatabase();
    const calendar = await db.get('SELECT id FROM academic_calendar WHERE user_id = ? AND is_current = 1', req.user.id);
    const id = uuidv4();
    await db.run(`
      INSERT INTO holidays (id, user_id, calendar_id, name, date)
      VALUES (?, ?, ?, ?, ?)
    `, id, req.user.id, calendar ? calendar.id : null, req.body.name, req.body.date);

    res.status(201).json(await db.get('SELECT * FROM holidays WHERE id = ? AND user_id = ?', id, req.user.id));
  } catch (err) {
    console.error('Add holiday error:', err);
    res.status(500).json({ error: 'Failed to add holiday' });
  }
});

// DELETE /api/calendar/holidays/:id
router.delete('/holidays/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.run('DELETE FROM holidays WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Holiday not found' });
    res.json({ message: 'Holiday deleted' });
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Holiday not found' });
    console.error('Delete holiday error:', err);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
});

// GET /api/calendar/projection/:subjectId - Calculate estimated recovery & deadline dates
router.get('/projection/:subjectId', async (req, res) => {
  try {
    const db = getDatabase();
    const subject = await db.get('SELECT * FROM subjects WHERE id = ? AND user_id = ?', req.params.subjectId, req.user.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const counts = await db.all(`
      SELECT status, COUNT(*) as count FROM attendance_records
      WHERE subject_id = ? AND user_id = ? GROUP BY status
    `, subject.id, req.user.id);

    let attended = 0, absent = 0;
    for (const c of counts) {
      if (c.status === 'present') attended = Number(c.count);
      else if (c.status === 'absent') absent = Number(c.count);
    }
    const total = attended + absent;

    const timetableEntries = await db.all('SELECT * FROM timetable_entries WHERE subject_id = ? AND user_id = ? AND is_active = 1', subject.id, req.user.id);
    const holidayRows = await db.all('SELECT date FROM holidays WHERE user_id = ?', req.user.id);
    const holidays = holidayRows.map(h => h.date);
    const calendar = await db.get('SELECT end_date FROM academic_calendar WHERE user_id = ? AND is_current = 1', req.user.id);

    const plannedAbsences = parseInt(req.query.plannedAbsences, 10) || 0;
    const deadlineInfo = engine.calculateDeadlineDate(
      attended, total, subject.required_attendance || 75,
      timetableEntries, holidays, calendar ? calendar.end_date : null
    );

    const projectedPct = engine.predictFutureAttendance(
      attended, total, deadlineInfo.classesRemaining, plannedAbsences
    );

    res.json({
      ...deadlineInfo,
      has_semester_dates: !!calendar,
      has_timetable: timetableEntries.length > 0,
      projected_percentage: Math.round(projectedPct * 10) / 10,
      is_estimate: true
    });
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Subject not found' });
    console.error('Projection error:', err);
    res.status(500).json({ error: 'Failed to calculate projection' });
  }
});

module.exports = router;
