/**
 * SQLite -> Supabase PostgreSQL Data Migration & Verification Script
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-pg.js --dry-run      # Inspect & check conflicts without writing
 *   node scripts/migrate-sqlite-to-pg.js                # Migrate data and verify IDs & all columns
 *   node scripts/migrate-sqlite-to-pg.js --verify-only  # Compare SQLite and PostgreSQL records
 *
 * Safety guarantees:
 * - Opens SQLite in read-only mode; never modifies or deletes database/attendance.db.
 * - Runs PostgreSQL inserts inside a single transaction (rolled back on any error or conflict).
 * - Detects conflicting existing IDs with mismatched field values instead of silently ignoring them.
 */

const { DatabaseSync } = require('node:sqlite');
const { Pool, types } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Keep DATE as YYYY-MM-DD, INT8 as integer, NUMERIC as float
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
types.setTypeParser(1082, (val) => val);

const TIMESTAMP_COLS = new Set(['created_at', 'updated_at', 'completed_at', 'changed_at']);
const TIME_COLS = new Set(['start_time', 'end_time', 'due_time']);

const TABLES = [
  {
    name: 'users',
    columns: ['id', 'email', 'password_hash', 'full_name', 'student_id', 'department', 'semester', 'profile_image', 'created_at', 'updated_at'],
    boolCols: [],
    verifyFields: ['email', 'password_hash', 'full_name', 'student_id', 'department', 'semester', 'profile_image', 'created_at', 'updated_at']
  },
  {
    name: 'user_settings',
    columns: ['id', 'user_id', 'min_attendance_threshold', 'warning_threshold', 'smart_buffer_warnings', 'critical_shortage_alert', 'morning_rundown', 'theme', 'notification_enabled', 'created_at', 'updated_at'],
    boolCols: ['smart_buffer_warnings', 'critical_shortage_alert', 'morning_rundown', 'notification_enabled'],
    verifyFields: ['user_id', 'min_attendance_threshold', 'warning_threshold', 'smart_buffer_warnings', 'critical_shortage_alert', 'morning_rundown', 'theme', 'notification_enabled', 'created_at', 'updated_at']
  },
  {
    name: 'subjects',
    columns: ['id', 'user_id', 'name', 'code', 'faculty_name', 'credits', 'frequency_per_week', 'room', 'required_attendance', 'color', 'is_active', 'created_at', 'updated_at'],
    boolCols: ['is_active'],
    verifyFields: ['user_id', 'name', 'code', 'faculty_name', 'credits', 'frequency_per_week', 'room', 'required_attendance', 'color', 'is_active', 'created_at', 'updated_at']
  },
  {
    name: 'attendance_records',
    columns: ['id', 'subject_id', 'user_id', 'date', 'status', 'session_type', 'start_time', 'end_time', 'notes', 'lecture_number', 'created_at', 'updated_at'],
    boolCols: [],
    verifyFields: ['subject_id', 'user_id', 'date', 'status', 'session_type', 'start_time', 'end_time', 'notes', 'lecture_number', 'created_at', 'updated_at']
  },
  {
    name: 'attendance_audit_log',
    columns: ['id', 'record_id', 'subject_id', 'user_id', 'action', 'old_status', 'new_status', 'changed_at'],
    boolCols: [],
    verifyFields: ['record_id', 'subject_id', 'user_id', 'action', 'old_status', 'new_status', 'changed_at']
  },
  {
    name: 'timetable_entries',
    columns: ['id', 'user_id', 'subject_id', 'day_of_week', 'start_time', 'end_time', 'session_type', 'room', 'is_active', 'created_at'],
    boolCols: ['is_active'],
    verifyFields: ['user_id', 'subject_id', 'day_of_week', 'start_time', 'end_time', 'session_type', 'room', 'is_active', 'created_at']
  },
  {
    name: 'academic_calendar',
    columns: ['id', 'user_id', 'semester_name', 'semester_number', 'start_date', 'end_date', 'is_current', 'created_at'],
    boolCols: ['is_current'],
    verifyFields: ['user_id', 'semester_name', 'semester_number', 'start_date', 'end_date', 'is_current', 'created_at']
  },
  {
    name: 'holidays',
    columns: ['id', 'user_id', 'calendar_id', 'name', 'date', 'created_at'],
    boolCols: [],
    verifyFields: ['user_id', 'calendar_id', 'name', 'date', 'created_at']
  },
  {
    name: 'deadlines',
    columns: ['id', 'user_id', 'subject_id', 'title', 'description', 'category', 'due_date', 'due_time', 'grade_weight', 'platform', 'is_completed', 'completed_at', 'reminder_before', 'created_at', 'updated_at'],
    boolCols: ['is_completed'],
    verifyFields: ['user_id', 'subject_id', 'title', 'description', 'category', 'due_date', 'due_time', 'grade_weight', 'platform', 'is_completed', 'completed_at', 'reminder_before', 'created_at', 'updated_at']
  },
  {
    name: 'notifications',
    columns: ['id', 'user_id', 'type', 'title', 'message', 'level', 'is_read', 'related_subject_id', 'created_at'],
    boolCols: ['is_read'],
    verifyFields: ['user_id', 'type', 'title', 'message', 'level', 'is_read', 'related_subject_id', 'created_at']
  }
];

