// Global timer module — singleton state accessible from any page
import {
  formatTime, playBeep, playDoubleBeep, playTripleBeep,
  requestWakeLock, releaseWakeLock, showToast
} from './utils.js';

// ===== STATE =====
let timerInterval = null;
let timeLeft = 0;
let totalTime = 0;
let isRunning = false;
let isPaused = false;
let timerMode = 'countdown'; // countdown | rest | interval
let timerLabel = '';

// Interval-specific state
let intervalConfig = { workTime: 30, restTime: 15, rounds: 8, prepareTime: 5 };
let intervalState = { round: 0, phase: 'prepare', totalRounds: 8 };

// Listeners: any part of the app can subscribe to timer ticks
const listeners = new Set();

const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 115;

// ===== SOUND HELPERS =====
function playCountdownTick() {
  try {
    const raw = localStorage.getItem('fitcoach_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.soundEnabled === false) return;
    }
  } catch { /* ignore */ }

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    osc.type = 'sine';
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* Audio not available */ }
}

function playWarningBeep() {
  try {
    const raw = localStorage.getItem('fitcoach_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.soundEnabled === false) return;
    }
  } catch { /* ignore */ }

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    osc.type = 'triangle';
    gain.gain.value = 0.25;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* Audio not available */ }
}

function playStartSound() {
  try {
    const raw = localStorage.getItem('fitcoach_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.soundEnabled === false) return;
    }
  } catch { /* ignore */ }

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Rising two-tone "go" sound
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 600;
    osc1.type = 'sine';
    gain1.gain.value = 0.25;
    osc1.start();
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc1.stop(ctx.currentTime + 0.15);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 900;
    osc2.type = 'sine';
    gain2.gain.value = 0.25;
    osc2.start(ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
  } catch { /* Audio not available */ }
}

function playFinishSound() {
  try {
    const raw = localStorage.getItem('fitcoach_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.soundEnabled === false) return;
    }
  } catch { /* ignore */ }

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Triumphant ascending three-tone
    [0, 0.2, 0.4].forEach((delay, i) => {
      const freq = [700, 880, 1100][i];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.4);
    });
  } catch { /* Audio not available */ }
}

// ===== PUBLIC API =====
export const globalTimer = {
  // Getters
  get timeLeft() { return timeLeft; },
  get totalTime() { return totalTime; },
  get isRunning() { return isRunning; },
  get isPaused() { return isPaused; },
  get isActive() { return isRunning || isPaused; },
  get mode() { return timerMode; },
  get label() { return timerLabel; },
  get intervalConfig() { return { ...intervalConfig }; },
  get intervalState() { return { ...intervalState }; },
  get progress() { return totalTime > 0 ? timeLeft / totalTime : 1; },
  get circumference() { return CIRCLE_CIRCUMFERENCE; },

  // Subscribe/unsubscribe to tick updates
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // Start a countdown timer
  startCountdown(seconds, label = '') {
    this.stop();
    timerMode = 'countdown';
    timerLabel = label;
    timeLeft = seconds;
    totalTime = seconds;
    isRunning = true;
    isPaused = false;
    requestWakeLock();
    playStartSound();
    this._notify();
    this._startInterval();
  },

  // Start a rest timer
  startRest(seconds) {
    this.stop();
    timerMode = 'rest';
    timerLabel = 'REST';
    timeLeft = seconds;
    totalTime = seconds;
    isRunning = true;
    isPaused = false;
    requestWakeLock();
    playStartSound();
    this._notify();
    this._startInterval();
  },

  // Start interval timer
  startInterval(config) {
    this.stop();
    timerMode = 'interval';
    timerLabel = 'INTERVAL';
    intervalConfig = { ...intervalConfig, ...config };
    intervalState = { round: 0, phase: 'prepare', totalRounds: intervalConfig.rounds };
    timeLeft = intervalConfig.prepareTime;
    totalTime = intervalConfig.prepareTime;
    isRunning = true;
    isPaused = false;
    requestWakeLock();
    playStartSound();
    this._notify();
    this._startInterval();
  },

  pause() {
    if (!isRunning) return;
    isRunning = false;
    isPaused = true;
    clearInterval(timerInterval);
    timerInterval = null;
    releaseWakeLock();
    this._notify();
  },

  resume() {
    if (!isPaused || timeLeft <= 0) return;
    isRunning = true;
    isPaused = false;
    requestWakeLock();
    this._notify();
    this._startInterval();
  },

  stop() {
    isRunning = false;
    isPaused = false;
    clearInterval(timerInterval);
    timerInterval = null;
    timeLeft = 0;
    totalTime = 0;
    timerLabel = '';
    releaseWakeLock();
    this._notify();
  },

  addTime(seconds) {
    if (!this.isActive) return;
    timeLeft = Math.max(0, timeLeft + seconds);
    totalTime = Math.max(totalTime, timeLeft);
    this._notify();
  },

  // Internal: notify all listeners
  _notify() {
    const state = {
      timeLeft,
      totalTime,
      isRunning,
      isPaused,
      isActive: isRunning || isPaused,
      mode: timerMode,
      label: timerLabel,
      progress: totalTime > 0 ? timeLeft / totalTime : 1,
      intervalState: { ...intervalState },
      intervalConfig: { ...intervalConfig }
    };
    listeners.forEach(fn => {
      try { fn(state); } catch { /* ignore */ }
    });
  },

  // Internal: start setInterval tick
  _startInterval() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!isRunning) return;
      timeLeft--;

      // Sound cues
      if (timeLeft === 5) {
        // 5-second warning
        playWarningBeep();
      } else if (timeLeft <= 3 && timeLeft > 0) {
        // Last 3 seconds countdown beep
        playBeep();
      } else if (timeLeft === 10) {
        // Subtle tick at 10s
        playCountdownTick();
      }

      if (timeLeft <= 0) {
        if (timerMode === 'interval') {
          this._handleIntervalPhaseEnd();
        } else {
          this._complete();
        }
      }

      this._notify();
    }, 1000);
  },

  _complete() {
    isRunning = false;
    isPaused = false;
    clearInterval(timerInterval);
    timerInterval = null;
    timeLeft = 0;
    releaseWakeLock();
    playFinishSound();
    showToast('Timer complete!');
    this._notify();
  },

  _handleIntervalPhaseEnd() {
    const { phase, round, totalRounds } = intervalState;

    if (phase === 'prepare') {
      intervalState.phase = 'work';
      intervalState.round = 1;
      timeLeft = intervalConfig.workTime;
      totalTime = intervalConfig.workTime;
      timerLabel = 'WORK';
      playDoubleBeep();
    } else if (phase === 'work') {
      if (round >= totalRounds) {
        // All rounds complete
        isRunning = false;
        isPaused = false;
        clearInterval(timerInterval);
        timerInterval = null;
        timeLeft = 0;
        releaseWakeLock();
        playFinishSound();
        showToast('Workout complete!');
        this._notify();
        return;
      }
      intervalState.phase = 'rest';
      timeLeft = intervalConfig.restTime;
      totalTime = intervalConfig.restTime;
      timerLabel = 'REST';
      playBeep();
    } else if (phase === 'rest') {
      intervalState.phase = 'work';
      intervalState.round++;
      timeLeft = intervalConfig.workTime;
      totalTime = intervalConfig.workTime;
      timerLabel = 'WORK';
      playDoubleBeep();
    }

    this._notify();
  }
};
