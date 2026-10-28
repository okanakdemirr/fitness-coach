import { store } from '../store.js';
import { formatTime, showToast } from '../utils.js';
import { globalTimer } from '../globalTimer.js';

const R = 112;
const CIRC = 2 * Math.PI * R;

const COUNTDOWN_PRESETS = [60, 120, 180, 300, 600, 900];
const REST_PRESETS = [30, 60, 90, 120, 180, 300];
const INTERVAL_PRESETS = {
  tabata: { label: 'Tabata', desc: '20s / 10s × 8', workTime: 20, restTime: 10, rounds: 8 },
  hiit: { label: 'HIIT', desc: '40s / 20s × 6', workTime: 40, restTime: 20, rounds: 6 },
  emom: { label: 'EMOM', desc: '50s / 10s × 10', workTime: 50, restTime: 10, rounds: 10 }
};

let currentMode = 'countdown';
// Remember the last setup within the session
let countdownSeconds = 300;
let restSeconds = null;
let intervalSetup = { workTime: 30, restTime: 15, rounds: 8 };

export function timerPage(container) {
  if (globalTimer.isActive) currentMode = globalTimer.mode;
  if (restSeconds === null) restSeconds = store.getSettings().defaultRestTime || 90;

  container.innerHTML = `
    <header class="page-header"><h1 class="page-title">Timer</h1></header>
    <div class="segmented mb-16" role="tablist" aria-label="Timer type">
      ${[['countdown', 'Countdown'], ['rest', 'Rest'], ['interval', 'Interval']].map(([id, label]) => `
        <button class="segment ${currentMode === id ? 'active' : ''}" data-mode="${id}" role="tab" aria-selected="${currentMode === id}">${label}</button>
      `).join('')}
    </div>

    <div class="timer-stage">
      <div class="timer-circle" data-tone="">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <circle class="timer-circle-bg" cx="120" cy="120" r="${R}"/>
          <circle class="timer-circle-progress" id="timer-progress" cx="120" cy="120" r="${R}"
            stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
        </svg>
        <div class="timer-display">
          <div class="timer-phase" id="timer-phase"></div>
          <div class="timer-time" id="timer-time" role="timer" aria-live="off">00:00</div>
          <div class="timer-label" id="timer-label"></div>
        </div>
      </div>

      <div class="timer-controls">
        <button class="timer-control-btn secondary" id="btn-reset" aria-label="Reset timer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button class="timer-control-btn primary" id="btn-play" aria-label="Start timer"></button>
        <button class="timer-control-btn secondary" id="btn-add" aria-label="Add 15 seconds">+15</button>
      </div>
    </div>

    <div id="timer-setup"></div>
  `;

  const setupEl = container.querySelector('#timer-setup');

  container.querySelectorAll('[data-mode]').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.mode === currentMode) return;
      if (globalTimer.isActive) {
        showToast('Stop the current timer first', 'error');
        return;
      }
      currentMode = tab.dataset.mode;
      container.querySelectorAll('[data-mode]').forEach(t => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on);
      });
      renderSetup(setupEl, container);
      update(container, globalTimer.snapshot());
    });
  });

  container.querySelector('#btn-play').addEventListener('click', () => {
    if (globalTimer.isRunning) {
      globalTimer.pause();
    } else if (globalTimer.isPaused) {
      globalTimer.resume();
    } else if (currentMode === 'countdown') {
      if (countdownSeconds > 0) globalTimer.startCountdown(countdownSeconds);
      else showToast('Set a duration first', 'error');
    } else if (currentMode === 'rest') {
      globalTimer.startRest(restSeconds);
    } else {
      globalTimer.startInterval(intervalSetup);
    }
  });

  container.querySelector('#btn-reset').addEventListener('click', () => globalTimer.stop());
  container.querySelector('#btn-add').addEventListener('click', () => globalTimer.addTime(15));

  renderSetup(setupEl, container);
  update(container, globalTimer.snapshot());

  const unsubscribe = globalTimer.subscribe((state) => update(container, state));
  return unsubscribe;
}

