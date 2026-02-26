import { store } from '../store.js';
import { showToast, showModal } from '../utils.js';
import { navigate } from '../router.js';

export function settingsPage(container) {
  const settings = store.getSettings();
  const bodyStats = store.getBodyStats();

  container.innerHTML = `
    <p class="page-title">Settings</p>

    <p class="section-title">Appearance</p>
    <div class="settings-group">
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Dark Mode</div>
          <div class="settings-item-desc">Use dark theme</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="toggle-theme" ${settings.theme === 'dark' ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <p class="section-title">Workout</p>
    <div class="settings-group">
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Weight Unit</div>
          <div class="settings-item-desc">Used for logging and display</div>
        </div>
        <select class="input" id="weight-unit" style="width:80px;padding:8px">
          <option value="kg" ${settings.weightUnit === 'kg' ? 'selected' : ''}>kg</option>
          <option value="lbs" ${settings.weightUnit === 'lbs' ? 'selected' : ''}>lbs</option>
        </select>
      </div>
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Default Rest Time</div>
          <div class="settings-item-desc">Seconds between sets</div>
        </div>
        <select class="input" id="rest-time" style="width:80px;padding:8px">
          <option value="30" ${settings.defaultRestTime === 30 ? 'selected' : ''}>30s</option>
          <option value="60" ${settings.defaultRestTime === 60 ? 'selected' : ''}>60s</option>
          <option value="90" ${settings.defaultRestTime === 90 ? 'selected' : ''}>90s</option>
          <option value="120" ${settings.defaultRestTime === 120 ? 'selected' : ''}>120s</option>
          <option value="180" ${settings.defaultRestTime === 180 ? 'selected' : ''}>180s</option>
        </select>
      </div>
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Sound Effects</div>
          <div class="settings-item-desc">Timer completion beeps</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="toggle-sound" ${settings.soundEnabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Weekly Goal</div>
          <div class="settings-item-desc">Workouts per week target</div>
        </div>
        <select class="input" id="weekly-goal" style="width:70px;padding:8px">
          ${[2,3,4,5,6,7].map(n => `<option value="${n}" ${(settings.weeklyGoal || 4) === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
    </div>

    <p class="section-title">Body Stats</p>
    <div class="settings-group">
      <div class="settings-item" style="cursor:pointer" id="log-weight-btn">
        <div>
          <div class="settings-item-label">Log Weight</div>
          <div class="settings-item-desc">${bodyStats.length > 0 ? `Latest: ${bodyStats[0].weight} ${bodyStats[0].unit || settings.weightUnit}` : 'Track your body weight'}</div>
        </div>
        <span class="text-accent">+</span>
      </div>
      <div class="settings-item" style="cursor:pointer" id="view-weight-btn">
        <div>
          <div class="settings-item-label">Weight History</div>
          <div class="settings-item-desc">${bodyStats.length} entries</div>
        </div>
        <span class="text-muted">&rsaquo;</span>
      </div>
    </div>

    <p class="section-title">Data</p>
    <div class="settings-group">
      <div class="settings-item" style="cursor:pointer" id="export-data">
        <div>
          <div class="settings-item-label">Export Data</div>
          <div class="settings-item-desc">Download all data as JSON</div>
        </div>
        <span class="text-muted">&rsaquo;</span>
      </div>
      <div class="settings-item" style="cursor:pointer" id="import-data">
        <div>
          <div class="settings-item-label">Import Data</div>
          <div class="settings-item-desc">Restore from JSON backup</div>
        </div>
        <span class="text-muted">&rsaquo;</span>
      </div>
      <div class="settings-item" style="cursor:pointer" id="clear-data">
        <div>
          <div class="settings-item-label text-danger">Clear All Data</div>
          <div class="settings-item-desc">Delete all workouts, templates, and stats</div>
        </div>
      </div>
    </div>

    <div class="text-center mt-24 text-muted text-sm">
      <p>FitCoach v1.0.0</p>
      <p class="mt-8">Built with care for your gains</p>
    </div>

    <input type="file" id="import-file-input" accept=".json" class="hidden">
  `;

  // Theme toggle
  container.querySelector('#toggle-theme').addEventListener('change', (e) => {
    const theme = e.target.checked ? 'dark' : 'light';
    store.updateSettings({ theme });
    document.documentElement.setAttribute('data-theme', theme);
  });

  // Weight unit
  container.querySelector('#weight-unit').addEventListener('change', (e) => {
    store.updateSettings({ weightUnit: e.target.value });
    showToast(`Weight unit set to ${e.target.value}`);
  });

  // Rest time
  container.querySelector('#rest-time').addEventListener('change', (e) => {
    store.updateSettings({ defaultRestTime: parseInt(e.target.value) });
  });

  // Sound toggle
  container.querySelector('#toggle-sound').addEventListener('change', (e) => {
    store.updateSettings({ soundEnabled: e.target.checked });
  });

  // Weekly goal
  container.querySelector('#weekly-goal').addEventListener('change', (e) => {
    store.updateSettings({ weeklyGoal: parseInt(e.target.value) });
    showToast(`Weekly goal set to ${e.target.value}`);
  });

  // Log weight
  container.querySelector('#log-weight-btn').addEventListener('click', () => {
    showLogWeight(container);
  });

  // View weight history
  container.querySelector('#view-weight-btn').addEventListener('click', () => {
    showWeightHistory();
  });

  // Export
  container.querySelector('#export-data').addEventListener('click', () => {
    const data = {
      workouts: store.getWorkouts(),
      templates: store.getTemplates(),
      bodyStats: store.getBodyStats(),
      settings: store.getSettings(),
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitcoach-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!');
  });

  // Import
  const fileInput = container.querySelector('#import-file-input');
  container.querySelector('#import-data').addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reject files larger than 10MB
    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large (max 10MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);

        // Validate imported data structure
        if (data.workouts && Array.isArray(data.workouts)) {
          store.set('workouts', data.workouts.slice(0, 10000));
        }
        if (data.templates && Array.isArray(data.templates)) {
          store.set('templates', data.templates.slice(0, 500));
        }
        if (data.bodyStats && Array.isArray(data.bodyStats)) {
          store.set('bodyStats', data.bodyStats.slice(0, 5000));
        }
        if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
          store.set('settings', data.settings);
        }
        showToast('Data imported successfully!');
        settingsPage(container); // Refresh
      } catch {
        showToast('Invalid backup file', 'error');
      }
    };
    reader.onerror = () => {
      showToast('Failed to read file', 'error');
    };
    reader.readAsText(file);
  });

  // Clear data
  container.querySelector('#clear-data').addEventListener('click', () => {
    const close = showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Clear All Data?</h3>
        <button class="modal-close" id="clear-cancel">&times;</button>
      </div>
      <p class="text-muted mb-16">This will permanently delete all your workouts, templates, and body stats. This cannot be undone.</p>
      <div class="flex gap-8">
        <button class="btn btn-danger btn-block" id="clear-confirm">Delete Everything</button>
        <button class="btn btn-secondary btn-block" id="clear-cancel2">Cancel</button>
      </div>
    `);

    setTimeout(() => {
      document.querySelector('#clear-confirm')?.addEventListener('click', () => {
        store.set('workouts', []);
        store.set('templates', []);
        store.set('bodyStats', []);
        store.clearActiveWorkout();
        close();
        showToast('All data cleared');
        settingsPage(container);
      });
      document.querySelector('#clear-cancel')?.addEventListener('click', close);
      document.querySelector('#clear-cancel2')?.addEventListener('click', close);
    }, 50);
  });
}

