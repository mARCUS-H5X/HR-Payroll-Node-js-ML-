/**
 * Database wrapper for sql.js providing a better-sqlite3 compatible API.
 * This allows all route code to use the same synchronous-style API.
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { initSQL, seedSQL } = require('./schema');

const DB_PATH = path.join(__dirname, '..', 'payroll.db');
let sqlDB = null;

/**
 * Wraps sql.js to provide better-sqlite3-like prepare/run/get/all API
 */
class DatabaseWrapper {
  constructor(db) {
    this._db = db;
  }

  prepare(sql) {
    const db = this._db;
    return {
      run(...params) {
        db.run(sql, params);
        return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0, changes: db.getRowsModified() };
      },
      get(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          stmt.free();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const row = {};
          cols.forEach((c, i) => row[c] = vals[i]);
          results.push(row);
        }
        stmt.free();
        return results;
      }
    };
  }

  exec(sql) {
    this._db.run(sql);
  }

  pragma(str) {
    try { this._db.run(`PRAGMA ${str}`); } catch(e) { /* ignore */ }
  }

  transaction(fn) {
    const self = this;
    return function(...args) {
      self._db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        self._db.run('COMMIT');
        self.save();
        return result;
      } catch(e) {
        self._db.run('ROLLBACK');
        throw e;
      }
    };
  }

  save() {
    try {
      const data = this._db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch(e) {
      console.error('Failed to save database:', e.message);
    }
  }

  close() {
    this.save();
    this._db.close();
  }
}

async function initializeDatabase() {
  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const wrapper = new DatabaseWrapper(db);
  wrapper.pragma('journal_mode = WAL');
  wrapper.pragma('foreign_keys = ON');

  // Run schema
  const statements = initSQL.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    try { wrapper._db.run(stmt + ';'); } catch(e) { /* table may already exist */ }
  }

  // Seed default rule if empty
  try {
    const result = wrapper.prepare('SELECT COUNT(*) as count FROM salary_rules').get();
    if (result && result.count === 0) {
      wrapper._db.run(seedSQL);
    }
  } catch(e) { /* ignore */ }

  wrapper.save();
  console.log('✅ Database initialized successfully');

  // Auto-save periodically
  setInterval(() => wrapper.save(), 30000);

  return wrapper;
}

module.exports = { initializeDatabase };
