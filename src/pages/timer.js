import { store } from '../store.js';
import {
  formatTime, playBeep, playDoubleBeep, playTripleBeep,
  requestWakeLock, releaseWakeLock, showToast
} from '../utils.js';

let timerInterval = null;
let timeLeft = 0;
let totalTime = 0;
let isRunning = false;
let currentMode = 'countdown'; // countdown | rest | interval

// Interval timer state
let intervalConfig = { workTime: 30, restTime: 15, rounds: 8, prepareTime: 5 };
let intervalState = { round: 0, phase: 'prepare', totalRounds: 8 };

const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 115; // radius=115

export function timerPage(container) {
  const settings = store.getSettings();

  container.innerHTML = `
    <div class="tab-group">
      <button class="tab active" data-mode="countdown">Countdown</button>
      <button class="tab" data-mode="rest">Rest</button>
      <button class="tab" data-mode="interval">Interval</button>
    </div>
    <div id="timer-content"></div>
  `;

  // Tab switching
  container.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      stopTimer();
      container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.dataset.mode;
      renderMode(container.querySelector('#timer-content'));
    });
  });

  renderMode(container.querySelector('#timer-content'));

  return () => {
    stopTimer();
    releaseWakeLock();
  };
}

function renderMode(el) {
  if (currentMode === 'countdown') renderCountdown(el);
  else if (currentMode === 'rest') renderRest(el);
  else renderInterval(el);
}

// ===== COUNTDOWN TIMER =====
function renderCountdown(el) {
  el.innerHTML = `
    <div class="timer-container">
      ${renderTimerCircle()}
      ${renderControls()}
      <div class="timer-setup" id="timer-setup">
        <p class="section-title text-center">Set Duration</p>
        <div class="flex items-center justify-center gap-16 mb-16">
          <div class="input-group" style="margin:0;width:80px">
            <label class="input-label text-center">Min</label>
            <input type="number" class="input" id="set-min" value="5" min="0" max="99" style="text-align:center">
          </div>
          <span style="font-size:24px;color:var(--text-muted);margin-top:20px">:</span>
          <div class="input-group" style="margin:0;width:80px">
            <label class="input-label text-center">Sec</label>
            <input type="number" class="input" id="set-sec" value="0" min="0" max="59" style="text-align:center">
          </div>
        </div>
        <div class="timer-presets">
          <button class="chip" data-seconds="60">1:00</button>
          <button class="chip" data-seconds="180">3:00</button>
          <button class="chip" data-seconds="300">5:00</button>
          <button class="chip" data-seconds="600">10:00</button>
          <button class="chip" data-seconds="900">15:00</button>
          <button class="chip" data-seconds="1800">30:00</button>
        </div>
      </div>
    </div>
  `;

  bindPresets(el);
  bindControls(el, () => {
    const mins = parseInt(el.querySelector('#set-min').value) || 0;
    const secs = parseInt(el.querySelector('#set-sec').value) || 0;
    return mins * 60 + secs;
  });
  updateDisplay(el);
}

// ===== REST TIMER =====
function renderRest(el) {
  const settings = store.getSettings();
  const defaultRest = settings.defaultRestTime || 90;

  el.innerHTML = `
    <div class="timer-container">
      ${renderTimerCircle('REST')}
      ${renderControls()}
      <div class="timer-setup" id="timer-setup">
        <p class="section-title text-center">Quick Rest</p>
        <div class="timer-presets">
          <button class="chip" data-seconds="30">0:30</button>
          <button class="chip active" data-seconds="${defaultRest}">${formatTime(defaultRest)}</button>
          <button class="chip" data-seconds="60">1:00</button>
          <button class="chip" data-seconds="90">1:30</button>
          <button class="chip" data-seconds="120">2:00</button>
          <button class="chip" data-seconds="180">3:00</button>
        </div>
      </div>
    </div>
  `;

  bindPresets(el);
  bindControls(el, () => defaultRest);
  updateDisplay(el);
}

