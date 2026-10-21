import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbPath = path.join(dataDir, 'exercise.sqlite');

let currentDb = null;

export function getDb() {
  if (!currentDb) {
    currentDb = new DatabaseSync(dbPath);
    currentDb.exec('PRAGMA journal_mode = WAL;');
    currentDb.exec('PRAGMA foreign_keys = ON;');
  }
  return currentDb;
}

export function reloadDb() {
  if (currentDb) {
    try {
      currentDb.close();
    } catch (e) {
      console.warn('Error closing db before reload:', e);
    }
  }
  currentDb = new DatabaseSync(dbPath);
  currentDb.exec('PRAGMA journal_mode = WAL;');
  currentDb.exec('PRAGMA foreign_keys = ON;');
  initDb();
  return currentDb;
}

// Proxy export so db.prepare(...) works transparently
export const db = new Proxy({}, {
  get(target, prop) {
    const active = getDb();
    const val = active[prop];
    if (typeof val === 'function') {
      return val.bind(active);
    }
    return val;
  }
});

export function initDb() {
  const activeDb = getDb();

  activeDb.exec(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      target_sets INTEGER DEFAULT 3,
      target_reps TEXT DEFAULT '10-12',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS routine_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL UNIQUE, -- 0: Minggu, 1: Senin, ..., 6: Sabtu
      routine_name TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS routine_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_day_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      order_index INTEGER DEFAULT 0,
      target_sets INTEGER,
      target_reps TEXT,
      notes TEXT,
      FOREIGN KEY (routine_day_id) REFERENCES routine_days(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL, -- YYYY-MM-DD
      day_of_week INTEGER,
      routine_name TEXT,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      details_json TEXT
    );

    CREATE TABLE IF NOT EXISTS apnea_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'co2', 'o2', 'custom'
      rounds INTEGER NOT NULL,
      config_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS apnea_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL, -- YYYY-MM-DD
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      preset_name TEXT,
      type TEXT,
      total_rounds INTEGER,
      total_hold_seconds INTEGER,
      details_json TEXT
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Default Personal Best (PB) setting if not set
  const pbSetting = activeDb.prepare('SELECT value FROM user_settings WHERE key = ?').get('apnea_pb_seconds');
  if (!pbSetting) {
    activeDb.prepare('INSERT INTO user_settings (key, value) VALUES (?, ?)').run('apnea_pb_seconds', '180');
  }

  // Seed default days of the week if not present
  const countDays = activeDb.prepare('SELECT COUNT(*) as count FROM routine_days').get();
  if (countDays.count === 0) {
    const dayNames = [
      { day: 0, name: 'Rest & Recovery' }, // Minggu
      { day: 1, name: 'Upper Body Focus' }, // Senin
      { day: 2, name: 'Lower Body & Core' }, // Selasa
      { day: 3, name: 'Cardio & Mobility' }, // Rabu
      { day: 4, name: 'Push / Pull Hypertrophy' }, // Kamis
      { day: 5, name: 'Legs & Endurance' }, // Jumat
      { day: 6, name: 'Free Movement / Outdoor' } // Sabtu
    ];

    const insertDay = activeDb.prepare('INSERT INTO routine_days (day_of_week, routine_name) VALUES (?, ?)');
    for (const d of dayNames) {
      insertDay.run(d.day, d.name);
    }
  }

  // Seed starter exercises if empty
  const countEx = activeDb.prepare('SELECT COUNT(*) as count FROM exercises').get();
  if (countEx.count === 0) {
    const sampleExercises = [
      { name: 'Push Up', category: 'Chest', sets: 4, reps: '15-20', notes: 'Tempo 2-1-2' },
      { name: 'Pull Up', category: 'Back', sets: 4, reps: '8-10', notes: 'Full range of motion' },
      { name: 'Bodyweight Squats', category: 'Legs', sets: 4, reps: '20', notes: 'Deep squat' },
      { name: 'Plank', category: 'Core', sets: 3, reps: '60 detik', notes: 'Keep core tight' },
      { name: 'Dips', category: 'Chest/Triceps', sets: 3, reps: '12', notes: 'Slow negative' },
      { name: 'Dumbbell Row', category: 'Back', sets: 3, reps: '12', notes: 'Squeeze back' }
    ];

    const insertEx = activeDb.prepare('INSERT INTO exercises (name, category, target_sets, target_reps, notes) VALUES (?, ?, ?, ?, ?)');
    for (const ex of sampleExercises) {
      insertEx.run(ex.name, ex.category, ex.sets, ex.reps, ex.notes);
    }

    // Attach sample exercises to Monday (day 1) and Tuesday (day 2)
    const monday = activeDb.prepare('SELECT id FROM routine_days WHERE day_of_week = 1').get();
    if (monday) {
      const attach = activeDb.prepare('INSERT INTO routine_exercises (routine_day_id, exercise_id, order_index, target_sets, target_reps) VALUES (?, ?, ?, ?, ?)');
      attach.run(monday.id, 1, 0, 4, '15-20'); // Push up
      attach.run(monday.id, 2, 1, 4, '8-10'); // Pull up
      attach.run(monday.id, 5, 2, 3, '12'); // Dips
    }

    const tuesday = activeDb.prepare('SELECT id FROM routine_days WHERE day_of_week = 2').get();
    if (tuesday) {
      const attach = activeDb.prepare('INSERT INTO routine_exercises (routine_day_id, exercise_id, order_index, target_sets, target_reps) VALUES (?, ?, ?, ?, ?)');
      attach.run(tuesday.id, 3, 0, 4, '20'); // Squats
      attach.run(tuesday.id, 4, 1, 3, '60s'); // Plank
    }
  }

  // Seed starter Apnea Presets if empty
  const countApnea = activeDb.prepare('SELECT COUNT(*) as count FROM apnea_presets').get();
  if (countApnea.count === 0) {
    const insertApnea = activeDb.prepare('INSERT INTO apnea_presets (name, type, rounds, config_json) VALUES (?, ?, ?, ?)');

    // CO2 Table (Standard: Hold stays 2m00s constant, Rest starts at 2m00s and decreases by 15s)
    const co2Config = {
      rounds: 8,
      prepSeconds: 120,
      baseHoldSeconds: 120,
      holdStepSeconds: 0,
      baseRestSeconds: 120,
      restStepSeconds: -15,
      minRestSeconds: 15
    };
    insertApnea.run('CO2 Table (Classic 8-Rounds)', 'co2', 8, JSON.stringify(co2Config));

    // O2 Table (Standard: Rest stays 2m00s, Hold starts at 1m15s and increases by 15s)
    const o2Config = {
      rounds: 8,
      prepSeconds: 120,
      baseHoldSeconds: 75,
      holdStepSeconds: 15,
      baseRestSeconds: 120,
      restStepSeconds: 0,
      minRestSeconds: 60
    };
    insertApnea.run('O2 Table (Progression 8-Rounds)', 'o2', 8, JSON.stringify(o2Config));
  }
}
