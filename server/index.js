import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, initDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seeds
initDb();

const app = express();
const PORT = process.env.PORT || 3000;

export function safeJsonParse(str, fallback = {}) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

app.use(cors());
app.use(express.json());

// --- EXERCISES API ---
app.get('/api/exercises', (req, res) => {
  try {
    const exercises = db.prepare('SELECT * FROM exercises ORDER BY category, name ASC').all();
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/exercises', (req, res) => {
  try {
    const { name, category, target_sets, target_reps, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }
    const stmt = db.prepare(`
      INSERT INTO exercises (name, category, target_sets, target_reps, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      name.trim(),
      category?.trim() || 'General',
      Number(target_sets) || 3,
      target_reps?.toString().trim() || '10-12',
      notes?.trim() || ''
    );
    const created = db.prepare('SELECT * FROM exercises WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/exercises/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, target_sets, target_reps, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }
    const stmt = db.prepare(`
      UPDATE exercises
      SET name = ?, category = ?, target_sets = ?, target_reps = ?, notes = ?
      WHERE id = ?
    `);
    stmt.run(
      name.trim(),
      category?.trim() || 'General',
      Number(target_sets) || 3,
      target_reps?.toString().trim() || '10-12',
      notes?.trim() || '',
      id
    );
    const updated = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/exercises/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM exercises WHERE id = ?').run(id);
    res.json({ success: true, deletedId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUTINES (WEEKLY SCHEDULE & GROUPING) ---
app.get('/api/routines', (req, res) => {
  try {
    const days = db.prepare('SELECT * FROM routine_days ORDER BY day_of_week ASC').all();
    const result = days.map(day => {
      const exercises = db.prepare(`
        SELECT re.id as routine_exercise_id, re.order_index, re.target_sets, re.target_reps, re.notes as exercise_notes,
               e.id as exercise_id, e.name, e.category
        FROM routine_exercises re
        JOIN exercises e ON re.exercise_id = e.id
        WHERE re.routine_day_id = ?
        ORDER BY re.order_index ASC, re.id ASC
      `).all(day.id);
      return {
        ...day,
        exercises
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/routines/day/:dayOfWeek', (req, res) => {
  try {
    const dayOfWeek = Number(req.params.dayOfWeek);
    const day = db.prepare('SELECT * FROM routine_days WHERE day_of_week = ?').get(dayOfWeek);
    if (!day) {
      return res.status(404).json({ error: 'Day routine not found' });
    }
    const exercises = db.prepare(`
      SELECT re.id as routine_exercise_id, re.order_index, re.target_sets, re.target_reps, re.notes as exercise_notes,
             e.id as exercise_id, e.name, e.category
      FROM routine_exercises re
      JOIN exercises e ON re.exercise_id = e.id
      WHERE re.routine_day_id = ?
      ORDER BY re.order_index ASC, re.id ASC
    `).all(day.id);
    res.json({ ...day, exercises });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update routine day name and assigned exercises
app.put('/api/routines/day/:dayOfWeek', (req, res) => {
  try {
    const dayOfWeek = Number(req.params.dayOfWeek);
    const { routine_name, notes, exercises } = req.body;

    let day = db.prepare('SELECT * FROM routine_days WHERE day_of_week = ?').get(dayOfWeek);
    if (!day) {
      const ins = db.prepare('INSERT INTO routine_days (day_of_week, routine_name, notes) VALUES (?, ?, ?)');
      const info = ins.run(dayOfWeek, routine_name || 'Workout', notes || '');
      day = { id: info.lastInsertRowid, day_of_week: dayOfWeek, routine_name };
    } else {
      db.prepare('UPDATE routine_days SET routine_name = ?, notes = ? WHERE id = ?').run(
        routine_name ?? day.routine_name,
        notes ?? day.notes,
        day.id
      );
    }

    // Replace routine_exercises if exercises array provided
    if (Array.isArray(exercises)) {
      db.prepare('DELETE FROM routine_exercises WHERE routine_day_id = ?').run(day.id);
      const insertRE = db.prepare(`
        INSERT INTO routine_exercises (routine_day_id, exercise_id, order_index, target_sets, target_reps, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      exercises.forEach((item, index) => {
        insertRE.run(
          day.id,
          item.exercise_id,
          index,
          item.target_sets !== undefined ? Number(item.target_sets) : null,
          item.target_reps || null,
          item.notes || null
        );
      });
    }

    // Return updated day
    const updatedExercises = db.prepare(`
      SELECT re.id as routine_exercise_id, re.order_index, re.target_sets, re.target_reps, re.notes as exercise_notes,
             e.id as exercise_id, e.name, e.category
      FROM routine_exercises re
      JOIN exercises e ON re.exercise_id = e.id
      WHERE re.routine_day_id = ?
      ORDER BY re.order_index ASC, re.id ASC
    `).all(day.id);

    res.json({
      ...day,
      routine_name: routine_name ?? day.routine_name,
      notes: notes ?? day.notes,
      exercises: updatedExercises
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- WORKOUT HISTORY & CALENDAR LOGS ---
app.get('/api/history', (req, res) => {
  try {
    const workouts = db.prepare('SELECT * FROM workout_logs ORDER BY date DESC, completed_at DESC').all();
    const apnea = db.prepare('SELECT * FROM apnea_logs ORDER BY date DESC, completed_at DESC').all();
    res.json({
      workouts: workouts.map(w => ({
        ...w,
        details: w.details_json ? JSON.parse(w.details_json) : null
      })),
      apnea: apnea.map(a => ({
        ...a,
        details: a.details_json ? JSON.parse(a.details_json) : null
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/history/workout', (req, res) => {
  try {
    const { date, day_of_week, routine_name, notes, details } = req.body;
    const logDate = date || new Date().toISOString().slice(0, 10);
    const stmt = db.prepare(`
      INSERT INTO workout_logs (date, day_of_week, routine_name, notes, details_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      logDate,
      day_of_week !== undefined ? Number(day_of_week) : null,
      routine_name || 'Completed Workout',
      notes || '',
      details ? JSON.stringify(details) : null
    );
    const created = db.prepare('SELECT * FROM workout_logs WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({
      ...created,
      details: created.details_json ? JSON.parse(created.details_json) : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/history/workout/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM workout_logs WHERE id = ?').run(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- APNEA PRESETS & HISTORY ---
app.get('/api/apnea/presets', (req, res) => {
  try {
    const presets = db.prepare('SELECT * FROM apnea_presets ORDER BY id ASC').all();
    res.json(presets.map(p => ({
      ...p,
      config: safeJsonParse(p.config_json, {})
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apnea/presets', (req, res) => {
  try {
    const { name, type, rounds, config } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Preset name is required' });
    }
    const stmt = db.prepare(`
      INSERT INTO apnea_presets (name, type, rounds, config_json)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(
      name.trim(),
      type || 'custom',
      Number(rounds) || 8,
      JSON.stringify(config || {})
    );
    const created = db.prepare('SELECT * FROM apnea_presets WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({
      ...created,
      config: safeJsonParse(created.config_json, {})
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/apnea/presets/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM apnea_presets WHERE id = ?').run(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apnea/history', (req, res) => {
  try {
    const { date, preset_name, type, total_rounds, total_hold_seconds, details } = req.body;
    const logDate = date || new Date().toISOString().slice(0, 10);
    const stmt = db.prepare(`
      INSERT INTO apnea_logs (date, preset_name, type, total_rounds, total_hold_seconds, details_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      logDate,
      preset_name || 'Apnea Training',
      type || 'custom',
      Number(total_rounds) || 0,
      Number(total_hold_seconds) || 0,
      details ? JSON.stringify(details) : null
    );
    const created = db.prepare('SELECT * FROM apnea_logs WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({
      ...created,
      details: created.details_json ? JSON.parse(created.details_json) : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/apnea/history/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM apnea_logs WHERE id = ?').run(req.params.id);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In Production mode: serve static assets from dist
const distPath = path.join(process.cwd(), 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
} else {
  // In Development mode: root route gives clear info
  app.get('/', (req, res) => {
    res.send(`
      <div style="font-family: sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; min-height: 100vh;">
        <h2>🚀 UrExercise Backend API Server (Port ${PORT})</h2>
        <p>Backend API berjalan normal.</p>
        <p>Untuk tampilan Frontend (mode dev dengan Hot-Reload), silakan buka: <a href="http://localhost:5173" style="color: #38bdf8; font-weight: bold;">http://localhost:5173</a></p>
      </div>
    `);
  });
}

app.listen(PORT, () => {
  console.log(`🚀 UrExercise Server running on port ${PORT}`);
});
