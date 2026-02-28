// Shared utility functions

export function generateId(prefix = '') {
  return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDuration(startTime, endTime) {
  if (!startTime || !endTime) return '—';
  const ms = new Date(endTime) - new Date(startTime);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

export function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'Today';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateFull(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Escapes HTML special characters to prevent XSS when interpolating
 * user-provided strings into HTML templates.
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Track active modal close handler for cleanup
let activeModalCloseHandler = null;

export function showModal(content) {
  const overlay = document.getElementById('modal-overlay');

  // Clean up previous modal listener
  if (activeModalCloseHandler) {
    overlay.removeEventListener('click', activeModalCloseHandler);
    activeModalCloseHandler = null;
  }

  overlay.innerHTML = '';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  if (typeof content === 'string') {
    modal.innerHTML = content;
  } else {
    modal.appendChild(content);
  }

  // Set aria-labelledby from first heading
  const heading = modal.querySelector('.modal-title, h3, h2');
  if (heading) {
    const headingId = heading.id || `modal-heading-${Date.now()}`;
    heading.id = headingId;
    modal.setAttribute('aria-labelledby', headingId);
  }

  overlay.appendChild(modal);
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // Trap focus inside modal
  const previousFocus = document.activeElement;

  const closeModal = () => {
    overlay.classList.remove('visible');
    overlay.removeEventListener('click', activeModalCloseHandler);
    document.removeEventListener('keydown', escKeyHandler);
    activeModalCloseHandler = null;
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
      // Return focus to the element that opened the modal
      if (previousFocus && previousFocus.focus) {
        previousFocus.focus();
      }
    }, 300);
  };

  activeModalCloseHandler = (e) => {
    if (e.target === overlay) closeModal();
  };

  const escKeyHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  overlay.addEventListener('click', activeModalCloseHandler);
  document.addEventListener('keydown', escKeyHandler);

  // Auto-focus first focusable element in modal
  setTimeout(() => {
    const focusable = modal.querySelector('input, button, select, textarea, [tabindex]');
    if (focusable) focusable.focus();
  }, 100);

  return closeModal;
}

export function playBeep() {
  // Check sound setting before playing
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
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio not available
  }
}

export function playDoubleBeep() {
  playBeep();
  setTimeout(playBeep, 200);
}

export function playTripleBeep() {
  playBeep();
  setTimeout(playBeep, 200);
  setTimeout(playBeep, 400);
}

// Wake Lock API - keep screen on during timers
let wakeLock = null;

export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      // Release existing lock before requesting a new one
      if (wakeLock) await releaseWakeLock();
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {
    // Wake lock not available or denied
  }
}

export async function releaseWakeLock() {
  if (wakeLock) {
    try {
      await wakeLock.release();
    } catch {
      // Ignore
    }
    wakeLock = null;
  }
}

// Parse decimal values that may use comma as separator (locale support)
export function parseDecimal(value) {
  if (typeof value !== 'string') value = String(value ?? '');
  return parseFloat(value.replace(',', '.'));
}

// Category icons/colors
export const categoryConfig = {
  chest: { emoji: '🫁', color: '#ff6b6b' },
  back: { emoji: '🔙', color: '#667eea' },
  legs: { emoji: '🦵', color: '#00d4aa' },
  shoulders: { emoji: '💪', color: '#ffd93d' },
  arms: { emoji: '💪', color: '#ff9f43' },
  core: { emoji: '🎯', color: '#a55eea' },
  cardio: { emoji: '❤️', color: '#ff6b6b' },
  fullbody: { emoji: '🏋️', color: '#00d4aa' }
};
