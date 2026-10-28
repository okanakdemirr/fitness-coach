import { store } from '../store.js';
import { showToast, confirmDialog, escapeHtml, todayStr, showModal } from '../utils.js';
import { applyTheme } from '../theme.js';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

export function settingsPage(container) {
  const settings = store.getSettings();
  const workouts = store.getWorkouts();

  const segmented = (name, options, current) => `
    <div class="segmented sm" role="radiogroup" aria-label="${name}">
      ${options.map(([value, label]) => `
        <button class="segment ${String(current) === String(value) ? 'active' : ''}" data-setting="${name}" data-value="${value}"
          role="radio" aria-checked="${String(current) === String(value)}">${label}</button>
      `).join('')}
    </div>
  `;

  const toggle = (id, checked, label) => `
    <label class="toggle">
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} aria-label="${label}">
      <span class="toggle-slider"></span>
    </label>
  `;

  container.innerHTML = `
    <header class="page-header">
      <h1 class="page-title">Settings</h1>
    </header>

    <p class="section-title">Appearance</p>
    <div class="settings-group">
      <div class="settings-item">
        <div class="settings-item-text">
          <div class="settings-item-label">Theme</div>
        </div>
        ${segmented('theme', [['system', 'Auto'], ['dark', 'Dark'], ['light', 'Light']], settings.theme)}
      </div>
    </div>

    <p class="section-title">Training</p>
    <div class="settings-group">
      <div class="settings-item">
        <div class="settings-item-text">
          <div class="settings-item-label">Weight unit</div>
        </div>
        ${segmented('weightUnit', [['kg', 'kg'], ['lbs', 'lbs']], settings.weightUnit)}
      </div>
      <div class="settings-item">
        <div class="settings-item-text">
          <div class="settings-item-label">Weekly goal</div>
          <div class="settings-item-desc">Workouts per week</div>
        </div>
        <div class="stepper">
          <button class="stepper-btn" data-goal="-1" aria-label="Decrease weekly goal">−</button>
          <span class="stepper-value" id="goal-value">${settings.weeklyGoal}</span>
          <button class="stepper-btn" data-goal="1" aria-label="Increase weekly goal">+</button>
        </div>
      </div>
      <div class="settings-item">
        <div class="settings-item-text">
          <div class="settings-item-label">Auto rest timer</div>
          <div class="settings-item-desc">Start resting when you check off a set</div>
        </div>
        ${toggle('toggle-auto-rest', settings.autoRestTimer, 'Auto rest timer')}
      </div>
      <div class="settings-item column">
        <div class="settings-item-text">
          <div class="settings-item-label">Default rest time</div>
        </div>
        ${segmented('defaultRestTime', [[30, '0:30'], [60, '1:00'], [90, '1:30'], [120, '2:00'], [180, '3:00']], settings.defaultRestTime)}
      </div>
    </div>

    <p class="section-title">Feedback</p>
    <div class="settings-group">
      <div class="settings-item">
        <div class="settings-item-text">
          <div class="settings-item-label">Sounds</div>
          <div class="settings-item-desc">Timer beeps and countdowns</div>
        </div>
        ${toggle('toggle-sound', settings.soundEnabled, 'Sounds')}
      </div>
      ${'vibrate' in navigator ? `
        <div class="settings-item">
          <div class="settings-item-text">
            <div class="settings-item-label">Vibration</div>
            <div class="settings-item-desc">Buzz when a timer ends</div>
          </div>
          ${toggle('toggle-vibration', settings.vibrationEnabled, 'Vibration')}
        </div>
      ` : ''}
    </div>

    <p class="section-title">Your data</p>
    <div class="settings-group">
      <button class="settings-item clickable" id="export-data">
        <div class="settings-item-text">
          <div class="settings-item-label">Export backup</div>
          <div class="settings-item-desc">${workouts.length} workouts · download as JSON</div>
        </div>
        <svg class="chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <button class="settings-item clickable" id="import-data">
        <div class="settings-item-text">
          <div class="settings-item-label">Restore backup</div>
          <div class="settings-item-desc">Replace current data with a JSON file</div>
        </div>
        <svg class="chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <button class="settings-item clickable" id="clear-data">
        <div class="settings-item-text">
          <div class="settings-item-label text-danger">Delete all data</div>
          <div class="settings-item-desc">Workouts, templates, weight and custom exercises</div>
        </div>
      </button>
    </div>
    <p class="settings-footnote">Everything is stored on this device only. Export a backup regularly so you don't lose your history.</p>

    <div class="app-footer">
      <div class="app-footer-logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6.5 6.5h11M6.5 17.5h11M6 12h12"/><rect x="2" y="6" width="4" height="12" rx="1.5"/><rect x="18" y="6" width="4" height="12" rx="1.5"/></svg>
      </div>
      <p>FitCoach${APP_VERSION ? ` v${escapeHtml(APP_VERSION)}` : ''}</p>
      <p class="text-muted">Built with care for your gains</p>
    </div>

    <input type="file" id="import-file-input" accept=".json,application/json" class="hidden">
  `;

  // Segmented settings
  container.querySelectorAll('[data-setting]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.setting;
      let value = btn.dataset.value;
      if (key === 'defaultRestTime') value = parseInt(value, 10);
      const current = store.getSettings()[key];
      if (current === value) return;

      if (key === 'weightUnit') {
        const changed = await changeUnit(current, value);
        if (!changed) return;
      } else {
        store.updateSettings({ [key]: value });
      }
      if (key === 'theme') applyTheme(value);

      btn.parentElement.querySelectorAll('[data-setting]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', on);
      });
    });
  });

  container.querySelectorAll('[data-goal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const goal = Math.max(1, Math.min(7, store.getSettings().weeklyGoal + parseInt(btn.dataset.goal, 10)));
      store.updateSettings({ weeklyGoal: goal });
      container.querySelector('#goal-value').textContent = goal;
    });
  });

  const bindToggle = (id, key) => {
    container.querySelector(id)?.addEventListener('change', (e) => {
      store.updateSettings({ [key]: e.target.checked });
    });
  };
  bindToggle('#toggle-auto-rest', 'autoRestTimer');
  bindToggle('#toggle-sound', 'soundEnabled');
  bindToggle('#toggle-vibration', 'vibrationEnabled');

  // Export
  container.querySelector('#export-data').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitcoach-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup downloaded');
  });

  // Import
  const fileInput = container.querySelector('#import-file-input');
  container.querySelector('#import-data').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    // Reset so picking the same file again still fires `change`
    fileInput.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large (max 10MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      let data;
      try {
        data = JSON.parse(evt.target.result);
      } catch {
        showToast('That file isn\'t valid JSON', 'error');
        return;
      }
      const count = Array.isArray(data?.workouts) ? data.workouts.length : 0;
      const ok = await confirmDialog({
        title: 'Restore backup?',
        message: `This replaces your current data with the backup${count ? ` (${count} workouts)` : ''}. Your current data will be lost unless you export it first.`,
        confirmText: 'Restore',
        danger: true
      });
      if (!ok) return;
      try {
        const summary = store.importData(data);
        applyTheme();
        showToast(`Restored ${summary.workouts ?? 0} workouts`);
        settingsPage(container);
      } catch (err) {
        showToast(err.message || 'Invalid backup file', 'error');
      }
    };
    reader.onerror = () => showToast('Failed to read file', 'error');
    reader.readAsText(file);
  });

  // Clear data — requires typing to confirm
  container.querySelector('#clear-data').addEventListener('click', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Delete all data?</h3>
      </div>
      <p class="modal-text">This permanently deletes ${workouts.length} workouts, your templates, weight log and custom exercises. Type <strong>DELETE</strong> to confirm.</p>
      <input type="text" class="input mb-16" id="clear-confirm-input" autocomplete="off" autocapitalize="characters" placeholder="DELETE">
      <div class="modal-actions">
        <button class="btn btn-secondary btn-block" data-close>Cancel</button>
        <button class="btn btn-danger-solid btn-block" id="clear-confirm" disabled>Delete everything</button>
      </div>
    `;
    const close = showModal(el);
    const input = el.querySelector('#clear-confirm-input');
    const btn = el.querySelector('#clear-confirm');
    input.addEventListener('input', () => { btn.disabled = input.value.trim().toUpperCase() !== 'DELETE'; });
    btn.addEventListener('click', () => {
      store.clearAll();
      close();
      showToast('All data deleted');
      settingsPage(container);
    });
  });
}

async function changeUnit(from, to) {
  const hasData = store.getWorkouts().length > 0 || store.getBodyStats().length > 0 || store.getActiveWorkout();
  if (!hasData) {
    store.updateSettings({ weightUnit: to });
    showToast(`Using ${to}`);
    return true;
  }

  return new Promise((resolve) => {
    let result = false;
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Switch to ${to}?</h3>
      </div>
      <p class="modal-text">Convert your logged weights from ${from} to ${to}? For example, 100 ${from} becomes ${to === 'lbs' ? '220.5 lbs' : '45.4 kg'}.</p>
      <div class="modal-actions stacked">
        <button class="btn btn-primary btn-block" id="unit-convert">Convert my data</button>
        <button class="btn btn-secondary btn-block" id="unit-keep">Just change the label</button>
        <button class="btn btn-ghost btn-block" data-close>Cancel</button>
      </div>
    `;
    const close = showModal(el, { onClose: () => resolve(result) });
    el.querySelector('#unit-convert').addEventListener('click', () => {
      store.convertAllWeights(from, to);
      store.updateSettings({ weightUnit: to });
      showToast(`Converted to ${to}`);
      result = true;
      close();
    });
    el.querySelector('#unit-keep').addEventListener('click', () => {
      store.updateSettings({ weightUnit: to });
      // Relabel body-weight entries so they display in the new unit
      store.set('bodyStats', store.getBodyStats().map(s => ({ ...s, unit: to })));
      showToast(`Using ${to}`);
      result = true;
      close();
    });
  });
}
