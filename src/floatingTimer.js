// Floating timer widget — persistent across all pages
import { globalTimer } from './globalTimer.js';
import { formatTime } from './utils.js';
import { getCurrentPath } from './router.js';

const RING_R = 20;
const RING_CIRC = 2 * Math.PI * RING_R;

let widgetEl = null;

export function initFloatingTimer() {
  widgetEl = document.createElement('div');
  widgetEl.id = 'floating-timer';
  widgetEl.className = 'floating-timer hidden';
  widgetEl.setAttribute('role', 'timer');
  widgetEl.setAttribute('aria-label', 'Active timer — tap to open');
  widgetEl.innerHTML = `
    <div class="floating-timer-ring">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle class="floating-timer-bg" cx="24" cy="24" r="${RING_R}"/>
        <circle class="floating-timer-progress" cx="24" cy="24" r="${RING_R}"
          stroke-dasharray="${RING_CIRC}" stroke-dashoffset="0"/>
      </svg>
    </div>
    <div class="floating-timer-info">
      <div class="floating-timer-time">00:00</div>
      <div class="floating-timer-label"></div>
    </div>
    <div class="floating-timer-actions">
      <button class="floating-timer-btn" data-action="add" aria-label="Add 15 seconds">+15</button>
      <button class="floating-timer-btn" data-action="toggle" aria-label="Pause"></button>
      <button class="floating-timer-btn stop" data-action="stop" aria-label="Stop timer">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2.5"/></svg>
      </button>
    </div>
  `;
  document.body.appendChild(widgetEl);

  widgetEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      window.location.hash = '#/timer';
      return;
    }
    e.stopPropagation();
    const action = btn.dataset.action;
    if (action === 'toggle') {
      if (globalTimer.isRunning) globalTimer.pause();
      else globalTimer.resume();
    } else if (action === 'stop') {
      globalTimer.stop();
    } else if (action === 'add') {
      globalTimer.addTime(15);
    }
  });

  globalTimer.subscribe(renderFromState);

  // Re-evaluate visibility on route changes and when the rest popup toggles
  window.addEventListener('hashchange', refreshFloatingTimer);
  renderFromState(globalTimer.snapshot());
}

export function refreshFloatingTimer() {
  renderFromState(globalTimer.snapshot());
}

let lastRunning = null;

function renderFromState(state) {
  if (!widgetEl) return;

  const hide = !state.isActive ||
    getCurrentPath() === '/timer' ||
    document.getElementById('rest-timer-popup');
  widgetEl.classList.toggle('hidden', !!hide);
  document.body.classList.toggle('has-floating-timer', !hide);
  if (hide) return;

  let tone = '';
  let label = state.label || state.mode.toUpperCase();
  if (state.mode === 'interval') {
    const { phase, round, totalRounds } = state.intervalState;
    if (phase === 'rest') tone = 'warning';
    else if (phase === 'prepare') tone = 'prepare';
    label = phase === 'prepare' ? 'GET READY' : `${phase.toUpperCase()} · ${round}/${totalRounds}`;
  } else if (state.timeLeft <= 5 && state.timeLeft > 0) {
    tone = 'danger';
  } else if (state.timeLeft <= 10 && state.timeLeft > 0) {
    tone = 'warning';
  }
  if (state.isPaused) label = 'PAUSED';

  widgetEl.dataset.tone = tone;
  widgetEl.querySelector('.floating-timer-progress')
    .setAttribute('stroke-dashoffset', RING_CIRC * (1 - state.progress));
  const timeEl = widgetEl.querySelector('.floating-timer-time');
  timeEl.textContent = formatTime(state.timeLeft);
  timeEl.classList.toggle('pulse-text', state.timeLeft <= 5 && state.timeLeft > 0 && state.isRunning);
  widgetEl.querySelector('.floating-timer-label').textContent = label;

  if (lastRunning !== state.isRunning) {
    lastRunning = state.isRunning;
    const toggle = widgetEl.querySelector('[data-action="toggle"]');
    toggle.setAttribute('aria-label', state.isRunning ? 'Pause' : 'Resume');
    toggle.innerHTML = state.isRunning
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';
  }
}
