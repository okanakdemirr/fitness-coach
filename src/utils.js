// Shared utility functions
import { store } from './store.js';

export function generateId(prefix = '') {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Escapes HTML special characters to prevent XSS when interpolating
 * user-provided strings into HTML templates (safe for attributes too).
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== DATES =====
// All workout dates are stored as local-time "YYYY-MM-DD" strings.
// Never use toISOString() for these: it converts to UTC and shifts the day
// for anyone not in UTC (e.g. a 01:00 workout in UTC+3 lands on yesterday).

const pad2 = (n) => String(n).padStart(2, '0');

export function toDateStr(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function parseDateStr(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

// Monday-based start of the week, at local midnight
export function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function formatDate(dateStr) {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === toDateStr(addDays(new Date(), -1))) return 'Yesterday';

  const date = parseDateStr(dateStr);
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString('en-US', opts);
}

export function formatDateFull(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatShortDate(dateStr) {
  return parseDateStr(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ===== NUMBERS & DURATIONS =====

export function formatTime(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${pad2(mins)}:${pad2(secs)}`;
  return `${pad2(mins)}:${pad2(secs)}`;
}

export function formatDurationMs(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function formatDuration(startTime, endTime) {
  if (!startTime || !endTime) return '—';
  return formatDurationMs(new Date(endTime) - new Date(startTime));
}

// Trims floating point noise: 72.50000001 -> "72.5"
export function formatNumber(n, maxDecimals = 1) {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US', { maximumFractionDigits: maxDecimals });
}

export function formatVolume(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return formatNumber(v, 0);
}

// Parse decimal values that may use comma as separator (locale support)
export function parseDecimal(value) {
  if (typeof value !== 'string') value = String(value ?? '');
  return parseFloat(value.replace(',', '.'));
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

// ===== TOASTS =====

export function showToast(message, type = 'success', { action, duration = 3000 } = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const text = document.createElement('span');
  text.className = 'toast-text';
  text.textContent = message;
  toast.appendChild(text);

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.onClick();
      dismiss();
    });
    toast.appendChild(btn);
  }

  container.appendChild(toast);
  // Keep at most 3 toasts on screen
  while (container.children.length > 3) container.firstElementChild.remove();

  const ms = action ? Math.max(duration, 5000) : duration;
  const timer = setTimeout(dismiss, ms);

  function dismiss() {
    clearTimeout(timer);
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 250);
  }
}

// ===== MODALS (bottom sheets) =====

let currentModal = null; // token of the modal currently open
let hideTimer = null;

export function showModal(content, { onClose } = {}) {
  const overlay = document.getElementById('modal-overlay');

  // Replace any open modal without letting its pending close wipe this one
  if (currentModal) currentModal.teardown();
  clearTimeout(hideTimer);

  overlay.innerHTML = '';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.tabIndex = -1;

  const handle = document.createElement('div');
  handle.className = 'modal-handle';
  handle.setAttribute('aria-hidden', 'true');
  modal.appendChild(handle);

  if (typeof content === 'string') {
    modal.insertAdjacentHTML('beforeend', content);
  } else {
    modal.appendChild(content);
  }

  const heading = modal.querySelector('.modal-title, h3, h2');
  if (heading) {
    heading.id = heading.id || `modal-heading-${Date.now()}`;
    modal.setAttribute('aria-labelledby', heading.id);
  }

  overlay.appendChild(modal);
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const previousFocus = currentModal ? currentModal.previousFocus : document.activeElement;

  const onOverlayClick = (e) => {
    if (e.target === overlay) close();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = [...modal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"]), a[href]'
      )].filter(el => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // Generic close buttons: anything marked data-close
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });

  overlay.addEventListener('click', onOverlayClick);
  document.addEventListener('keydown', onKey);

  const token = {
    previousFocus,
    teardown() {
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener('keydown', onKey);
    }
  };
  currentModal = token;

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    token.teardown();
    if (onClose) {
      try { onClose(); } catch (err) { console.error(err); }
    }
    // A newer modal has taken over: leave the overlay alone
    if (currentModal !== token) return;
    currentModal = null;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    hideTimer = setTimeout(() => {
      if (currentModal) return;
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
      if (previousFocus && previousFocus.isConnected && previousFocus.focus) {
        previousFocus.focus({ preventScroll: true });
      }
    }, 280);
  }
  token.close = close;

  // Only focus inputs explicitly marked autofocus — focusing on open would
  // pop up the mobile keyboard and cover the sheet.
  setTimeout(() => {
    if (currentModal !== token) return;
    const auto = modal.querySelector('[autofocus]');
    (auto || modal).focus({ preventScroll: true });
  }, 60);

  return close;
}

export function closeModal() {
  if (currentModal) currentModal.close();
}

export function confirmDialog({
  title,
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false
}) {
  return new Promise((resolve) => {
    let result = false;
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
      </div>
      ${message ? `<p class="modal-text">${message}</p>` : ''}
      <div class="modal-actions">
        <button class="btn btn-secondary btn-block" data-close>${escapeHtml(cancelText)}</button>
        <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'} btn-block" id="confirm-ok">${escapeHtml(confirmText)}</button>
      </div>
    `;
    const close = showModal(el, { onClose: () => resolve(result) });
    el.querySelector('#confirm-ok').addEventListener('click', () => {
      result = true;
      close();
    });
  });
}

export function promptDialog({
  title,
  label = '',
  value = '',
  placeholder = '',
  confirmText = 'Save',
  maxLength = 100
}) {
  return new Promise((resolve) => {
    let result = null;
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
      </div>
      <form id="prompt-form">
        ${label ? `<label class="input-label" for="prompt-input">${escapeHtml(label)}</label>` : ''}
        <input type="text" class="input mb-16" id="prompt-input" value="${escapeHtml(value)}"
          placeholder="${escapeHtml(placeholder)}" maxlength="${maxLength}" autofocus autocomplete="off">
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary btn-block" data-close>Cancel</button>
          <button type="submit" class="btn btn-primary btn-block">${escapeHtml(confirmText)}</button>
        </div>
      </form>
    `;
    const close = showModal(el, { onClose: () => resolve(result) });
    const input = el.querySelector('#prompt-input');
    el.querySelector('#prompt-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) {
        input.focus();
        return;
      }
      result = v.slice(0, maxLength);
      close();
    });
  });
}

// ===== SOUND & HAPTICS =====
// A single shared AudioContext. Creating a new one per beep leaks contexts
// and on iOS every new context starts "suspended" outside a user gesture,
// so timer beeps would never play. We unlock it on the first interaction.

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    // A silent buffer played inside a gesture unlocks audio on iOS Safari
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* ignore */ }
}

export function isSoundEnabled() {
  return store.getSettings().soundEnabled !== false;
}

// notes: [{ freq, at (s offset), dur (s), vol, type }]
function playNotes(notes) {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime + 0.01;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type || 'sine';
      osc.frequency.value = n.freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + (n.at || 0);
      const vol = n.vol ?? 0.25;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
      osc.start(start);
      osc.stop(start + n.dur + 0.02);
    }
  } catch { /* audio unavailable */ }
}

export const sounds = {
  tick: () => playNotes([{ freq: 880, dur: 0.12 }]),
  start: () => playNotes([
    { freq: 600, dur: 0.14 },
    { freq: 900, at: 0.14, dur: 0.2 }
  ]),
  work: () => playNotes([
    { freq: 880, dur: 0.15 },
    { freq: 880, at: 0.2, dur: 0.15 }
  ]),
  rest: () => playNotes([{ freq: 660, dur: 0.35, type: 'triangle' }]),
  finish: () => playNotes([
    { freq: 700, dur: 0.35, vol: 0.3 },
    { freq: 880, at: 0.18, dur: 0.35, vol: 0.3 },
    { freq: 1100, at: 0.36, dur: 0.5, vol: 0.3 }
  ]),
  success: () => playNotes([
    { freq: 1046, dur: 0.12, vol: 0.18 },
    { freq: 1318, at: 0.09, dur: 0.18, vol: 0.18 }
  ])
};

export function vibrate(pattern) {
  try {
    if (store.getSettings().vibrationEnabled === false) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* ignore */ }
}

// ===== WAKE LOCK =====
// Keeps the screen on during timers. The lock is dropped by the browser
// whenever the page is hidden, so re-acquire it when we become visible.

let wakeLock = null;
let wakeLockWanted = false;

export async function requestWakeLock() {
  wakeLockWanted = true;
  try {
    if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {
    // Wake lock not available or denied
  }
}

export async function releaseWakeLock() {
  wakeLockWanted = false;
  if (wakeLock) {
    try { await wakeLock.release(); } catch { /* ignore */ }
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLockWanted) requestWakeLock();
});

// ===== CATEGORIES =====
export const categoryConfig = {
  chest: { color: '#ff6b81' },
  back: { color: '#7c8cff' },
  legs: { color: '#36d399' },
  shoulders: { color: '#ffb547' },
  arms: { color: '#ff8f5a' },
  core: { color: '#b18cff' },
  cardio: { color: '#4cc9f0' }
};

export function categoryColor(cat) {
  return categoryConfig[cat]?.color || '#8a8f9c';
}

export function capitalize(str) {
  const s = String(str || '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