function normalizeValue(val, col, boolCols) {
  if (val === undefined || val === null) return null;
  if (boolCols.includes(col)) {
    return Boolean(val);
  }
  return val;
}

function parseTimestampMs(val) {
  if (val instanceof Date) return val.getTime();
  if (typeof val !== 'string') return NaN;
  const trimmed = val.trim();
  // SQLite CURRENT_TIMESTAMP produces 'YYYY-MM-DD HH:MM:SS' in UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return Date.parse(`${trimmed.replace(' ', 'T')}Z`);
  }
  return Date.parse(trimmed);
}

function valuesMatch(sqliteVal, pgVal, col, boolCols) {
  const normSqlite = normalizeValue(sqliteVal, col, boolCols);
  const normPg = pgVal === undefined ? null : pgVal;

  if (normSqlite === null && normPg === null) return true;
  if (normSqlite === null || normPg === null) return false;

  if (boolCols.includes(col)) {
    return Boolean(normSqlite) === Boolean(normPg);
  }
  if (TIMESTAMP_COLS.has(col)) {
    const ms1 = parseTimestampMs(normSqlite);
    const ms2 = parseTimestampMs(normPg);
    if (!Number.isNaN(ms1) && !Number.isNaN(ms2)) {
      return Math.abs(ms1 - ms2) < 1000;
    }
  }
  if (typeof normSqlite === 'number' || typeof normPg === 'number') {
    return Number(normSqlite) === Number(normPg);
  }
  // Handle PostgreSQL TIME 'HH:MM:SS' vs SQLite 'HH:MM'
  if (TIME_COLS.has(col) && typeof normSqlite === 'string' && typeof normPg === 'string') {
    const s = normSqlite.length === 5 ? `${normSqlite}:00` : normSqlite;
    const p = normPg.length === 5 ? `${normPg}:00` : normPg;
    return s === p;
  }
  return String(normSqlite) === String(normPg);
}

function findRowMismatches(sqliteRow, pgRow, table) {
  const diffs = [];
  for (const col of table.verifyFields) {
    if (!valuesMatch(sqliteRow[col], pgRow[col], col, table.boolCols)) {
      diffs.push({
        field: col,
        sqlite: normalizeValue(sqliteRow[col], col, table.boolCols),
        postgres: pgRow[col]
      });
    }
  }
  return diffs;
}

function createPgPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required.');
  }
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const sslDisabled = connectionString.includes('sslmode=disable');
  return new Pool({
    connectionString,
    ssl: !sslDisabled && !isLocal ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true' } : undefined
  });
}

async function verifyData(sqliteDb, pgClient) {
  console.log('\n[verify] Comparing SQLite and PostgreSQL records (IDs and all migrated columns)...');
  let totalMismatches = 0;

  for (const table of TABLES) {
    const sqliteRows = sqliteDb.prepare(`SELECT * FROM ${table.name}`).all();
    const pgRes = await pgClient.query(`SELECT * FROM public.${table.name}`);
    const pgById = new Map(pgRes.rows.map((r) => [r.id, r]));
    const sqliteIds = new Set(sqliteRows.map((r) => r.id));

    const missingInPg = [];
    const fieldMismatches = [];

    for (const sRow of sqliteRows) {
      const pRow = pgById.get(sRow.id);
      if (!pRow) {
        missingInPg.push(sRow.id);
        continue;
      }
      const diffs = findRowMismatches(sRow, pRow, table);
      if (diffs.length > 0) {
        fieldMismatches.push({ id: sRow.id, diffs });
      }
    }

    const extraInPg = pgRes.rows.filter((r) => !sqliteIds.has(r.id)).map((r) => r.id);

    const statusOk =
      sqliteRows.length === pgRes.rows.length &&
      missingInPg.length === 0 &&
      extraInPg.length === 0 &&
      fieldMismatches.length === 0;

    console.log(
      `  ${statusOk ? 'OK' : 'MISMATCH'} ${table.name}: SQLite=${sqliteRows.length}, PG=${pgRes.rows.length}` +
        (missingInPg.length ? `, missingInPg=${missingInPg.length}` : '') +
        (extraInPg.length ? `, extraInPg=${extraInPg.length}` : '') +
        (fieldMismatches.length ? `, fieldMismatches=${fieldMismatches.length}` : '')
    );

    if (!statusOk) {
      totalMismatches++;
      if (missingInPg.length > 0) {
        console.error(`    Missing IDs in PG: ${missingInPg.slice(0, 10).join(', ')}`);
      }
      if (extraInPg.length > 0) {
        console.error(`    Extra IDs in PG: ${extraInPg.slice(0, 10).join(', ')}`);
      }
      for (const fm of fieldMismatches.slice(0, 5)) {
        console.error(`    Field mismatch for ID ${fm.id}:`, JSON.stringify(fm.diffs));
      }
    }
  }

  if (totalMismatches > 0) {
    throw new Error(`Verification failed with mismatches in ${totalMismatches} table(s).`);
  }
  console.log('[verify] All tables verified: row counts, IDs, and all migrated columns match.');
}

