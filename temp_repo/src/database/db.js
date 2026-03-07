const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || './data/app.db';

let _sqlDb = null;   // raw sql.js Database instance

function getDb() {
    if (!_sqlDb) throw new Error('Database not initialized. Call initializeDatabase() first.');
    return _sqlDb;
}

/* ─── Persist the in-memory DB to disk ──────────────────────────────────── */
function persist() {
    if (!_sqlDb) return;
    const resolvedPath = path.resolve(DB_PATH);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolvedPath, Buffer.from(_sqlDb.export()));
}

/* ─── Thin synchronous wrapper providing a friendlier query API ─────────── */
function query(sql, params = []) {
    const stmt = _sqlDb.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

function queryOne(sql, params = []) {
    const rows = query(sql, params);
    return rows.length ? rows[0] : null;
}

function run(sql, params = []) {
    _sqlDb.run(sql, params);
    persist();
}

/* ─── Initialize ─────────────────────────────────────────────────────────── */
async function initializeDatabase() {
    const SQL = await initSqlJs();

    const resolvedPath = path.resolve(DB_PATH);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(resolvedPath)) {
        const fileBuffer = fs.readFileSync(resolvedPath);
        _sqlDb = new SQL.Database(fileBuffer);
    } else {
        _sqlDb = new SQL.Database();
    }

    // Schema
    _sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id   TEXT    UNIQUE NOT NULL,
      name        TEXT    NOT NULL,
      email       TEXT    UNIQUE NOT NULL,
      avatar      TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
  `);
    persist();

    console.log('✅ Database initialized at:', resolvedPath);
    return { query, queryOne, run, persist };
}

function closeDatabase() {
    persist();
    if (_sqlDb) { _sqlDb.close(); _sqlDb = null; }
}

process.on('exit', closeDatabase);
process.on('SIGINT', () => { closeDatabase(); process.exit(0); });
process.on('SIGTERM', () => { closeDatabase(); process.exit(0); });

module.exports = { getDb, initializeDatabase, closeDatabase, query, queryOne, run, persist };
