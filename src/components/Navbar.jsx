import React, { useState, useEffect } from 'react';
import { Dumbbell, Calendar, Flame, Timer, Volume2, VolumeX, Moon, Sun, ListCheck } from 'lucide-react';
import { sound } from '../utils/audio';

export default function Navbar({ activeTab, setActiveTab, darkMode, setDarkMode }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);

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

          {/* Quick Controls: Audio & Theme */}
          <div className="flex items-center gap-2">
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
    </header>
  );
}
