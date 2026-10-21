import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Dumbbell, Calendar, MoveUp, MoveDown, Layers, Search, Save, Copy } from 'lucide-react';
import { api } from '../utils/api';

const DAYS = [
  { id: 1, name: 'Senin', short: 'Sen' },
  { id: 2, name: 'Selasa', short: 'Sel' },
  { id: 3, name: 'Rabu', short: 'Rab' },
  { id: 4, name: 'Kamis', short: 'Kam' },
  { id: 5, name: 'Jumat', short: 'Jum' },
  { id: 6, name: 'Sabtu', short: 'Sab' },
  { id: 0, name: 'Minggu', short: 'Min' },
];

const CATEGORIES = [
  'Semua',
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Cardio',
  'Mobility',
  'General',
];

export default function RoutineBuilder() {
  const [subTab, setSubTab] = useState('weekly'); // 'weekly' | 'library'
  const [routines, setRoutines] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1); // Default Monday
  const [loading, setLoading] = useState(true);

  // Form states for Exercise Library CRUD
  const [showExModal, setShowExModal] = useState(false);
  const [editingEx, setEditingEx] = useState(null);
  const [exForm, setExForm] = useState({
    name: '',
    category: 'Chest',
    target_sets: 3,
    target_reps: '10-12',
    notes: '',
  });

  // Routine Edit state for selected day
  const [routineName, setRoutineName] = useState('');
  const [routineNotes, setRoutineNotes] = useState('');
  const [dayExercises, setDayExercises] = useState([]);
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Exercise Picker modal for adding to routine
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('Semua');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [routinesData, exercisesData] = await Promise.all([
        api.getRoutines(),
        api.getExercises(),
      ]);
      setRoutines(routinesData);
      setExercises(exercisesData);

      // Initialize selected day state
      const currentDayData = routinesData.find((r) => r.day_of_week === selectedDay);
      if (currentDayData) {
        setRoutineName(currentDayData.routine_name || '');
        setRoutineNotes(currentDayData.notes || '');
        setDayExercises(currentDayData.exercises || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDay = (dayId) => {
    setSelectedDay(dayId);
    setSaveSuccess(false);
    const dayData = routines.find((r) => r.day_of_week === dayId);
    if (dayData) {
      setRoutineName(dayData.routine_name || '');
      setRoutineNotes(dayData.notes || '');
      setDayExercises(dayData.exercises || []);
    } else {
      setRoutineName('Rest Day');
      setRoutineNotes('');
      setDayExercises([]);
    }
  };

  // --- SAVE ROUTINE FOR DAY ---
  const handleSaveRoutine = async () => {
    setIsSavingRoutine(true);
    try {
      const payload = {
        routine_name: routineName.trim() || 'Latihan',
        notes: routineNotes.trim(),
        exercises: dayExercises.map((e) => ({
          exercise_id: e.exercise_id,
          target_sets: e.target_sets || 3,
          target_reps: e.target_reps || '10-12',
          notes: e.exercise_notes || '',
        })),
      };
      await api.updateRoutineDay(selectedDay, payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);

      // Refresh list
      const updated = await api.getRoutines();
      setRoutines(updated);
    } catch (err) {
      alert('Gagal menyimpan jadwal: ' + err.message);
    } finally {
      setIsSavingRoutine(false);
    }
  };

  const handleCopyRoutineFromDay = async (fromDayId) => {
    if (fromDayId === '' || Number(fromDayId) === selectedDay) return;
    const sourceDay = DAYS.find((d) => d.id === Number(fromDayId));
    const targetDay = DAYS.find((d) => d.id === selectedDay);
    if (!confirm(`Salin seluruh latihan dari ${sourceDay?.name} ke ${targetDay?.name}?`)) return;

    try {
      await api.copyRoutine(Number(fromDayId), selectedDay);
      const updated = await api.getRoutines();
      setRoutines(updated);
      const targetUpdated = updated.find((r) => r.day_of_week === selectedDay);
      if (targetUpdated) {
        setRoutineName(targetUpdated.routine_name || '');
        setRoutineNotes(targetUpdated.notes || '');
        setDayExercises(targetUpdated.exercises || []);
      }
      alert(`Berhasil menyalin rutinitas dari ${sourceDay?.name}!`);
    } catch (err) {
      alert('Gagal menyalin jadwal: ' + err.message);
    }
  };

  // Add exercise from library into current day's routine
  const handleAddExerciseToDay = (ex) => {
    const alreadyExists = dayExercises.some((e) => e.exercise_id === ex.id);
    if (alreadyExists) {
      alert('Latihan ini sudah ada di jadwal hari ini.');
      return;
    }
    const newEntry = {
      exercise_id: ex.id,
      name: ex.name,
      category: ex.category,
      target_sets: ex.target_sets || 3,
      target_reps: ex.target_reps || '10-12',
      exercise_notes: ex.notes || '',
    };
    setDayExercises([...dayExercises, newEntry]);
    setShowPickerModal(false);
  };

  const handleRemoveExerciseFromDay = (index) => {
    setDayExercises(dayExercises.filter((_, idx) => idx !== index));
  };

  const handleMoveExercise = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= dayExercises.length) return;
    const reordered = [...dayExercises];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    setDayExercises(reordered);
  };

  const handleUpdateDayExerciseField = (index, field, value) => {
    const updated = [...dayExercises];
    updated[index] = { ...updated[index], [field]: value };
    setDayExercises(updated);
  };

  // --- EXERCISE LIBRARY CRUD ---
  const handleOpenExModal = (ex = null) => {
    if (ex) {
      setEditingEx(ex);
      setExForm({
        name: ex.name,
        category: ex.category || 'General',
        target_sets: ex.target_sets || 3,
        target_reps: ex.target_reps || '10-12',
        notes: ex.notes || '',
      });
    } else {
      setEditingEx(null);
      setExForm({
        name: '',
        category: 'Chest',
        target_sets: 3,
        target_reps: '10-12',
        notes: '',
      });
    }
    setShowExModal(true);
  };

  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!exForm.name.trim()) return;
    try {
      if (editingEx) {
        await api.updateExercise(editingEx.id, exForm);
      } else {
        await api.createExercise(exForm);
      }
      setShowExModal(false);
      // Reload exercises
      const exData = await api.getExercises();
      setExercises(exData);
    } catch (err) {
      alert('Gagal menyimpan latihan: ' + err.message);
    }
  };

  const handleDeleteExercise = async (id) => {
    if (!confirm('Yakin ingin menghapus latihan ini dari Bank Latihan?')) return;
    try {
      await api.deleteExercise(id);
      const exData = await api.getExercises();
      setExercises(exData);
      // Also remove from local day list if present
      setDayExercises(dayExercises.filter((e) => e.exercise_id !== id));
    } catch (err) {
      alert('Gagal menghapus latihan: ' + err.message);
    }
  };

  const filteredLibrary = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(pickerSearch.toLowerCase());
    const matchesCat = pickerCategory === 'Semua' || ex.category === pickerCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Subtab Switcher */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1.5 max-w-md mx-auto">
        <button
          onClick={() => setSubTab('weekly')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            subTab === 'weekly'
              ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar size={15} />
          <span>Jadwal Mingguan</span>
        </button>
        <button
          onClick={() => setSubTab('library')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            subTab === 'library'
              ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers size={15} />
          <span>Bank Latihan ({exercises.length})</span>
        </button>
      </div>

      {/* --- TAB 1: JADWAL MINGGUAN (GROUPING PER HARI) --- */}
      {subTab === 'weekly' && (
        <div className="space-y-6">
          {/* Day Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2">
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d) => {
                const isSelected = selectedDay === d.id;
                const routineForD = routines.find((r) => r.day_of_week === d.id);
                const exCount = routineForD?.exercises?.length || 0;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleSelectDay(d.id)}
                    className={`py-2 px-1 rounded-xl text-center transition flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-cyan-500 text-white font-bold shadow-md shadow-cyan-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xs uppercase">{d.short}</span>
                    <span className="text-[10px] opacity-80 mt-0.5">{exCount} ex</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Routine Day Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  Pengaturan Jadwal • {DAYS.find((d) => d.id === selectedDay)?.name}
                </span>
                <h2 className="text-xl font-bold text-white">Grup & Rangkaian Latihan</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Salin dari Hari Lain */}
                <div className="relative">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value !== '') {
                        handleCopyRoutineFromDay(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer focus:outline-none focus:border-cyan-500"
                  >
                    <option value="" disabled>📋 Salin dari Hari...</option>
                    {DAYS.filter((d) => d.id !== selectedDay).map((d) => (
                      <option key={d.id} value={d.id}>
                        Salin dari {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setShowPickerModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition"
                >
                  <Plus size={16} />
                  <span>+ Tambah Latihan</span>
                </button>
                <button
                  onClick={handleSaveRoutine}
                  disabled={isSavingRoutine}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-md ${
                    saveSuccess
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                  }`}
                >
                  {saveSuccess ? <Check size={16} /> : <Save size={16} />}
                  <span>{saveSuccess ? 'Tersimpan!' : isSavingRoutine ? 'Menyimpan...' : 'Simpan Jadwal'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Nama Routine Hari Ini (Contoh: Chest & Triceps, Leg Day, Rest Day)
                </label>
                <input
                  type="text"
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  placeholder="Misal: Upper Body Focus"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Catatan / Target Khusus Hari Ini
                </label>
                <input
                  type="text"
                  value={routineNotes}
                  onChange={(e) => setRoutineNotes(e.target.value)}
                  placeholder="Misal: Istirahat 90 detik tiap set"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* List of exercises assigned to day */}
            <div className="pt-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Daftar Gerakan ({dayExercises.length})
              </span>

              {dayExercises.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl p-6 text-slate-500 text-xs">
                  Belum ada latihan yang ditambahkan ke hari ini. Klik <strong className="text-cyan-400">+ Tambah Latihan</strong> untuk memilih dari Bank Latihan.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dayExercises.map((item, index) => (
                    <div
                      key={item.exercise_id + '-' + index}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-2">
                        {/* Order buttons */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveExercise(index, -1)}
                            disabled={index === 0}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <MoveUp size={12} />
                          </button>
                          <button
                            onClick={() => handleMoveExercise(index, 1)}
                            disabled={index === dayExercises.length - 1}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <MoveDown size={12} />
                          </button>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-500">#{index + 1}</span>
                            <span className="text-xs px-2 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {item.category}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white">{item.name}</h4>
                        </div>
                      </div>

                      {/* Configurable target sets/reps */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                          <span className="text-slate-400">Sets:</span>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={item.target_sets || 3}
                            onChange={(e) =>
                              handleUpdateDayExerciseField(index, 'target_sets', parseInt(e.target.value) || 1)
                            }
                            className="w-12 bg-transparent text-white font-bold focus:outline-none text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                          <span className="text-slate-400">Reps:</span>
                          <input
                            type="text"
                            value={item.target_reps || ''}
                            onChange={(e) =>
                              handleUpdateDayExerciseField(index, 'target_reps', e.target.value)
                            }
                            placeholder="10-12"
                            className="w-16 bg-transparent text-white font-bold focus:outline-none text-center"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveExerciseFromDay(index)}
                          title="Hapus dari jadwal hari ini"
                          className="p-2 rounded-lg bg-red-950/40 text-red-400 border border-red-900/40 hover:bg-red-900/60 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: BANK LATIHAN (LIBRARY CRUD) --- */}
      {subTab === 'library' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Koleksi Gerakan</span>
              <h2 className="text-xl font-bold text-white">Bank Latihan</h2>
            </div>
            <button
              onClick={() => handleOpenExModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition"
            >
              <Plus size={16} />
              <span>+ Buat Gerakan Baru</span>
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Cari nama latihan..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
              {CATEGORIES.slice(0, 6).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setPickerCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    pickerCategory === cat
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Exercises */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {filteredLibrary.map((ex) => (
              <div
                key={ex.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700 font-semibold">
                      {ex.category || 'General'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenExModal(ex)}
                        className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteExercise(ex.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-white">{ex.name}</h4>
                  <div className="text-xs text-slate-400 mt-1">
                    Target default: <strong className="text-slate-200">{ex.target_sets} Sets</strong> x <strong className="text-slate-200">{ex.target_reps} Reps</strong>
                  </div>
                  {ex.notes && (
                    <p className="text-[11px] text-slate-400 italic mt-1.5 line-clamp-2">
                      "{ex.notes}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MODAL: PICK EXERCISE FOR ROUTINE --- */}
      {showPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Pilih Latihan ke Jadwal</h3>
                <p className="text-xs text-slate-400">Pilih dari bank latihan untuk dimasukkan ke hari ini</p>
              </div>
              <button
                onClick={() => setShowPickerModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Cari gerakan..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredLibrary.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => handleAddExerciseToDay(ex)}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 mr-2">
                      {ex.category}
                    </span>
                    <strong className="text-xs text-white">{ex.name}</strong>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {ex.target_sets} Sets • {ex.target_reps} Reps
                    </div>
                  </div>
                  <span className="text-xs text-cyan-400 font-bold px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-800">
                    + Tambah
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT EXERCISE --- */}
      {showExModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveExercise}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">
                {editingEx ? 'Edit Gerakan Latihan' : 'Tambah Gerakan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowExModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Nama Gerakan</label>
                <input
                  type="text"
                  required
                  value={exForm.name}
                  onChange={(e) => setExForm({ ...exForm, name: e.target.value })}
                  placeholder="Contoh: Barbell Bench Press"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Kategori Otot / Jenis</label>
                <select
                  value={exForm.category}
                  onChange={(e) => setExForm({ ...exForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                >
                  {CATEGORIES.filter((c) => c !== 'Semua').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Default Sets</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={exForm.target_sets}
                    onChange={(e) => setExForm({ ...exForm, target_sets: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Default Reps / Durasi</label>
                  <input
                    type="text"
                    value={exForm.target_reps}
                    onChange={(e) => setExForm({ ...exForm, target_reps: e.target.value })}
                    placeholder="10-12 atau 60s"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Catatan / Tips Gerakan</label>
                <textarea
                  rows="2"
                  value={exForm.notes}
                  onChange={(e) => setExForm({ ...exForm, notes: e.target.value })}
                  placeholder="Catatan tempo, form, atau beban..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
