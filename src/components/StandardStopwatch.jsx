import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Flag, Timer, Copy, Check, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react';


export default function StandardStopwatch() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // Total cumulative time in ms (Split)
  const [currentLapTime, setCurrentLapTime] = useState(0); // Current lap interval in ms
  const [records, setRecords] = useState([]); // List of recorded { index, lapMs, splitMs }
  const [copied, setCopied] = useState(false);

  const startTimeRef = useRef(0);
  const lastLapMarkRef = useRef(0);
  const requestRef = useRef(null);

  const updateTimer = () => {
    const now = Date.now();
    const total = now - startTimeRef.current;
    const lap = total - lastLapMarkRef.current;
    setElapsedTime(total);
    setCurrentLapTime(lap);
    requestRef.current = requestAnimationFrame(updateTimer);
  };

  const handleStart = () => {
    const now = Date.now();
    startTimeRef.current = now - elapsedTime;
    setIsRunning(true);
    requestRef.current = requestAnimationFrame(updateTimer);
  };

  const handlePause = () => {
    cancelAnimationFrame(requestRef.current);
    setIsRunning(false);
  };

  const handleReset = () => {
    cancelAnimationFrame(requestRef.current);
    setIsRunning(false);
    setElapsedTime(0);
    setCurrentLapTime(0);
    lastLapMarkRef.current = 0;
    setRecords([]);
  };

  const handleSplitLap = () => {
    if (!isRunning) return;
    const lapDuration = elapsedTime - lastLapMarkRef.current;
    lastLapMarkRef.current = elapsedTime;

    const newRecord = {
      index: records.length + 1,
      lapMs: lapDuration,
      splitMs: elapsedTime,
      formattedLap: formatTime(lapDuration),
      formattedSplit: formatTime(elapsedTime),
    };

    setRecords([newRecord, ...records]);
    setCurrentLapTime(0);
  };

  const handleClearTable = () => {
    if (confirm('Hapus seluruh riwayat split/lap di tabel?')) {
      setRecords([]);
      lastLapMarkRef.current = elapsedTime;
    }
  };

  const handleCopyTable = () => {
    if (records.length === 0) return;
    const header = "No\tLap Time\tSplit Time\n";
    const rows = [...records]
      .reverse()
      .map((r) => `#${r.index}\t${r.formattedLap.full}\t${r.formattedSplit.full}`)
      .join('\n');
    navigator.clipboard.writeText(header + rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is inside an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;

      const key = e.key ? e.key.toLowerCase() : '';

      // Spacebar: Start / Pause
      if (e.code === 'Space' || key === ' ') {
        e.preventDefault();
        if (isRunning) {
          handlePause();
        } else {
          handleStart();
        }
      }

      // 's': Split / Lap
      if (key === 's') {
        if (isRunning) {
          e.preventDefault();
          handleSplitLap();
        }
      }

      // 'r': Reset
      if (key === 'r') {
        if (elapsedTime > 0) {
          e.preventDefault();
          handleReset();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);

  }, [isRunning, elapsedTime, records]);

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);

    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');
    const msStr = String(hundredths).padStart(2, '0');

    return { mStr, sStr, msStr, full: `${mStr}:${sStr}.${msStr}` };
  };

  const mainTime = formatTime(elapsedTime);
  const lapTimeDisplay = formatTime(currentLapTime);

  // Identify Fastest and Slowest Lap if at least 2 records exist
  let minLapMs = Infinity;
  let maxLapMs = -Infinity;
  if (records.length >= 2) {
    records.forEach((r) => {
      if (r.lapMs < minLapMs) minLapMs = r.lapMs;
      if (r.lapMs > maxLapMs) maxLapMs = r.lapMs;
    });
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Stopwatch Display Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 text-center shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-center gap-2 mb-2 text-cyan-400">
          <Timer size={20} />
          <span className="text-xs font-bold uppercase tracking-wider">Stopwatch & Split Timer</span>
        </div>

        {/* Current Lap Sub-Display */}
        <div className="text-xs font-mono text-slate-400 mb-1">
          <span>Putaran Berjalan (Current Lap): </span>
          <strong className="text-slate-200">
            {lapTimeDisplay.mStr}:{lapTimeDisplay.sStr}.{lapTimeDisplay.msStr}
          </strong>
        </div>

        {/* BIG DIGITAL SPLIT DISPLAY */}
        <div className="my-5">
          <div className="font-mono text-6xl sm:text-7xl md:text-8xl font-black text-white tracking-tight flex items-baseline justify-center">
            <span>{mainTime.mStr}</span>
            <span className="text-cyan-500 animate-pulse">:</span>
            <span>{mainTime.sStr}</span>
            <span className="text-cyan-400 text-3xl sm:text-4xl md:text-5xl ml-1 font-semibold">
              .{mainTime.msStr}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold block mt-1">
            Total Waktu Kumulatif (Split Time)
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 pt-3 max-w-md mx-auto">
          {/* Reset button */}
          <button
            onClick={handleReset}
            disabled={elapsedTime === 0}
            className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700 transition relative flex items-center justify-center gap-1"
            title="Reset Stopwatch (Shortcut: R)"
          >
            <RotateCcw size={18} />
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-slate-900 border border-slate-700 rounded text-slate-400 font-mono">
              R
            </kbd>
          </button>

          {/* Start / Pause button */}
          <button
            onClick={isRunning ? handlePause : handleStart}
            className={`flex-1 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 text-base shadow-xl transition transform active:scale-95 ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/25'
            }`}
            title="Start / Pause (Shortcut: Spasi)"
          >
            {isRunning ? <Pause size={22} /> : <Play size={22} />}
            <span>{isRunning ? 'Pause' : 'Start'}</span>
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-black/25 rounded text-slate-900 font-mono font-bold">
              Space
            </kbd>
          </button>

          {/* Split / Lap button */}
          <button
            onClick={handleSplitLap}
            disabled={!isRunning}
            className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-sm border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-md"
            title="Catat Split / Lap (Shortcut: S)"
          >
            <Flag size={18} />
            <span className="hidden sm:inline">Split / Lap</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-slate-900 border border-slate-700 rounded text-cyan-300 font-mono">
              S
            </kbd>
          </button>
        </div>
      </div>

      {/* --- TABLE OF SPLITS & LAPS --- */}
      {records.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          {/* Table Header Controls */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Tabel Split & Lap Timing</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 font-mono">
                  {records.length} Baris
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Waktu Lap mengukur interval tiap putaran, Split mengukur waktu akumulasi.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyTable}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                title="Salin Data Tabel ke Clipboard"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'Tersalin!' : 'Salin Data'}</span>
              </button>
              <button
                onClick={handleClearTable}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-slate-700 transition"
                title="Kosongkan Tabel"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Structured Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3.5 text-center w-14">#</th>
                  <th className="py-3 px-4">Waktu Lap (Interval)</th>
                  <th className="py-3 px-4">Waktu Split (Kumulatif)</th>
                  <th className="py-3 px-4 text-center">Analisis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {records.map((r) => {
                  const isFastest = records.length >= 2 && r.lapMs === minLapMs;
                  const isSlowest = records.length >= 2 && r.lapMs === maxLapMs;

                  return (
                    <tr
                      key={r.index}
                      className={`transition ${
                        isFastest
                          ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                          : isSlowest
                          ? 'bg-rose-950/20 hover:bg-rose-950/30'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3 px-3.5 text-center font-bold text-slate-500">
                        #{r.index}
                      </td>

                      {/* Lap Time */}
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold text-sm ${
                            isFastest
                              ? 'text-emerald-400'
                              : isSlowest
                              ? 'text-rose-400'
                              : 'text-white'
                          }`}
                        >
                          {r.formattedLap.full}
                        </span>
                      </td>

                      {/* Split Time */}
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {r.formattedSplit.full}
                      </td>

                      {/* Analysis Badge */}
                      <td className="py-3 px-4 text-center">
                        {isFastest ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-sans">
                            <ArrowDownRight size={11} /> Tercepat
                          </span>
                        ) : isSlowest ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 font-sans">
                            <ArrowUpRight size={11} /> Terlambat
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-sans">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend / Table Summary */}
          {records.length >= 2 && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Lap Tercepat
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Lap Terlambat
                </span>
              </div>
              <span>Total Split: {records[0]?.formattedSplit.full}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
