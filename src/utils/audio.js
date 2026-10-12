// Audio feedback using native Web Audio API
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
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

  // 3-2-1 Countdown ticks
  countdownTick() {
    this.beep(600, 0.1, 'sine', 0.25);
  }

  // Transition to HOLD (strong high beep)
  holdStart() {
    this.beep(880, 0.4, 'triangle', 0.4);
    setTimeout(() => {
      this.beep(1100, 0.5, 'sine', 0.45);
    }, 150);
  }

  // Transition to REST / BREATHE-UP (soothing tone)
  restStart() {
    this.beep(523.25, 0.3, 'sine', 0.3); // C5
    setTimeout(() => {
      this.beep(659.25, 0.4, 'sine', 0.35); // E5
    }, 180);
  }

  // Session Completed chime
  sessionComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.beep(freq, 0.35, 'sine', 0.35);
      }, idx * 160);
    });
  }
}

export const sound = new SoundManager();
