const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function ensureSettings(db, userId) {
  let settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (!settings) {
    const id = uuidv4();
    db.prepare('INSERT INTO user_settings (id, user_id) VALUES (?, ?)').run(id, userId);
    settings = db.prepare('SELECT * FROM user_settings WHERE id = ?').get(id);
  }
  return settings;
}

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const settings = ensureSettings(db, req.user.id);
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PUT /api/settings
router.put('/', (req, res) => {
  try {
    const db = getDatabase();
    ensureSettings(db, req.user.id);

    const {
      min_attendance_threshold,
      warning_threshold,
      smart_buffer_warnings,
      critical_shortage_alert,
      morning_rundown,
      theme,
      notification_enabled
    } = req.body;

    db.prepare(`
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
    `).run(
      min_attendance_threshold,
      warning_threshold,
      smart_buffer_warnings !== undefined ? (smart_buffer_warnings ? 1 : 0) : null,
      critical_shortage_alert !== undefined ? (critical_shortage_alert ? 1 : 0) : null,
      morning_rundown !== undefined ? (morning_rundown ? 1 : 0) : null,
      theme,
      notification_enabled !== undefined ? (notification_enabled ? 1 : 0) : null,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
    res.json(updated);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/settings/reset-attendance
router.post('/reset-attendance', (req, res) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM attendance_records WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All attendance records have been reset', deleted: result.changes });
  } catch (err) {
    console.error('Reset attendance error:', err);
    res.status(500).json({ error: 'Failed to reset attendance records' });
  }
});

module.exports = router;
