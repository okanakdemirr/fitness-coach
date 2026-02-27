// Floating timer widget — persistent across all pages
import { globalTimer } from './globalTimer.js';
import { formatTime } from './utils.js';
import { getCurrentPath } from './router.js';

let widgetEl = null;
let unsubscribe = null;

export function initFloatingTimer() {
  // Create the floating widget element
  widgetEl = document.createElement('div');
  widgetEl.id = 'floating-timer';
  widgetEl.className = 'floating-timer hidden';
  widgetEl.setAttribute('role', 'status');
  widgetEl.setAttribute('aria-live', 'polite');
  widgetEl.setAttribute('aria-label', 'Active timer');
  document.body.appendChild(widgetEl);

  // Bind click-to-navigate once on the container (delegates through)
  widgetEl.addEventListener('click', (e) => {
    if (e.target.closest('.floating-timer-btn')) return;
    window.location.hash = '#/timer';
  });

  // Subscribe to global timer updates
  unsubscribe = globalTimer.subscribe(renderFromState);

  // Re-render on route changes so the widget shows/hides correctly
  // when navigating to/from the timer page
  window.addEventListener('hashchange', () => {
    renderFromState(buildSnapshot());
  });
}

function buildSnapshot() {
  return {
    timeLeft: globalTimer.timeLeft,
    totalTime: globalTimer.totalTime,
    isRunning: globalTimer.isRunning,
    isPaused: globalTimer.isPaused,
    isActive: globalTimer.isActive,
    mode: globalTimer.mode,
    label: globalTimer.label,
    progress: globalTimer.progress,
    intervalState: globalTimer.intervalState,
    intervalConfig: globalTimer.intervalConfig
  };
}

function renderFromState(state) {
  if (!widgetEl) return;

  // Hide widget if timer is not active
  if (!state.isActive) {
    widgetEl.classList.add('hidden');
    return;
  }

  // Hide on the timer page (the full timer UI is shown there)
  if (getCurrentPath() === '/timer') {
    widgetEl.classList.add('hidden');
    return;
  }

  // Hide if the workout rest timer popup is already visible
  // (avoid showing two timer UIs at once)
  if (document.getElementById('rest-timer-popup')) {
    widgetEl.classList.add('hidden');
    return;
  }

  widgetEl.classList.remove('hidden');

  const progress = state.progress;
  const ringR = 20;
  const ringCirc = 2 * Math.PI * ringR;

  // Determine colors
  let progressClass = '';
  let phaseLabel = state.label || state.mode.toUpperCase();

  if (state.mode === 'interval') {
    const phase = state.intervalState.phase;
    if (phase === 'rest') progressClass = 'warning';
    else if (phase === 'prepare') progressClass = 'prepare';
    phaseLabel = `${phase.toUpperCase()} ${state.intervalState.round}/${state.intervalState.totalRounds}`;
  } else {
    if (state.timeLeft <= 5 && state.timeLeft > 0) progressClass = 'danger';
    else if (state.timeLeft <= 10 && state.timeLeft > 0) progressClass = 'warning';
  }

  const timeStr = formatTime(Math.max(0, state.timeLeft));

  widgetEl.innerHTML = `
    <div class="floating-timer-ring">
      <svg viewBox="0 0 48 48">
        <circle class="floating-timer-bg" cx="24" cy="24" r="${ringR}"/>
        <circle class="floating-timer-progress ${progressClass}" cx="24" cy="24" r="${ringR}"
          stroke-dasharray="${ringCirc}" stroke-dashoffset="${ringCirc * (1 - progress)}"/>
      </svg>
      <div class="floating-timer-icon">
        ${state.isPaused ? `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        ` : `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="13" r="8"/><polyline points="12 10 12 13 14 14"/></svg>
        `}
      </div>
    </div>
    <div class="floating-timer-info">
      <div class="floating-timer-time ${state.timeLeft <= 5 && state.timeLeft > 0 ? 'pulse-text' : ''}">${timeStr}</div>
      <div class="floating-timer-label">${phaseLabel}</div>
    </div>
    <div class="floating-timer-actions">
      <button class="floating-timer-btn" id="ft-toggle" aria-label="${state.isRunning ? 'Pause' : 'Resume'}">
        ${state.isRunning ? `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        ` : `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>
        `}
      </button>
      <button class="floating-timer-btn stop" id="ft-stop" aria-label="Stop timer">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
      </button>
    </div>
  `;

  // Bind action buttons (these are inside innerHTML so must rebind each render)
  widgetEl.querySelector('#ft-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (globalTimer.isRunning) globalTimer.pause();
    else globalTimer.resume();
  });

  widgetEl.querySelector('#ft-stop')?.addEventListener('click', (e) => {
    e.stopPropagation();
    globalTimer.stop();
  });
}
