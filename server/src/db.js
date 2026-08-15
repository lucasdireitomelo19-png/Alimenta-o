const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "acesso.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    descriptor TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS access_rules (
    employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    cafe_allowed INTEGER NOT NULL DEFAULT 0,
    cafe_start TEXT NOT NULL DEFAULT '07:00',
    cafe_end TEXT NOT NULL DEFAULT '09:00',
    almoco_allowed INTEGER NOT NULL DEFAULT 1,
    almoco_start TEXT NOT NULL DEFAULT '11:30',
    almoco_end TEXT NOT NULL DEFAULT '14:00',
    janta_allowed INTEGER NOT NULL DEFAULT 0,
    janta_start TEXT NOT NULL DEFAULT '18:00',
    janta_end TEXT NOT NULL DEFAULT '20:00'
  );

  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    employee_name TEXT,
    company_name TEXT,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    granted INTEGER NOT NULL,
    reason TEXT NOT NULL,
    meal_type TEXT,
    distance REAL
  );
`);

module.exports = db;