function idleSeconds() {
  if (currentMode === 'countdown') return countdownSeconds;
  if (currentMode === 'rest') return restSeconds;
  return intervalSetup.workTime;
}

function update(container, state) {
  const active = state.isActive && state.mode === currentMode;
  const circle = container.querySelector('.timer-circle');
  const timeEl = container.querySelector('#timer-time');
  const labelEl = container.querySelector('#timer-label');
  const phaseEl = container.querySelector('#timer-phase');
  const progressEl = container.querySelector('#timer-progress');
  const playBtn = container.querySelector('#btn-play');
  const addBtn = container.querySelector('#btn-add');
  const resetBtn = container.querySelector('#btn-reset');
  const setup = container.querySelector('#timer-setup');

  let tone = '';
  if (active) {
    timeEl.textContent = formatTime(state.timeLeft);
    progressEl.style.strokeDashoffset = CIRC * (1 - state.progress);
    if (state.mode === 'interval') {
      const { phase, round, totalRounds } = state.intervalState;
      tone = phase === 'work' ? '' : phase === 'rest' ? 'warning' : 'prepare';
      phaseEl.textContent = phase === 'prepare' ? 'Get ready' : phase;
      labelEl.textContent = phase === 'prepare' ? `${totalRounds} rounds` : `Round ${round} of ${totalRounds}`;
    } else {
      phaseEl.textContent = state.mode === 'rest' ? 'Rest' : '';
      labelEl.textContent = state.isPaused ? 'Paused' : '';
      if (state.timeLeft <= 5) tone = 'danger';
      else if (state.timeLeft <= 10) tone = 'warning';
    }
    if (state.isPaused) labelEl.textContent = 'Paused';
  } else {
    timeEl.textContent = formatTime(idleSeconds());
    progressEl.style.strokeDashoffset = 0;
    phaseEl.textContent = currentMode === 'interval' ? 'Work' : currentMode === 'rest' ? 'Rest' : '';
    labelEl.textContent = currentMode === 'interval'
      ? `${intervalSetup.rounds} rounds · ${intervalSetup.restTime}s rest`
      : 'Ready';
  }

  circle.dataset.tone = tone;
  circle.classList.toggle('running', active && state.isRunning);
  timeEl.classList.toggle('urgent', active && state.mode !== 'interval' && state.timeLeft <= 5 && state.isRunning);

  const running = active && state.isRunning;
  playBtn.setAttribute('aria-label', running ? 'Pause timer' : active ? 'Resume timer' : 'Start timer');
  playBtn.classList.toggle('paused-state', running);
  playBtn.innerHTML = running
    ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';

  addBtn.disabled = !active;
  resetBtn.disabled = !active;
  setup.classList.toggle('hidden', active);
}

