const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, isInvalidInputError, emptyToNull } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const engine = require('../services/attendance-engine');

const router = express.Router();
router.use(authenticate);

async function getSubjectStats(db, subjectId, userId) {
  const records = await db.all(`
    SELECT status, COUNT(*) as count FROM attendance_records
    WHERE subject_id = ? AND user_id = ?
    GROUP BY status
  `, subjectId, userId);

  let attended = 0, absent = 0, excused = 0;
  for (const r of records) {
    if (r.status === 'present') attended = Number(r.count);
    else if (r.status === 'absent') absent = Number(r.count);
    else if (r.status === 'excused') excused = Number(r.count);
  }
  const total = attended + absent; // excused don't count against total

  return { attended, absent, excused, total };
}

async function enrichSubject(db, subject) {
  const stats = await getSubjectStats(db, subject.id, subject.user_id);
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
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const subjects = await db.all('SELECT * FROM subjects WHERE user_id = ? AND is_active = 1 ORDER BY name', req.user.id);
    const enriched = await Promise.all(subjects.map(s => enrichSubject(db, s)));
    res.json(enriched);
  } catch (err) {
    console.error('Get subjects error:', err);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// GET /api/subjects/archived
router.get('/archived', async (req, res) => {
  try {
    const db = getDatabase();
    const subjects = await db.all(
      'SELECT * FROM subjects WHERE user_id = ? AND is_active = 0 ORDER BY updated_at DESC, name ASC',
      req.user.id
    );
    const enriched = await Promise.all(subjects.map(s => enrichSubject(db, s)));
    res.json(enriched);
  } catch (err) {
    console.error('Get archived subjects error:', err);
    res.status(500).json({ error: 'Failed to fetch archived subjects' });
  }
});

// POST /api/subjects
router.post('/', [
  body('name').trim().notEmpty().withMessage('Subject name is required'),
  body('code').trim().notEmpty().withMessage('Subject code is required'),
  body('required_attendance').optional({ values: 'null' }).customSanitizer(v => (v === '' ? undefined : v)).optional().isFloat({ min: 0, max: 100 }),
  body('credits').optional({ values: 'null' }).customSanitizer(v => (v === '' ? undefined : v)).optional().isFloat({ min: 0, max: 10 }).withMessage('Credits must be between 0 and 10'),
  body('frequency_per_week').optional({ values: 'null' }).customSanitizer(v => (v === '' ? undefined : v)).optional().isInt({ min: 1, max: 14 }).withMessage('Frequency per week must be between 1 and 14')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const db = getDatabase();
    const id = uuidv4();
    const { name, code, faculty_name, credits, frequency_per_week, room, required_attendance, color } = req.body;

    const existing = await db.get(`
      SELECT id FROM subjects
      WHERE user_id = ? AND is_active = 1
        AND (LOWER(TRIM(code)) = LOWER(TRIM(?)) OR LOWER(TRIM(name)) = LOWER(TRIM(?)))
    `, req.user.id, code, name);
    if (existing) {
      return res.status(409).json({ error: 'A subject with this name or code already exists' });
    }

    const parsedCredits = credits !== undefined && credits !== null && credits !== '' ? Number(credits) : 3.0;
    const parsedFreq = frequency_per_week !== undefined && frequency_per_week !== null && frequency_per_week !== '' ? parseInt(frequency_per_week, 10) : 3;
    const parsedReq = required_attendance !== undefined && required_attendance !== null && required_attendance !== '' ? Number(required_attendance) : 75.0;

    await db.run(`
      INSERT INTO subjects (id, user_id, name, code, faculty_name, credits, frequency_per_week, room, required_attendance, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, id, req.user.id, name, code, faculty_name || null, parsedCredits, parsedFreq, room || null, parsedReq, color || '#91A995');

    const subject = await db.get('SELECT * FROM subjects WHERE id = ? AND user_id = ?', id, req.user.id);
    res.status(201).json(await enrichSubject(db, subject));
  } catch (err) {
    console.error('Create subject error:', err);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// GET /api/subjects/:id
router.get('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const subject = await db.get('SELECT * FROM subjects WHERE id = ? AND user_id = ? AND is_active = 1', req.params.id, req.user.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const enriched = await enrichSubject(db, subject);

    const recov = engine.calculateRecoveryPath(
      enriched.attended, enriched.total, subject.required_attendance, subject.frequency_per_week
    );
    enriched.recovery = recov;

    res.json(enriched);
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Subject not found' });
    console.error('Get subject error:', err);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// PUT /api/subjects/:id
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Subject name cannot be empty'),
  body('code').optional().trim().notEmpty().withMessage('Subject code cannot be empty'),
  body('required_attendance').optional({ values: 'null' }).customSanitizer(v => (v === '' ? undefined : v)).optional().isFloat({ min: 0, max: 100 }).withMessage('Required attendance must be between 0 and 100'),
  body('credits').optional({ values: 'null' }).customSanitizer(v => (v === '' ? undefined : v)).optional().isFloat({ min: 0, max: 10 }).withMessage('Credits must be between 0 and 10'),
  body('frequency_per_week').optional({ values: 'null' }).customSanitizer(v => (v === '' ? undefined : v)).optional().isInt({ min: 1, max: 14 }).withMessage('Frequency per week must be between 1 and 14')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const db = getDatabase();
    const subject = await db.get('SELECT * FROM subjects WHERE id = ? AND user_id = ? AND is_active = 1', req.params.id, req.user.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const { name, code, faculty_name, credits, frequency_per_week, room, required_attendance, color } = req.body;

    const nextName = name !== undefined ? name : subject.name;
    const nextCode = code !== undefined ? code : subject.code;
    const duplicate = await db.get(`
      SELECT id FROM subjects
      WHERE user_id = ? AND is_active = 1 AND id != ?
        AND (LOWER(TRIM(code)) = LOWER(TRIM(?)) OR LOWER(TRIM(name)) = LOWER(TRIM(?)))
    `, req.user.id, req.params.id, nextCode, nextName);
    if (duplicate) {
      return res.status(409).json({ error: 'A subject with this name or code already exists' });
    }

    await db.run(`
      UPDATE subjects SET
        name = COALESCE(?, name), code = COALESCE(?, code), faculty_name = COALESCE(?, faculty_name),
        credits = COALESCE(?, credits), frequency_per_week = COALESCE(?, frequency_per_week),
        room = COALESCE(?, room), required_attendance = COALESCE(?, required_attendance),
        color = COALESCE(?, color), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, name, code, faculty_name, emptyToNull(credits), emptyToNull(frequency_per_week), room, emptyToNull(required_attendance), color, req.params.id, req.user.id);

    const updated = await db.get('SELECT * FROM subjects WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
    res.json(await enrichSubject(db, updated));
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Subject not found' });
    console.error('Update subject error:', err);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

const normalizeTime = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return null;
};

// POST /api/subjects/:id/restore
router.post('/:id/restore', async (req, res) => {
  try {
    const db = getDatabase();
    const restored = await db.transaction(async (tx) => {
      const archived = await tx.get(
        'SELECT * FROM subjects WHERE id = ? AND user_id = ? AND is_active = 0',
        req.params.id, req.user.id
      );
      if (!archived) return { status: 404, error: 'Archived subject not found' };

      const conflict = await tx.get(`
        SELECT id FROM subjects
        WHERE user_id = ? AND is_active = 1 AND id != ?
          AND (LOWER(TRIM(code)) = LOWER(TRIM(?)) OR LOWER(TRIM(name)) = LOWER(TRIM(?)))
      `, req.user.id, archived.id, archived.code, archived.name);
      if (conflict) {
        return { status: 409, error: 'An active subject with this name or code already exists' };
      }

      const archivedSlots = await tx.all(
        'SELECT id, day_of_week, start_time, end_time FROM timetable_entries WHERE subject_id = ? AND user_id = ? AND is_active = 0',
        archived.id, req.user.id
      );
      if (archivedSlots.length > 0) {
        const activeSlots = await tx.all(
          'SELECT id, day_of_week, start_time, end_time FROM timetable_entries WHERE user_id = ? AND is_active = 1',
          req.user.id
        );
        const hasOverlap = archivedSlots.some((arch) => {
          const aStart = normalizeTime(String(arch.start_time));
          const aEnd = normalizeTime(String(arch.end_time));
          if (!aStart || !aEnd) return false;
          return activeSlots.some((act) => {
            if (Number(act.day_of_week) !== Number(arch.day_of_week)) return false;
            const bStart = normalizeTime(String(act.start_time));
            const bEnd = normalizeTime(String(act.end_time));
            return bStart && bEnd && bStart < aEnd && bEnd > aStart;
          });
        });
        if (hasOverlap) {
          return {
            status: 409,
            error: 'Cannot restore subject because one or more of its timetable slots conflict with existing active timetable entries'
          };
        }
      }

      await tx.run(
        'UPDATE subjects SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        archived.id, req.user.id
      );
      await tx.run(
        'UPDATE timetable_entries SET is_active = 1 WHERE subject_id = ? AND user_id = ?',
        archived.id, req.user.id
      );

      const row = await tx.get('SELECT * FROM subjects WHERE id = ? AND user_id = ?', archived.id, req.user.id);
      return { status: 200, row };
    });

    if (restored.error) return res.status(restored.status).json({ error: restored.error });
    res.json(await enrichSubject(db, restored.row));
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Archived subject not found' });
    console.error('Restore subject error:', err);
    res.status(500).json({ error: 'Failed to restore subject' });
  }
});

// DELETE /api/subjects/:id (soft-archive to preserve attendance, deadlines, and timetable history)
router.delete('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const archived = await db.transaction(async (tx) => {
      const existing = await tx.get(
        'SELECT id FROM subjects WHERE id = ? AND user_id = ? AND is_active = 1',
        req.params.id, req.user.id
      );
      if (!existing) return false;

      await tx.run(
        'UPDATE subjects SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        req.params.id, req.user.id
      );
      await tx.run(
        'UPDATE timetable_entries SET is_active = 0 WHERE subject_id = ? AND user_id = ?',
        req.params.id, req.user.id
      );
      return true;
    });

    if (!archived) return res.status(404).json({ error: 'Subject not found' });
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    if (isInvalidInputError(err)) return res.status(404).json({ error: 'Subject not found' });
    console.error('Delete subject error:', err);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

module.exports = router;