async function runMigration(sqliteDb, client, { dryRun = false } = {}) {
  await client.query('BEGIN');
  let txEnded = false;
  let insertedTotal = 0;
  let skippedIdentical = 0;
  const conflicts = [];

  try {
    for (const table of TABLES) {
      const sqliteRows = sqliteDb.prepare(`SELECT * FROM ${table.name}`).all();
      const existingRes = await client.query(`SELECT * FROM public.${table.name}`);
      const existingById = new Map(existingRes.rows.map((r) => [r.id, r]));

      let tableInserted = 0;
      let tableSkipped = 0;

      const placeholders = table.columns.map((_, i) => `$${i + 1}`).join(', ');
      const insertSql = `INSERT INTO public.${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`;

      for (const row of sqliteRows) {
        const existing = existingById.get(row.id);
        if (existing) {
          const diffs = findRowMismatches(row, existing, table);
          if (diffs.length > 0) {
            conflicts.push({ table: table.name, id: row.id, diffs });
          } else {
            tableSkipped++;
            skippedIdentical++;
          }
          continue;
        }

        if (!dryRun) {
          const values = table.columns.map((col) => normalizeValue(row[col], col, table.boolCols));
          await client.query(insertSql, values);
        }
        tableInserted++;
        insertedTotal++;
      }

      console.log(
        `  [${dryRun ? 'DRY-RUN' : 'MIGRATE'}] ${table.name}: source=${sqliteRows.length}, toInsert=${tableInserted}, identicalExisting=${tableSkipped}`
      );
    }

    if (conflicts.length > 0) {
      console.error(`\n[migrate-pg] ERROR: Detected ${conflicts.length} conflicting existing ID(s) with mismatched data:`);
      for (const c of conflicts.slice(0, 20)) {
        console.error(`  - ${c.table} (${c.id}):`, JSON.stringify(c.diffs));
      }
      throw new Error('Aborting migration due to conflicting existing IDs.');
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      txEnded = true;
      console.log(`\n[migrate-pg] Dry-run complete. No writes performed. Would insert ${insertedTotal} row(s), skip ${skippedIdentical} identical row(s).`);
    } else {
      await client.query('COMMIT');
      txEnded = true;
      console.log(`\n[migrate-pg] Migration committed: inserted ${insertedTotal} row(s), skipped ${skippedIdentical} identical row(s).`);
      await verifyData(sqliteDb, client);
    }

    return { insertedTotal, skippedIdentical, conflicts };
  } catch (err) {
    if (!txEnded) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        // Ignore rollback errors
      }
    }
    throw err;
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const verifyOnly = args.has('--verify-only');

  const sqlitePath = path.resolve(process.env.DB_PATH || path.join(__dirname, '..', 'database', 'attendance.db'));
  if (!fs.existsSync(sqlitePath)) {
    console.error(`[migrate-pg] SQLite database not found at ${sqlitePath}`);
    process.exit(1);
  }

  console.log(`[migrate-pg] Source SQLite (read-only): ${sqlitePath}`);
  let sqliteDb = null;
  let pool = null;
  let client = null;

  try {
    sqliteDb = new DatabaseSync(sqlitePath, { readOnly: true });
    pool = createPgPool();
    client = await pool.connect();

    if (verifyOnly) {
      await verifyData(sqliteDb, client);
      return;
    }

    await runMigration(sqliteDb, client, { dryRun });
  } catch (err) {
    console.error('[migrate-pg] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    if (pool) await pool.end();
    if (sqliteDb) sqliteDb.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  TABLES,
  normalizeValue,
  parseTimestampMs,
  valuesMatch,
  findRowMismatches,
  verifyData,
  runMigration
};
