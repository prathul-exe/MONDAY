const fs = require('fs');
const path = require('path');
const { getDatabase, close } = require('../database/db');

function backupDatabase() {
  const dbPath = path.resolve(process.env.DB_PATH || path.join(__dirname, '..', 'database', 'attendance.db'));
  if (!fs.existsSync(dbPath)) {
    console.error(`[backup] Database not found at ${dbPath}`);
    process.exit(1);
  }

  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const db = getDatabase();
  // Flush WAL to main database file before copying
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  close();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `attendance-${stamp}.db`);
  fs.copyFileSync(dbPath, dest);
  console.log(`[backup] Created backup: ${dest}`);
}

backupDatabase();
