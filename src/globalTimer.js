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

// ===== SHARED AUDIO HELPERS =====
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browsers suspend until user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function isSoundEnabled() {
  try {
    const raw = localStorage.getItem('fitcoach_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.soundEnabled === false) return false;
    }
  } catch { /* ignore */ }
  return true;
}

function playTone(frequency, duration, volume = 0.25, type = 'sine', startDelay = 0) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = type;
    const startAt = ctx.currentTime + startDelay;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    osc.start(startAt);
    osc.stop(startAt + duration);
  } catch { /* Audio not available */ }
}

function playCountdownTick() {
  if (!isSoundEnabled()) return;
  playTone(660, 0.15, 0.15);
}

function playWarningBeep() {
  if (!isSoundEnabled()) return;
  playTone(1200, 0.3, 0.25, 'triangle');
}

function playStartSound() {
  if (!isSoundEnabled()) return;
  // Rising two-tone "go" sound
  playTone(600, 0.15, 0.25);
  playTone(900, 0.2, 0.25, 'sine', 0.15);
}

function playFinishSound() {
  if (!isSoundEnabled()) return;
  // Triumphant ascending three-tone
  playTone(700, 0.4, 0.3, 'sine', 0);
  playTone(880, 0.4, 0.3, 'sine', 0.2);
  playTone(1100, 0.4, 0.3, 'sine', 0.4);
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
    this._startTick();
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
    this._startTick();
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
    this._startTick();
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
    this._startTick();
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

  // Internal: notify all listeners with a snapshot of current state
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

  // Internal: start the 1-second tick loop
  _startTick() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!isRunning) return;
      timeLeft--;

      // Sound cues
      if (timeLeft === 5) {
        playWarningBeep();
      } else if (timeLeft <= 3 && timeLeft > 0) {
        playBeep();
      } else if (timeLeft === 10) {
        playCountdownTick();
      }

      if (timeLeft <= 0) {
        if (timerMode === 'interval') {
          this._advanceIntervalPhase();
        } else {
          this._finish();
        }
      }

      this._notify();
    }, 1000);
  },

  // Internal: timer completed (non-interval)
  _finish() {
    isRunning = false;
    isPaused = false;
    clearInterval(timerInterval);
    timerInterval = null;
    timeLeft = 0;
    releaseWakeLock();
    playFinishSound();
    showToast('Timer complete!');
    // _notify is called by the tick loop after this returns
  },

  // Internal: advance to the next interval phase
  _advanceIntervalPhase() {
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
        // _notify is called by the tick loop after this returns
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
    // _notify is called by the tick loop after this returns
  }
};
