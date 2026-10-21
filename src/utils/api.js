const BASE_URL = '/api';

async function request(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (!res.ok) {
      let errMessage = `Error ${res.status}: ${res.statusText || 'Gagal memproses permintaan'}`;
      if (text) {
        try {
          const errObj = JSON.parse(text);
          if (errObj.error) errMessage = errObj.error;
        } catch {
          errMessage = text;
        }
      }
      throw new Error(errMessage);
    }

    if (!text || !text.trim()) {
      return {};
    }

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Format respons JSON tidak valid dari server: ${text.slice(0, 100)}`);
      }
    }

    return text;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error('Tidak dapat terhubung ke server backend API (koneksi terputus). Pastikan server backend sedang berjalan.');
    }
    throw err;
  }
}

export const api = {
  // Exercises
  getExercises() {
    return request(`${BASE_URL}/exercises`);
  },
  createExercise(data) {
    return request(`${BASE_URL}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  updateExercise(id, data) {
    return request(`${BASE_URL}/exercises/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  deleteExercise(id) {
    return request(`${BASE_URL}/exercises/${id}`, { method: 'DELETE' });
  },

  // Routines (Weekly)
  getRoutines() {
    return request(`${BASE_URL}/routines`);
  },
  getRoutineByDay(dayOfWeek) {
    return request(`${BASE_URL}/routines/day/${dayOfWeek}`);
  },
  updateRoutineDay(dayOfWeek, data) {
    return request(`${BASE_URL}/routines/day/${dayOfWeek}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Workout History
  getHistory() {
    return request(`${BASE_URL}/history`);
  },
  logWorkout(data) {
    return request(`${BASE_URL}/history/workout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  deleteWorkoutLog(id) {
    return request(`${BASE_URL}/history/workout/${id}`, { method: 'DELETE' });
  },

  // Apnea
  getApneaPresets() {
    return request(`${BASE_URL}/apnea/presets`);
  },
  createApneaPreset(data) {
    return request(`${BASE_URL}/apnea/presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  deleteApneaPreset(id) {
    return request(`${BASE_URL}/apnea/presets/${id}`, { method: 'DELETE' });
  },
  logApnea(data) {
    return request(`${BASE_URL}/apnea/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
  deleteApneaLog(id) {
    return request(`${BASE_URL}/apnea/history/${id}`, { method: 'DELETE' });
  },

  // Routines Copy
  copyRoutine(fromDay, toDay) {
    return request(`${BASE_URL}/routines/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDay, toDay }),
    });
  },

  // Settings (PB, etc.)
  getSettings() {
    return request(`${BASE_URL}/settings`);
  },
  updateSetting(key, value) {
    return request(`${BASE_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  },

  // Database Backup & Restore
  getBackupDownloadUrl() {
    return `${BASE_URL}/backup/download`;
  },
  async restoreDatabase(file) {
    const arrayBuffer = await file.arrayBuffer();
    return request(`${BASE_URL}/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: arrayBuffer,
    });
  },
};
