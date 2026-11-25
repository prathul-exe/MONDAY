# Changelog

All notable changes to **Monday – Smart Attendance Tracker** will be documented in this file.

## [1.0.0] - 2026-11-25
### Added
- Initial full-stack web SPA preserving the Google Stitch **Kinetic Glass Minimalist** UI.
- Node.js + Express backend with `/api/v1/*` versioned endpoints and backward-compatible `/api/*` aliases.
- SQLite persistence (`node:sqlite`), database migrations (`schema_migrations`), `attendance_audit_log`, and `db:backup` script.
- Intelligent Attendance Calculation Engine (percentage, consecutive classes needed, safe bunk calculator, future projections, recovery date estimates).
- Multi-user JWT authentication, `bcryptjs` password hashing, strict per-user isolation, and account deletion (`DELETE /api/auth/me`).
- Weekly timetable matrix with Lecture, Lab, Tutorial, Seminar, Break/Recess, and Lunch Break slots + `.ics` export.
- Supabase PostgreSQL schema with Row Level Security (`supabase/migrations/001_initial_schema.sql`) and Edge Functions.
- Capacitor Android project (`android/`) configured for `Monday` (`com.monday.attendance`), Android Keystore-backed secure token storage, hardware back button handling, and `POST_NOTIFICATIONS` permission.
- Version checking (`GET /api/system/version`) and GitHub Actions CI workflow.
