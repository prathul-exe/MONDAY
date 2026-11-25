# Contributing to MONDAY Smart Attendance Tracker

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/Attendance_tracker.git
   cd Attendance_tracker
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your local `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Run database migrations and tests:
   ```bash
   npm run db:migrate
   npm test
   ```

## Guidelines

- **Never commit secrets**: Do not commit `.env`, API keys, database files (`*.db`), `logs/`, or `backups/`.
- **Preserve the UI**: Keep all frontend changes aligned with the Kinetic Glass Minimalist design tokens in `stitch_monday_student_academic_tracker/kinetic_glass_minimalist/DESIGN.md`.
- **Tests required**: Add or update unit/integration tests in `tests/run-tests.js` for any new endpoints or calculation logic, and verify `npm test` passes before opening a pull request.
- **Code style**: Keep calculation logic pure in `services/attendance-engine.js` and enforce per-user `user_id` scoping on all database queries.
