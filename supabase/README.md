# Supabase Backend Setup & Activation Guide

This directory contains the complete Supabase backend implementation for the **MONDAY Smart Attendance Tracker**:
- `migrations/001_initial_schema.sql`: PostgreSQL schema, indexes, audit trail triggers, auto-profile/settings triggers, and Row Level Security (RLS) policies for all user-owned tables.
- `functions/attendance-engine/index.ts`: Edge Function for attendance percentage, recovery, bunk limits, future projections, and deadline estimates using the caller's JWT (RLS-enforced).
- `functions/notifications/index.ts`: Edge Function for threshold alert generation and optional Firebase Cloud Messaging (FCM) push dispatch.

## Activation Steps

1. **Install & Link Supabase CLI**:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <YOUR_SUPABASE_PROJECT_REF>
   ```

2. **Push Database Schema & RLS Policies**:
   ```bash
   supabase db push
   ```

3. **Configure Secrets (for FCM Push Notifications, optional)**:
   ```bash
   supabase secrets set FCM_SERVER_KEY=<YOUR_FIREBASE_CLOUD_MESSAGING_SERVER_KEY>
   ```
   *(Never expose the `SUPABASE_SERVICE_ROLE_KEY` in any client app; Edge Functions here use `SUPABASE_ANON_KEY` + the user's `Authorization` JWT so RLS enforces strict per-user isolation.)*

4. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy attendance-engine
   supabase functions deploy notifications
   ```
