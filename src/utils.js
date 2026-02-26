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

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function showModal(content) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = '';
  const modal = document.createElement('div');
  modal.className = 'modal';
  if (typeof content === 'string') {
    modal.innerHTML = content;
  } else {
    modal.appendChild(content);
  }
  overlay.appendChild(modal);
  overlay.classList.remove('hidden');
  // Trigger animation
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const closeModal = () => {
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
    }, 300);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

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
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {
    // Wake lock not available
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
