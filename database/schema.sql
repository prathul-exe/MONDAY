-- Smart Attendance Tracker - Database Schema
-- SQLite Database

PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    student_id TEXT,
    department TEXT,
    semester INTEGER DEFAULT 1,
    profile_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    faculty_name TEXT,
    credits REAL DEFAULT 3.0,
    frequency_per_week INTEGER DEFAULT 3,
    room TEXT,
    required_attendance REAL DEFAULT 75.0,
    color TEXT DEFAULT '#91A995',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Attendance records table
CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'excused')),
    session_type TEXT DEFAULT 'lecture' CHECK(session_type IN ('lecture', 'lab', 'tutorial', 'seminar')),
    start_time TEXT,
    end_time TEXT,
    notes TEXT,
    lecture_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(subject_id, date, start_time)
);

-- Attendance audit log table
CREATE TABLE IF NOT EXISTS attendance_audit_log (
    id TEXT PRIMARY KEY,
    record_id TEXT,
    subject_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_status TEXT,
    new_status TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Timetable entries table
CREATE TABLE IF NOT EXISTS timetable_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject_id TEXT,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    session_type TEXT DEFAULT 'lecture',
    room TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Academic calendar / semester info
CREATE TABLE IF NOT EXISTS academic_calendar (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    semester_name TEXT NOT NULL,
    semester_number INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_current INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    calendar_id TEXT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (calendar_id) REFERENCES academic_calendar(id) ON DELETE CASCADE
);

-- Deadlines/tasks table
CREATE TABLE IF NOT EXISTS deadlines (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'assignment' CHECK(category IN ('assignment', 'tp_lab', 'project', 'exam_quiz', 'reading', 'custom')),
    due_date TEXT NOT NULL,
    due_time TEXT DEFAULT '23:59',
    grade_weight REAL DEFAULT 0,
    platform TEXT,
    is_completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    reminder_before TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    level TEXT DEFAULT 'info' CHECK(level IN ('info', 'warning', 'critical', 'success')),
    is_read INTEGER DEFAULT 0,
    related_subject_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    min_attendance_threshold REAL DEFAULT 75.0,
    warning_threshold REAL DEFAULT 80.0,
    smart_buffer_warnings INTEGER DEFAULT 1,
    critical_shortage_alert INTEGER DEFAULT 1,
    morning_rundown INTEGER DEFAULT 1,
    theme TEXT DEFAULT 'light',
    notification_enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON attendance_records(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_timetable_user ON timetable_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_user ON deadlines(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
