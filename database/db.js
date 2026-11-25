const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { createPostgresAdapter } = require('./pg');

let db = null;
let dbClient = null;

function getDbClient() {
  const explicit = (process.env.DB_CLIENT || '').trim().toLowerCase();
  return explicit === 'postgres' ? 'postgres' : 'sqlite';
}

function isPostgres() {
  return getDbClient() === 'postgres';
}

function normalizeArgs(args) {
  return args.map((v) => (v === undefined ? null : v));
}

function wrapSqliteDatabase(rawDb) {
  let txChain = Promise.resolve();

  const runner = {
    async exec(sql) {
      return rawDb.exec(sql);
    },
    async run(sql, ...args) {
      const stmt = rawDb.prepare(sql);
      return stmt.run(...normalizeArgs(args));
    },
    async get(sql, ...args) {
      const stmt = rawDb.prepare(sql);
      return stmt.get(...normalizeArgs(args));
    },
    async all(sql, ...args) {
      const stmt = rawDb.prepare(sql);
      return stmt.all(...normalizeArgs(args));
    },
    prepare(sql) {
      const stmt = rawDb.prepare(sql);
      return {
        async run(...args) {
          return stmt.run(...normalizeArgs(args));
        },
        async get(...args) {
          return stmt.get(...normalizeArgs(args));
        },
        async all(...args) {
          return stmt.all(...normalizeArgs(args));
        }
      };
    }
  };

  return {
    client: 'sqlite',
    ...runner,
    async pragma(stmt) {
      return rawDb.exec(`PRAGMA ${stmt};`);
    },
    transaction(fn) {
      const runTx = async () => {
        rawDb.exec('BEGIN IMMEDIATE');
        try {
          const result = await fn(runner);
          rawDb.exec('COMMIT');
          return result;
        } catch (err) {
          try {
            rawDb.exec('ROLLBACK');
          } catch (_) {
            // Ignore rollback errors if transaction already aborted
          }
          throw err;
        }
      };
      // Serialize async transactions on the single SQLite connection
      const next = txChain.then(runTx, runTx);
      txChain = next.catch(() => {});
      return next;
    },
    async close() {
      return rawDb.close();
    }
  };
}

/**
 * Returns the singleton async database adapter.
 * Defaults to SQLite unless DB_CLIENT=postgres is explicitly set.
 */
function getDatabase() {
  const targetClient = getDbClient();
  if (db && dbClient !== targetClient) {
    throw new Error(`Database client already initialized as "${dbClient}", cannot switch to "${targetClient}" without closing first.`);
  }

  if (!db) {
    dbClient = targetClient;
    if (targetClient === 'postgres') {
      db = createPostgresAdapter();
    } else {
      const dbPath = process.env.DB_PATH || path.join(__dirname, 'attendance.db');
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const raw = new DatabaseSync(dbPath);
      raw.exec('PRAGMA journal_mode = WAL;');
      raw.exec('PRAGMA foreign_keys = ON;');
      db = wrapSqliteDatabase(raw);
    }
  }
  return db;
}

/**
 * Closes the database connection and resets the singleton.
 */
async function close() {
  if (db) {
    await db.close();
    db = null;
    dbClient = null;
  }
}

function isUniqueConstraintError(err) {
  if (!err) return false;
  if (err.code === '23505') return true;
  return typeof err.message === 'string' && err.message.includes('UNIQUE constraint');
}

function isInvalidInputError(err) {
  if (!err) return false;
  return err.code === '22P02';
}

function emptyToNull(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  return val;
}

module.exports = {
  getDatabase,
  close,
  getDbClient,
  isPostgres,
  isUniqueConstraintError,
  isInvalidInputError,
  emptyToNull
};
