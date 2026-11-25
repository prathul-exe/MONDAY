# Production Deployment Guide — MONDAY Smart Attendance Tracker

## 1. Architecture Overview
For public Google Play Store / web distribution where end users install and register without configuring any backend:
- **Cloud Database & Auth**: Supabase (PostgreSQL + Row Level Security + Supabase Auth) — see `supabase/migrations/001_initial_schema.sql` and `supabase/README.md`.
- **Edge Functions**: `supabase/functions/attendance-engine` and `supabase/functions/notifications`.
- **Web / API Server (Express)**: `server.js` (can be deployed to Render, Railway, Fly.io, or Cloud Run).

## 2. Required Owner Configuration
Before public release, the application owner must configure:
1. **Environment Variables** (`.env` / hosting secrets):
   - `NODE_ENV=production`
   - `PORT=3000`
   - `JWT_SECRET=<cryptographically-random-64-char-secret>`
   - `BCRYPT_ROUNDS=12`
   - `DB_PATH=/data/attendance.db` (if using persistent disk with Express+SQLite) OR deploy with Supabase PostgreSQL (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
2. **Email Provider for Password Recovery**:
   - Configure SMTP in Supabase Auth (**Authentication → Email Templates / SMTP Settings**) or plug an SMTP/Resend transport into `routes/auth.js` (`POST /api/auth/forgot-password`).
3. **Push Notifications (Optional)**:
   - Set `FCM_SERVER_KEY` via `supabase secrets set FCM_SERVER_KEY=...`.
4. **Database Backups**:
   - On Supabase Pro: Point-in-Time Recovery (PITR) & daily automated backups are enabled at the project level.
   - On self-hosted SQLite: Schedule `npm run db:backup` (`scripts/backup-db.js`) via cron/Task Scheduler and sync `backups/` to object storage.
5. **Error Monitoring**:
   - Application errors are logged to `logs/error.log` via `services/logger.js` without leaking stack traces in HTTP responses. For cloud APM, attach Sentry (`@sentry/node`) in `server.js`.
6. **Legal URLs for Play Store**:
   - Privacy Policy: `https://<your-domain>/privacy`
   - Terms of Service: `https://<your-domain>/terms`
