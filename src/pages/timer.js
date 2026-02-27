import { store } from '../store.js';
import { formatTime } from '../utils.js';
import { globalTimer } from '../globalTimer.js';

const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 115;

let currentMode = 'countdown';
let unsubscribe = null;

export function timerPage(container) {
  // If a timer is already active, sync the tab to the active mode
  if (globalTimer.isActive) {
    currentMode = globalTimer.mode;
  }

  container.innerHTML = `
    <div class="tab-group">
      <button class="tab ${currentMode === 'countdown' ? 'active' : ''}" data-mode="countdown">Countdown</button>
      <button class="tab ${currentMode === 'rest' ? 'active' : ''}" data-mode="rest">Rest</button>
      <button class="tab ${currentMode === 'interval' ? 'active' : ''}" data-mode="interval">Interval</button>
    </div>
    <div id="timer-content"></div>
  `;

  // Tab switching
  container.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Don't switch tabs if a different timer type is active
      if (globalTimer.isActive && globalTimer.mode !== tab.dataset.mode) {
        return;
      }
      container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.dataset.mode;
      renderMode(container.querySelector('#timer-content'));
    });
  });

  renderMode(container.querySelector('#timer-content'));

  // Subscribe to global timer for live updates
  unsubscribe = globalTimer.subscribe((state) => {
    updateDisplayFromState(container, state);
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
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
      <div class="timer-setup ${globalTimer.isActive ? 'hidden' : ''}" id="timer-setup">
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

  // If timer is already running, sync display
  if (globalTimer.isActive && globalTimer.mode === 'countdown') {
    syncActiveState(el);
  }
}

// ===== REST TIMER =====
function renderRest(el) {
  const settings = store.getSettings();
  const defaultRest = settings.defaultRestTime || 90;

  // Fixed presets in ascending order; highlight the one matching user's default
  const restPresets = [30, 60, 90, 120, 180, 300];
  let selectedRest = defaultRest;

  el.innerHTML = `
    <div class="timer-container">
      ${renderTimerCircle('REST')}
      ${renderControls()}
      <div class="timer-setup ${globalTimer.isActive ? 'hidden' : ''}" id="timer-setup">
        <p class="section-title text-center">Quick Rest</p>
        <div class="timer-presets">
          ${restPresets.map(sec => `
            <button class="chip ${sec === defaultRest ? 'active' : ''}" data-seconds="${sec}">${formatTime(sec)}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Bind chip selection — update variable and visual state
  el.querySelectorAll('[data-seconds]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-seconds]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRest = parseInt(btn.dataset.seconds, 10);
    });
  });

  // Read selected rest duration from variable when play is pressed
  bindControls(el, () => selectedRest, false, 'rest');

  if (globalTimer.isActive && globalTimer.mode === 'rest') {
    syncActiveState(el);
  }
}

// ===== INTERVAL TIMER =====
function renderInterval(el) {
  const config = globalTimer.isActive && globalTimer.mode === 'interval'
    ? globalTimer.intervalConfig
    : { workTime: 30, restTime: 15, rounds: 8 };

  el.innerHTML = `
    <div class="timer-container">
      <div id="interval-status" class="${globalTimer.isActive && globalTimer.mode === 'interval' ? '' : 'hidden'}">
        <div class="interval-phase prepare" id="interval-phase">PREPARE</div>
        <div class="interval-info">
          <div class="interval-info-item">
            <div class="interval-info-value" id="interval-round">0/${config.rounds}</div>
            <div class="interval-info-label">Round</div>
          </div>
        </div>
      </div>
      ${renderTimerCircle('INTERVAL')}
      ${renderControls()}
      <div class="timer-setup ${globalTimer.isActive ? 'hidden' : ''}" id="timer-setup">
        <p class="section-title text-center">Configure Interval</p>
        <div class="flex flex-wrap justify-center gap-16 mb-16">
          <div class="input-group" style="margin:0;width:100px">
            <label class="input-label text-center">Work (sec)</label>
            <input type="number" class="input" id="interval-work" value="${config.workTime}" min="5" max="300" style="text-align:center">
          </div>
          <div class="input-group" style="margin:0;width:100px">
            <label class="input-label text-center">Rest (sec)</label>
            <input type="number" class="input" id="interval-rest" value="${config.restTime}" min="5" max="300" style="text-align:center">
          </div>
          <div class="input-group" style="margin:0;width:100px">
            <label class="input-label text-center">Rounds</label>
            <input type="number" class="input" id="interval-rounds" value="${config.rounds}" min="1" max="50" style="text-align:center">
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
        el.querySelector('#interval-work').value = p.workTime;
        el.querySelector('#interval-rest').value = p.restTime;
        el.querySelector('#interval-rounds').value = p.rounds;
      }
    });
  });

  bindControls(el, () => {
    return {
      workTime: parseInt(el.querySelector('#interval-work').value) || 30,
      restTime: parseInt(el.querySelector('#interval-rest').value) || 15,
      rounds: parseInt(el.querySelector('#interval-rounds').value) || 8
    };
  }, true);

  if (globalTimer.isActive && globalTimer.mode === 'interval') {
    syncActiveState(el);
  }
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
        <div class="timer-time" id="timer-time" aria-live="polite" aria-atomic="true">00:00</div>
        <div class="timer-label" id="timer-label">${label}</div>
      </div>
    </div>
  `;
}

