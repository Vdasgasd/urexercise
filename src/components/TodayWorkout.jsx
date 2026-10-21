import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trophy, Edit3, ArrowRight, RotateCcw, Calendar, CheckSquare, Sparkles, Flame, Repeat } from 'lucide-react';
import { api } from '../utils/api';
import { sound } from '../utils/audio';

const DAYS = [
  { id: 1, name: 'Senin', short: 'Sen' },
  { id: 2, name: 'Selasa', short: 'Sel' },
  { id: 3, name: 'Rabu', short: 'Rab' },
  { id: 4, name: 'Kamis', short: 'Kam' },
  { id: 5, name: 'Jumat', short: 'Jum' },
  { id: 6, name: 'Sabtu', short: 'Sab' },
  { id: 0, name: 'Minggu', short: 'Min' },
];

function getDateForDayOfWeek(targetDay, refDate = new Date()) {
  const currentDay = refDate.getDay(); // 0: Min, 1: Sen, ..., 6: Sab
  const currentIso = currentDay === 0 ? 7 : currentDay;
  const targetIso = targetDay === 0 ? 7 : targetDay;
  const diff = targetIso - currentIso;
  const d = new Date(refDate);
  d.setDate(refDate.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TodayWorkout({ onGoToRoutine, onGoToCalendar }) {
  const currentDayOfWeek = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(currentDayOfWeek);
  const [workoutDate, setWorkoutDate] = useState(() => getDateForDayOfWeek(currentDayOfWeek));
  const [dayRoutine, setDayRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedSets, setCompletedSets] = useState({}); // { [routineExerciseId]: [true, false, ...] }
  const [isDoneForDay, setIsDoneForDay] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [weeklyWorkoutCount, setWeeklyWorkoutCount] = useState(0);

  useEffect(() => {
    setWorkoutDate(getDateForDayOfWeek(selectedDay));
    loadRoutine(selectedDay);
    loadWeeklyStats();
  }, [selectedDay]);

  const loadWeeklyStats = async () => {
    try {
      const history = await api.getHistory();
      if (history && history.workouts) {
        // Count workouts in current week
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay() || 7;
        startOfWeek.setDate(startOfWeek.getDate() - day + 1);
        startOfWeek.setHours(0, 0, 0, 0);

        const count = history.workouts.filter((w) => {
          const wDate = new Date(w.date);
          return wDate >= startOfWeek;
        }).length;
        setWeeklyWorkoutCount(count);
      }
    } catch (err) {
      console.warn('Error loading weekly stats:', err);
    }
  };

  const loadRoutine = async (day) => {
    setLoading(true);
    try {
      const data = await api.getRoutineByDay(day);
      setDayRoutine(data);
      // Initialize completed sets tracking
      const initial = {};
      if (data && data.exercises) {
        data.exercises.forEach((ex) => {
          const setsCount = ex.target_sets || 3;
          initial[ex.routine_exercise_id] = new Array(setsCount).fill(false);
        });
      }
      setCompletedSets(initial);
      setShowCelebration(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSet = (exerciseId, setIdx) => {
    setCompletedSets((prev) => {
      const current = prev[exerciseId] ? [...prev[exerciseId]] : [];
      current[setIdx] = !current[setIdx];
      if (current[setIdx]) {
        sound.countdownTick();
      }
      return {
        ...prev,
        [exerciseId]: current,
      };
    });
  };

  const toggleAllSetsForExercise = (exerciseId, setsCount) => {
    setCompletedSets((prev) => {
      const current = prev[exerciseId] || [];
      const allDone = current.every(Boolean) && current.length === setsCount;
      const next = new Array(setsCount).fill(!allDone);
      if (!allDone) sound.holdStart();
      return {
        ...prev,
        [exerciseId]: next,
      };
    });
  };

  const totalExercises = dayRoutine?.exercises?.length || 0;
  const completedExercisesCount = dayRoutine?.exercises?.filter((ex) => {
    const sets = completedSets[ex.routine_exercise_id];
    return sets && sets.length > 0 && sets.every(Boolean);
  }).length || 0;

  const progressPercent = totalExercises > 0 ? Math.round((completedExercisesCount / totalExercises) * 100) : 0;

  const handleFinishWorkout = async () => {
    if (savingLog) return;
    setSavingLog(true);
    try {
      const logTargetDate = workoutDate || new Date().toISOString().slice(0, 10);
      const summaryDetails = dayRoutine.exercises.map((ex) => ({
        name: ex.name,
        category: ex.category,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
        completed_sets: (completedSets[ex.routine_exercise_id] || []).filter(Boolean).length,
      }));

      await api.logWorkout({
        date: logTargetDate,
        day_of_week: selectedDay,
        routine_name: dayRoutine.routine_name || 'Latihan Harian',
        notes: `Selesai ${completedExercisesCount}/${totalExercises} latihan`,
        details: summaryDetails,
      });

      sound.sessionComplete();
      setShowCelebration(true);
      setIsDoneForDay(true);
      loadWeeklyStats();
    } catch (err) {
      alert('Gagal menyimpan latihan: ' + err.message);
    } finally {
      setSavingLog(false);
    }
  };

  const handleResetChecklist = () => {
    if (!dayRoutine?.exercises) return;
    const resetState = {};
    dayRoutine.exercises.forEach((ex) => {
      resetState[ex.routine_exercise_id] = new Array(ex.target_sets || 3).fill(false);
    });
    setCompletedSets(resetState);
    setShowCelebration(false);
  };

  const selectedDayObj = DAYS.find((d) => d.id === selectedDay);
  const isRealToday = selectedDay === currentDayOfWeek;

  return (
    <div className="space-y-6">
      {/* Day Selector Pill Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-sm">
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d) => {
            const isSelected = selectedDay === d.id;
            const isToday = d.id === currentDayOfWeek;
            const dayDate = getDateForDayOfWeek(d.id);
            const dateNum = dayDate ? parseInt(dayDate.split('-')[2]) : '';
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDay(d.id)}
                className={`py-2 px-1 rounded-xl text-center transition flex flex-col items-center justify-center relative ${
                  isSelected
                    ? 'bg-gradient-to-b from-cyan-500 to-cyan-600 text-white font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="text-[11px] uppercase tracking-wider">{d.short}</span>
                <span className="text-[11px] font-mono opacity-90">{dateNum}</span>
                {isToday && (
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full mt-0.5 ${
                      isSelected ? 'bg-white' : 'bg-emerald-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Header Summary */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800 text-xs font-semibold">
                {isRealToday ? 'Hari Ini' : 'Jadwal'} • {selectedDayObj?.name}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium">
                <Repeat size={12} className="text-cyan-400" />
                <span>Otomatis Berulang</span>
              </span>
              {weeklyWorkoutCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-400 border border-amber-800/60 text-xs font-semibold">
                  <Flame size={12} />
                  <span>{weeklyWorkoutCount} Latihan Minggu Ini</span>
                </span>
              )}
              {dayRoutine?.notes && (
                <span className="text-xs text-slate-400 italic">"{dayRoutine.notes}"</span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              {dayRoutine?.routine_name || 'Tidak ada jadwal'}
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Tanggal yang akan dicatat di kalender */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium shadow-sm">
              <Calendar size={14} className="text-cyan-400" />
              <span>Tanggal:</span>
              <input
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={onGoToRoutine}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <Edit3 size={14} />
              <span>Ubah Rencana</span>
            </button>
            {totalExercises > 0 && (
              <button
                onClick={handleResetChecklist}
                title="Reset checklist hari ini"
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {totalExercises > 0 && (
          <div className="mt-5 space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Progres Selesai</span>
              <span className="font-mono text-cyan-400 font-bold">
                {completedExercisesCount} / {totalExercises} Latihan ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Exercises Checklist */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Memuat data latihan...</div>
      ) : totalExercises === 0 ? (
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <CheckSquare size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-200">Belum Ada Latihan di Hari {selectedDayObj?.name}</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Hari ini masih kosong atau diatur sebagai hari istirahat. Lo bisa menambahkan latihan dari bank latihan.
            </p>
          </div>
          <button
            onClick={onGoToRoutine}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition shadow-md shadow-cyan-600/20"
          >
            <span>Atur Latihan Hari Ini</span>
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {dayRoutine.exercises.map((ex, index) => {
            const sets = completedSets[ex.routine_exercise_id] || [];
            const setsCount = ex.target_sets || 3;
            const isAllSetsDone = sets.length > 0 && sets.every(Boolean);

            return (
              <div
                key={ex.routine_exercise_id}
                className={`border rounded-2xl p-4 transition-all duration-200 ${
                  isAllSetsDone
                    ? 'bg-emerald-950/20 border-emerald-800/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-slate-500">#{index + 1}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                        {ex.category || 'General'}
                      </span>
                      {isAllSetsDone && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                          <CheckCircle2 size={13} /> Selesai
                        </span>
                      )}
                    </div>
                    <h3 className={`text-base font-bold ${isAllSetsDone ? 'text-slate-300 line-through' : 'text-white'}`}>
                      {ex.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Target: <strong className="text-slate-200">{setsCount} Sets</strong></span>
                      <span>•</span>
                      <span>Reps: <strong className="text-slate-200">{ex.target_reps || '10-12'}</strong></span>
                      {ex.exercise_notes && (
                        <>
                          <span>•</span>
                          <span className="text-cyan-400/90 italic">{ex.exercise_notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick Toggle All Button */}
                  <button
                    onClick={() => toggleAllSetsForExercise(ex.routine_exercise_id, setsCount)}
                    title={isAllSetsDone ? 'Batal tandai selesai' : 'Tandai semua set selesai'}
                    className={`p-2 rounded-xl border transition ${
                      isAllSetsDone
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {isAllSetsDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>
                </div>

                {/* Individual Set Checkboxes */}
                <div className="mt-3 pt-3 border-t border-slate-800/80">
                  <span className="text-xs text-slate-400 font-medium block mb-2">Checklist Per Set:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {Array.from({ length: setsCount }).map((_, setIdx) => {
                      const isSetDone = Boolean(sets[setIdx]);
                      return (
                        <button
                          key={setIdx}
                          onClick={() => toggleSet(ex.routine_exercise_id, setIdx)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            isSetDone
                              ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600 hover:bg-slate-750'
                          }`}
                        >
                          {isSetDone ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                          <span>Set {setIdx + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Complete Today's Workout Button */}
          <div className="pt-4">
            <button
              onClick={handleFinishWorkout}
              disabled={savingLog || completedExercisesCount === 0}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition duration-200 ${
                completedExercisesCount > 0
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Trophy size={18} />
              <span>
                {savingLog
                  ? 'Menyimpan ke Kalender...'
                  : `Selesaikan Latihan & Simpan ke Kalender (${workoutDate})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Celebration Modal after saving */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Sparkles size={32} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Latihan Selesai! 🎉</h2>
              <p className="text-xs text-slate-300">
                Mantap! Latihan hari ini sudah tercatat rapi ke dalam kalender history lo.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setShowCelebration(false);
                  onGoToCalendar();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Calendar size={15} />
                <span>Lihat di Kalender</span>
              </button>
              <button
                onClick={() => setShowCelebration(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
