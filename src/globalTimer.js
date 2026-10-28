// Global timer module — singleton state accessible from any page
import { sounds, vibrate, requestWakeLock, releaseWakeLock, showToast } from './utils.js';

const PERSIST_KEY = 'fitcoach_timer';

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

// Wall-clock reference for accurate timing when background-throttled
let _tickRefTime = 0;
let _tickRefTimeLeft = 0;

// Listeners: any part of the app can subscribe to timer ticks
const listeners = new Set();

function maybePlayTick(prev, current) {
  if (current !== prev && current > 0 && current <= 3) {
    sounds.tick();
  }
}

function snapshot() {
  return {
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
}

// Persist so a running timer survives reloads and the OS killing the PWA
function persist() {
  try {
    if (!isRunning && !isPaused) {
      localStorage.removeItem(PERSIST_KEY);
      return;
    }
    localStorage.setItem(PERSIST_KEY, JSON.stringify({
      timeLeft, totalTime, isRunning, isPaused, timerMode, timerLabel,
      intervalConfig, intervalState,
      refTime: _tickRefTime, refTimeLeft: _tickRefTimeLeft
    }));
  } catch { /* ignore */ }
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

  snapshot,

  // Subscribe/unsubscribe to tick updates
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  _begin(mode, label, seconds) {
    this._halt();
    timerMode = mode;
    timerLabel = label;
    timeLeft = seconds;
    totalTime = seconds;
    isRunning = true;
    isPaused = false;
    requestWakeLock();
    sounds.start();
    this._startTick();
    this._notify();
  },

  // Start a countdown timer
  startCountdown(seconds, label = '') {
    this._begin('countdown', label, seconds);
  },

  // Start a rest timer
  startRest(seconds) {
    this._begin('rest', 'REST', seconds);
  },

  // Start interval timer
  startInterval(config) {
    intervalConfig = { ...intervalConfig, ...config };
    intervalState = { round: 0, phase: 'prepare', totalRounds: intervalConfig.rounds };
    this._begin('interval', 'GET READY', intervalConfig.prepareTime);
  },

  pause() {
    if (!isRunning) return;
    this._syncTime();
    if (!isRunning) {
      // Finished during the sync
      this._notify();
      return;
    }
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
    this._startTick();
    this._notify();
  },

  stop() {
    this._halt();
    this._notify();
  },

  addTime(seconds) {
    if (!this.isActive) return;
    if (isRunning) this._syncTime();
    timeLeft = Math.max(1, timeLeft + seconds);
    totalTime = Math.max(totalTime, timeLeft);
    if (isRunning) {
      _tickRefTime = Date.now();
      _tickRefTimeLeft = timeLeft;
    }
    this._notify();
  },

  // Internal: reset to idle without notifying
  _halt() {
    isRunning = false;
    isPaused = false;
    clearInterval(timerInterval);
    timerInterval = null;
    timeLeft = 0;
    totalTime = 0;
    timerLabel = '';
    _tickRefTime = 0;
    releaseWakeLock();
  },

  // Internal: notify all listeners with a snapshot of current state
  _notify() {
    persist();
    const state = snapshot();
    listeners.forEach(fn => {
      try { fn(state); } catch (err) { console.error(err); }
    });
  },

  // Internal: start the tick loop. A short interval keeps the display
  // snappy; the wall-clock reference keeps it accurate.
  _startTick(resetRef = true) {
    clearInterval(timerInterval);
    if (resetRef) {
      _tickRefTime = Date.now();
      _tickRefTimeLeft = timeLeft;
    }
    timerInterval = setInterval(() => {
      if (!isRunning) return;
      if (this._syncTime()) this._notify();
    }, 250);
  },

  // Internal: recalculate timeLeft from wall clock to survive background throttling
  // Returns true if state changed, false otherwise
  _syncTime() {
    if (_tickRefTime === 0) return false;
    const elapsed = Math.floor((Date.now() - _tickRefTime) / 1000);
    if (elapsed <= 0) return false;

    if (timerMode !== 'interval') {
      const prev = timeLeft;
      timeLeft = Math.max(0, _tickRefTimeLeft - elapsed);
      maybePlayTick(prev, timeLeft);
      if (timeLeft <= 0) this._finish();
      return timeLeft !== prev;
    }

    // Interval mode: may need to advance through multiple phases
    const remaining = _tickRefTimeLeft - elapsed;
    if (remaining > 0) {
      const prev = timeLeft;
      timeLeft = remaining;
      maybePlayTick(prev, timeLeft);
      return timeLeft !== prev;
    }

    // Phase(s) completed while backgrounded — step through them silently,
    // only sounding the transition if it is happening right now
    let overflow = -remaining;
    const silent = overflow > 2;
    this._advanceIntervalPhase(silent);
    while (overflow > 0 && isRunning && timeLeft > 0) {
      if (overflow >= timeLeft) {
        overflow -= timeLeft;
        this._advanceIntervalPhase(true);
      } else {
        timeLeft -= overflow;
        overflow = 0;
      }
    }
    if (isRunning) {
      _tickRefTime = Date.now();
      _tickRefTimeLeft = timeLeft;
    }
    return true;
  },

  // Internal: timer completed (non-interval)
  _finish() {
    const wasRest = timerMode === 'rest';
    isRunning = false;
    isPaused = false;
    clearInterval(timerInterval);
    timerInterval = null;
    timeLeft = 0;
    _tickRefTime = 0;
    releaseWakeLock();
    sounds.finish();
    vibrate([200, 100, 200, 100, 300]);
    showToast(wasRest ? 'Rest over — next set!' : 'Timer complete!');
    // _notify is called by the caller after this returns
  },

  // Internal: advance to the next interval phase
  _advanceIntervalPhase(silent = false) {
    const { phase, round, totalRounds } = intervalState;

    if (phase === 'prepare' || phase === 'rest') {
      intervalState.phase = 'work';
      intervalState.round = phase === 'prepare' ? 1 : round + 1;
      timeLeft = intervalConfig.workTime;
      totalTime = intervalConfig.workTime;
      timerLabel = 'WORK';
      if (!silent) { sounds.work(); vibrate([150, 80, 150]); }
      return;
    }

    // phase === 'work'
    if (round >= totalRounds) {
      isRunning = false;
      isPaused = false;
      clearInterval(timerInterval);
      timerInterval = null;
      timeLeft = 0;
      _tickRefTime = 0;
      releaseWakeLock();
      if (!silent) { sounds.finish(); vibrate([200, 100, 200, 100, 300]); }
      showToast('Interval session complete!');
      return;
    }
    if (intervalConfig.restTime <= 0) {
      intervalState.phase = 'rest';
      this._advanceIntervalPhase(silent);
      return;
    }
    intervalState.phase = 'rest';
    timeLeft = intervalConfig.restTime;
    totalTime = intervalConfig.restTime;
    timerLabel = 'REST';
    if (!silent) { sounds.rest(); vibrate(300); }
  }
};

// Restore a timer that was running when the app was closed
(function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || 'null');
    if (!saved) return;
    timerMode = saved.timerMode;
    timerLabel = saved.timerLabel;
    totalTime = saved.totalTime;
    timeLeft = saved.timeLeft;
    intervalConfig = saved.intervalConfig || intervalConfig;
    intervalState = saved.intervalState || intervalState;

    if (saved.isPaused) {
      isPaused = true;
      return;
    }
    if (!saved.isRunning || !saved.refTime) {
      localStorage.removeItem(PERSIST_KEY);
      return;
    }

    _tickRefTime = saved.refTime;
    _tickRefTimeLeft = saved.refTimeLeft;
    const elapsed = Math.floor((Date.now() - _tickRefTime) / 1000);

    if (timerMode !== 'interval' && elapsed >= _tickRefTimeLeft) {
      // Finished long ago while the app was closed — discard quietly
      timerLabel = '';
      timeLeft = 0;
      totalTime = 0;
      localStorage.removeItem(PERSIST_KEY);
      return;
    }

    isRunning = true;
    globalTimer._syncTime();
    if (isRunning) {
      requestWakeLock();
      globalTimer._startTick(false);
    }
    persist();
  } catch {
    localStorage.removeItem(PERSIST_KEY);
  }
})();

// Sync timer immediately when the tab becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isRunning) {
    if (globalTimer._syncTime()) globalTimer._notify();
  }
});
