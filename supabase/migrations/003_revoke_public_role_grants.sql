-- ============================================================================
-- Migration 003: Revoke unnecessary public/anon/authenticated privileges
-- ============================================================================
-- Purpose:
--   Monday uses Express with custom JWT authentication over a privileged
--   `postgres` database connection, never Supabase Data API (PostgREST) as
--   `anon` or `authenticated`.
--
--   By default in Supabase, tables/views/functions in `public` can inherit or
--   receive grants (such as TRUNCATE, TRIGGER, REFERENCES on tables/views and
--   EXECUTE on functions) for `PUBLIC`, `anon`, and `authenticated`.
--   `TRUNCATE` in particular is not governed by Row-Level Security (RLS).
--
--   This migration:
--   1. Revokes table/view privileges from PUBLIC, anon, and authenticated.
--   2. Revokes sequence privileges in `public` from PUBLIC, anon, and authenticated.
--   3. Revokes direct EXECUTE on trigger functions from PUBLIC, anon, and authenticated
--      (triggers still fire normally when DML runs as `postgres`).
--   4. Hardens default privileges for future objects created by `postgres` in `public`.
--   5. Preserves all privileges for `postgres` (Express backend) and `service_role`.
--   6. Does NOT alter ownership, RLS policies, triggers, constraints, or data.
-- ============================================================================

BEGIN;

-- 1. Revoke all privileges on existing tables and views in `public`
--    from PUBLIC, anon, and authenticated (covers all 11 tables + academic_calendars view).
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 2. Revoke all privileges on existing sequences in `public`
--    from PUBLIC, anon, and authenticated.
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 3. Revoke direct EXECUTE on trigger functions in `public`
--    from PUBLIC, anon, and authenticated (trigger execution is unaffected).
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_attendance_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 4. Prevent future tables, views, sequences, and functions created by `postgres`
--    in `public` from automatically granting privileges to PUBLIC, anon, or authenticated.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;