// ===== INTERVAL TIMER =====
function renderInterval(el) {
  el.innerHTML = `
    <div class="timer-container">
      <div id="interval-status" class="hidden">
        <div class="interval-phase prepare" id="interval-phase">PREPARE</div>
        <div class="interval-info">
          <div class="interval-info-item">
            <div class="interval-info-value" id="interval-round">0/${intervalConfig.rounds}</div>
            <div class="interval-info-label">Round</div>
          </div>
        </div>
      </div>
      ${renderTimerCircle('INTERVAL')}
      ${renderControls()}
      <div class="timer-setup" id="timer-setup">
        <p class="section-title text-center">Configure Interval</p>
        <div class="flex flex-wrap justify-center gap-16 mb-16">
          <div class="input-group" style="margin:0;width:100px">
            <label class="input-label text-center">Work (sec)</label>
            <input type="number" class="input" id="interval-work" value="${intervalConfig.workTime}" min="5" max="300" style="text-align:center">
          </div>
          <div class="input-group" style="margin:0;width:100px">
            <label class="input-label text-center">Rest (sec)</label>
            <input type="number" class="input" id="interval-rest" value="${intervalConfig.restTime}" min="5" max="300" style="text-align:center">
          </div>
          <div class="input-group" style="margin:0;width:100px">
            <label class="input-label text-center">Rounds</label>
            <input type="number" class="input" id="interval-rounds" value="${intervalConfig.rounds}" min="1" max="50" style="text-align:center">
          </div>
        </div>
        <div class="timer-presets">
          <button class="chip" data-preset="tabata">Tabata (20/10 x8)</button>
          <button class="chip" data-preset="hiit">HIIT (40/20 x6)</button>
          <button class="chip" data-preset="emom">EMOM (50/10 x10)</button>
        </div>
      </div>
    </div>
  `;

  // Preset buttons
  el.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const presets = {
        tabata: { workTime: 20, restTime: 10, rounds: 8 },
        hiit: { workTime: 40, restTime: 20, rounds: 6 },
        emom: { workTime: 50, restTime: 10, rounds: 10 }
      };
      const p = presets[btn.dataset.preset];
      if (p) {
        intervalConfig = { ...intervalConfig, ...p };
        el.querySelector('#interval-work').value = p.workTime;
        el.querySelector('#interval-rest').value = p.restTime;
        el.querySelector('#interval-rounds').value = p.rounds;
      }
    });
  });

  bindControls(el, () => {
    intervalConfig.workTime = parseInt(el.querySelector('#interval-work').value) || 30;
    intervalConfig.restTime = parseInt(el.querySelector('#interval-rest').value) || 15;
    intervalConfig.rounds = parseInt(el.querySelector('#interval-rounds').value) || 8;
    intervalState = { round: 0, phase: 'prepare', totalRounds: intervalConfig.rounds };
    return intervalConfig.prepareTime;
  }, true);

  updateDisplay(el);
}

// ===== SHARED RENDERING =====
function renderTimerCircle(label = '') {
  return `
    <div class="timer-circle">
      <svg viewBox="0 0 240 240">
        <circle class="timer-circle-bg" cx="120" cy="120" r="115"/>
        <circle class="timer-circle-progress" id="timer-progress" cx="120" cy="120" r="115"
          stroke-dasharray="${CIRCLE_CIRCUMFERENCE}" stroke-dashoffset="0"/>
      </svg>
      <div class="timer-display">
        <div class="timer-time" id="timer-time">00:00</div>
        <div class="timer-label" id="timer-label">${label}</div>
      </div>
    </div>
  `;
}

function renderControls() {
  return `
    <div class="timer-controls">
      <button class="timer-control-btn reset" id="btn-reset" title="Reset">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M3 12a9 9 0 1 1 9 9 9 9 0 0 1-6.36-2.64"/>
          <path d="M3 3v9h9"/>
        </svg>
      </button>
      <button class="timer-control-btn play" id="btn-play" title="Start">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6,3 20,12 6,21"/>
        </svg>
      </button>
    </div>
  `;
}

// ===== CONTROL BINDING =====
function bindPresets(el) {
  el.querySelectorAll('[data-seconds]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-seconds]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const secs = parseInt(btn.dataset.seconds);
      const minInput = el.querySelector('#set-min');
      const secInput = el.querySelector('#set-sec');
      if (minInput) minInput.value = Math.floor(secs / 60);
      if (secInput) secInput.value = secs % 60;
    });
  });
}

function bindControls(el, getInitialTime, isInterval = false) {
  const playBtn = el.querySelector('#btn-play');
  const resetBtn = el.querySelector('#btn-reset');

  playBtn.addEventListener('click', () => {
    if (isRunning) {
      pauseTimer(el);
    } else if (timeLeft > 0) {
      resumeTimer(el, isInterval);
    } else {
      const t = getInitialTime();
      if (t > 0) {
        startTimer(el, t, isInterval);
      }
    }
  });

  resetBtn.addEventListener('click', () => {
    stopTimer();
    timeLeft = 0;
    totalTime = 0;
    updateDisplay(el);
    const setup = el.querySelector('#timer-setup');
    if (setup) setup.classList.remove('hidden');
    const status = el.querySelector('#interval-status');
    if (status) status.classList.add('hidden');
  });
}

