let Pool = null;
try {
  Pool = require('pg').Pool;
} catch (e) {}

let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {}

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
  if (dbUrl && Pool) {
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

  if (sqlite3) {
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
      console.log('Connected to local SQLite database.');
      return;
    } catch (sqliteErr) {
      console.warn('SQLite initialization failed, using in-memory store:', sqliteErr.message);
    }
  }

  isMemoryFallback = true;
  console.log('Running in zero-dependency in-memory database mode.');
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

  // Users
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
  if (t.includes('SELECT * FROM users WHERE LOWER(email)')) {
    const user = memoryStore.users.find((u) => u.email.toLowerCase() === params[0].toLowerCase());
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }
  if (t.includes('SELECT id FROM users WHERE LOWER(email)')) {
    const user = memoryStore.users.find((u) => u.email.toLowerCase() === params[0].toLowerCase());
    return { rows: user ? [{ id: user.id }] : [], rowCount: user ? 1 : 0 };
  }
  if (t.includes('SELECT id, full_name, email, created_at FROM users WHERE id')) {
    const user = memoryStore.users.find((u) => u.id == params[0]);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  // Projects
  if (t.includes('SELECT p.*')) {
    const userProjs = memoryStore.projects.filter((p) => p.user_id == params[0]);
    const formatted = userProjs.map(p => ({
      ...p,
      table_count: memoryStore.entities.filter(e => e.project_id == p.id).length,
      entity_count: memoryStore.entities.filter(e => e.project_id == p.id).length
    }));
    return { rows: formatted, rowCount: formatted.length };
  }
  if (t.includes('INSERT INTO projects')) {
    const proj = {
      id: memoryStore.projects.length + 1,
      user_id: params[0],
      name: params[1],
      description: params[2],
      database_type: params[3],
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryStore.projects.push(proj);
    return { rows: [proj], rowCount: 1 };
  }
  if (t.includes('SELECT * FROM projects WHERE id')) {
    const proj = memoryStore.projects.find((p) => p.id == params[0]);
    return { rows: proj ? [proj] : [], rowCount: proj ? 1 : 0 };
  }
  if (t.includes('SELECT user_id, database_type FROM projects WHERE id')) {
    const proj = memoryStore.projects.find((p) => p.id == params[0]);
    return { rows: proj ? [{ user_id: proj.user_id, database_type: proj.database_type }] : [], rowCount: proj ? 1 : 0 };
  }
  if (t.includes('SELECT user_id FROM projects WHERE id')) {
    const proj = memoryStore.projects.find((p) => p.id == params[0]);
    return { rows: proj ? [{ user_id: proj.user_id }] : [], rowCount: proj ? 1 : 0 };
  }

  // Requirements
  if (t.includes('SELECT * FROM requirements WHERE project_id')) {
    const req = memoryStore.requirements.find((r) => r.project_id == params[0]);
    return { rows: req ? [req] : [], rowCount: req ? 1 : 0 };
  }
  if (t.includes('INSERT INTO requirements')) {
    const idx = memoryStore.requirements.findIndex(r => r.project_id == params[0]);
    const reqData = {
      id: idx >= 0 ? memoryStore.requirements[idx].id : memoryStore.requirements.length + 1,
      project_id: params[0],
      raw_text: params[1],
      domain: params[2] || '',
      analysis_json: params[3] || null,
      updated_at: new Date().toISOString()
    };
    if (idx >= 0) {
      memoryStore.requirements[idx] = reqData;
    } else {
      memoryStore.requirements.push(reqData);
    }
    return { rows: [reqData], rowCount: 1 };
  }

  // Entities & Attributes
  if (t.includes('SELECT * FROM entities WHERE project_id')) {
    const list = memoryStore.entities.filter(e => e.project_id == params[0]);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('DELETE FROM entities WHERE project_id')) {
    memoryStore.entities = memoryStore.entities.filter(e => e.project_id != params[0]);
    return { rows: [], rowCount: 1 };
  }
  if (t.includes('INSERT INTO entities')) {
    const ent = {
      id: memoryStore.entities.length + 1,
      project_id: params[0],
      name: params[1],
      description: params[2] || ''
    };
    memoryStore.entities.push(ent);
    return { rows: [{ id: ent.id }], rowCount: 1 };
  }
  if (t.includes('SELECT * FROM attributes WHERE entity_id')) {
    const list = memoryStore.attributes.filter(a => a.entity_id == params[0]);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('INSERT INTO attributes')) {
    const attr = {
      id: memoryStore.attributes.length + 1,
      entity_id: params[0],
      name: params[1],
      data_type: params[2],
      is_primary_key: params[3],
      is_foreign_key: params[4],
      is_nullable: params[5],
      is_unique: params[6],
      is_auto_increment: params[7],
      default_value: params[8]
    };
    memoryStore.attributes.push(attr);
    return { rows: [attr], rowCount: 1 };
  }

  // Relationships
  if (t.includes('SELECT * FROM relationships WHERE project_id')) {
    const list = memoryStore.relationships.filter(r => r.project_id == params[0]);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('DELETE FROM relationships WHERE project_id')) {
    memoryStore.relationships = memoryStore.relationships.filter(r => r.project_id != params[0]);
    return { rows: [], rowCount: 1 };
  }
  if (t.includes('INSERT INTO relationships')) {
    const rel = {
      id: memoryStore.relationships.length + 1,
      project_id: params[0],
      source_entity: params[1],
      target_entity: params[2],
      type: params[3],
      source_column: params[4] || null,
      target_column: params[5] || null,
      foreign_key_column: params[6] || null,
      on_delete: params[7] || 'CASCADE',
      on_update: params[8] || 'CASCADE',
      description: params[9] || ''
    };
    memoryStore.relationships.push(rel);
    return { rows: [rel], rowCount: 1 };
  }

  // Schemas & SQL
  if (t.includes('SELECT * FROM generated_schemas WHERE project_id') || t.includes('SELECT schema_json FROM generated_schemas WHERE project_id')) {
    const item = memoryStore.generated_schemas.find(s => s.project_id == params[0]);
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('INSERT INTO generated_schemas')) {
    const idx = memoryStore.generated_schemas.findIndex(s => s.project_id == params[0]);
    const item = {
      id: idx >= 0 ? memoryStore.generated_schemas[idx].id : memoryStore.generated_schemas.length + 1,
      project_id: params[0],
      schema_json: params[1],
      normalization_status: params[2] || null
    };
    if (idx >= 0) memoryStore.generated_schemas[idx] = item;
    else memoryStore.generated_schemas.push(item);
    return { rows: [item], rowCount: 1 };
  }
  if (t.includes('SELECT * FROM generated_sql WHERE project_id') || t.includes('SELECT ddl_sql FROM generated_sql WHERE project_id')) {
    const item = memoryStore.generated_sql.find(s => s.project_id == params[0]);
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('INSERT INTO generated_sql')) {
    const idx = memoryStore.generated_sql.findIndex(s => s.project_id == params[0]);
    const item = {
      id: idx >= 0 ? memoryStore.generated_sql[idx].id : memoryStore.generated_sql.length + 1,
      project_id: params[0],
      ddl_sql: params[1],
      sample_data_sql: params[2] || '',
      dialect: params[3] || 'PostgreSQL'
    };
    if (idx >= 0) memoryStore.generated_sql[idx] = item;
    else memoryStore.generated_sql.push(item);
    return { rows: [item], rowCount: 1 };
  }

  // Validation
  if (t.includes('SELECT * FROM validation_results WHERE project_id') || t.includes('SELECT issues FROM validation_results WHERE project_id')) {
    const item = memoryStore.validation_results.find(v => v.project_id == params[0]);
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('INSERT INTO validation_results')) {
    const idx = memoryStore.validation_results.findIndex(v => v.project_id == params[0]);
    const item = {
      id: idx >= 0 ? memoryStore.validation_results[idx].id : memoryStore.validation_results.length + 1,
      project_id: params[0],
      score: params[1],
      is_valid: params[2],
      issues: params[3]
    };
    if (idx >= 0) memoryStore.validation_results[idx] = item;
    else memoryStore.validation_results.push(item);
    return { rows: [item], rowCount: 1 };
  }

  // Versions
  if (t.includes('SELECT id, version_number, created_at FROM project_versions WHERE project_id')) {
    const list = memoryStore.project_versions.filter(v => v.project_id == params[0]);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('SELECT MAX(version_number)')) {
    const list = memoryStore.project_versions.filter(v => v.project_id == params[0]);
    const maxV = list.reduce((m, v) => Math.max(m, v.version_number), 0);
    return { rows: [{ max_v: maxV }], rowCount: 1 };
  }
  if (t.includes('INSERT INTO project_versions')) {
    const vItem = {
      id: memoryStore.project_versions.length + 1,
      project_id: params[0],
      version_number: params[1],
      snapshot_json: params[2],
      created_at: new Date().toISOString()
    };
    memoryStore.project_versions.push(vItem);
    return { rows: [vItem], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
};

module.exports = {
  initDb,
  query,
  isPg: () => usePg
};