function showLogWeight(container) {
  const settings = store.getSettings();
  const el = document.createElement('div');

  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Log Weight</h3>
      <button class="modal-close" id="log-close">&times;</button>
    </div>
    <div class="input-group">
      <label class="input-label">Weight (${settings.weightUnit})</label>
      <input type="number" class="input" id="weight-input" placeholder="0" inputmode="decimal" step="0.1">
    </div>
    <div class="input-group">
      <label class="input-label">Date</label>
      <input type="date" class="input" id="weight-date" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <button class="btn btn-primary btn-block" id="save-weight">Save</button>
  `;

  const close = showModal(el);

  setTimeout(() => {
    el.querySelector('#log-close')?.addEventListener('click', close);
    el.querySelector('#weight-input')?.focus();

    el.querySelector('#save-weight')?.addEventListener('click', () => {
      const weight = parseFloat(el.querySelector('#weight-input').value);
      const date = el.querySelector('#weight-date').value;
      if (!weight || !date) {
        showToast('Please enter a weight', 'error');
        return;
      }
      store.addBodyStat({ date, weight, unit: settings.weightUnit });
      close();
      showToast('Weight logged!');
      settingsPage(container);
    });
  }, 100);
}

function showWeightHistory() {
  const stats = store.getBodyStats();
  const settings = store.getSettings();

  const el = document.createElement('div');
  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Weight History</h3>
      <button class="modal-close" id="hist-close">&times;</button>
    </div>
    ${stats.length === 0 ? `
      <p class="text-muted text-center">No entries yet</p>
    ` : `
      <div style="max-height:400px;overflow-y:auto">
        ${stats.map(s => `
          <div class="body-stat-entry">
            <span class="body-stat-date">${new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span class="body-stat-value">${s.weight} ${s.unit || settings.weightUnit}</span>
          </div>
        `).join('')}
      </div>
    `}
  `;

  const close = showModal(el);
  setTimeout(() => {
    el.querySelector('#hist-close')?.addEventListener('click', close);
  }, 50);
}
