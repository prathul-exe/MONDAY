const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const engine = require('../services/attendance-engine');

const router = express.Router();
router.use(authenticate);

function getSubjectStats(db, subjectId, userId) {
  const records = db.prepare(`
    SELECT status, COUNT(*) as count FROM attendance_records
    WHERE subject_id = ? AND user_id = ?
    GROUP BY status
  `).all(subjectId, userId);

  let attended = 0, absent = 0, excused = 0;
  for (const r of records) {
    if (r.status === 'present') attended = r.count;
    else if (r.status === 'absent') absent = r.count;
    else if (r.status === 'excused') excused = r.count;
  }
  const total = attended + absent; // excused don't count against total

  return { attended, absent, excused, total };
}

function enrichSubject(db, subject) {
  const stats = getSubjectStats(db, subject.id, subject.user_id);
  const percentage = engine.calculatePercentage(stats.attended, stats.total);
  const reqPct = subject.required_attendance || 75;
  const status = engine.getAttendanceStatus(percentage, reqPct);
  const classesCanMiss = engine.calculateClassesCanMiss(stats.attended, stats.total, reqPct);
  const classesNeeded = engine.calculateClassesNeeded(stats.attended, stats.total, reqPct);

  return {
    ...subject,
    ...stats,
    percentage: Math.round(percentage * 10) / 10,
    status: status.status,
    status_label: status.label,
    status_color: status.color,
    status_bg_color: status.bgColor,
    status_stroke_color: status.strokeColor,
    classes_can_miss: classesCanMiss,
    classes_needed: classesNeeded
  };
}

// GET /api/subjects
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const subjects = db.prepare('SELECT * FROM subjects WHERE user_id = ? AND is_active = 1 ORDER BY name').all(req.user.id);
    const enriched = subjects.map(s => enrichSubject(db, s));
    res.json(enriched);
  } catch (err) {
    console.error('Get subjects error:', err);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// POST /api/subjects
router.post('/', [
  body('name').trim().notEmpty().withMessage('Subject name is required'),
  body('code').trim().notEmpty().withMessage('Subject code is required'),
  body('required_attendance').optional().isFloat({ min: 0, max: 100 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const db = getDatabase();
    const id = uuidv4();
    const { name, code, faculty_name, credits, frequency_per_week, room, required_attendance, color } = req.body;

    db.prepare(`
      INSERT INTO subjects (id, user_id, name, code, faculty_name, credits, frequency_per_week, room, required_attendance, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, name, code, faculty_name || null, credits || 3.0, frequency_per_week || 3, room || null, required_attendance || 75.0, color || '#91A995');

    const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
    res.status(201).json(enrichSubject(db, subject));
  } catch (err) {
    console.error('Create subject error:', err);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// GET /api/subjects/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const subject = db.prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    
    const recovery = engine.calculateRecoveryPath(
      0, 0, subject.required_attendance, subject.frequency_per_week
    );
    
    const enriched = enrichSubject(db, subject);
    
    // Recalculate recovery with actual stats
    const recov = engine.calculateRecoveryPath(
      enriched.attended, enriched.total, subject.required_attendance, subject.frequency_per_week
    );
    enriched.recovery = recov;
    
    res.json(enriched);
  } catch (err) {
    console.error('Get subject error:', err);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// PUT /api/subjects/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const subject = db.prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const { name, code, faculty_name, credits, frequency_per_week, room, required_attendance, color } = req.body;
    
    db.prepare(`
      UPDATE subjects SET
        name = COALESCE(?, name), code = COALESCE(?, code), faculty_name = COALESCE(?, faculty_name),
        credits = COALESCE(?, credits), frequency_per_week = COALESCE(?, frequency_per_week),
        room = COALESCE(?, room), required_attendance = COALESCE(?, required_attendance),
        color = COALESCE(?, color), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(name, code, faculty_name, credits, frequency_per_week, room, required_attendance, color, req.params.id, req.user.id);

    const updated = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
    res.json(enrichSubject(db, updated));
  } catch (err) {
    console.error('Update subject error:', err);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// DELETE /api/subjects/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Subject not found' });
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    console.error('Delete subject error:', err);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

module.exports = router;