function renderControls() {
  return `
    <div class="timer-controls">
      <button class="timer-control-btn reset" id="btn-reset" title="Reset" aria-label="Reset timer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path d="M3 12a9 9 0 1 1 9 9 9 9 0 0 1-6.36-2.64"/>
          <path d="M3 3v9h9"/>
        </svg>
      </button>
      <button class="timer-control-btn play" id="btn-play" title="Start" aria-label="Start timer">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6,3 20,12 6,21"/>
        </svg>
      </button>
    </div>
  `;
}

// ===== SYNC ACTIVE STATE =====
function syncActiveState(el) {
  const setup = el.querySelector('#timer-setup');
  if (setup) setup.classList.add('hidden');

  updatePlayButton(el, globalTimer.isRunning);

  // Update display with current state
  const timeEl = el.querySelector('#timer-time');
  if (timeEl) timeEl.textContent = formatTime(Math.max(0, globalTimer.timeLeft));

  const progressEl = el.querySelector('#timer-progress');
  if (progressEl) {
    const offset = CIRCLE_CIRCUMFERENCE * (1 - globalTimer.progress);
    progressEl.style.strokeDashoffset = offset;
  }

  const labelEl = el.querySelector('#timer-label');
  if (labelEl) labelEl.textContent = globalTimer.label;

  if (globalTimer.mode === 'interval') {
    const status = el.querySelector('#interval-status');
    if (status) status.classList.remove('hidden');
    updateIntervalDisplay(el, globalTimer.intervalState);
  }
}

// ===== CONTROL BINDING =====
function bindPresets(el) {
  el.querySelectorAll('[data-seconds]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-seconds]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const secs = parseInt(btn.dataset.seconds, 10);
      const minInput = el.querySelector('#set-min');
      const secInput = el.querySelector('#set-sec');
      if (minInput) minInput.value = Math.floor(secs / 60);
      if (secInput) secInput.value = secs % 60;
    });
  });
}

