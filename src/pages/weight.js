import { store } from '../store.js';
import {
  showToast, escapeHtml, formatDate, formatShortDate, todayStr, parseDecimal, confirmDialog,
  formatNumber, toDateStr, addDays
} from '../utils.js';
import { lineChart } from '../charts.js';

let range = 30; // days shown in the chart; 0 = all

export function weightPage(container) {
  render(container);
}

function render(container) {
  const unit = store.getSettings().weightUnit;
  const stats = store.getBodyStats();
  const latest = stats[0] || null;
  const now = new Date();

  // Change vs. the closest entry ~7 and ~30 days ago
  const changeSince = (days) => {
    if (!latest) return null;
    const cutoff = toDateStr(addDays(new Date(), -days));
    const past = stats.find(s => s.date <= cutoff);
    return past ? latest.weight - past.weight : null;
  };
  const change7 = changeSince(7);
  const change30 = changeSince(30);

  const cutoff = range ? toDateStr(addDays(now, -range)) : '';
  const chartData = stats.filter(s => !cutoff || s.date >= cutoff).slice().reverse();

  const delta = (v) => {
    if (v === null) return '<span class="delta">—</span>';
    const cls = v > 0.05 ? 'up' : v < -0.05 ? 'down' : '';
    return `<span class="delta ${cls}">${v > 0 ? '+' : ''}${formatNumber(v)} ${escapeHtml(unit)}</span>`;
  };

  container.innerHTML = `
    <header class="page-header">
      <a href="#/tools" class="icon-btn" aria-label="Back to tools">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>
      </a>
      <h1 class="page-title">Body Weight</h1>
    </header>

    ${latest ? `
      <div class="card weight-hero mb-16">
        <div class="weight-hero-main">
          <span class="weight-hero-label">Current</span>
          <span class="weight-hero-value">${formatNumber(latest.weight)}<small> ${escapeHtml(unit)}</small></span>
          <span class="weight-hero-date">${escapeHtml(formatDate(latest.date))}${latest.time ? ` · ${escapeHtml(latest.time)}` : ''}</span>
        </div>
        <div class="weight-hero-deltas">
          <div><span class="delta-label">7 days</span>${delta(change7)}</div>
          <div><span class="delta-label">30 days</span>${delta(change30)}</div>
        </div>
      </div>
    ` : ''}

    <form class="card weight-log mb-16" id="weight-form">
      <div class="weight-log-row">
        <div class="weight-log-input">
          <label class="input-label" for="weight-input">Log weight</label>
          <div class="input-suffix">
            <input type="text" class="input input-lg" id="weight-input" placeholder="${latest ? formatNumber(latest.weight) : '0.0'}" inputmode="decimal" autocomplete="off">
            <span>${escapeHtml(unit)}</span>
          </div>
        </div>
        <div class="weight-log-date">
          <label class="input-label" for="weight-date">Date</label>
          <input type="date" class="input" id="weight-date" value="${todayStr()}" max="${todayStr()}">
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Save</button>
    </form>

    ${stats.length >= 2 ? `
      <section class="card mb-16">
        <div class="card-head">
          <span class="card-title">Trend</span>
          <div class="segmented sm" role="tablist">
            ${[[30, '30D'], [90, '90D'], [365, '1Y'], [0, 'All']].map(([d, l]) => `
              <button class="segment ${range === d ? 'active' : ''}" data-range="${d}" role="tab" aria-selected="${range === d}">${l}</button>
            `).join('')}
          </div>
        </div>
        ${chartData.length >= 2
          ? lineChart(chartData.map(s => ({ label: formatShortDate(s.date), value: s.weight })), { unit, height: 150 })
          : '<p class="tool-hint">Not enough entries in this range.</p>'}
      </section>
    ` : ''}

    ${stats.length > 0 ? `
      <div class="section-header">
        <h2 class="section-title">History</h2>
        <span class="section-meta">${stats.length} entries</span>
      </div>
      <div class="list-card">
        ${stats.map((s, i) => {
          const prev = stats[i + 1];
          const diff = prev ? s.weight - prev.weight : null;
          return `
          <div class="weight-row">
            <div class="weight-row-info">
              <span class="weight-row-date">${escapeHtml(formatDate(s.date))}</span>
              ${s.time ? `<span class="weight-row-time">${escapeHtml(s.time)}</span>` : ''}
            </div>
            ${diff !== null ? delta(diff) : '<span></span>'}
            <span class="weight-row-value">${formatNumber(s.weight)} <small>${escapeHtml(s.unit || unit)}</small></span>
            <button class="icon-btn sm danger weight-delete-btn" data-date="${escapeHtml(s.date)}" aria-label="Delete entry for ${escapeHtml(formatDate(s.date))}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
            </button>
          </div>`;
        }).join('')}
      </div>
    ` : `
      <div class="empty-state compact">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14l-1.5 13h-11z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>
        </div>
        <p class="empty-title">No entries yet</p>
        <p>Weigh in at the same time of day — mornings work best — for a clean trend.</p>
      </div>
    `}
  `;

  container.querySelector('#weight-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const weightInput = container.querySelector('#weight-input');
    const weight = parseDecimal(weightInput.value);
    const date = container.querySelector('#weight-date').value;

    if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) {
      showToast('Enter a valid weight', 'error');
      weightInput.focus();
      return;
    }
    if (!date) {
      showToast('Pick a date', 'error');
      return;
    }
    const replacing = stats.some(s => s.date === date);
    const time = date === todayStr() ? new Date().toTimeString().slice(0, 5) : '';
    store.addBodyStat({ date, time, weight: Math.round(weight * 10) / 10, unit });
    showToast(replacing ? 'Entry updated' : 'Weight logged');
    render(container);
  });

  container.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      range = +btn.dataset.range;
      render(container);
    });
  });

  container.querySelectorAll('.weight-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const date = btn.dataset.date;
      const entry = stats.find(s => s.date === date);
      const ok = await confirmDialog({
        title: 'Delete entry?',
        message: `Remove the weight entry for ${escapeHtml(formatDate(date))}?`,
        confirmText: 'Delete',
        danger: true
      });
      if (!ok) return;
      store.deleteBodyStat(date);
      render(container);
      showToast('Entry deleted', 'success', {
        action: {
          label: 'Undo',
          onClick: () => {
            store.addBodyStat(entry);
            render(container);
          }
        }
      });
    });
  });
}
