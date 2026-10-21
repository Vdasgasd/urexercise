import React, { useState, useEffect, useRef } from 'react';
import { Dumbbell, Calendar, Flame, Timer, Volume2, VolumeX, Moon, Sun, ListCheck, Database, Download, Upload, X, CheckCircle2 } from 'lucide-react';
import { sound } from '../utils/audio';
import { api } from '../utils/api';

export default function Navbar({ activeTab, setActiveTab, darkMode, setDarkMode }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    sound.enabled = next;
    setSoundEnabled(next);
    if (next) sound.countdownTick();
  };

  const dayNamesIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNamesIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const formattedDay = dayNamesIndo[currentTime.getDay()];
  const formattedDate = `${currentTime.getDate()} ${monthNamesIndo[currentTime.getMonth()]} ${currentTime.getFullYear()}`;
  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const navItems = [
    { id: 'today', label: 'Hari Ini', icon: ListCheck },
    { id: 'routine', label: 'Rencana & Bank Latihan', icon: Dumbbell },
    { id: 'calendar', label: 'Kalender & History', icon: Calendar },
    { id: 'apnea', label: 'Static Apnea', icon: Flame },
    { id: 'stopwatch', label: 'Stopwatch', icon: Timer },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-800 transition-colors">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Realtime Clock */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 shadow-md shadow-cyan-500/20 text-white font-black text-xl">
              U
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">UrExercise</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-medium">
                  v1.0
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <span className="text-cyan-400 font-semibold">{formattedDay}</span>
                <span>•</span>
                <span>{formattedDate}</span>
                <span>•</span>
                <span className="font-mono text-emerald-400 tracking-wider font-semibold">{formattedTime}</span>
              </div>
            </div>
          </div>

          {/* Quick Controls: Audio, Theme & Backup */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBackupModal(true)}
              title="Backup & Restore SQLite Database"
              className="p-2 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700 hover:bg-slate-700 transition"
            >
              <Database size={18} />
            </button>

            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Mute Suara Bip' : 'Nyalakan Suara Bip'}
              className={`p-2 rounded-lg border transition ${
                soundEnabled
                  ? 'bg-slate-800 text-cyan-400 border-cyan-800/60 hover:bg-slate-700'
                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
              className="p-2 rounded-lg bg-slate-800 text-amber-400 border border-slate-700 hover:bg-slate-700 transition"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Mobile-responsive scrollable horizontal bar) */}
        <nav className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar pb-1 text-sm font-medium">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                }`}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Backup & Restore Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400">
                <Database size={20} />
                <h3 className="font-bold text-white text-base">Backup & Restore SQLite</h3>
              </div>
              <button
                onClick={() => {
                  setShowBackupModal(false);
                  setRestoreMessage('');
                }}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Seluruh jadwal latihan, bank latihan, dan riwayat static apnea lo tersimpan di database lokal SQLite.
            </p>

            <div className="space-y-3 pt-2">
              {/* Download Backup */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white block">1. Ekspor & Unduh Backup</span>
                <p className="text-[11px] text-slate-400">
                  Unduh salinan file <code className="text-cyan-400">exercise.sqlite</code> ke komputer/HP lo.
                </p>
                <a
                  href={api.getBackupDownloadUrl()}
                  download
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20"
                >
                  <Download size={14} />
                  <span>Download Backup Database</span>
                </a>
              </div>

              {/* Restore Backup */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white block">2. Pulihkan / Restore Database</span>
                <p className="text-[11px] text-slate-400">
                  Pilih file backup <code className="text-amber-400">.sqlite</code> untuk memulihkan seluruh data.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".sqlite,.db"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!confirm(`Yakin ingin memulihkan database dari "${file.name}"? Data saat ini akan ditimpa.`)) {
                      e.target.value = '';
                      return;
                    }
                    setIsRestoring(true);
                    setRestoreMessage('');
                    try {
                      await api.restoreDatabase(file);
                      setRestoreMessage('Database berhasil dipulihkan! Halaman akan dimuat ulang...');
                      setTimeout(() => {
                        window.location.reload();
                      }, 1200);
                    } catch (err) {
                      alert('Gagal restore: ' + err.message);
                    } finally {
                      setIsRestoring(false);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
                >
                  <Upload size={14} />
                  <span>{isRestoring ? 'Memulihkan Data...' : 'Pilih File .sqlite untuk Restore'}</span>
                </button>
                {restoreMessage && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 pt-1 font-semibold">
                    <CheckCircle2 size={14} />
                    <span>{restoreMessage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
