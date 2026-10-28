// --- SOUND SYNTHESIZER (WEB AUDIO API) ---
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('apnea_sound') !== 'false';
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  beep(freq = 440, duration = 0.15, type = 'sine', volume = 0.3) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  countdownTick() { this.beep(600, 0.1, 'sine', 0.25); }
  holdStart() {
    this.beep(880, 0.4, 'triangle', 0.4);
    setTimeout(() => this.beep(1100, 0.5, 'sine', 0.45), 150);
  }
  restStart() {
    this.beep(523.25, 0.3, 'sine', 0.3);
    setTimeout(() => this.beep(659.25, 0.4, 'sine', 0.35), 180);
  }
  sessionComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.beep(freq, 0.35, 'sine', 0.35), idx * 160);
    });
  }
}

const sound = new SoundManager();

// --- VIBRATION & WAKE LOCK ---
function triggerVibration(pattern) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch {}
  }
}

let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) {
    console.warn('Wake Lock error:', e);
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
    } catch {}
  }
}

// --- DEFAULT SEED PRESETS ---
const DEFAULT_PRESETS = [
  {
    id: 'co2-classic',
    name: 'CO2 Table (Classic 8-Rounds)',
    type: 'co2',
    rounds: 8,
    config: {
      rounds: 8,
      prepSeconds: 120,
      baseHoldSeconds: 120, // 2:00 hold tetap
      holdStepSeconds: 0,
      baseRestSeconds: 120, // 2:00 rest berkurang 15s
      restStepSeconds: -15,
      minRestSeconds: 15
    }
  },
  {
    id: 'o2-progression',
    name: 'O2 Table (Progression 8-Rounds)',
    type: 'o2',
    rounds: 8,
    config: {
      rounds: 8,
      prepSeconds: 120,
      baseHoldSeconds: 75, // 1:15 bertambah 15s
      holdStepSeconds: 15,
      baseRestSeconds: 120, // 2:00 rest tetap
      restStepSeconds: 0,
      minRestSeconds: 60
    }
  }
];

// --- APP STATE (LOCAL STORAGE BACKED) ---
class ApneaApp {
  constructor() {
    this.presets = [];
    this.selectedPresetId = null;
    this.currentSchedule = [];
    this.currentPhaseIndex = 0;
    this.timeLeft = 0;
    this.isRunning = false;
    this.timerInterval = null;
    this.personalBest = 180;
    this.history = [];
    this.completedData = null;

    this.init();
  }

  init() {
    this.loadLocalStorage();
    this.setupClock();
    this.setupEventListeners();
    this.renderPresets();
    if (this.presets.length > 0) {
      this.selectPreset(this.presets[0].id);
    }
    this.updateSoundIcon();
    this.updatePbDisplay();
  }

  loadLocalStorage() {
    // Load presets
    const savedPresets = localStorage.getItem('apnea_standalone_presets');
    if (savedPresets) {
      try {
        this.presets = JSON.parse(savedPresets);
      } catch {
        this.presets = [...DEFAULT_PRESETS];
      }
    } else {
      this.presets = [...DEFAULT_PRESETS];
      this.savePresets();
    }

    // Load PB
    const savedPb = localStorage.getItem('apnea_standalone_pb');
    if (savedPb) {
      this.personalBest = Number(savedPb) || 180;
    }

    // Load History
    const savedHistory = localStorage.getItem('apnea_standalone_history');
    if (savedHistory) {
      try {
        this.history = JSON.parse(savedHistory);
      } catch {
        this.history = [];
      }
    }
  }

  savePresets() {
    localStorage.setItem('apnea_standalone_presets', JSON.stringify(this.presets));
  }

  savePb() {
    localStorage.setItem('apnea_standalone_pb', String(this.personalBest));
  }

  saveHistory() {
    localStorage.setItem('apnea_standalone_history', JSON.stringify(this.history));
  }

