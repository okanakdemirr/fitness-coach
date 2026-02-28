import { store } from '../store.js';
import { showToast, showModal, escapeHtml, formatDate, todayStr, parseDecimal } from '../utils.js';

export function weightPage(container) {
  const settings = store.getSettings();
  const unit = settings.weightUnit || 'kg';

  render(container, unit);

  return () => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      overlay.classList.add('hidden');
      overlay.classList.remove('visible');
      overlay.innerHTML = '';
    }
  };
}

function render(container, unit) {
  const stats = store.getBodyStats();
  const now = new Date();
  const defaultDate = todayStr();
  const defaultTime = now.toTimeString().slice(0, 5);
  const escapedUnit = escapeHtml(unit);

  // Calculate trend info
  const latest = stats[0] || null;
  const previous = stats[1] || null;
  let trendHtml = '';
  if (latest && previous) {
    const diffNum = latest.weight - previous.weight;
    const diffStr = diffNum.toFixed(1);
    const sign = diffNum > 0 ? '+' : '';
    const color = diffNum > 0 ? 'var(--warning)' : diffNum < 0 ? 'var(--accent)' : 'var(--text-muted)';
    const arrow = diffNum > 0
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
      : diffNum < 0
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>'
        : '';
    trendHtml = `
      <div class="weight-trend" style="color:${color}">
        ${arrow} ${sign}${diffStr} ${escapedUnit}
      </div>
    `;
  }

  // Build mini chart (last 10 entries, reversed so oldest is left)
  let chartHtml = '';
  if (stats.length >= 2) {
    const chartData = stats.slice(0, 10).reverse();
    const weights = chartData.map(s => s.weight);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = maxW - minW || 1;

    const coords = chartData.map((s, i) => ({
      x: (i / (chartData.length - 1)) * 260 + 10,
      y: 80 - ((s.weight - minW) / range) * 60 + 10
    }));
    const points = coords.map(c => `${c.x},${c.y}`).join(' ');

    chartHtml = `
      <div class="weight-chart-card card">
        <div class="weight-chart-header">
          <span class="section-title" style="margin-bottom:0">Trend</span>
          <span class="text-sm text-muted">Last ${chartData.length} entries</span>
        </div>
        <svg viewBox="0 0 280 100" class="weight-chart-svg">
          <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${coords.map(c =>
            `<circle cx="${c.x}" cy="${c.y}" r="4" fill="var(--accent)" stroke="var(--bg-secondary)" stroke-width="2"/>`
          ).join('')}
        </svg>
        <div class="weight-chart-labels">
          <span class="text-sm text-muted">${maxW} ${escapedUnit}</span>
          <span class="text-sm text-muted">${minW} ${escapedUnit}</span>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <p class="page-title">Weight</p>

    <div class="weight-log-card card">
      <p class="weight-log-title">Log Weight</p>
      <div class="weight-input-row">
        <div class="weight-input-group">
          <label class="input-label" for="weight-input">Weight (${escapedUnit})</label>
          <input type="text" class="input" id="weight-input" placeholder="0" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*">
        </div>
      </div>
      <div class="weight-input-row">
        <div class="weight-input-group">
          <label class="input-label" for="weight-date">Date</label>
          <input type="date" class="input" id="weight-date" value="${defaultDate}">
        </div>
        <div class="weight-input-group">
          <label class="input-label" for="weight-time">Time</label>
          <input type="time" class="input" id="weight-time" value="${defaultTime}">
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="save-weight">Save Weight</button>
    </div>

    ${latest ? `
      <div class="weight-current card">
        <div class="weight-current-info">
          <span class="text-sm text-muted">Current Weight</span>
          <span class="weight-current-value">${latest.weight} ${escapedUnit}</span>
          ${trendHtml}
        </div>
        <div class="weight-current-date text-sm text-muted">
          ${formatDate(latest.date)}${latest.time ? ' at ' + latest.time : ''}
        </div>
      </div>
    ` : ''}

    ${chartHtml}

    ${stats.length > 0 ? `
      <p class="section-title">History</p>
      <div class="weight-history-list">
        ${stats.map(s => `
          <div class="weight-history-item" data-date="${escapeHtml(s.date)}">
            <div class="weight-history-info">
              <span class="weight-history-date">${formatDate(s.date)}</span>
              <span class="weight-history-time text-sm text-muted">${s.time || ''}</span>
            </div>
            <div class="weight-history-right">
              <span class="weight-history-value">${s.weight} ${escapedUnit}</span>
              <button class="weight-delete-btn" data-date="${escapeHtml(s.date)}" aria-label="Delete entry">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 3v18M3 12h18M7 8l5-5 5 5M7 16l5 5 5-5"/>
        </svg>
        <p style="font-size:16px;font-weight:600;margin-bottom:4px">No weight entries yet</p>
        <p>Log your first weight above to start tracking</p>
      </div>
    `}
  `;

  // Save weight
  container.querySelector('#save-weight').addEventListener('click', () => {
    const weightInput = container.querySelector('#weight-input');
    const dateInput = container.querySelector('#weight-date');
    const timeInput = container.querySelector('#weight-time');
    const weight = parseDecimal(weightInput.value);
    const date = dateInput.value;
    const time = timeInput.value;

    if (isNaN(weight) || weight <= 0) {
      showToast('Please enter a valid weight', 'error');
      weightInput.focus();
      return;
    }
    if (!date) {
      showToast('Please select a date', 'error');
      return;
    }

    store.addBodyStat({ date, time, weight, unit });
    showToast('Weight logged!');
    render(container, unit);
  });

  // Delete entries (event delegation)
  container.querySelector('.weight-history-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.weight-delete-btn');
    if (!btn) return;
    e.stopPropagation();
    const date = btn.dataset.date;
    const overlay = document.getElementById('modal-overlay');
    const close = showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Delete Entry?</h3>
        <button class="modal-close" id="del-cancel">&times;</button>
      </div>
      <p class="text-muted mb-16">Remove the weight entry for ${formatDate(date)}?</p>
      <div class="flex gap-8">
        <button class="btn btn-danger btn-block" id="del-confirm">Delete</button>
        <button class="btn btn-secondary btn-block" id="del-cancel2">Cancel</button>
      </div>
    `);

    overlay.querySelector('#del-confirm')?.addEventListener('click', () => {
      store.deleteBodyStat(date);
      close();
      showToast('Entry deleted');
      render(container, unit);
    });
    overlay.querySelector('#del-cancel')?.addEventListener('click', close);
    overlay.querySelector('#del-cancel2')?.addEventListener('click', close);
  });

  // Auto-focus weight input
  container.querySelector('#weight-input')?.focus();
}
