import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Plus, Trash2, Save, Flame, Volume2, Sparkles, Calendar, Maximize2, Minimize2, Settings2, Trophy, Smartphone } from 'lucide-react';
import { api } from '../utils/api';
import { sound } from '../utils/audio';

export default function ApneaTimer({ onGoToCalendar }) {
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState([]); // array of phases
  const [loading, setLoading] = useState(true);

  // Runner state
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [completedSessionData, setCompletedSessionData] = useState(null);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [personalBest, setPersonalBest] = useState(180); // in seconds
  const [showPbModal, setShowPbModal] = useState(false);
  const [pbInputMinutes, setPbInputMinutes] = useState('3');
  const [pbInputSeconds, setPbInputSeconds] = useState('00');

  // Table Builder / Progression Customizer Modal
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [builderForm, setBuilderForm] = useState({
    name: 'Tabel Apnea Progresif',
    type: 'co2', // 'co2' | 'o2' | 'custom'
    rounds: 8,
    prepSeconds: 120,
    baseHoldSeconds: 90,
    holdStepSeconds: 0,
    baseRestSeconds: 120,
    restStepSeconds: -15,
    minRestSeconds: 15,
  });

  const timerRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Vibration feedback for mobile
  const triggerVibration = (pattern) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  // Screen Wake Lock API to prevent display from sleeping
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.warn('Wake Lock release error:', err);
      }
    }
  };

  useEffect(() => {
    loadPresets();
    loadPersonalBest();
  }, []);

  const loadPersonalBest = async () => {
    try {
      const settings = await api.getSettings();
      if (settings && settings.apnea_pb_seconds) {
        const secs = Number(settings.apnea_pb_seconds);
        setPersonalBest(secs);
        setPbInputMinutes(String(Math.floor(secs / 60)));
        setPbInputSeconds(String(secs % 60).padStart(2, '0'));
      }
    } catch (err) {
      console.warn('Error loading PB:', err);
    }
  };

  const handleSavePersonalBest = async (e) => {
    e.preventDefault();
    const totalSecs = (parseInt(pbInputMinutes) || 0) * 60 + (parseInt(pbInputSeconds) || 0);
    if (totalSecs <= 0) return;
    try {
      await api.updateSetting('apnea_pb_seconds', totalSecs);
      setPersonalBest(totalSecs);
      setShowPbModal(false);
    } catch (err) {
      alert('Gagal menyimpan PB: ' + err.message);
    }
  };

  const loadPresets = async () => {
    setLoading(true);
    try {
      const data = await api.getApneaPresets();
      if (Array.isArray(data)) {
        setPresets(data);
        if (data.length > 0 && !selectedPresetId) {
          selectPreset(data[0]);
        }
      }
    } catch (err) {
      console.error('Gagal memuat preset apnea:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateScheduleFromConfig = (config) => {
    const rounds = Number(config.rounds) || 8;
    const prepSeconds = Number(config.prepSeconds) || 120;
    const baseHold = Number(config.baseHoldSeconds) || 90;
    const holdStep = Number(config.holdStepSeconds) || 0;
    const baseRest = Number(config.baseRestSeconds) || 120;
    const restStep = Number(config.restStepSeconds) || 0;
    const minRest = Number(config.minRestSeconds) || 15;

    const schedule = [];

    // Phase 0: Initial Prep / Breath up
    schedule.push({
      phase: 'PREPARE',
      label: 'Persiapan & Relaksasi Napas',
      duration: prepSeconds,
      round: 0,
    });

    for (let r = 1; r <= rounds; r++) {
      // Hold duration for this round
      const holdDuration = Math.max(10, baseHold + (r - 1) * holdStep);
      schedule.push({
        phase: 'HOLD',
        label: `Putaran ${r}: Tahan Napas`,
        duration: holdDuration,
        round: r,
      });

      // If not the last round, add recovery / rest
      if (r < rounds) {
        const rawRest = baseRest + (r - 1) * restStep;
        const restDuration = Math.max(minRest, rawRest);
        schedule.push({
          phase: 'REST',
          label: `Putaran ${r}: Recovery & Breathe Up`,
          duration: restDuration,
          round: r,
        });
      }
    }

    return schedule;
  };

  const selectPreset = (preset) => {
    setSelectedPresetId(preset.id);
    const schedule = generateScheduleFromConfig(preset.config || {});
    setCurrentSchedule(schedule);
    resetTimer(schedule);
  };

  const resetTimer = (scheduleToUse = currentSchedule) => {
    clearInterval(timerRef.current);
    setIsRunning(false);
    setCurrentPhaseIndex(0);
    if (scheduleToUse && scheduleToUse.length > 0) {
      setTimeLeft(scheduleToUse[0].duration);
    } else {
      setTimeLeft(0);
    }
  };

  // Timer tick effect
  useEffect(() => {
    if (isRunning) {
      requestWakeLock();
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          // Play tick audio & haptic vibration on last 3, 2, 1 seconds
          if (prev <= 4 && prev > 1) {
            sound.countdownTick();
            triggerVibration(70);
          }

          if (prev <= 1) {
            advancePhase();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      releaseWakeLock();
      clearInterval(timerRef.current);
    }
    return () => {
      clearInterval(timerRef.current);
      releaseWakeLock();
    };
  }, [isRunning, currentPhaseIndex, currentSchedule]);

  const advancePhase = () => {
    const nextIdx = currentPhaseIndex + 1;
    if (nextIdx < currentSchedule.length) {
      const nextPhase = currentSchedule[nextIdx];
      setCurrentPhaseIndex(nextIdx);
      setTimeLeft(nextPhase.duration);

      // Trigger audio & haptic cue
      if (nextPhase.phase === 'HOLD') {
        sound.holdStart();
        triggerVibration([250, 100, 250]);
      } else {
        sound.restStart();
        triggerVibration([150, 80, 150]);
      }
    } else {
      // Finished all rounds!
      clearInterval(timerRef.current);
      releaseWakeLock();
      setIsRunning(false);
      sound.sessionComplete();
      triggerVibration([400, 150, 400, 150, 600]);

      // Calculate total hold time
      const totalHoldSecs = currentSchedule
        .filter((s) => s.phase === 'HOLD')
        .reduce((sum, s) => sum + s.duration, 0);

      const activePreset = presets.find((p) => p.id === selectedPresetId);
      setCompletedSessionData({
        presetName: activePreset?.name || 'Custom Apnea',
        type: activePreset?.type || 'custom',
        totalRounds: activePreset?.rounds || 8,
        totalHoldSeconds: totalHoldSecs,
      });
    }
  };

  const handleTogglePlay = () => {
    sound.init(); // Initialize audio context on user interaction
    setIsRunning(!isRunning);
  };

  const handleSkipPhase = () => {
    advancePhase();
  };

  const handleSaveSessionToHistory = async () => {
    if (!completedSessionData || isSavingLog) return;
    setIsSavingLog(true);
    try {
      const todayDate = new Date().toISOString().slice(0, 10);
      await api.logApnea({
        date: todayDate,
        preset_name: completedSessionData.presetName,
        type: completedSessionData.type,
        total_rounds: completedSessionData.totalRounds,
        total_hold_seconds: completedSessionData.totalHoldSeconds,
        details: { scheduleLength: currentSchedule.length },
      });
      alert('Sesi apnea berhasil dicatat ke kalender!');
      setCompletedSessionData(null);
      resetTimer();
      if (onGoToCalendar) onGoToCalendar();
    } catch (err) {
      alert('Gagal mencatat riwayat: ' + err.message);
    } finally {
      setIsSavingLog(false);
    }
  };

  // --- PRESET BUILDER / CUSTOM TABLE ---
  const handleSaveNewPreset = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: builderForm.name.trim() || 'Custom Apnea Table',
        type: builderForm.type,
        rounds: Number(builderForm.rounds) || 8,
        config: {
          rounds: Number(builderForm.rounds) || 8,
          prepSeconds: Number(builderForm.prepSeconds) || 120,
          baseHoldSeconds: Number(builderForm.baseHoldSeconds) || 90,
          holdStepSeconds: Number(builderForm.holdStepSeconds) || 0,
          baseRestSeconds: Number(builderForm.baseRestSeconds) || 120,
          restStepSeconds: Number(builderForm.restStepSeconds) || 0,
          minRestSeconds: Number(builderForm.minRestSeconds) || 15,
        },
      };

      const created = await api.createApneaPreset(payload);
      setShowBuilderModal(false);
      await loadPresets();
      if (created && created.id) {
        selectPreset(created);
      }
    } catch (err) {
      alert('Gagal menyimpan preset baru: ' + (err.message || 'Terjadi kesalahan'));
    }
  };

  const handleDeletePreset = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Hapus preset tabel ini?')) return;
    try {
      await api.deleteApneaPreset(id);
      loadPresets();
    } catch (err) {
      alert('Gagal menghapus preset: ' + err.message);
    }
  };

  const currentPhase = currentSchedule[currentPhaseIndex] || {
    phase: 'PREPARE',
    label: 'Ready',
    duration: 0,
    round: 0,
  };

  const nextPhase = currentSchedule[currentPhaseIndex + 1] || null;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Phase color theme
  const isHold = currentPhase.phase === 'HOLD';
  const isPrep = currentPhase.phase === 'PREPARE';

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto' : ''}`}>
      {/* Top Bar / Presets */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Flame size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Tabel Static Apnea</h2>
              <p className="text-xs text-slate-400">Pilih preset atau buat tabel sendiri sesuai progres napas lo</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Personal Best Badge */}
            <button
              onClick={() => setShowPbModal(true)}
              title="Klik untuk ubah Personal Best"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/25 transition"
            >
              <Trophy size={14} />
              <span>PB: {formatTime(personalBest)}</span>
            </button>

            <button
              onClick={() => setShowBuilderModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20"
            >
              <Plus size={15} />
              <span>+ Buat Tabel Progres</span>
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title="Layar Penuh"
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Preset Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {presets.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => selectPreset(preset)}
                className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">
                      {preset.type?.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400">{preset.rounds} Rounds</span>
                  </div>
                  <strong className="text-xs text-white block">{preset.name}</strong>
                </div>

                {presets.length > 2 && (
                  <button
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    title="Hapus Preset"
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- RUNNER DISPLAY --- */}
      <div
        className={`border rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden transition-all duration-500 shadow-2xl ${
          isHold
            ? 'bg-gradient-to-b from-rose-950/80 via-slate-950 to-slate-950 border-rose-500/50 shadow-rose-900/30'
            : isPrep
            ? 'bg-gradient-to-b from-teal-950/70 via-slate-950 to-slate-950 border-teal-500/40 shadow-teal-900/20'
            : 'bg-gradient-to-b from-cyan-950/70 via-slate-950 to-slate-950 border-cyan-500/40 shadow-cyan-900/20'
        }`}
      >
        {/* Glow backdrop */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20 ${
            isHold ? 'bg-rose-500' : 'bg-cyan-500'
          }`}
        />

        {/* Phase Pill Badge */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span
            className={`px-4 py-1 rounded-full text-xs font-black tracking-widest uppercase border transition-all ${
              isHold
                ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/40 animate-pulse'
                : isPrep
                ? 'bg-teal-500/20 text-teal-300 border-teal-400/40'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
            }`}
          >
            {isHold ? '🫁 TAHAN NAPAS (HOLD)' : isPrep ? '🧘 PERSIAPAN (BREATHE UP)' : '🌿 RECOVERY / REST'}
          </span>
        </div>

        {/* Round Counter */}
        <div className="text-xs font-semibold text-slate-400 mb-2">
          {currentPhase.round > 0 ? (
            <span>
              Putaran Ke: <strong className="text-white text-sm">{currentPhase.round}</strong>
            </span>
          ) : (
            <span>Persiapan Awal Sebelum Putaran 1</span>
          )}
        </div>

        {/* GIANT COUNTDOWN TIMER */}
        <div className="my-6">
          <span
            className={`font-mono text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter drop-shadow-lg ${
              isHold ? 'text-rose-400' : isPrep ? 'text-teal-300' : 'text-cyan-400'
            }`}
          >
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Next Phase Indicator */}
        <div className="text-xs text-slate-400 mb-6 flex items-center justify-center gap-1.5">
          <span>Berikutnya:</span>
          {nextPhase ? (
            <span className="font-semibold text-slate-200">
              {nextPhase.phase === 'HOLD' ? 'Tahan Napas' : 'Recovery'} ({formatTime(nextPhase.duration)})
            </span>
          ) : (
            <span className="text-emerald-400 font-semibold">Selesai Semua Putaran 🎉</span>
          )}
        </div>

        {/* CONTROLS */}
        <div className="flex items-center justify-center gap-4 max-w-sm mx-auto">
          <button
            onClick={() => resetTimer()}
            title="Reset ke Awal"
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RotateCcw size={20} />
          </button>

          <button
            onClick={handleTogglePlay}
            className={`flex-1 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 text-base shadow-xl transition transform active:scale-95 ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 shadow-cyan-500/25'
            }`}
          >
            {isRunning ? <Pause size={22} /> : <Play size={22} />}
            <span>{isRunning ? 'Jeda (Pause)' : 'Mulai (Start)'}</span>
          </button>

          <button
            onClick={handleSkipPhase}
            title="Lewati ke Fase Berikutnya"
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <SkipForward size={20} />
          </button>
        </div>
      </div>

      {/* --- TABLE BREAKDOWN PREVIEW --- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>Susunan Putaran Tabel Ini</span>
          <span className="text-xs font-normal text-slate-400">({currentSchedule.length} Fase)</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {currentSchedule.map((phase, idx) => {
            const isCurrent = currentPhaseIndex === idx;
            return (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border text-center transition ${
                  isCurrent
                    ? 'border-cyan-400 bg-cyan-950 ring-1 ring-cyan-400 text-white'
                    : phase.phase === 'HOLD'
                    ? 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span className="text-[10px] block opacity-75">
                  {phase.phase === 'PREPARE'
                    ? 'Prep'
                    : phase.phase === 'HOLD'
                    ? `Hold R${phase.round}`
                    : `Rest R${phase.round}`}
                </span>
                <strong className="text-xs font-mono">{formatTime(phase.duration)}</strong>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- MODAL: SESSION COMPLETED & SAVE TO HISTORY --- */}
      {completedSessionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
              <Sparkles size={32} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Latihan Selesai! 🎉</h2>
              <p className="text-xs text-slate-300">
                Luar biasa! Lo berhasil menyelesaikan semua putaran apnea tabel ini.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Tabel:</span>
                <strong className="text-white">{completedSessionData.presetName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Putaran:</span>
                <strong className="text-white">{completedSessionData.totalRounds} Putaran</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Akumulasi Waktu Hold:</span>
                <strong className="text-cyan-400 font-mono">
                  {formatTime(completedSessionData.totalHoldSeconds)}
                </strong>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleSaveSessionToHistory}
                disabled={isSavingLog}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Calendar size={15} />
                <span>{isSavingLog ? 'Menyimpan...' : 'Catat ke Kalender History'}</span>
              </button>
              <button
                onClick={() => {
                  setCompletedSessionData(null);
                  resetTimer();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Tutup Saja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: BUILDER / CUSTOM TABLE CONFIGURATOR --- */}
      {showBuilderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveNewPreset}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Buat Tabel Apnea Baru</h3>
                <p className="text-xs text-slate-400">Sesuaikan dengan target progres tahan napas lo</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBuilderModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Nama Tabel</label>
                <input
                  type="text"
                  required
                  value={builderForm.name}
                  onChange={(e) => setBuilderForm({ ...builderForm, name: e.target.value })}
                  placeholder="Contoh: CO2 Table 2:00 Min Hold"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Tipe Tabel</label>
                  <select
                    value={builderForm.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      if (type === 'co2') {
                        setBuilderForm({
                          ...builderForm,
                          type: 'co2',
                          holdStepSeconds: 0,
                          restStepSeconds: -15,
                        });
                      } else if (type === 'o2') {
                        setBuilderForm({
                          ...builderForm,
                          type: 'o2',
                          holdStepSeconds: 15,
                          restStepSeconds: 0,
                        });
                      } else {
                        setBuilderForm({ ...builderForm, type: 'custom' });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="co2">CO2 (Hold Konstan, Rest Berkurang)</option>
                    <option value="o2">O2 (Hold Bertambah, Rest Konstan)</option>
                    <option value="custom">Custom Manual</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Jumlah Putaran (Rounds)</label>
                  <input
                    type="number"
                    min="2"
                    max="15"
                    value={builderForm.rounds}
                    onChange={(e) => setBuilderForm({ ...builderForm, rounds: parseInt(e.target.value) || 2 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">
                  Persiapan Awal (Detik)
                </label>
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={builderForm.prepSeconds}
                  onChange={(e) => setBuilderForm({ ...builderForm, prepSeconds: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Hold Awal (Detik)</label>
                  <input
                    type="number"
                    min="10"
                    max="600"
                    value={builderForm.baseHoldSeconds}
                    onChange={(e) => setBuilderForm({ ...builderForm, baseHoldSeconds: parseInt(e.target.value) || 60 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Perubahan Hold Per Round (Detik)</label>
                  <input
                    type="number"
                    value={builderForm.holdStepSeconds}
                    onChange={(e) => setBuilderForm({ ...builderForm, holdStepSeconds: parseInt(e.target.value) || 0 })}
                    placeholder="0 atau 15"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Rest Awal (Detik)</label>
                  <input
                    type="number"
                    min="15"
                    max="600"
                    value={builderForm.baseRestSeconds}
                    onChange={(e) => setBuilderForm({ ...builderForm, baseRestSeconds: parseInt(e.target.value) || 60 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Perubahan Rest Per Round (Detik)</label>
                  <input
                    type="number"
                    value={builderForm.restStepSeconds}
                    onChange={(e) => setBuilderForm({ ...builderForm, restStepSeconds: parseInt(e.target.value) || 0 })}
                    placeholder="-15 atau 0"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBuilderModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20"
              >
                Simpan Sebagai Preset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- MODAL: EDIT PERSONAL BEST (PB) --- */}
      {showPbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSavePersonalBest}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <Trophy size={18} />
                <h3 className="font-bold text-white text-base">Atur Personal Best (PB)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPbModal(false)}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Catatan rekor tahan napas terlama (static breath-hold) lo saat ini:
            </p>

            <div className="flex items-center justify-center gap-2 my-3">
              <div className="text-center">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={pbInputMinutes}
                  onChange={(e) => setPbInputMinutes(e.target.value)}
                  className="w-16 p-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-center text-xl font-bold font-mono focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-1 uppercase">Menit</span>
              </div>
              <span className="text-2xl font-bold text-slate-500 mb-4">:</span>
              <div className="text-center">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={pbInputSeconds}
                  onChange={(e) => setPbInputSeconds(e.target.value)}
                  className="w-16 p-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-center text-xl font-bold font-mono focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-1 uppercase">Detik</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPbModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
              >
                Simpan PB
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
