import { store } from '../store.js';
import {
  formatDate, formatDateFull, formatDuration, showModal, showToast, escapeHtml, parseDecimal,
  confirmDialog, todayStr, toDateStr, addDays, startOfWeek, formatNumber, formatVolume,
  capitalize, categoryColor, plural
} from '../utils.js';
import { countCompletedSets, workoutVolume, workoutTitle } from '../analytics.js';
import { startWorkoutFrom } from './workout.js';

export function progressTabs(active) {
  return `
    <div class="segmented mb-16" role="tablist" aria-label="Progress views">
      <a href="#/history" class="segment ${active === 'history' ? 'active' : ''}" role="tab" aria-selected="${active === 'history'}">History</a>
      <a href="#/stats" class="segment ${active === 'stats' ? 'active' : ''}" role="tab" aria-selected="${active === 'stats'}">Stats</a>
    </div>
  `;
}

export function historyPage(container) {
  render(container);

  // Deep link from the dashboard: #/history?w=<id>
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const linked = params.get('w');
  if (linked) {
    history.replaceState(null, '', '#/history');
    const workout = store.getWorkouts().find(w => w.id === linked);
    if (workout) showWorkoutDetail(workout, container);
  }
}

function render(container) {
  const workouts = store.getWorkouts();
  const unit = store.getSettings().weightUnit;

  if (workouts.length === 0) {
    container.innerHTML = `
      <header class="page-header"><h1 class="page-title">Progress</h1></header>
      ${progressTabs('history')}
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>
        </div>
        <p class="empty-title">No workouts yet</p>
        <p>Your completed workouts and training calendar will appear here.</p>
        <a href="#/workout" class="btn btn-primary mt-16">Start a workout</a>
      </div>
    `;
    return;
  }

  const counts = {};
  workouts.forEach(w => { counts[w.date] = (counts[w.date] || 0) + 1; });

  // Group by month, then by day
  const months = [];
  for (const w of workouts) {
    const key = w.date.slice(0, 7);
    let month = months.at(-1);
    if (!month || month.key !== key) {
      month = { key, workouts: [] };
      months.push(month);
    }
    month.workouts.push(w);
  }

  container.innerHTML = `
    <header class="page-header"><h1 class="page-title">Progress</h1></header>
    ${progressTabs('history')}

    ${renderCalendarHeatmap(counts)}

    ${months.map(m => {
      const [y, mo] = m.key.split('-').map(Number);
      const label = new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return `
        <div class="section-header">
          <h2 class="section-title">${label}</h2>
          <span class="section-meta">${plural(m.workouts.length, 'workout')}</span>
        </div>
        ${m.workouts.map(w => `
          <button class="workout-summary-card" data-workout-id="${escapeHtml(w.id)}">
            <div class="workout-summary-header">
              <span class="workout-summary-title">${escapeHtml(workoutTitle(w))}</span>
              <span class="workout-summary-date">${escapeHtml(formatDate(w.date))}</span>
            </div>
            <div class="workout-summary-meta">
              <span>${formatDuration(w.startTime, w.endTime)}</span>
              <span>${countCompletedSets(w)} sets</span>
              <span>${formatVolume(workoutVolume(w))} ${escapeHtml(unit)}</span>
            </div>
            <div class="workout-summary-exercises">
              ${(w.exercises || []).map(ex => `<span class="workout-summary-exercise">${escapeHtml(ex.name)}</span>`).join('')}
            </div>
          </button>
        `).join('')}
      `;
    }).join('')}
  `;

  container.querySelectorAll('.workout-summary-card').forEach(card => {
    card.addEventListener('click', () => {
      const workout = workouts.find(w => w.id === card.dataset.workoutId);
      if (workout) showWorkoutDetail(workout, container);
    });
  });

  // Scroll the heatmap to the most recent weeks
  const scroller = container.querySelector('.heatmap-scroll');
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;
}

