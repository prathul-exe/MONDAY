const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, isUniqueConstraintError, isInvalidInputError, emptyToNull } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const engine = require('../services/attendance-engine');

const router = express.Router();
router.use(authenticate);

async function getSubjectWithStats(db, subjectId, userId) {
  const subject = await db.get('SELECT * FROM subjects WHERE id = ? AND user_id = ?', subjectId, userId);
  if (!subject) return null;

  const records = await db.all(`
    SELECT status, COUNT(*) as count FROM attendance_records
    WHERE subject_id = ? AND user_id = ? GROUP BY status
  `, subjectId, userId);

  let attended = 0, absent = 0, excused = 0;
  for (const r of records) {
    if (r.status === 'present') attended = Number(r.count);
    else if (r.status === 'absent') absent = Number(r.count);
    else if (r.status === 'excused') excused = Number(r.count);
  }
  const total = attended + absent;
  const percentage = engine.calculatePercentage(attended, total);
  const reqPct = subject.required_attendance || 75;
  const status = engine.getAttendanceStatus(percentage, reqPct);

  return {
    ...subject, attended, absent, excused, total,
    percentage: Math.round(percentage * 10) / 10,
    status: status.status, status_label: status.label,
    classes_can_miss: engine.calculateClassesCanMiss(attended, total, reqPct),
    classes_needed: engine.calculateClassesNeeded(attended, total, reqPct)
  };
}

// POST /api/attendance
router.post('/', [
  body('subject_id').notEmpty().withMessage('Subject ID is required'),
  body('date').notEmpty().withMessage('Date is required'),
  body('status').isIn(['present', 'absent', 'excused']).withMessage('Status must be present, absent, or excused')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const db = getDatabase();
    const { subject_id, date, status, session_type, start_time, end_time, notes, lecture_number } = req.body;

    // Verify subject belongs to user
    const subject = await db.get('SELECT id FROM subjects WHERE id = ? AND user_id = ?', subject_id, req.user.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const id = uuidv4();
    try {
      await db.transaction(async (tx) => {
        await tx.run(`
          INSERT INTO attendance_records (id, subject_id, user_id, date, status, session_type, start_time, end_time, notes, lecture_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, id, subject_id, req.user.id, date, status, session_type || 'lecture', emptyToNull(start_time), emptyToNull(end_time), notes || null, lecture_number || null);

        await tx.run(`
          INSERT INTO attendance_audit_log (id, record_id, subject_id, user_id, action, new_status)
          VALUES (?, ?, ?, ?, 'INSERT', ?)
        `, uuidv4(), id, subject_id, req.user.id, status);
      });
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return res.status(409).json({ error: 'An attendance record already exists for this class' });
      }
      throw e;
    }

    const record = await db.get('SELECT * FROM attendance_records WHERE id = ? AND user_id = ?', id, req.user.id);
    const updatedSubject = await getSubjectWithStats(db, subject_id, req.user.id);

    res.status(201).json({ record, subject: updatedSubject });
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Subject not found' });
    console.error('Create attendance error:', err);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// GET /api/attendance
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    let query = 'SELECT ar.*, s.name as subject_name, s.code as subject_code FROM attendance_records ar JOIN subjects s ON ar.subject_id = s.id WHERE ar.user_id = ?';
    const params = [req.user.id];

    if (req.query.subject_id) { query += ' AND ar.subject_id = ?'; params.push(req.query.subject_id); }
    if (req.query.date_from) { query += ' AND ar.date >= ?'; params.push(req.query.date_from); }
    if (req.query.date_to) { query += ' AND ar.date <= ?'; params.push(req.query.date_to); }
    if (req.query.status) { query += ' AND ar.status = ?'; params.push(req.query.status); }

    query += ' ORDER BY ar.date DESC, ar.start_time DESC';
    if (req.query.limit) { query += ' LIMIT ?'; params.push(parseInt(req.query.limit, 10)); }

    const records = await db.all(query, ...params);
    res.json(records);
  } catch (err) {
    if (isInvalidInputError(err)) return res.json([]);
    console.error('Get attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// GET /api/attendance/subject/:subjectId
router.get('/subject/:subjectId', async (req, res) => {
  try {
    const db = getDatabase();
    const records = await db.all(`
      SELECT * FROM attendance_records WHERE subject_id = ? AND user_id = ? ORDER BY date DESC, start_time DESC
    `, req.params.subjectId, req.user.id);
    res.json(records);
  } catch (err) {
    if (isInvalidInputError(err)) return res.json([]);
    console.error('Get subject attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// PUT /api/attendance/:id
router.put('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const record = await db.get('SELECT * FROM attendance_records WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const { status, session_type, notes, date, start_time, end_time } = req.body;
    await db.transaction(async (tx) => {
      await tx.run(`
        UPDATE attendance_records SET
          status = COALESCE(?, status), session_type = COALESCE(?, session_type),
          notes = COALESCE(?, notes), date = COALESCE(?, date),
          start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, status, session_type, notes, emptyToNull(date), emptyToNull(start_time), emptyToNull(end_time), req.params.id, req.user.id);

      if (status && status !== record.status) {
        await tx.run(`
          INSERT INTO attendance_audit_log (id, record_id, subject_id, user_id, action, old_status, new_status)
          VALUES (?, ?, ?, ?, 'UPDATE', ?, ?)
        `, uuidv4(), record.id, record.subject_id, req.user.id, record.status, status);
      }
    });

    const updated = await db.get('SELECT * FROM attendance_records WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    const updatedSubject = await getSubjectWithStats(db, record.subject_id, req.user.id);
    res.json({ record: updated, subject: updatedSubject });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: 'An attendance record already exists for this class' });
    }
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Record not found' });
    console.error('Update attendance error:', err);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// DELETE /api/attendance/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const record = await db.get('SELECT * FROM attendance_records WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });

    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM attendance_records WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
      await tx.run(`
        INSERT INTO attendance_audit_log (id, record_id, subject_id, user_id, action, old_status)
        VALUES (?, ?, ?, ?, 'DELETE', ?)
      `, uuidv4(), record.id, record.subject_id, req.user.id, record.status);
    });

    const updatedSubject = await getSubjectWithStats(db, record.subject_id, req.user.id);
    res.json({ message: 'Record deleted', subject: updatedSubject });
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Record not found' });
    console.error('Delete attendance error:', err);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

module.exports = router;
