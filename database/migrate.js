const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function migrate() {
  if ((process.env.DB_CLIENT || '').trim().toLowerCase() === 'postgres') {
    console.log('[migrate] DB_CLIENT=postgres; skipping local SQLite migration.');
    return;
  }

  const dbPath = process.env.DB_PATH || path.join(__dirname, 'attendance.db');
  console.log(`[migrate] Database path: ${dbPath}`);

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`[migrate] ERROR: Schema file not found at ${schemaPath}`);
    process.exit(1);
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  let db;
  try {
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(schema);

    // Track schema migration versions for backward-compatible upgrades
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.prepare('INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)').run('001_initial_schema');

    // Ensure timetable_entries.subject_id is nullable for lunch/break slots
    const cols = db.prepare("PRAGMA table_info(timetable_entries);").all();
    const subjCol = cols.find(c => c.name === 'subject_id');
    if (subjCol && subjCol.notnull === 1) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE timetable_entries_new (
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
        INSERT INTO timetable_entries_new SELECT * FROM timetable_entries;
        DROP TABLE timetable_entries;
        ALTER TABLE timetable_entries_new RENAME TO timetable_entries;
        CREATE INDEX IF NOT EXISTS idx_timetable_user ON timetable_entries(user_id);
        PRAGMA foreign_keys = ON;
      `);
      console.log('[migrate] Updated timetable_entries to allow nullable subject_id.');
    }

    console.log('[migrate] Migration completed successfully.');
  } catch (err) {
    console.error('[migrate] Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (db) db.close();
  }
}

migrate();
