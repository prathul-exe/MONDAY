const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/db');
const engine = require('../services/attendance-engine');

/**
 * Create a notification record for a user.
 */
async function createNotification(userId, type, title, message, level = 'info', relatedSubjectId = null) {
  const db = getDatabase();
  const id = uuidv4();
  await db.run(`
    INSERT INTO notifications (id, user_id, type, title, message, level, related_subject_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, id, userId, type, title, message, level, relatedSubjectId);
  return db.get('SELECT * FROM notifications WHERE id = ?', id);
}

/**
 * Evaluate all active subjects for a user and generate attendance warnings
 * when thresholds or low-buffer conditions are triggered.
 */
async function generateAttendanceWarnings(userId) {
  const db = getDatabase();
  const settings = (await db.get('SELECT * FROM user_settings WHERE user_id = ?', userId)) || {
    min_attendance_threshold: 75,
    warning_threshold: 80,
    smart_buffer_warnings: 1,
    critical_shortage_alert: 1,
    notification_enabled: 1
  };

  if (!settings.notification_enabled) return [];

  const subjects = await db.all('SELECT * FROM subjects WHERE user_id = ? AND is_active = 1', userId);
  const created = [];

  for (const subject of subjects) {
    const counts = await db.all(`
      SELECT status, COUNT(*) as count
      FROM attendance_records
      WHERE subject_id = ? AND user_id = ?
      GROUP BY status
    `, subject.id, userId);

    let attended = 0;
    let absent = 0;
    for (const c of counts) {
      if (c.status === 'present') attended = Number(c.count);
      else if (c.status === 'absent') absent = Number(c.count);
    }

    const total = attended + absent;
    if (total === 0) continue;

    const pct = engine.calculatePercentage(attended, total);
    const reqPct = subject.required_attendance || settings.min_attendance_threshold || 75;
    const needed = engine.calculateClassesNeeded(attended, total, reqPct);
    const canMiss = engine.calculateClassesCanMiss(attended, total, reqPct);

    // Avoid spamming duplicate unread notifications for the same subject & type
    const hasUnread = async (type) => !!(await db.get(`
      SELECT id FROM notifications
      WHERE user_id = ? AND related_subject_id = ? AND type = ? AND is_read = 0
    `, userId, subject.id, type));

    if (pct < reqPct && settings.critical_shortage_alert) {
      if (!(await hasUnread('attendance_shortage'))) {
        const msg = needed > 0
          ? `${subject.code} is at ${pct.toFixed(1)}% (below ${reqPct}%). Attend ${needed} consecutive classes to recover.`
          : `${subject.code} is at ${pct.toFixed(1)}% (below ${reqPct}%).`;
        created.push(await createNotification(userId, 'attendance_shortage', `Shortage Alert: ${subject.name}`, msg, 'critical', subject.id));
      }
    } else if (pct < (settings.warning_threshold || reqPct + 5) && settings.smart_buffer_warnings) {
      if (!(await hasUnread('attendance_warning'))) {
        const msg = canMiss <= 2
          ? `${subject.code} is at ${pct.toFixed(1)}%. Only ${canMiss} safe miss${canMiss === 1 ? '' : 'es'} remaining.`
          : `${subject.code} is at ${pct.toFixed(1)}%, approaching your ${reqPct}% minimum.`;
        created.push(await createNotification(userId, 'attendance_warning', `Low Buffer: ${subject.name}`, msg, 'warning', subject.id));
      }
    }
  }

  return created;
}

module.exports = {
  createNotification,
  generateAttendanceWarnings
};
