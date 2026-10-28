// Per-exercise progress sheet (chart, bests, session history)
import { store } from './store.js';
import { showModal, escapeHtml, formatNumber, formatShortDate, formatDate, formatVolume, categoryColor } from './utils.js';
import { getExerciseHistory } from './analytics.js';
import { lineChart } from './charts.js';

export function showExerciseProgress(initialName = null) {
  const workouts = store.getWorkouts();
  const unit = store.getSettings().weightUnit;

  // Exercises with at least one completed set, most-used first
  const usage = new Map();
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      if (!(ex.sets || []).some(s => s.completed)) continue;
      const key = ex.name.toLowerCase();
      const entry = usage.get(key) || { name: ex.name, category: ex.category, count: 0 };
      entry.count++;
      usage.set(key, entry);
    }
  }
  const names = [...usage.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const el = document.createElement('div');
  let metric = 'e1rm';
  let selected = initialName;

  function render() {
    if (!selected) {
      el.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">Exercise Progress</h3>
          <button class="modal-close" data-close aria-label="Close">&times;</button>
        </div>
        ${names.length === 0 ? `
          <div class="empty-state compact">
            <p class="empty-title">No data yet</p>
            <p>Complete a few workouts to see your progress here.</p>
          </div>
        ` : `
          <p class="modal-text">Pick an exercise to see how it's trending.</p>
          <div class="picker-list">
            ${names.map(n => `
              <div class="picker-item" role="button" tabindex="0" data-name="${escapeHtml(n.name)}">
                <span class="cat-dot lg" style="background:${categoryColor(n.category)}"></span>
                <div class="picker-item-text">
                  <div class="picker-item-name">${escapeHtml(n.name)}</div>
                  <div class="picker-item-meta">${n.count} session${n.count !== 1 ? 's' : ''}</div>
                </div>
                <svg class="picker-item-add" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg>
              </div>
            `).join('')}
          </div>
        `}
      `;
      return;
    }

    const history = getExerciseHistory(workouts, selected);
    const back = names.length > 1 || !initialName
      ? `<button class="icon-btn" id="progress-back" aria-label="All exercises">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>`
      : '';

    if (history.length === 0) {
      el.innerHTML = `
        <div class="modal-header">
          ${back}
          <h3 class="modal-title">${escapeHtml(selected)}</h3>
          <button class="modal-close" data-close aria-label="Close">&times;</button>
        </div>
        <div class="empty-state compact">
          <p class="empty-title">No completed sets yet</p>
          <p>Finish a workout with this exercise to start tracking it.</p>
        </div>
      `;
      return;
    }

    const bestWeight = Math.max(...history.map(h => h.maxWeight));
    const bestE1rm = Math.max(...history.map(h => h.e1rm));
    const totalVol = history.reduce((a, h) => a + h.volume, 0);
    const bodyweight = bestWeight === 0;
    if (bodyweight) metric = 'reps';

    const chronological = history.slice(0, 20).reverse();
    const metricValue = (h) => metric === 'e1rm' ? h.e1rm : metric === 'weight' ? h.maxWeight : metric === 'reps' ? h.maxReps : h.volume;

    el.innerHTML = `
      <div class="modal-header">
        ${back}
        <h3 class="modal-title">${escapeHtml(selected)}</h3>
        <button class="modal-close" data-close aria-label="Close">&times;</button>
      </div>

      <div class="mini-stats mb-16">
        ${bodyweight ? `
          <div class="mini-stat"><span class="mini-stat-value">${Math.max(...history.map(h => h.maxReps))}</span><span class="mini-stat-label">Best reps</span></div>
        ` : `
          <div class="mini-stat"><span class="mini-stat-value">${formatNumber(bestWeight)}</span><span class="mini-stat-label">Best ${escapeHtml(unit)}</span></div>
          <div class="mini-stat"><span class="mini-stat-value">${formatNumber(bestE1rm, 0)}</span><span class="mini-stat-label">Est. 1RM</span></div>
        `}
        <div class="mini-stat"><span class="mini-stat-value">${history.length}</span><span class="mini-stat-label">Sessions</span></div>
        ${bodyweight ? '' : `<div class="mini-stat"><span class="mini-stat-value">${formatVolume(totalVol)}</span><span class="mini-stat-label">Volume</span></div>`}
      </div>

      ${chronological.length >= 2 ? `
        ${bodyweight ? '' : `
          <div class="segmented sm mb-12" role="tablist">
            ${[['e1rm', 'Est. 1RM'], ['weight', 'Top weight'], ['volume', 'Volume']].map(([id, label]) => `
              <button class="segment ${metric === id ? 'active' : ''}" data-metric="${id}" role="tab" aria-selected="${metric === id}">${label}</button>
            `).join('')}
          </div>
        `}
        <div class="card chart-card mb-16">
          ${lineChart(chronological.map(h => ({ label: formatShortDate(h.date), value: metricValue(h) })), {
            unit: metric === 'reps' ? 'reps' : unit,
            decimals: metric === 'volume' ? 0 : 1
          })}
        </div>
      ` : '<p class="modal-text">Log this exercise once more to see a trend chart.</p>'}

      <p class="section-title">History</p>
      <div class="session-list">
        ${history.map(h => `
          <div class="session-item">
            <div class="session-head">
              <span class="session-date">${escapeHtml(formatDate(h.date))}</span>
              ${h.maxWeight === bestWeight && !bodyweight ? '<span class="badge badge-accent">Best</span>' : ''}
            </div>
            <div class="session-sets">
              ${h.sets.map(s => `<span class="set-pill">${s.weight ? `${formatNumber(s.weight)}×` : ''}${s.reps || 0}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  render();
  showModal(el);

  el.addEventListener('click', (e) => {
    const item = e.target.closest('.picker-item[data-name]');
    if (item) {
      selected = item.dataset.name;
      metric = 'e1rm';
      render();
      el.closest('.modal')?.scrollTo(0, 0);
      return;
    }
    if (e.target.closest('#progress-back')) {
      selected = null;
      render();
      return;
    }
    const m = e.target.closest('[data-metric]');
    if (m) {
      metric = m.dataset.metric;
      render();
    }
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.picker-item')) e.target.click();
  });
}

