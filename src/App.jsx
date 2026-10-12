import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import TodayWorkout from './components/TodayWorkout';
import RoutineBuilder from './components/RoutineBuilder';
import CalendarHistory from './components/CalendarHistory';
import ApneaTimer from './components/ApneaTimer';
import StandardStopwatch from './components/StandardStopwatch';

export default function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('urexercise_theme');
    return saved !== null ? saved === 'dark' : true; // Default dark mode!
  });

  useEffect(() => {
    localStorage.setItem('urexercise_theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'today' && (
          <TodayWorkout
            onGoToRoutine={() => setActiveTab('routine')}
            onGoToCalendar={() => setActiveTab('calendar')}
          />
        )}

        {activeTab === 'routine' && <RoutineBuilder />}

        {activeTab === 'calendar' && <CalendarHistory />}

        {activeTab === 'apnea' && (
          <ApneaTimer onGoToCalendar={() => setActiveTab('calendar')} />
        )}

        {activeTab === 'stopwatch' && <StandardStopwatch />}
      </main>

      <footer className="py-4 border-t border-slate-800/80 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>UrExercise • Workout Routine & Static Apnea Tracker</span>
          <span className="font-mono text-cyan-500/80">SQLite Powered • Offline Ready</span>
        </div>
      </footer>
    </div>
  );
}