function renderSetup(el, container) {
  if (currentMode === 'countdown') {
    const m = Math.floor(countdownSeconds / 60);
    const s = countdownSeconds % 60;
    el.innerHTML = `
      <div class="card timer-setup">
        <div class="duration-inputs">
          <label class="duration-field">
            <input type="text" inputmode="numeric" class="input" id="set-min" value="${m}" maxlength="2" aria-label="Minutes">
            <span>min</span>
          </label>
          <span class="duration-sep">:</span>
          <label class="duration-field">
            <input type="text" inputmode="numeric" class="input" id="set-sec" value="${String(s).padStart(2, '0')}" maxlength="2" aria-label="Seconds">
            <span>sec</span>
          </label>
        </div>
        <div class="chip-group centered">
          ${COUNTDOWN_PRESETS.map(sec => `
            <button class="chip ${sec === countdownSeconds ? 'active' : ''}" data-seconds="${sec}">${sec / 60} min</button>
          `).join('')}
        </div>
      </div>
    `;
    const minIn = el.querySelector('#set-min');
    const secIn = el.querySelector('#set-sec');
    const sync = () => {
      const mins = Math.min(99, parseInt(minIn.value.replace(/\D/g, ''), 10) || 0);
      const secs = Math.min(59, parseInt(secIn.value.replace(/\D/g, ''), 10) || 0);
      countdownSeconds = mins * 60 + secs;
      el.querySelectorAll('[data-seconds]').forEach(c => c.classList.toggle('active', +c.dataset.seconds === countdownSeconds));
      update(container, globalTimer.snapshot());
    };
    [minIn, secIn].forEach(inp => {
      inp.addEventListener('input', sync);
      inp.addEventListener('focus', () => inp.select());
    });
    secIn.addEventListener('blur', () => { secIn.value = String(countdownSeconds % 60).padStart(2, '0'); });
    el.querySelectorAll('[data-seconds]').forEach(btn => {
      btn.addEventListener('click', () => {
        countdownSeconds = +btn.dataset.seconds;
        minIn.value = Math.floor(countdownSeconds / 60);
        secIn.value = String(countdownSeconds % 60).padStart(2, '0');
        sync();
      });
    });
  } else if (currentMode === 'rest') {
    const def = store.getSettings().defaultRestTime;
    el.innerHTML = `
      <div class="card timer-setup">
        <p class="setup-hint">Rest between sets</p>
        <div class="preset-grid">
          ${REST_PRESETS.map(sec => `
            <button class="preset-btn ${sec === restSeconds ? 'active' : ''}" data-seconds="${sec}">
              <span class="preset-value">${sec < 60 ? `${sec}s` : formatTime(sec).replace(/^0/, '')}</span>
              ${sec === def ? '<span class="preset-tag">default</span>' : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    el.querySelectorAll('[data-seconds]').forEach(btn => {
      btn.addEventListener('click', () => {
        restSeconds = +btn.dataset.seconds;
        el.querySelectorAll('[data-seconds]').forEach(b => b.classList.toggle('active', b === btn));
        update(container, globalTimer.snapshot());
      });
    });
  } else {
    el.innerHTML = `
      <div class="card timer-setup">
        <div class="interval-fields">
          ${intervalField('Work', 'workTime', 's', 5, 600, 5)}
          ${intervalField('Rest', 'restTime', 's', 0, 600, 5)}
          ${intervalField('Rounds', 'rounds', '', 1, 50, 1)}
        </div>
        <div class="preset-grid three">
          ${Object.entries(INTERVAL_PRESETS).map(([id, p]) => `
            <button class="preset-btn" data-preset="${id}">
              <span class="preset-value">${p.label}</span>
              <span class="preset-tag">${p.desc}</span>
            </button>
          `).join('')}
        </div>
        <p class="setup-hint">Total ${formatTime(intervalSetup.rounds * intervalSetup.workTime + (intervalSetup.rounds - 1) * intervalSetup.restTime)} · 5s get-ready</p>
      </div>
    `;
    el.querySelectorAll('[data-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.field;
        const v = intervalSetup[f] + Number(btn.dataset.step);
        intervalSetup[f] = Math.max(Number(btn.dataset.min), Math.min(Number(btn.dataset.max), v));
        renderSetup(el, container);
        update(container, globalTimer.snapshot());
      });
    });
    el.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { workTime, restTime, rounds } = INTERVAL_PRESETS[btn.dataset.preset];
        intervalSetup = { workTime, restTime, rounds };
        renderSetup(el, container);
        update(container, globalTimer.snapshot());
      });
    });
  }
}

function intervalField(label, field, suffix, min, max, step) {
  return `
    <div class="interval-field">
      <span class="interval-field-label">${label}</span>
      <div class="stepper">
        <button class="stepper-btn" data-step="-${step}" data-field="${field}" data-min="${min}" data-max="${max}" aria-label="Decrease ${label}">−</button>
        <span class="stepper-value">${intervalSetup[field]}${suffix}</span>
        <button class="stepper-btn" data-step="${step}" data-field="${field}" data-min="${min}" data-max="${max}" aria-label="Increase ${label}">+</button>
      </div>
    </div>
  `;
}
