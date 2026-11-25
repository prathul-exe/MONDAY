-- ============================================================================
-- Migration 002: Align Supabase PostgreSQL schema with Express Custom JWT Auth
-- ============================================================================
-- NOTE:
-- - Do NOT modify 001_initial_schema.sql.
-- - This migration is additive/non-destructive and preserves existing data.
-- - Wrapped in BEGIN ... COMMIT so execution is atomic even outside Supabase CLI.
-- - Express connects with a privileged PostgreSQL connection (bypassing RLS),
--   so user ownership MUST still be enforced in every Express query.
-- ============================================================================

BEGIN;

-- 1. Create public.users for custom JWT authentication
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    student_id TEXT,
    department TEXT,
    semester INTEGER DEFAULT 1 CHECK (semester BETWEEN 1 AND 12),
    profile_image TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at current on public.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_users_updated'
          AND tgrelid = 'public.users'::regclass
    ) THEN
        CREATE TRIGGER trg_users_updated
        BEFORE UPDATE ON public.users
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- Enable RLS on public.users (defense-in-depth; Express enforces ownership in SQL)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Note on public.student_profiles & auth.users:
-- 001_initial_schema.sql created public.student_profiles referencing auth.users(id).
-- We intentionally preserve public.student_profiles and auth.users triggers without
-- dropping them to avoid destructive operations on any existing Supabase Auth data.
-- All Express backend operations use public.users.

-- 2. Resolve academic_calendars vs academic_calendar table name difference
DO $$
BEGIN
    IF to_regclass('public.academic_calendars') IS NOT NULL
       AND to_regclass('public.academic_calendar') IS NULL THEN
        ALTER TABLE public.academic_calendars RENAME TO academic_calendar;
    END IF;
END $$;

-- Compatibility view for any Supabase Edge Function querying academic_calendars.
-- Uses security_invoker = true on PostgreSQL 15+ so caller RLS policies apply.
DO $$
BEGIN
    IF to_regclass('public.academic_calendar') IS NOT NULL
       AND to_regclass('public.academic_calendars') IS NULL THEN
        IF current_setting('server_version_num')::int >= 150000 THEN
            CREATE VIEW public.academic_calendars
            WITH (security_invoker = true) AS
            SELECT * FROM public.academic_calendar;
        ELSE
            CREATE VIEW public.academic_calendars AS
            SELECT * FROM public.academic_calendar;
        END IF;
    END IF;
END $$;

-- 3. Resolve push_notifications_enabled vs notification_enabled column difference
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_settings'
          AND column_name = 'push_notifications_enabled'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_settings'
          AND column_name = 'notification_enabled'
    ) THEN
        ALTER TABLE public.user_settings
        RENAME COLUMN push_notifications_enabled TO notification_enabled;
    END IF;
END $$;

-- 4. Re-point all user-owned table foreign keys from auth.users(id) to public.users(id)
-- Uses a helper DO block to safely drop any FK on user_id referencing auth.users
-- and add the corresponding ON DELETE CASCADE FK to public.users(id).
DO $$
DECLARE
    tbl TEXT;
    fk_name TEXT;
    target_tables TEXT[] := ARRAY[
        'user_settings',
        'subjects',
        'attendance_records',
        'attendance_audit_log',
        'timetable_entries',
        'academic_calendar',
        'holidays',
        'deadlines',
        'notifications'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        -- Drop any existing FK constraint on user_id for this table
        FOR fk_name IN
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = tbl
              AND kcu.column_name = 'user_id'
        LOOP
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, fk_name);
        END LOOP;

        -- Add FK referencing public.users(id) ON DELETE CASCADE
        EXECUTE format(
            'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE',
            tbl,
            tbl || '_user_id_fkey'
        );
    END LOOP;
END $$;

-- 5. Prevent duplicate audit log rows:
-- Express routes/attendance.js explicitly inserts into attendance_audit_log
-- inside transactions (matching SQLite behaviour).
-- IMPORTANT: Removing trg_attendance_audit means future direct database writes
-- (e.g., via Supabase SQL Editor, PostgREST, or Edge Functions outside Express)
-- will NOT automatically generate attendance_audit_log records.
DROP TRIGGER IF EXISTS trg_attendance_audit ON public.attendance_records;

-- 6. Preserve SQLite's existing NULL uniqueness behaviour on attendance_records:
-- 001_initial_schema.sql already defines UNIQUE (subject_id, date, start_time),
-- which treats NULL start_time values as distinct just like SQLite.
-- No partial unique index is added here.

COMMIT;
