import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'app.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('mother','doctor','health_unit')),
  organization TEXT,
  speciality TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mother_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  health_unit_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  lmp_date TEXT,
  due_date TEXT,
  pregnancy_status TEXT NOT NULL DEFAULT 'pregnant',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'male',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pregnancy_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  gestational_week INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS symptoms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  severity TEXT NOT NULL,
  advice TEXT,
  reasoning TEXT,
  doctor_notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS child_vaccinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  mother_marked_at TEXT,
  confirmed_at TEXT,
  confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  UNIQUE (child_id, group_key)
);

CREATE TABLE IF NOT EXISTS growth_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  weight REAL,
  height REAL,
  head REAL,
  chest REAL,
  age_months_at_record REAL,
  assessment TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  related_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  form TEXT,
  times TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medication_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dose_date TEXT,
  dose_time TEXT,
  status TEXT NOT NULL DEFAULT 'taken',
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_symptoms_mother ON symptoms(mother_id);
CREATE INDEX IF NOT EXISTS idx_vacc_confirm ON child_vaccinations(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_medications_mother ON medications(mother_id, is_active);
CREATE INDEX IF NOT EXISTS idx_med_logs ON medication_logs(medication_id, dose_time, logged_at);
`);

export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

// ---------- توليد أكواد المستخدمين (طبيبة / وحدة صحية) ----------
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_PREFIX = { doctor: 'DOC', health_unit: 'UNIT' };
export function generateCode(prefix, length = 5) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${prefix}-${code}`;
}
export function uniqueUserCode(prefix) {
  let code;
  do {
    code = generateCode(prefix);
  } while (get('SELECT id FROM users WHERE code = ?', code));
  return code;
}
export const uniqueUnitCode = uniqueUserCode;

// ---------- ترقية المخطط (Migrations) ----------
const userCols = all('PRAGMA table_info(users)').map((c) => c.name);
if (!userCols.includes('code')) {
  db.exec('ALTER TABLE users ADD COLUMN code TEXT;');
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_code ON users(code) WHERE code IS NOT NULL;');

const growthCols = all('PRAGMA table_info(growth_records)').map((c) => c.name);
if (growthCols.length && !growthCols.includes('chest')) {
  db.exec('ALTER TABLE growth_records ADD COLUMN chest REAL;');
}

// جدول موحّد لطلبات الربط (طبيبة أو وحدة صحية) مع موافقة الطرف الآخر
db.exec(`
CREATE TABLE IF NOT EXISTS link_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mother_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL CHECK (target_role IN ('doctor','health_unit')),
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_used TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_lr_target ON link_requests(target_role, target_id, status);
CREATE INDEX IF NOT EXISTS idx_lr_mother ON link_requests(mother_id, target_role);
`);

// ترحيل الطلبات القديمة (الوحدة الصحية) إلى الجدول الموحّد دون فقدان بيانات
const hurCols = all('PRAGMA table_info(health_unit_requests)').map((c) => c.name);
if (hurCols.length) {
  db.exec(`
    INSERT INTO link_requests (id, mother_id, target_role, target_id, code_used, status, created_at, responded_at)
    SELECT id, mother_id, 'health_unit', health_unit_id, code_used, status, created_at, responded_at
    FROM health_unit_requests
    WHERE id NOT IN (SELECT id FROM link_requests);
  `);
}

// توليد/تصحيح أكواد الأطباء والوحدات (DOC-XXXXX / UNIT-XXXXX)
for (const user of all("SELECT id, role, code FROM users WHERE role IN ('doctor','health_unit')")) {
  const prefix = CODE_PREFIX[user.role];
  if (!user.code || !user.code.startsWith(`${prefix}-`)) {
    run('UPDATE users SET code=? WHERE id=?', uniqueUserCode(prefix), user.id);
  }
}


