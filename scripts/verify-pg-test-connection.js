/**
 * Read-only PostgreSQL test connection verifier.
 *
 * Usage (PowerShell):
 *   $env:TEST_DATABASE_URL = "postgresql://..."
 *   node scripts/verify-pg-test-connection.js
 *
 * Safety guarantees:
 * - Reads ONLY TEST_DATABASE_URL (never DATABASE_URL).
 * - Refuses to run if TEST_DATABASE_URL matches DATABASE_URL.
 * - Never prints the connection string, password, or query parameters.
 */

const { Pool } = require('pg');

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    console.error('[verify-pg] ERROR: TEST_DATABASE_URL is not set.');
    console.error('[verify-pg] Set $env:TEST_DATABASE_URL in your PowerShell session before running this script.');
    process.exit(1);
  }

  if (process.env.DATABASE_URL && testUrl === process.env.DATABASE_URL) {
    console.error('[verify-pg] ERROR: TEST_DATABASE_URL matches DATABASE_URL. Refusing to connect to avoid touching production.');
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(testUrl);
  } catch {
    console.error('[verify-pg] ERROR: TEST_DATABASE_URL is not a valid URL.');
    process.exit(1);
  }

  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const sslDisabled = testUrl.includes('sslmode=disable');

  const pool = new Pool({
    connectionString: testUrl,
    connectionTimeoutMillis: 10000,
    ssl: !sslDisabled && !isLocal ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'true' } : undefined
  });

  try {
    const res = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        version() AS postgres_version
    `);
    const row = res.rows[0];
    console.log('[verify-pg] Connection successful (read-only check):');
    console.log(`  Target host:      ${parsed.hostname}:${parsed.port || 5432}`);
    console.log(`  Database name:    ${row.database_name}`);
    console.log(`  Database user:    ${row.database_user}`);
    console.log(`  PostgreSQL ver:   ${row.postgres_version}`);
  } catch (err) {
    console.error('[verify-pg] Connection failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
