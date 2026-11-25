const { Pool, types } = require('pg');

// Ensure PostgreSQL types match SQLite/JS expectations:
// OID 20 = INT8 (COUNT(*)), OID 1700 = NUMERIC, OID 1082 = DATE
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
types.setTypeParser(1082, (val) => val);

const BOOLEAN_COLUMNS = [
  'is_active',
  'is_completed',
  'is_read',
  'is_current',
  'smart_buffer_warnings',
  'critical_shortage_alert',
  'morning_rundown',
  'notification_enabled'
];

const BOOLEAN_EQ_REGEX = new RegExp(
  `(\\b(?:${BOOLEAN_COLUMNS.join('|')})\\b\\s*=\\s*)(1|0)\\b`,
  'gi'
);

/**
 * Match a PostgreSQL dollar-quote opening tag at index `pos` (e.g. `$$` or `$tag$`).
 * Returns the full tag string or null.
 */
function matchDollarTag(sql, pos) {
  if (sql[pos] !== '$') return null;
  const match = sql.slice(pos).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
  return match ? match[0] : null;
}

/**
 * Lexically scan SQL and transform only unquoted/uncommented code segments.
 * Preserves:
 * - Single-quoted strings ('...' with '' escapes)
 * - Double-quoted identifiers ("..." with "" escapes)
 * - Line comments (-- ... \n)
 * - Block comments (/* ... * /, including nested)
 * - PostgreSQL dollar-quoted strings ($$...$$, $tag$...$tag$)
 */
function transformSql(sql, { transformBooleans = true } = {}) {
  let out = '';
  let paramIndex = 1;
  let i = 0;
  const len = sql.length;

  function emitUnquoted(segment) {
    if (!segment) return;
    let processed = segment;
    if (transformBooleans) {
      processed = processed.replace(BOOLEAN_EQ_REGEX, (_, prefix, bit) => {
        return `${prefix}${bit === '1' ? 'TRUE' : 'FALSE'}`;
      });
    }
    out += processed.replace(/\?/g, () => `$${paramIndex++}`);
  }

  let unquotedStart = 0;

  while (i < len) {
    const ch = sql[i];

    // 1. Single-quoted string literal
    if (ch === "'") {
      emitUnquoted(sql.slice(unquotedStart, i));
      const start = i;
      i++;
      while (i < len) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          i++;
        }
      }
      out += sql.slice(start, i);
      unquotedStart = i;
      continue;
    }

    // 2. Double-quoted identifier
    if (ch === '"') {
      emitUnquoted(sql.slice(unquotedStart, i));
      const start = i;
      i++;
      while (i < len) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          i++;
        }
      }
      out += sql.slice(start, i);
      unquotedStart = i;
      continue;
    }

    // 3. Line comment (-- ...)
    if (ch === '-' && sql[i + 1] === '-') {
      emitUnquoted(sql.slice(unquotedStart, i));
      const start = i;
      i += 2;
      while (i < len && sql[i] !== '\n') {
        i++;
      }
      if (i < len && sql[i] === '\n') i++;
      out += sql.slice(start, i);
      unquotedStart = i;
      continue;
    }

    // 4. Block comment (/* ... */, supports nesting)
    if (ch === '/' && sql[i + 1] === '*') {
      emitUnquoted(sql.slice(unquotedStart, i));
      const start = i;
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      out += sql.slice(start, i);
      unquotedStart = i;
      continue;
    }

    // 5. PostgreSQL dollar-quoted string ($$...$$ or $tag$...$tag$)
    if (ch === '$') {
      const tag = matchDollarTag(sql, i);
      if (tag) {
        emitUnquoted(sql.slice(unquotedStart, i));
        const start = i;
        i += tag.length;
        const closeIdx = sql.indexOf(tag, i);
        if (closeIdx === -1) {
          i = len;
        } else {
          i = closeIdx + tag.length;
        }
        out += sql.slice(start, i);
        unquotedStart = i;
        continue;
      }
    }

    i++;
  }

  emitUnquoted(sql.slice(unquotedStart));
  return out;
}

function convertPlaceholders(sql) {
  return transformSql(sql, { transformBooleans: false });
}

function transformSqlForPostgres(sql) {
  return transformSql(sql, { transformBooleans: true });
}

function normalizeArgs(args) {
  return args.map((v) => (v === undefined ? null : v));
}

function wrapQueryRunner(clientOrPool) {
  async function query(sql, args) {
    const pgSql = transformSqlForPostgres(sql);
    const params = normalizeArgs(args);
    return clientOrPool.query(pgSql, params);
  }

  return {
    async exec(sql) {
      await clientOrPool.query(sql);
    },
    async run(sql, ...args) {
      const res = await query(sql, args);
      return { changes: res.rowCount || 0 };
    },
    async get(sql, ...args) {
      const res = await query(sql, args);
      return res.rows[0];
    },
    async all(sql, ...args) {
      const res = await query(sql, args);
      return res.rows;
    },
    prepare(sql) {
      return {
        async run(...args) {
          const res = await query(sql, args);
          return { changes: res.rowCount || 0 };
        },
        async get(...args) {
          const res = await query(sql, args);
          return res.rows[0];
        },
        async all(...args) {
          const res = await query(sql, args);
          return res.rows;
        }
      };
    }
  };
}

function buildPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required when DB_CLIENT=postgres');
  }

  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1');
  const sslDisabled = connectionString.includes('sslmode=disable');

  const config = {
    connectionString,
    max: parseInt(process.env.PG_POOL_MAX, 10) || 10,
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT_MS, 10) || 10000
  };

  if (!sslDisabled && (!isLocal || process.env.PGSSLMODE === 'require')) {
    config.ssl = {
      rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true'
    };
  }

  return config;
}

function createPostgresAdapter() {
  const pool = new Pool(buildPoolConfig());
  const runner = wrapQueryRunner(pool);

  return {
    client: 'postgres',
    ...runner,
    async pragma() {
      // No-op for PostgreSQL
    },
    async transaction(fn) {
      const client = await pool.connect();
      const txRunner = wrapQueryRunner(client);
      try {
        await client.query('BEGIN');
        const result = await fn(txRunner);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr) {
          console.error('[pg] Rollback error:', rollbackErr.message);
        }
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    }
  };
}

module.exports = {
  createPostgresAdapter,
  convertPlaceholders,
  transformSqlForPostgres
};
