const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

let db = null;

function normalizeArgs(args) {
  return args.map(v => (v === undefined ? null : v));
}

function wrapDatabase(rawDb) {
  return {
    exec(sql) {
      return rawDb.exec(sql);
    },
    pragma(stmt) {
      return rawDb.exec(`PRAGMA ${stmt};`);
    },
    prepare(sql) {
      const stmt = rawDb.prepare(sql);
      return {
        run(...args) {
          return stmt.run(...normalizeArgs(args));
        },
        get(...args) {
          return stmt.get(...normalizeArgs(args));
        },
        all(...args) {
          return stmt.all(...normalizeArgs(args));
        }
      };
    },
    close() {
      return rawDb.close();
    }
  };
}

/**
 * Returns the singleton database instance.
 * Creates and configures the connection on first call.
 */
function getDatabase() {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'attendance.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const raw = new DatabaseSync(dbPath);
    db = wrapDatabase(raw);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Closes the database connection and resets the singleton.
 */
function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDatabase, close };