// ===== TIMER ENGINE =====
function startTimer(el, seconds, isInterval = false) {
  timeLeft = seconds;
  totalTime = seconds;
  isRunning = true;
  requestWakeLock();

  const setup = el.querySelector('#timer-setup');
  if (setup) setup.classList.add('hidden');

  if (isInterval) {
    const status = el.querySelector('#interval-status');
    if (status) status.classList.remove('hidden');
    updateIntervalDisplay(el);
  }

  updateDisplay(el);
  updatePlayButton(el, true);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateDisplay(el);

    // Beep on last 3 seconds
    if (timeLeft <= 3 && timeLeft > 0) {
      playBeep();
    }

    if (timeLeft <= 0) {
      if (isInterval) {
        handleIntervalPhaseEnd(el);
      } else {
        timerComplete(el);
      }
    }
  }, 1000);
}

function resumeTimer(el, isInterval = false) {
  isRunning = true;
  requestWakeLock();
  updatePlayButton(el, true);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateDisplay(el);

    if (timeLeft <= 3 && timeLeft > 0) {
      playBeep();
    }

    if (timeLeft <= 0) {
      if (isInterval) {
        handleIntervalPhaseEnd(el);
      } else {
        timerComplete(el);
      }
    }
  }, 1000);
}

function pauseTimer(el) {
  isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  releaseWakeLock();
  updatePlayButton(el, false);
}

function stopTimer() {
  isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  releaseWakeLock();
}

function timerComplete(el) {
  stopTimer();
  playTripleBeep();
  showToast('Timer complete!');
  timeLeft = 0;
  updateDisplay(el);
  updatePlayButton(el, false);
  const setup = el.querySelector('#timer-setup');
  if (setup) setup.classList.remove('hidden');
}

// ===== INTERVAL TIMER LOGIC =====
function handleIntervalPhaseEnd(el) {
  const { phase, round, totalRounds } = intervalState;

  if (phase === 'prepare') {
    // Start work phase
    intervalState.phase = 'work';
    intervalState.round = 1;
    timeLeft = intervalConfig.workTime;
    totalTime = intervalConfig.workTime;
    playDoubleBeep();
  } else if (phase === 'work') {
    if (round >= totalRounds) {
      // All rounds complete
      stopTimer();
      playTripleBeep();
      showToast('Workout complete!');
      const setup = el.querySelector('#timer-setup');
      if (setup) setup.classList.remove('hidden');
      const status = el.querySelector('#interval-status');
      if (status) status.classList.add('hidden');
      updatePlayButton(el, false);
      return;
    }
    // Start rest phase
    intervalState.phase = 'rest';
    timeLeft = intervalConfig.restTime;
    totalTime = intervalConfig.restTime;
    playBeep();
  } else if (phase === 'rest') {
    // Start next work phase
    intervalState.phase = 'work';
    intervalState.round++;
    timeLeft = intervalConfig.workTime;
    totalTime = intervalConfig.workTime;
    playDoubleBeep();
  }

  updateIntervalDisplay(el);
  updateDisplay(el);
}

function updateIntervalDisplay(el) {
  const phaseEl = el.querySelector('#interval-phase');
  const roundEl = el.querySelector('#interval-round');

  if (phaseEl) {
    phaseEl.textContent = intervalState.phase.toUpperCase();
    phaseEl.className = `interval-phase ${intervalState.phase}`;
  }
  if (roundEl) {
    roundEl.textContent = `${intervalState.round}/${intervalState.totalRounds}`;
  }
}

// ===== DISPLAY UPDATES =====
function updateDisplay(el) {
  const timeEl = el.querySelector('#timer-time');
  const progressEl = el.querySelector('#timer-progress');

  if (timeEl) {
    timeEl.textContent = formatTime(Math.max(0, timeLeft));
  }

  if (progressEl) {
    const progress = totalTime > 0 ? timeLeft / totalTime : 1;
    const offset = CIRCLE_CIRCUMFERENCE * (1 - progress);
    progressEl.style.strokeDashoffset = offset;

    // Color based on time remaining
    progressEl.classList.remove('warning', 'danger');
    if (currentMode === 'interval') {
      if (intervalState.phase === 'rest') progressEl.classList.add('warning');
      else if (intervalState.phase === 'prepare') progressEl.style.stroke = 'var(--accent-secondary)';
      else progressEl.style.stroke = '';
    } else if (timeLeft <= 5 && timeLeft > 0) {
      progressEl.classList.add('danger');
    } else if (timeLeft <= 10 && timeLeft > 0) {
      progressEl.classList.add('warning');
    }
  }
}

function updatePlayButton(el, playing) {
  const btn = el.querySelector('#btn-play');
  if (!btn) return;

  if (playing) {
    btn.className = 'timer-control-btn pause';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1"/>
        <rect x="14" y="4" width="4" height="16" rx="1"/>
      </svg>
    `;
  } else {
    btn.className = 'timer-control-btn play';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="6,3 20,12 6,21"/>
      </svg>
    `;
  }
}