  // --- CLOCK ---
  setupClock() {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const updateClock = () => {
      const now = new Date();
      document.getElementById('headerDay').textContent = dayNames[now.getDay()];
      document.getElementById('headerDate').textContent = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      document.getElementById('headerTime').textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  // --- SCHEDULE GENERATOR ---
  generateSchedule(config) {
    const rounds = Number(config.rounds) || 8;
    const prep = Number(config.prepSeconds) || 120;
    const baseHold = Number(config.baseHoldSeconds) || 90;
    const holdStep = Number(config.holdStepSeconds) || 0;
    const baseRest = Number(config.baseRestSeconds) || 120;
    const restStep = Number(config.restStepSeconds) || 0;
    const minRest = Number(config.minRestSeconds) || 15;

    const schedule = [];
    schedule.push({
      phase: 'PREPARE',
      label: 'Persiapan & Relaksasi Napas',
      duration: prep,
      round: 0
    });

    for (let r = 1; r <= rounds; r++) {
      const hold = Math.max(5, baseHold + (r - 1) * holdStep);
      schedule.push({
        phase: 'HOLD',
        label: `Putaran ${r}: Tahan Napas`,
        duration: hold,
        round: r
      });

      if (r < rounds) {
        const rawRest = baseRest + (r - 1) * restStep;
        const rest = Math.max(minRest, rawRest);
        schedule.push({
          phase: 'REST',
          label: `Putaran ${r}: Recovery & Breathe Up`,
          duration: rest,
          round: r
        });
      }
    }
    return schedule;
  }

  selectPreset(presetId) {
    const p = this.presets.find(x => x.id === presetId);
    if (!p) return;
    this.selectedPresetId = presetId;
    this.currentSchedule = this.generateSchedule(p.config);
    this.resetTimer();
    this.renderPresets();
    this.renderScheduleTimeline();
  }

  // --- TIMER RUNNER ---
  resetTimer() {
    clearInterval(this.timerInterval);
    releaseWakeLock();
    this.isRunning = false;
    this.currentPhaseIndex = 0;
    if (this.currentSchedule.length > 0) {
      this.timeLeft = this.currentSchedule[0].duration;
    } else {
      this.timeLeft = 0;
    }
    this.updateRunnerUI();
  }

  togglePlay() {
    sound.init();
    if (this.isRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    this.isRunning = true;
    requestWakeLock();
    this.updatePlayButton();

    this.timerInterval = setInterval(() => {
      if (this.timeLeft <= 4 && this.timeLeft > 1) {
        sound.countdownTick();
        triggerVibration(70);
      }

      if (this.timeLeft <= 1) {
        this.advancePhase();
        return;
      }
      this.timeLeft--;
      this.updateTimerDisplayOnly();
    }, 1000);
  }

  pauseTimer() {
    clearInterval(this.timerInterval);
    releaseWakeLock();
    this.isRunning = false;
    this.updatePlayButton();
  }

  skipPhase() {
    sound.init();
    this.advancePhase();
  }

  advancePhase() {
    const nextIdx = this.currentPhaseIndex + 1;
    if (nextIdx < this.currentSchedule.length) {
      this.currentPhaseIndex = nextIdx;
      const nextPhase = this.currentSchedule[nextIdx];
      this.timeLeft = nextPhase.duration;

      if (nextPhase.phase === 'HOLD') {
        sound.holdStart();
        triggerVibration([250, 100, 250]);
      } else {
        sound.restStart();
        triggerVibration([150, 80, 150]);
      }
      this.updateRunnerUI();
    } else {
      // Finished all rounds!
      clearInterval(this.timerInterval);
      releaseWakeLock();
      this.isRunning = false;
      sound.sessionComplete();
      triggerVibration([400, 150, 400, 150, 600]);

      const activePreset = this.presets.find(p => p.id === this.selectedPresetId);
      const totalHold = this.currentSchedule
        .filter(s => s.phase === 'HOLD')
        .reduce((sum, s) => sum + s.duration, 0);

      this.completedData = {
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        presetName: activePreset?.name || 'Custom Apnea',
        type: activePreset?.type || 'custom',
        totalRounds: activePreset?.rounds || 8,
        totalHoldSeconds: totalHold
      };

      this.showFinishModal();
      this.resetTimer();
    }
  }

  // --- UI UPDATES ---
  formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  updateTimerDisplayOnly() {
    document.getElementById('timerDisplay').textContent = this.formatTime(this.timeLeft);
  }

  updatePlayButton() {
    const icon = document.getElementById('playIcon');
    const label = document.getElementById('playLabel');
    const btn = document.getElementById('btnPlayPause');
    if (this.isRunning) {
      icon.textContent = '⏸';
      label.textContent = 'Jeda (Pause)';
      btn.className = btn.className.replace(/from-cyan-500 to-emerald-400/, 'from-amber-500 to-amber-400 text-slate-950');
    } else {
      icon.textContent = '▶';
      label.textContent = 'Mulai (Start)';
      btn.className = btn.className.replace(/from-amber-500 to-amber-400 text-slate-950/, 'from-cyan-500 to-emerald-400 text-slate-950');
    }
  }

  updateRunnerUI() {
    this.updatePlayButton();
    this.updateTimerDisplayOnly();

    const current = this.currentSchedule[this.currentPhaseIndex] || { phase: 'PREPARE', round: 0 };
    const next = this.currentSchedule[this.currentPhaseIndex + 1];

    const container = document.getElementById('runnerContainer');
    const badge = document.getElementById('phaseBadge');
    const timerText = document.getElementById('timerDisplay');
    const roundText = document.getElementById('roundCounter');
    const nextText = document.getElementById('nextPhaseDisplay');
    const glow = document.getElementById('backdropGlow');

    if (current.phase === 'HOLD') {
      container.className = "border rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden transition-all duration-500 shadow-2xl bg-gradient-to-b from-rose-950/80 via-slate-950 to-slate-950 border-rose-500/50 shadow-rose-900/30";
      badge.className = "px-5 py-1.5 rounded-full text-xs font-black tracking-widest uppercase border transition-all bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/40 animate-pulse";
      badge.textContent = "🫁 TAHAN NAPAS (HOLD)";
      timerText.className = "font-mono text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter drop-shadow-2xl text-rose-400 transition-colors";
      glow.className = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-25 bg-rose-500 animate-pulse-slow";
    } else if (current.phase === 'PREPARE') {
      container.className = "border rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden transition-all duration-500 shadow-2xl bg-gradient-to-b from-teal-950/70 via-slate-950 to-slate-950 border-teal-500/40 shadow-teal-900/20";
      badge.className = "px-5 py-1.5 rounded-full text-xs font-black tracking-widest uppercase border transition-all bg-teal-500/20 text-teal-300 border-teal-400/40";
      badge.textContent = "🧘 PERSIAPAN (BREATHE UP)";
      timerText.className = "font-mono text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter drop-shadow-2xl text-teal-300 transition-colors";
      glow.className = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-25 bg-teal-500 animate-pulse-slow";
    } else {
      container.className = "border rounded-3xl p-6 sm:p-10 text-center relative overflow-hidden transition-all duration-500 shadow-2xl bg-gradient-to-b from-cyan-950/70 via-slate-950 to-slate-950 border-cyan-500/40 shadow-cyan-900/20";
      badge.className = "px-5 py-1.5 rounded-full text-xs font-black tracking-widest uppercase border transition-all bg-cyan-500/20 text-cyan-300 border-cyan-400/40";
      badge.textContent = "🌿 RECOVERY / REST";
      timerText.className = "font-mono text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter drop-shadow-2xl text-cyan-400 transition-colors";
      glow.className = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-25 bg-cyan-500 animate-pulse-slow";
    }

    roundText.innerHTML = current.round > 0 
      ? `Putaran Ke: <strong class="text-white text-sm">${current.round}</strong>` 
      : 'Persiapan Awal Sebelum Putaran 1';

    if (next) {
      const nextLabel = next.phase === 'HOLD' ? 'Tahan Napas' : 'Recovery';
      nextText.textContent = `${nextLabel} (${this.formatTime(next.duration)})`;
    } else {
      nextText.textContent = 'Selesai Semua Putaran 🎉';
    }

    this.renderScheduleTimeline();
  }

  renderPresets() {
    const list = document.getElementById('presetsList');
    list.innerHTML = '';
    this.presets.forEach(p => {
      const isSelected = p.id === this.selectedPresetId;
      const card = document.createElement('div');
      card.className = `p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
        isSelected
          ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md shadow-cyan-500/20'
          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
      }`;

      const isCustom = !p.id.startsWith('co2-classic') && !p.id.startsWith('o2-progression');

      card.innerHTML = `
        <div>
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400">
              ${(p.type || 'custom').toUpperCase()}
            </span>
            <span class="text-[10px] text-slate-400">${p.rounds} Rounds</span>
          </div>
          <strong class="text-xs text-white block">${p.name}</strong>
        </div>
        ${isCustom ? `<button data-del="${p.id}" class="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 text-xs" title="Hapus Preset">🗑</button>` : ''}
      `;

      card.onclick = (e) => {
        if (e.target.dataset.del) {
          e.stopPropagation();
          this.deleteCustomPreset(e.target.dataset.del);
          return;
        }
        this.selectPreset(p.id);
      };
      list.appendChild(card);
    });
  }

  renderScheduleTimeline() {
    const container = document.getElementById('scheduleTimeline');
    container.innerHTML = '';
    document.getElementById('scheduleTotalPhases').textContent = `(${this.currentSchedule.length} Fase)`;

    const totalHold = this.currentSchedule
      .filter(s => s.phase === 'HOLD')
      .reduce((sum, s) => sum + s.duration, 0);
    document.getElementById('totalHoldAccumulated').textContent = `Total Hold: ${this.formatTime(totalHold)}`;

    this.currentSchedule.forEach((phase, idx) => {
      const isCurrent = this.currentPhaseIndex === idx;
      const el = document.createElement('div');
      el.className = `p-2 rounded-xl border text-center transition ${
        isCurrent
          ? 'border-cyan-400 bg-cyan-950 ring-1 ring-cyan-400 text-white'
          : phase.phase === 'HOLD'
          ? 'bg-rose-950/20 border-rose-900/40 text-rose-300'
          : 'bg-slate-950 border-slate-800 text-slate-400'
      }`;

      const label = phase.phase === 'PREPARE' ? 'Prep' : phase.phase === 'HOLD' ? `Hold R${phase.round}` : `Rest R${phase.round}`;
      el.innerHTML = `
        <span class="text-[10px] block opacity-75">${label}</span>
        <strong class="text-xs font-mono">${this.formatTime(phase.duration)}</strong>
      `;
      container.appendChild(el);
    });
  }

  deleteCustomPreset(id) {
    if (!confirm('Hapus preset tabel ini dari LocalStorage?')) return;
    this.presets = this.presets.filter(p => p.id !== id);
    this.savePresets();
    if (this.selectedPresetId === id) {
      this.selectPreset(this.presets[0]?.id || 'co2-classic');
    } else {
      this.renderPresets();
    }
  }

  // --- PB DIALOG ---
  updatePbDisplay() {
    document.getElementById('displayPb').textContent = `PB: ${this.formatTime(this.personalBest)}`;
  }

  // --- FINISH MODAL & HISTORY ---
  showFinishModal() {
    if (!this.completedData) return;
    document.getElementById('finishPresetName').textContent = this.completedData.presetName;
    document.getElementById('finishTotalRounds').textContent = `${this.completedData.totalRounds} Putaran`;
    document.getElementById('finishTotalHold').textContent = this.formatTime(this.completedData.totalHoldSeconds);
    document.getElementById('modalFinish').classList.remove('hidden');
  }

  saveCompletedSession() {
    if (!this.completedData) return;
    this.history.unshift({
      id: Date.now(),
      ...this.completedData
    });
    this.saveHistory();
    alert('Sesi berhasil dicatat ke LocalStorage!');
    document.getElementById('modalFinish').classList.add('hidden');
    this.completedData = null;
  }

  renderHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    document.getElementById('historyCount').textContent = `${this.history.length} Sesi Tersimpan`;

    if (this.history.length === 0) {
      list.innerHTML = `<div class="text-center py-8 text-xs text-slate-500">Belum ada riwayat sesi tersimpan di LocalStorage.</div>`;
      return;
    }

    this.history.forEach((h, idx) => {
      const card = document.createElement('div');
      card.className = "bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs";
      card.innerHTML = `
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 font-mono">${(h.type || 'apnea').toUpperCase()}</span>
            <span class="text-slate-400">${h.date} • ${h.time}</span>
          </div>
          <strong class="text-white text-sm">${h.presetName}</strong>
          <div class="text-slate-400 text-[11px] mt-0.5">
            ${h.totalRounds} Rounds • Total Hold: <strong class="text-cyan-400">${this.formatTime(h.totalHoldSeconds)}</strong>
          </div>
        </div>
        <button data-delhist="${h.id}" class="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-lg" title="Hapus">✕</button>
      `;
      card.querySelector('button').onclick = () => {
        this.history = this.history.filter(item => item.id !== h.id);
        this.saveHistory();
        this.renderHistory();
      };
      list.appendChild(card);
    });
  }

  updateSoundIcon() {
    document.getElementById('soundIcon').textContent = sound.enabled ? '🔊' : '🔇';
  }

  // --- EVENT LISTENERS ---
  setupEventListeners() {
    // Play/Pause
    document.getElementById('btnPlayPause').onclick = () => this.togglePlay();
    document.getElementById('btnResetTimer').onclick = () => this.resetTimer();
    document.getElementById('btnSkipPhase').onclick = () => this.skipPhase();

    // Sound Toggle
    document.getElementById('btnToggleSound').onclick = () => {
      sound.enabled = !sound.enabled;
      localStorage.setItem('apnea_sound', String(sound.enabled));
      this.updateSoundIcon();
      if (sound.enabled) sound.countdownTick();
    };

    // Fullscreen
    document.getElementById('btnFullscreen').onclick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    // PB Modal
    const modalPb = document.getElementById('modalPb');
    document.getElementById('btnOpenPb').onclick = () => {
      document.getElementById('pbMinutes').value = Math.floor(this.personalBest / 60);
      document.getElementById('pbSeconds').value = this.personalBest % 60;
      modalPb.classList.remove('hidden');
    };
    document.getElementById('btnClosePb').onclick = () => modalPb.classList.add('hidden');
    document.getElementById('btnCancelPb').onclick = () => modalPb.classList.add('hidden');
    document.getElementById('btnSavePb').onclick = () => {
      const m = parseInt(document.getElementById('pbMinutes').value) || 0;
      const s = parseInt(document.getElementById('pbSeconds').value) || 0;
      this.personalBest = Math.max(1, m * 60 + s);
      this.savePb();
      this.updatePbDisplay();
      modalPb.classList.add('hidden');
    };

    // Builder Modal
    const modalBuilder = document.getElementById('modalBuilder');
    document.getElementById('btnOpenBuilder').onclick = () => modalBuilder.classList.remove('hidden');
    document.getElementById('btnCloseBuilder').onclick = () => modalBuilder.classList.add('hidden');
    document.getElementById('btnCancelBuilder').onclick = () => modalBuilder.classList.add('hidden');

    document.getElementById('bldType').onchange = (e) => {
      const type = e.target.value;
      if (type === 'co2') {
        document.getElementById('bldHoldStep').value = 0;
        document.getElementById('bldRestStep').value = -15;
      } else if (type === 'o2') {
        document.getElementById('bldHoldStep').value = 15;
        document.getElementById('bldRestStep').value = 0;
      }
    };

    document.getElementById('formBuilder').onsubmit = (e) => {
      e.preventDefault();
      const newPreset = {
        id: 'custom-' + Date.now(),
        name: document.getElementById('bldName').value.trim() || 'Custom Table',
        type: document.getElementById('bldType').value,
        rounds: Number(document.getElementById('bldRounds').value) || 8,
        config: {
          rounds: Number(document.getElementById('bldRounds').value) || 8,
          prepSeconds: Number(document.getElementById('bldPrep').value) || 120,
          baseHoldSeconds: Number(document.getElementById('bldBaseHold').value) || 90,
          holdStepSeconds: Number(document.getElementById('bldHoldStep').value) || 0,
          baseRestSeconds: Number(document.getElementById('bldBaseRest').value) || 120,
          restStepSeconds: Number(document.getElementById('bldRestStep').value) || 0,
          minRestSeconds: 15
        }
      };
      this.presets.push(newPreset);
      this.savePresets();
      this.selectPreset(newPreset.id);
      modalBuilder.classList.add('hidden');
      e.target.reset();
    };

    // Finish Modal
    document.getElementById('btnCloseFinish').onclick = () => {
      document.getElementById('modalFinish').classList.add('hidden');
    };
    document.getElementById('btnSaveToHistory').onclick = () => this.saveCompletedSession();

    // History Modal
    const modalHistory = document.getElementById('modalHistory');
    document.getElementById('btnOpenHistory').onclick = () => {
      this.renderHistory();
      modalHistory.classList.remove('hidden');
    };
    document.getElementById('btnCloseHistory').onclick = () => modalHistory.classList.add('hidden');
    document.getElementById('btnClearHistory').onclick = () => {
      if (confirm('Kosongkan seluruh riwayat di LocalStorage?')) {
        this.history = [];
        this.saveHistory();
        this.renderHistory();
      }
    };
    document.getElementById('btnExportHistory').onclick = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.history, null, 2));
      const dl = document.createElement('a');
      dl.setAttribute("href", dataStr);
      dl.setAttribute("download", `ApneaTimer-history-${new Date().toISOString().slice(0, 10)}.json`);
      dl.click();
    };
  }
}

// Start App on page load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new ApneaApp();
});