function bindControls(el, getInitialValue, isInterval = false, mode = 'countdown') {
  const playBtn = el.querySelector('#btn-play');
  const resetBtn = el.querySelector('#btn-reset');

  playBtn.addEventListener('click', () => {
    if (globalTimer.isRunning) {
      globalTimer.pause();
      updatePlayButton(el, false);
    } else if (globalTimer.isPaused) {
      globalTimer.resume();
      updatePlayButton(el, true);
    } else {
      // Start new timer
      const val = getInitialValue();
      if (isInterval) {
        if (val.workTime > 0) {
          globalTimer.startInterval(val);
          const setup = el.querySelector('#timer-setup');
          if (setup) setup.classList.add('hidden');
          const status = el.querySelector('#interval-status');
          if (status) status.classList.remove('hidden');
          updatePlayButton(el, true);
        }
      } else if (mode === 'rest') {
        if (val > 0) {
          globalTimer.startRest(val);
          const setup = el.querySelector('#timer-setup');
          if (setup) setup.classList.add('hidden');
          updatePlayButton(el, true);
        }
      } else {
        if (val > 0) {
          globalTimer.startCountdown(val);
          const setup = el.querySelector('#timer-setup');
          if (setup) setup.classList.add('hidden');
          updatePlayButton(el, true);
        }
      }
    }
  });

  resetBtn.addEventListener('click', () => {
    globalTimer.stop();
    updatePlayButton(el, false);
    const setup = el.querySelector('#timer-setup');
    if (setup) setup.classList.remove('hidden');
    const status = el.querySelector('#interval-status');
    if (status) status.classList.add('hidden');
    // Fully reset display
    const timeEl = el.querySelector('#timer-time');
    if (timeEl) {
      timeEl.textContent = '00:00';
      timeEl.classList.remove('timer-time-urgent');
    }
    const progressEl = el.querySelector('#timer-progress');
    if (progressEl) {
      progressEl.style.strokeDashoffset = '0';
      progressEl.classList.remove('warning', 'danger');
      progressEl.style.stroke = '';
    }
    const labelEl = el.querySelector('#timer-label');
    if (labelEl) labelEl.textContent = '';
  });
}

// ===== DISPLAY UPDATES FROM GLOBAL STATE =====
function updateDisplayFromState(container, state) {
  const el = container.querySelector('#timer-content');
  if (!el) return;

  const timeEl = el.querySelector('#timer-time');
  const progressEl = el.querySelector('#timer-progress');
  const labelEl = el.querySelector('#timer-label');

  if (timeEl) {
    timeEl.textContent = formatTime(Math.max(0, state.timeLeft));
    // Add visual urgency class
    timeEl.classList.toggle('timer-time-urgent', state.timeLeft <= 5 && state.timeLeft > 0);
  }

  if (progressEl) {
    const offset = CIRCLE_CIRCUMFERENCE * (1 - state.progress);
    progressEl.style.strokeDashoffset = offset;

    // Color based on time remaining
    progressEl.classList.remove('warning', 'danger');
    progressEl.style.stroke = '';
    if (state.mode === 'interval') {
      const phase = state.intervalState.phase;
      if (phase === 'rest') progressEl.classList.add('warning');
      else if (phase === 'prepare') progressEl.style.stroke = 'var(--accent-secondary)';
    } else if (state.timeLeft <= 5 && state.timeLeft > 0) {
      progressEl.classList.add('danger');
    } else if (state.timeLeft <= 10 && state.timeLeft > 0) {
      progressEl.classList.add('warning');
    }
  }

  if (labelEl) {
    labelEl.textContent = state.label || '';
  }

  // Update interval-specific UI
  if (state.mode === 'interval') {
    updateIntervalDisplay(el, state.intervalState);
  }

  // Always sync play/pause button with timer state
  if (state.isRunning) {
    updatePlayButton(el, true);
  } else {
    updatePlayButton(el, false);
  }

  // Show setup when timer completes or is stopped
  if (!state.isActive && !state.isRunning) {
    const setup = el.querySelector('#timer-setup');
    if (setup) setup.classList.remove('hidden');
    const status = el.querySelector('#interval-status');
    if (status) status.classList.add('hidden');
  }
}

function updateIntervalDisplay(el, iState) {
  const phaseEl = el.querySelector('#interval-phase');
  const roundEl = el.querySelector('#interval-round');

  if (phaseEl) {
    phaseEl.textContent = iState.phase.toUpperCase();
    phaseEl.className = `interval-phase ${iState.phase}`;
  }
  if (roundEl) {
    roundEl.textContent = `${iState.round}/${iState.totalRounds}`;
  }
}

function updatePlayButton(el, playing) {
  const btn = el.querySelector('#btn-play');
  if (!btn) return;

  if (playing) {
    btn.className = 'timer-control-btn pause';
    btn.title = 'Pause';
    btn.setAttribute('aria-label', 'Pause timer');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1"/>
        <rect x="14" y="4" width="4" height="16" rx="1"/>
      </svg>
    `;
  } else {
    btn.className = 'timer-control-btn play';
    btn.title = 'Start';
    btn.setAttribute('aria-label', 'Start timer');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="6,3 20,12 6,21"/>
      </svg>
    `;
  }
}