function showWorkoutDetail(workout, container) {
  const unit = store.getSettings().weightUnit;
  const el = document.createElement('div');
  let editData = null;
  let close = null;

  function renderView() {
    const exercises = workout.exercises || [];
    el.innerHTML = `
      <div class="modal-header">
        <div>
          <h3 class="modal-title">${escapeHtml(workoutTitle(workout))}</h3>
          <p class="modal-subtitle">${escapeHtml(formatDateFull(workout.date))}</p>
        </div>
        <button class="modal-close" data-close aria-label="Close">&times;</button>
      </div>
      <div class="summary-stats mb-16">
        <div><span class="summary-value">${formatDuration(workout.startTime, workout.endTime)}</span><span class="summary-label">Duration</span></div>
        <div><span class="summary-value">${countCompletedSets(workout)}</span><span class="summary-label">Sets</span></div>
        <div><span class="summary-value">${formatVolume(workoutVolume(workout))}</span><span class="summary-label">Volume (${escapeHtml(unit)})</span></div>
      </div>
      ${workout.notes ? `<div class="note-box mb-16">${escapeHtml(workout.notes)}</div>` : ''}
      ${exercises.map(ex => `
        <div class="detail-exercise">
          <div class="detail-exercise-head">
            <span class="cat-dot" style="background:${categoryColor(ex.category)}"></span>
            <span class="detail-exercise-name">${escapeHtml(ex.name)}</span>
            <span class="detail-exercise-cat">${escapeHtml(capitalize(ex.category))}</span>
          </div>
          <div class="session-sets">
            ${(ex.sets || []).map((s, i) => `
              <span class="set-pill ${s.completed ? '' : 'muted'}"><b>${i + 1}</b> ${s.weight ? `${formatNumber(s.weight)} ${escapeHtml(unit)} × ` : ''}${s.reps || 0}</span>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <div class="modal-actions stacked mt-16">
        <button class="btn btn-primary btn-block" id="repeat-workout">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>
          Repeat this workout
        </button>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-block" id="edit-workout">Edit</button>
          <button class="btn btn-danger btn-block" id="delete-workout">Delete</button>
        </div>
      </div>
    `;

    el.querySelector('#repeat-workout').addEventListener('click', async () => {
      if (store.getActiveWorkout()) {
        const ok = await confirmDialog({
          title: 'Workout in progress',
          message: 'You already have an active workout. Replace it with this one?',
          confirmText: 'Replace',
          danger: true
        });
        if (!ok) return;
      }
      startWorkoutFrom({ name: workout.name, exercises: workout.exercises || [], templateId: workout.templateId });
      close();
      window.location.hash = '#/workout';
    });

    el.querySelector('#edit-workout').addEventListener('click', () => {
      editData = JSON.parse(JSON.stringify(workout));
      renderEdit();
    });

    el.querySelector('#delete-workout').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete workout?',
        message: `${escapeHtml(workoutTitle(workout))} on ${escapeHtml(formatDate(workout.date))} will be removed from your history.`,
        confirmText: 'Delete',
        danger: true
      });
      if (!ok) return;
      store.deleteWorkout(workout.id);
      render(container);
      showToast('Workout deleted', 'success', {
        action: {
          label: 'Undo',
          onClick: () => {
            store.saveWorkout(workout);
            render(container);
          }
        }
      });
    });
  }

  function renderEdit() {
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Edit Workout</h3>
        <button class="modal-close" id="edit-cancel" aria-label="Cancel editing">&times;</button>
      </div>
      <div class="input-group">
        <label class="input-label" for="edit-name">Name</label>
        <input type="text" class="input" id="edit-name" maxlength="100" value="${escapeHtml(editData.name || '')}" placeholder="Workout name">
      </div>
      <div class="input-group">
        <label class="input-label" for="edit-date">Date</label>
        <input type="date" class="input" id="edit-date" value="${escapeHtml(editData.date)}" max="${todayStr()}">
      </div>
      <div class="input-group">
        <label class="input-label" for="edit-notes">Notes</label>
        <textarea class="input" id="edit-notes" rows="2" placeholder="Workout notes">${escapeHtml(editData.notes || '')}</textarea>
      </div>
      ${(editData.exercises || []).map((ex, exIdx) => `
        <div class="detail-exercise">
          <div class="detail-exercise-head">
            <span class="cat-dot" style="background:${categoryColor(ex.category)}"></span>
            <span class="detail-exercise-name">${escapeHtml(ex.name)}</span>
            <button class="link-btn danger edit-remove-exercise" data-idx="${exIdx}">Remove</button>
          </div>
          <div class="set-header compact">
            <span>Set</span><span>${escapeHtml(unit)}</span><span>Reps</span><span></span><span></span>
          </div>
          ${(ex.sets || []).map((set, setIdx) => `
            <div class="set-row compact ${set.completed ? 'done' : ''}">
              <span class="set-number">${setIdx + 1}</span>
              <input type="text" class="input set-input edit-weight" data-ex="${exIdx}" data-set="${setIdx}"
                value="${set.weight || ''}" placeholder="0" inputmode="decimal" aria-label="Weight">
              <input type="text" class="input set-input edit-reps" data-ex="${exIdx}" data-set="${setIdx}"
                value="${set.reps || ''}" placeholder="0" inputmode="numeric" aria-label="Reps">
              <button class="set-check ${set.completed ? 'checked' : ''} edit-completed" data-ex="${exIdx}" data-set="${setIdx}" aria-pressed="${!!set.completed}" aria-label="Completed">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button class="remove-set edit-remove-set" data-ex="${exIdx}" data-set="${setIdx}" aria-label="Remove set">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          `).join('')}
          <button class="add-set-btn edit-add-set" data-ex="${exIdx}">+ Add Set</button>
        </div>
      `).join('')}
      <div class="modal-actions mt-16">
        <button class="btn btn-secondary btn-block" id="edit-cancel-btn">Cancel</button>
        <button class="btn btn-primary btn-block" id="edit-save">Save</button>
      </div>
    `;

    const cancel = () => { editData = null; renderView(); };
    el.querySelector('#edit-cancel').addEventListener('click', cancel);
    el.querySelector('#edit-cancel-btn').addEventListener('click', cancel);

    el.querySelector('#edit-name').addEventListener('input', (e) => { editData.name = e.target.value.trim(); });
    el.querySelector('#edit-date').addEventListener('change', (e) => {
      if (e.target.value) editData.date = e.target.value;
    });
    el.querySelector('#edit-notes').addEventListener('input', (e) => { editData.notes = e.target.value; });

    const idx = (t) => [parseInt(t.dataset.ex, 10), parseInt(t.dataset.set, 10)];

    el.querySelectorAll('.edit-weight').forEach(input => {
      input.addEventListener('input', () => {
        const [ex, set] = idx(input);
        const v = parseDecimal(input.value);
        editData.exercises[ex].sets[set].weight = Number.isFinite(v) ? Math.max(0, Math.min(v, 9999)) : 0;
      });
    });

    el.querySelectorAll('.edit-reps').forEach(input => {
      input.addEventListener('input', () => {
        const [ex, set] = idx(input);
        input.value = input.value.replace(/[^\d]/g, '');
        editData.exercises[ex].sets[set].reps = Math.min(parseInt(input.value, 10) || 0, 9999);
      });
    });

    el.querySelectorAll('.edit-completed').forEach(btn => {
      btn.addEventListener('click', () => {
        const [ex, set] = idx(btn);
        const s = editData.exercises[ex].sets[set];
        s.completed = !s.completed;
        btn.classList.toggle('checked', s.completed);
        btn.setAttribute('aria-pressed', s.completed);
        btn.closest('.set-row').classList.toggle('done', s.completed);
      });
    });

    el.querySelectorAll('.edit-add-set').forEach(btn => {
      btn.addEventListener('click', () => {
        const exIdx = parseInt(btn.dataset.ex, 10);
        const last = editData.exercises[exIdx].sets.at(-1);
        editData.exercises[exIdx].sets.push({ reps: last?.reps || 0, weight: last?.weight || 0, completed: true });
        renderEdit();
      });
    });

    el.querySelectorAll('.edit-remove-set').forEach(btn => {
      btn.addEventListener('click', () => {
        const [exIdx, setIdx] = idx(btn);
        const sets = editData.exercises[exIdx].sets;
        if (sets.length <= 1) {
          editData.exercises.splice(exIdx, 1);
        } else {
          sets.splice(setIdx, 1);
        }
        renderEdit();
      });
    });

    el.querySelectorAll('.edit-remove-exercise').forEach(btn => {
      btn.addEventListener('click', () => {
        editData.exercises.splice(parseInt(btn.dataset.idx, 10), 1);
        renderEdit();
      });
    });

    el.querySelector('#edit-save').addEventListener('click', () => {
      Object.assign(workout, editData);
      store.saveWorkout(workout);
      editData = null;
      showToast('Workout updated');
      render(container);
      renderView();
    });
  }

  renderView();
  close = showModal(el);
}

// ===== CALENDAR HEATMAP =====
function renderCalendarHeatmap(counts) {
  const weeks = 20;
  const today = todayStr();
  const firstMonday = addDays(startOfWeek(), -(weeks - 1) * 7);
  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', ''];

  let monthLabels = '';
  let lastMonth = -1;
  let columns = '';
  let activeDays = 0;

  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(firstMonday, w * 7);
    const m = weekStart.getMonth();
    monthLabels += `<span>${m !== lastMonth ? weekStart.toLocaleDateString('en-US', { month: 'short' }) : ''}</span>`;
    lastMonth = m;

    let cells = '';
    for (let d = 0; d < 7; d++) {
      const dateStr = toDateStr(addDays(weekStart, d));
      const count = counts[dateStr] || 0;
      if (count && dateStr <= today) activeDays++;
      const level = Math.min(count, 3);
      const cls = dateStr > today ? 'future' : dateStr === today ? 'today' : '';
      cells += `<span class="heatmap-cell ${cls}" data-level="${dateStr > today ? '' : level}" title="${escapeHtml(formatDate(dateStr))}: ${plural(count, 'workout')}"></span>`;
    }
    columns += `<div class="heatmap-col">${cells}</div>`;
  }

  return `
    <div class="card heatmap-card mb-24">
      <div class="heatmap-top">
        <span class="card-title">Training calendar</span>
        <span class="section-meta">${plural(activeDays, 'active day')} · ${weeks} weeks</span>
      </div>
      <div class="heatmap">
        <div class="heatmap-days">${dayLabels.map(d => `<span>${d}</span>`).join('')}</div>
        <div class="heatmap-scroll">
          <div class="heatmap-months">${monthLabels}</div>
          <div class="heatmap-grid">${columns}</div>
        </div>
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        <span class="heatmap-cell" data-level="0"></span>
        <span class="heatmap-cell" data-level="1"></span>
        <span class="heatmap-cell" data-level="2"></span>
        <span class="heatmap-cell" data-level="3"></span>
        <span>More</span>
      </div>
    </div>
  `;
}
