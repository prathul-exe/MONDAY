const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDatabase, isPostgres, isUniqueConstraintError } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function toDbBool(val) {
  if (val === undefined) return null;
  return isPostgres() ? Boolean(val) : (val ? 1 : 0);
}

async function ensureSettings(db, userId) {
  let settings = await db.get('SELECT * FROM user_settings WHERE user_id = ?', userId);
  if (!settings) {
    const id = uuidv4();
    try {
      await db.run('INSERT INTO user_settings (id, user_id) VALUES (?, ?)', id, userId);
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }
    settings = await db.get('SELECT * FROM user_settings WHERE user_id = ?', userId);
  }
  return settings;
}

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const settings = await ensureSettings(db, req.user.id);
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const db = getDatabase();
    await ensureSettings(db, req.user.id);

    const {
      min_attendance_threshold,
      warning_threshold,
      smart_buffer_warnings,
      critical_shortage_alert,
      morning_rundown,
      theme,
      notification_enabled
    } = req.body;

    await db.run(`
      UPDATE user_settings SET
        min_attendance_threshold = COALESCE(?, min_attendance_threshold),
        warning_threshold = COALESCE(?, warning_threshold),
        smart_buffer_warnings = COALESCE(?, smart_buffer_warnings),
        critical_shortage_alert = COALESCE(?, critical_shortage_alert),
        morning_rundown = COALESCE(?, morning_rundown),
        theme = COALESCE(?, theme),
        notification_enabled = COALESCE(?, notification_enabled),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `,
      min_attendance_threshold,
      warning_threshold,
      toDbBool(smart_buffer_warnings),
      toDbBool(critical_shortage_alert),
      toDbBool(morning_rundown),
      theme,
      toDbBool(notification_enabled),
      req.user.id
    );

    const updated = await db.get('SELECT * FROM user_settings WHERE user_id = ?', req.user.id);
    res.json(updated);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/settings/reset-attendance
router.post('/reset-attendance', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.run('DELETE FROM attendance_records WHERE user_id = ?', req.user.id);
    res.json({ message: 'All attendance records have been reset', deleted: result.changes });
  } catch (err) {
    console.error('Reset attendance error:', err);
    res.status(500).json({ error: 'Failed to reset attendance records' });
  }
});

module.exports = router;
