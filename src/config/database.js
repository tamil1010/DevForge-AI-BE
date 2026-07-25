const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let pgPool = null;
let sqliteDb = null;
let usePg = false;

const memoryStore = {
  users: [],
  projects: [],
  requirements: [],
  entities: [],
  attributes: [],
  relationships: [],
  generated_schemas: [],
  generated_sql: [],
  validation_results: [],
  ai_suggestions: [],
  project_versions: []
};
let isMemoryFallback = false;

const initDb = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      pgPool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000
      });
      await pgPool.query('SELECT 1');
      usePg = true;
      console.log('Connected successfully to PostgreSQL database.');
      return;
    } catch (err) {
      console.warn('PostgreSQL connection failed. Falling back to local file/memory database:', err.message);
      if (pgPool) {
        pgPool.end().catch(() => {});
        pgPool = null;
      }
    }
  }

  try {
    const dbDir = path.join(__dirname, '../../database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'devforge_local.sqlite');
    sqliteDb = new sqlite3.Database(dbPath);

    await new Promise((resolve, reject) => {
      sqliteDb.serialize(() => {
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            database_type TEXT DEFAULT 'PostgreSQL',
            status TEXT DEFAULT 'draft',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS requirements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER UNIQUE NOT NULL,
            raw_text TEXT NOT NULL,
            domain TEXT,
            analysis_json TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS attributes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            data_type TEXT NOT NULL,
            is_primary_key INTEGER DEFAULT 0,
            is_foreign_key INTEGER DEFAULT 0,
            is_nullable INTEGER DEFAULT 1,
            is_unique INTEGER DEFAULT 0,
            is_auto_increment INTEGER DEFAULT 0,
            default_value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            source_entity TEXT NOT NULL,
            target_entity TEXT NOT NULL,
            type TEXT NOT NULL,
            source_column TEXT,
            target_column TEXT,
            foreign_key_column TEXT,
            on_delete TEXT DEFAULT 'CASCADE',
            on_update TEXT DEFAULT 'CASCADE',
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS generated_schemas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER UNIQUE NOT NULL,
            schema_json TEXT NOT NULL,
            normalization_status TEXT,
            is_outdated INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS generated_sql (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER UNIQUE NOT NULL,
            ddl_sql TEXT NOT NULL,
            sample_data_sql TEXT,
            dialect TEXT NOT NULL,
            is_outdated INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS validation_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER UNIQUE NOT NULL,
            score INTEGER NOT NULL,
            is_valid INTEGER DEFAULT 1,
            issues TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS ai_suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            type TEXT,
            severity TEXT,
            title TEXT,
            description TEXT,
            reason TEXT,
            recommended_change TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS project_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            version_number INTEGER NOT NULL,
            snapshot_json TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    console.log('Connected to local SQLite fallback database.');
  } catch (sqliteErr) {
    console.warn('SQLite initialization failed, using in-memory store:', sqliteErr.message);
    isMemoryFallback = true;
  }
};

const query = async (text, params = []) => {
  if (usePg && pgPool) {
    const res = await pgPool.query(text, params);
    return res;
  }

  if (sqliteDb && !isMemoryFallback) {
    return new Promise((resolve, reject) => {
      let sqliteText = text;
      let paramIdx = 1;
      while (sqliteText.includes(`$${paramIdx}`)) {
        sqliteText = sqliteText.replace(`$${paramIdx}`, '?');
        paramIdx++;
      }

      const trimmed = sqliteText.trim().toUpperCase();
      if (trimmed.startsWith('SELECT')) {
        sqliteDb.all(sqliteText, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows, rowCount: rows.length });
        });
      } else {
        sqliteDb.run(sqliteText, params, function (err) {
          if (err) return reject(err);
          resolve({
            rows: [{ id: this.lastID }],
            rowCount: this.changes,
            lastID: this.lastID
          });
        });
      }
    });
  }

  return handleMemoryQuery(text, params);
};

const handleMemoryQuery = async (text, params) => {
  const t = text.trim();
  if (t.includes('INSERT INTO users')) {
    const user = {
      id: memoryStore.users.length + 1,
      full_name: params[0],
      email: params[1],
      password_hash: params[2],
      created_at: new Date().toISOString()
    };
    memoryStore.users.push(user);
    return { rows: [user], rowCount: 1 };
  }
  if (t.includes('SELECT * FROM users WHERE email')) {
    const user = memoryStore.users.find((u) => u.email === params[0]);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }
  if (t.includes('SELECT * FROM users WHERE id')) {
    const user = memoryStore.users.find((u) => u.id == params[0]);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }
  return { rows: [], rowCount: 0 };
};

module.exports = {
  initDb,
  query,
  isPg: () => usePg
};
