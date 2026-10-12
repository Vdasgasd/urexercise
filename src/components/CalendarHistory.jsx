import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Dumbbell, Flame, Calendar as CalendarIcon, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { api } from '../utils/api';

const MONTHS_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function CalendarHistory() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [history, setHistory] = useState({ workouts: [], apnea: [] });
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await api.getHistory();
      setHistory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkout = async (id) => {
    if (!confirm('Hapus log latihan ini?')) return;
    try {
      await api.deleteWorkoutLog(id);
      loadHistory();
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  const handleDeleteApnea = async (id) => {
    if (!confirm('Hapus log apnea ini?')) return;
    try {
      await api.deleteApneaLog(id);
      loadHistory();
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  // Calendar logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const formatHoldDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  // Filter logs for selected date
  const selectedWorkouts = history.workouts.filter((w) => w.date === selectedDateStr);
  const selectedApneas = history.apnea.filter((a) => a.date === selectedDateStr);

  const realTodayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Calendar Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon size={18} className="text-cyan-400" />
            <h2 className="text-lg font-bold text-white">
              {MONTHS_INDO[month]} {year}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              Bulan Ini
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 py-1">
          <span>MIN</span>
          <span>SEN</span>
          <span>SEL</span>
          <span>RAB</span>
          <span>KAM</span>
          <span>JUM</span>
          <span>SAB</span>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Blank spaces before start of month */}
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={'blank-' + idx} className="h-14 sm:h-16 rounded-xl bg-slate-950/20 opacity-30" />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const formattedDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isSelected = selectedDateStr === formattedDayStr;
            const isToday = realTodayStr === formattedDayStr;

            const hasWorkout = history.workouts.some((w) => w.date === formattedDayStr);
            const hasApnea = history.apnea.some((a) => a.date === formattedDayStr);

            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDateStr(formattedDayStr)}
                className={`h-14 sm:h-16 rounded-xl p-1.5 flex flex-col justify-between items-start transition border relative ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500 text-white font-bold ring-1 ring-cyan-500'
                    : isToday
                    ? 'bg-slate-800/80 border-slate-700 text-cyan-400'
                    : 'bg-slate-950/50 border-slate-800/70 text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs ${isToday ? 'font-bold text-cyan-400' : ''}`}>
                    {dayNum}
                  </span>
                  {isToday && (
                    <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                      Hari Ini
                    </span>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1 mt-auto">
                  {hasWorkout && (
                    <span
                      title="Workout Selesai"
                      className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px]"
                    >
                      🏋️
                    </span>
                  )}
                  {hasApnea && (
                    <span
                      title="Latihan Apnea Selesai"
                      className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center text-[10px]"
                    >
                      ⏱️
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[9px]">
              🏋️
            </span>
            <span>Workout Gym / Exercise Selesai</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-[9px]">
              ⏱️
            </span>
            <span>Latihan Static Apnea Selesai</span>
          </div>
        </div>
      </div>

      {/* Detail for Selected Date */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Detail Catatan Latihan</span>
            <h3 className="text-lg font-bold text-white">Tanggal: {selectedDateStr}</h3>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            {selectedWorkouts.length} Workout • {selectedApneas.length} Apnea
          </div>
        </div>

        {selectedWorkouts.length === 0 && selectedApneas.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            Tidak ada riwayat latihan tercatat pada tanggal ini.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Workouts on this date */}
            {selectedWorkouts.map((w) => (
              <div key={w.id} className="bg-slate-950/80 border border-emerald-800/30 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <Dumbbell size={16} />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{w.routine_name}</h4>
                      <span className="text-[11px] text-slate-400">
                        Selesai pada: {new Date(w.completed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteWorkout(w.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {w.notes && <p className="text-xs text-slate-300 italic">"{w.notes}"</p>}

                {w.details && Array.isArray(w.details) && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 block font-semibold mb-1">Daftar Gerakan yang Selesai:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {w.details.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span className="text-white font-medium">{item.name}</span>
                          <span className="text-slate-400 text-[10px] ml-auto">
                            {item.completed_sets}/{item.target_sets || 3} sets
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Apnea Sessions on this date */}
            {selectedApneas.map((a) => (
              <div key={a.id} className="bg-slate-950/80 border border-cyan-800/30 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <Flame size={16} />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{a.preset_name}</h4>
                      <span className="text-[11px] text-slate-400">
                        {a.type?.toUpperCase()} Table • Selesai: {new Date(a.completed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteApnea(a.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Total Putaran</span>
                    <strong className="text-white text-sm">{a.total_rounds} Putaran</strong>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Total Waktu Tahan Napas (Hold)</span>
                    <strong className="text-cyan-400 text-sm">{formatHoldDuration(a.total_hold_seconds)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
