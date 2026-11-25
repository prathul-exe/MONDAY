const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const engine = require('../services/attendance-engine');

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) || {
      min_attendance_threshold: 75,
      warning_threshold: 80
    };

    const subjects = db.prepare('SELECT * FROM subjects WHERE user_id = ? AND is_active = 1 ORDER BY name').all(userId);

    let totalAttended = 0;
    let totalAbsent = 0;
    let totalExcused = 0;
    const subjectSummaries = [];
    const subjectsBelowThreshold = [];
    const subjectsAtRisk = [];
    const attendanceWarnings = [];
    const improvementSuggestions = [];

    for (const s of subjects) {
      const counts = db.prepare(`
        SELECT status, COUNT(*) as count
        FROM attendance_records
        WHERE subject_id = ? AND user_id = ?
        GROUP BY status
      `).all(s.id, userId);

      let attended = 0, absent = 0, excused = 0;
      for (const c of counts) {
        if (c.status === 'present') attended = c.count;
        else if (c.status === 'absent') absent = c.count;
        else if (c.status === 'excused') excused = c.count;
      }

      const total = attended + absent;
      totalAttended += attended;
      totalAbsent += absent;
      totalExcused += excused;

      const reqPct = s.required_attendance || settings.min_attendance_threshold || 75;
      const pct = engine.calculatePercentage(attended, total);
      const status = engine.getAttendanceStatus(pct, reqPct);
      const classesCanMiss = engine.calculateClassesCanMiss(attended, total, reqPct);
      const classesNeeded = engine.calculateClassesNeeded(attended, total, reqPct);

      const enriched = {
        ...s,
        attended,
        absent,
        excused,
        total,
        percentage: Math.round(pct * 10) / 10,
        status: status.status,
        status_label: status.label,
        classes_can_miss: classesCanMiss,
        classes_needed: classesNeeded
      };
      subjectSummaries.push(enriched);

      if (total > 0 && pct < reqPct) {
        subjectsBelowThreshold.push(enriched);
        attendanceWarnings.push({
          level: 'RED',
          subject_id: s.id,
          code: s.code,
          name: s.name,
          percentage: enriched.percentage,
          required: reqPct,
          message: classesNeeded > 0
            ? `${s.code} (${enriched.percentage}%) is below ${reqPct}%. Attend ${classesNeeded} consecutive class${classesNeeded === 1 ? '' : 'es'} to recover.`
            : `${s.code} (${enriched.percentage}%) cannot reach ${reqPct}% through future classes alone.`
        });
        if (classesNeeded > 0) {
          improvementSuggestions.push(`Prioritize ${s.name} (${s.code}): attend the next ${classesNeeded} class${classesNeeded === 1 ? '' : 'es'} to reach ${reqPct}%.`);
        }
      } else if (total > 0 && pct < reqPct + 5) {
        subjectsAtRisk.push(enriched);
        attendanceWarnings.push({
          level: 'YELLOW',
          subject_id: s.id,
          code: s.code,
          name: s.name,
          percentage: enriched.percentage,
          required: reqPct,
          message: `${s.code} (${enriched.percentage}%) is near the ${reqPct}% minimum. Safe misses left: ${classesCanMiss}.`
        });
      }
    }

    const totalClasses = totalAttended + totalAbsent;
    const overallAttendance = Math.round(engine.calculatePercentage(totalAttended, totalClasses) * 10) / 10;

    const upcomingDeadlines = db.prepare(`
      SELECT d.*, s.code as subject_code, s.name as subject_name
      FROM deadlines d
      LEFT JOIN subjects s ON d.subject_id = s.id
      WHERE d.user_id = ? AND d.is_completed = 0
      ORDER BY d.due_date ASC, d.due_time ASC
      LIMIT 5
    `).all(userId);

    const recentNotifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ? AND is_read = 0
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId);

    const calendar = db.prepare(`
      SELECT * FROM academic_calendar WHERE user_id = ? AND is_current = 1 LIMIT 1
    `).get(userId);

    res.json({
      overall_attendance: overallAttendance,
      total_classes: totalClasses,
      total_attended: totalAttended,
      total_missed: totalAbsent,
      total_excused: totalExcused,
      total_subjects: subjects.length,
      subjects: subjectSummaries,
      subjects_below_threshold: subjectsBelowThreshold,
      subjects_at_risk: subjectsAtRisk,
      upcoming_deadlines: upcomingDeadlines,
      recent_notifications: recentNotifications,
      attendance_warnings: attendanceWarnings,
      improvement_suggestions: improvementSuggestions,
      academic_calendar: calendar || null
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

module.exports = router;
