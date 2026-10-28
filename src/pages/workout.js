import { store } from '../store.js';
import {
  generateId, todayStr, showToast, showModal, formatTime, formatDurationMs, formatNumber,
  formatVolume, escapeHtml, parseDecimal, confirmDialog, promptDialog, capitalize,
  categoryColor, sounds, vibrate, formatDate, plural
} from '../utils.js';
import { globalTimer } from '../globalTimer.js';
import { refreshFloatingTimer } from '../floatingTimer.js';
import { openExercisePicker, categoryChips } from '../exercisePicker.js';
import { showExerciseProgress } from '../exerciseProgress.js';
import {
  getLastPerformance, countCompletedSets, workoutVolume, findNewPRs, defaultWorkoutName
} from '../analytics.js';

let activeWorkout = null;
let elapsedInterval = null;
let restTimerUnsubscribe = null;
// Previous-session sets per exercise name, cached per render
let previousCache = new Map();

export function workoutPage(container) {
  activeWorkout = store.getActiveWorkout();

  if (activeWorkout) {
    renderActiveWorkout(container);
  } else {
    renderWorkoutStart(container);
  }

  return () => {
    clearInterval(elapsedInterval);
    elapsedInterval = null;
    dismissRestTimer();
  };
}

// Start a workout from anywhere (dashboard, history "repeat")
export function startWorkoutFrom({ name, exercises, templateId }) {
  const workouts = store.getWorkouts();
  const built = exercises.map(ex => {
    const prev = getLastPerformance(workouts, ex.name);
    const count = ex.targetSets || ex.sets?.length || prev?.length || 3;
    return {
      name: ex.name,
      category: ex.category,
      sets: Array.from({ length: count }, (_, i) => ({
        weight: 0,
        reps: ex.targetReps || ex.sets?.[i]?.reps || 0,
        completed: false
      }))
    };
  });
  startNewWorkout(built, name, templateId);
}

function saveActive() {
  store.setActiveWorkout(activeWorkout);
}

// ===== START SCREEN =====

function renderWorkoutStart(container) {
  const templates = store.getTemplates();
  const workouts = store.getWorkouts();

  const lastDone = (tpl) => {
    const w = workouts.find(x => x.templateId === tpl.id);
    if (!w) return 'Not done yet';
    const d = formatDate(w.date);
    return `Last done ${d === 'Today' || d === 'Yesterday' ? d.toLowerCase() : d}`;
  };

  container.innerHTML = `
    <header class="page-header">
      <h1 class="page-title">Workout</h1>
    </header>

    <button class="start-card mb-24" id="start-empty">
      <span class="start-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </span>
      <span class="start-card-text">
        <span class="start-card-title">Start empty workout</span>
        <span class="start-card-desc">Add exercises as you go</span>
      </span>
      <svg class="start-card-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
    </button>

    <div class="section-header">
      <h2 class="section-title">Templates</h2>
      <button class="link-btn" id="create-template">+ New template</button>
    </div>

    ${templates.length > 0 ? `
      <div class="template-list">
        ${templates.map(t => `
          <div class="template-card" data-template="${escapeHtml(t.id)}">
            <div class="template-card-main">
              <div class="template-name">${escapeHtml(t.name)}</div>
              <div class="template-meta">${plural(t.exercises.length, 'exercise')} · ${escapeHtml(lastDone(t))}</div>
              <div class="template-exercises">${t.exercises.map(e => escapeHtml(e.name)).join(' · ')}</div>
            </div>
            <div class="template-actions">
              <button class="btn btn-primary btn-sm start-template" data-id="${escapeHtml(t.id)}">Start</button>
              <button class="icon-btn edit-template" data-id="${escapeHtml(t.id)}" aria-label="Edit ${escapeHtml(t.name)}">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              </button>
              <button class="icon-btn danger delete-template" data-id="${escapeHtml(t.id)}" aria-label="Delete ${escapeHtml(t.name)}">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `
      <div class="empty-state compact">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
        </div>
        <p class="empty-title">No templates yet</p>
        <p>Save routines like “Push Day” to start them in one tap.</p>
        <button class="btn btn-secondary mt-16" id="create-template-empty">Create template</button>
      </div>
    `}
  `;

  container.querySelector('#start-empty').addEventListener('click', () => {
    startNewWorkout([]);
    renderActiveWorkout(container);
  });

  const openCreator = () => showTemplateEditor(container);
  container.querySelector('#create-template').addEventListener('click', openCreator);
  container.querySelector('#create-template-empty')?.addEventListener('click', openCreator);

  container.querySelectorAll('.start-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const tpl = templates.find(t => t.id === btn.dataset.id);
      if (!tpl) return;
      startWorkoutFrom({ name: tpl.name, exercises: tpl.exercises, templateId: tpl.id });
      renderActiveWorkout(container);
    });
  });

  container.querySelectorAll('.edit-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const tpl = templates.find(t => t.id === btn.dataset.id);
      if (tpl) showTemplateEditor(container, tpl);
    });
  });

  container.querySelectorAll('.delete-template').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tpl = templates.find(t => t.id === btn.dataset.id);
      if (!tpl) return;
      const ok = await confirmDialog({
        title: 'Delete template?',
        message: `“${escapeHtml(tpl.name)}” will be deleted. Workouts you already logged are kept.`,
        confirmText: 'Delete',
        danger: true
      });
      if (!ok) return;
      store.deleteTemplate(tpl.id);
      renderWorkoutStart(container);
      showToast('Template deleted', 'success', {
        action: {
          label: 'Undo',
          onClick: () => {
            store.saveTemplate(tpl);
            renderWorkoutStart(container);
          }
        }
      });
    });
  });
}

function startNewWorkout(exercises, name, templateId) {
  activeWorkout = {
    id: generateId('w_'),
    name: name || defaultWorkoutName(),
    templateId: templateId || null,
    date: todayStr(),
    startTime: new Date().toISOString(),
    endTime: null,
    exercises,
    notes: ''
  };
  saveActive();
}

// ===== ACTIVE WORKOUT =====

function renderActiveWorkout(container) {
  const settings = store.getSettings();
  const workouts = store.getWorkouts();
  previousCache = new Map();
  for (const ex of activeWorkout.exercises) {
    previousCache.set(ex.name.toLowerCase(), getLastPerformance(workouts, ex.name));
  }

  container.innerHTML = `
    <div class="workout-head">
      <div class="workout-head-info">
        <button class="workout-name" id="rename-workout" aria-label="Rename workout">
          <span id="workout-name-text">${escapeHtml(activeWorkout.name || 'Workout')}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        </button>
        <div class="workout-meta">
          <span class="live-dot" aria-hidden="true"></span>
          <span id="elapsed-time" class="tabular">00:00</span>
          <span class="meta-sep">·</span>
          <span id="set-progress"></span>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-finish">Finish</button>
    </div>
    <div class="progress-bar mb-16" aria-hidden="true"><div class="progress-fill" id="workout-progress"></div></div>

    <div id="exercises-list"></div>

    <button class="add-exercise-btn" id="btn-add-exercise">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      Add Exercise
    </button>

    <div class="input-group mt-24">
      <label class="input-label" for="workout-notes">Notes</label>
      <textarea class="input" id="workout-notes" rows="2" placeholder="How did it feel? Anything to remember next time?">${escapeHtml(activeWorkout.notes || '')}</textarea>
    </div>

    <button class="btn btn-ghost-danger btn-block" id="btn-discard">Discard workout</button>
  `;

  renderExercises(container, settings);
  // Delegated once on the list container, which survives re-renders
  bindExerciseEvents(container, container.querySelector('#exercises-list'), settings);
  startElapsedTimer(container);

  container.querySelector('#btn-add-exercise').addEventListener('click', () => {
    openExercisePicker({
      exclude: activeWorkout.exercises.map(e => e.name),
      onPick: ({ name, category }) => addExerciseToWorkout(name, category, container, settings)
    });
  });

  container.querySelector('#rename-workout').addEventListener('click', async () => {
    const name = await promptDialog({
      title: 'Rename workout',
      value: activeWorkout.name || '',
      placeholder: 'e.g. Push Day'
    });
    if (!name) return;
    activeWorkout.name = name;
    saveActive();
    container.querySelector('#workout-name-text').textContent = name;
  });

  container.querySelector('#btn-finish').addEventListener('click', () => finishWorkout(container));

  container.querySelector('#btn-discard').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Discard workout?',
      message: 'All sets logged in this workout will be lost.',
      confirmText: 'Discard',
      danger: true
    });
    if (!ok) return;
    discardActive();
    showToast('Workout discarded');
    renderWorkoutStart(container);
  });

  container.querySelector('#workout-notes').addEventListener('input', (e) => {
    activeWorkout.notes = e.target.value;
    saveActive();
  });
}

function discardActive() {
  store.clearActiveWorkout();
  activeWorkout = null;
  clearInterval(elapsedInterval);
  dismissRestTimer();
  if (globalTimer.mode === 'rest') globalTimer.stop();
}

function formatPrev(set) {
  if (!set) return '—';
  if (set.weight) return `${formatNumber(set.weight)}×${set.reps || 0}`;
  return set.reps ? `${set.reps} reps` : '—';
}

function renderExercises(container, settings) {
  const list = container.querySelector('#exercises-list');
  if (!list) return;
  const unit = settings.weightUnit;

  if (activeWorkout.exercises.length === 0) {
    list.innerHTML = `
      <div class="empty-state compact">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6.5 6.5h11M6.5 17.5h11M6 12h12"/><rect x="2" y="5" width="4" height="14" rx="1.5"/><rect x="18" y="5" width="4" height="14" rx="1.5"/></svg>
        </div>
        <p class="empty-title">Let's get moving</p>
        <p>Add your first exercise to start logging sets.</p>
      </div>
    `;
    updateProgress(container);
    return;
  }

  list.innerHTML = activeWorkout.exercises.map((ex, exIdx) => {
    const prev = previousCache.get(ex.name.toLowerCase()) || null;
    const done = ex.sets.filter(s => s.completed).length;
    return `
    <section class="exercise-block ${done === ex.sets.length && done > 0 ? 'all-done' : ''}" data-exercise="${exIdx}">
      <div class="exercise-block-header">
        <span class="cat-bar" style="background:${categoryColor(ex.category)}" aria-hidden="true"></span>
        <div class="exercise-title-wrap">
          <h3 class="exercise-block-name">${escapeHtml(ex.name)}</h3>
          <span class="exercise-block-category">${escapeHtml(capitalize(ex.category))}</span>
        </div>
        <span class="exercise-done-count" data-count="${exIdx}">${done}/${ex.sets.length}</span>
        <button class="icon-btn exercise-menu" data-ex="${exIdx}" aria-label="Options for ${escapeHtml(ex.name)}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
        </button>
      </div>
      <div class="set-table" role="table" aria-label="${escapeHtml(ex.name)} sets">
        <div class="set-header" role="row">
          <span role="columnheader">Set</span>
          <span role="columnheader">Previous</span>
          <span role="columnheader">${escapeHtml(unit)}</span>
          <span role="columnheader">Reps</span>
          <span role="columnheader"><span class="sr-only">Done</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <span></span>
        </div>
        ${ex.sets.map((set, setIdx) => {
          const p = prev?.[setIdx] || null;
          return `
          <div class="set-row ${set.completed ? 'done' : ''}" role="row" data-row="${exIdx}-${setIdx}">
            <span class="set-number">${setIdx + 1}</span>
            <button class="set-prev" data-ex="${exIdx}" data-set="${setIdx}" ${p ? '' : 'disabled'}
              aria-label="${p ? `Use previous: ${formatPrev(p)}` : 'No previous set'}">${formatPrev(p)}</button>
            <input type="text" class="input set-input set-weight" data-ex="${exIdx}" data-set="${setIdx}"
              value="${set.weight || ''}" placeholder="${p?.weight ? formatNumber(p.weight) : '0'}"
              inputmode="decimal" autocomplete="off" aria-label="Set ${setIdx + 1} weight">
            <input type="text" class="input set-input set-reps" data-ex="${exIdx}" data-set="${setIdx}"
              value="${set.reps || ''}" placeholder="${p?.reps || '0'}"
              inputmode="numeric" autocomplete="off" aria-label="Set ${setIdx + 1} reps">
            <button class="set-check ${set.completed ? 'checked' : ''}" data-ex="${exIdx}" data-set="${setIdx}"
              aria-pressed="${set.completed}" aria-label="Mark set ${setIdx + 1} done">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button class="remove-set" data-ex="${exIdx}" data-set="${setIdx}" aria-label="Remove set ${setIdx + 1}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>`;
        }).join('')}
      </div>
      <button class="add-set-btn" data-ex="${exIdx}">+ Add Set</button>
    </section>
  `;
  }).join('');

  updateProgress(container);
}

function bindExerciseEvents(container, list, settings) {
  const getIdx = (el) => [parseInt(el.dataset.ex, 10), parseInt(el.dataset.set, 10)];

  // Save as the user types so nothing is lost if the app is closed
  list.addEventListener('input', (e) => {
    const input = e.target;
    if (!input.classList.contains('set-input')) return;
    const [ex, set] = getIdx(input);
    const target = activeWorkout.exercises[ex]?.sets[set];
    if (!target) return;
    if (input.classList.contains('set-weight')) {
      const val = parseDecimal(input.value);
      target.weight = Number.isFinite(val) ? Math.max(0, Math.min(val, 9999)) : 0;
    } else {
      input.value = input.value.replace(/[^\d]/g, '');
      target.reps = Math.max(0, Math.min(parseInt(input.value, 10) || 0, 9999));
    }
    saveActive();
  });

  // Normalise the displayed value once editing is done
  list.addEventListener('change', (e) => {
    const input = e.target;
    if (!input.classList.contains('set-input')) return;
    const [ex, set] = getIdx(input);
    const target = activeWorkout.exercises[ex]?.sets[set];
    if (!target) return;
    const val = input.classList.contains('set-weight') ? target.weight : target.reps;
    input.value = val ? formatNumber(val, 2).replace(/,/g, '') : '';
  });

  // Enter moves to the next field
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.classList.contains('set-input')) return;
    e.preventDefault();
    const inputs = [...list.querySelectorAll('.set-input')];
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) next.focus();
    else e.target.blur();
  });

  list.addEventListener('click', (e) => {
    const check = e.target.closest('.set-check');
    if (check) {
      toggleSet(container, settings, ...getIdx(check));
      return;
    }

    const prevBtn = e.target.closest('.set-prev');
    if (prevBtn) {
      const [ex, set] = getIdx(prevBtn);
      const exercise = activeWorkout.exercises[ex];
      const p = previousCache.get(exercise.name.toLowerCase())?.[set];
      if (!p) return;
      exercise.sets[set].weight = p.weight || 0;
      exercise.sets[set].reps = p.reps || 0;
      saveActive();
      const row = list.querySelector(`[data-row="${ex}-${set}"]`);
      row.querySelector('.set-weight').value = p.weight ? formatNumber(p.weight, 2).replace(/,/g, '') : '';
      row.querySelector('.set-reps').value = p.reps || '';
      return;
    }

    const addSet = e.target.closest('.add-set-btn');
    if (addSet) {
      const exIdx = parseInt(addSet.dataset.ex, 10);
      const sets = activeWorkout.exercises[exIdx].sets;
      const last = sets.at(-1);
      sets.push({ reps: last?.reps || 0, weight: last?.weight || 0, completed: false });
      saveActive();
      renderExercises(container, settings);
      return;
    }

    const removeSet = e.target.closest('.remove-set');
    if (removeSet) {
      const [exIdx, setIdx] = getIdx(removeSet);
      const exercise = activeWorkout.exercises[exIdx];
      if (exercise.sets.length <= 1) {
        removeExercise(container, settings, exIdx);
        return;
      }
      exercise.sets.splice(setIdx, 1);
      saveActive();
      renderExercises(container, settings);
      return;
    }

    const menu = e.target.closest('.exercise-menu');
    if (menu) {
      showExerciseMenu(container, settings, parseInt(menu.dataset.ex, 10));
    }
  });
}

function toggleSet(container, settings, exIdx, setIdx) {
  const exercise = activeWorkout.exercises[exIdx];
  const set = exercise?.sets[setIdx];
  if (!set) return;
  const row = container.querySelector(`[data-row="${exIdx}-${setIdx}"]`);

  if (!set.completed) {
    // Fill empty fields from what the placeholders suggest (last session)
    const p = previousCache.get(exercise.name.toLowerCase())?.[setIdx];
    if (!set.weight && p?.weight) {
      set.weight = p.weight;
      row.querySelector('.set-weight').value = formatNumber(p.weight, 2).replace(/,/g, '');
    }
    if (!set.reps && p?.reps) {
      set.reps = p.reps;
      row.querySelector('.set-reps').value = p.reps;
    }
    if (!set.reps && !set.weight) {
      showToast('Enter reps or weight first', 'error');
      row.querySelector('.set-reps').focus();
      return;
    }
  }

  set.completed = !set.completed;
  saveActive();

  row.classList.toggle('done', set.completed);
  const btn = row.querySelector('.set-check');
  btn.classList.toggle('checked', set.completed);
  btn.setAttribute('aria-pressed', set.completed);

  const done = exercise.sets.filter(s => s.completed).length;
  const countEl = container.querySelector(`[data-count="${exIdx}"]`);
  if (countEl) countEl.textContent = `${done}/${exercise.sets.length}`;
  container.querySelector(`[data-exercise="${exIdx}"]`)
    ?.classList.toggle('all-done', done === exercise.sets.length);
  updateProgress(container);

  if (set.completed) {
    vibrate(15);
    if (settings.autoRestTimer !== false) {
      showRestTimerPopup(settings.defaultRestTime || 90);
    }
  }
}

function updateProgress(container) {
  const total = activeWorkout.exercises.reduce((a, e) => a + e.sets.length, 0);
  const done = countCompletedSets(activeWorkout);
  const progressEl = container.querySelector('#set-progress');
  if (progressEl) progressEl.textContent = `${done}/${total} sets`;
  const fill = container.querySelector('#workout-progress');
  if (fill) fill.style.width = `${total ? (done / total) * 100 : 0}%`;
}

function removeExercise(container, settings, exIdx) {
  const [removed] = activeWorkout.exercises.splice(exIdx, 1);
  saveActive();
  renderExercises(container, settings);
  showToast(`${removed.name} removed`, 'success', {
    action: {
      label: 'Undo',
      onClick: () => {
        if (!activeWorkout) return;
        activeWorkout.exercises.splice(exIdx, 0, removed);
        saveActive();
        renderExercises(container, settings);
      }
    }
  });
}

function showExerciseMenu(container, settings, exIdx) {
  const ex = activeWorkout.exercises[exIdx];
  const last = activeWorkout.exercises.length - 1;
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${escapeHtml(ex.name)}</h3>
      <button class="modal-close" data-close aria-label="Close">&times;</button>
    </div>
    <div class="action-list">
      <button class="action-item" data-act="progress">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>
        View progress
      </button>
      <button class="action-item" data-act="up" ${exIdx === 0 ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        Move up
      </button>
      <button class="action-item" data-act="down" ${exIdx === last ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        Move down
      </button>
      <button class="action-item" data-act="category">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>
        Change muscle group
      </button>
      <button class="action-item danger" data-act="remove">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
        Remove exercise
      </button>
    </div>
  `;
  const close = showModal(el);

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'progress') {
      showExerciseProgress(ex.name);
      return;
    }
    if (act === 'category') {
      showCategoryPicker(exIdx, container, settings);
      return;
    }
    close();
    if (act === 'remove') {
      removeExercise(container, settings, exIdx);
    } else if (act === 'up' || act === 'down') {
      const to = act === 'up' ? exIdx - 1 : exIdx + 1;
      const list = activeWorkout.exercises;
      [list[exIdx], list[to]] = [list[to], list[exIdx]];
      saveActive();
      renderExercises(container, settings);
    }
  });
}

function showCategoryPicker(exIdx, container, settings) {
  const ex = activeWorkout.exercises[exIdx];
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Muscle group</h3>
      <button class="modal-close" data-close aria-label="Close">&times;</button>
    </div>
    <p class="modal-text">Applies to <strong>${escapeHtml(ex.name)}</strong> everywhere, including past workouts.</p>
    <div class="chip-group">${categoryChips(ex.category)}</div>
  `;
  const close = showModal(el);

  el.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-pick-cat]');
    if (!chip) return;
    const category = chip.dataset.pickCat;
    activeWorkout.exercises.forEach(x => {
      if (x.name.toLowerCase() === ex.name.toLowerCase()) x.category = category;
    });
    saveActive();
    store.updateCustomExercise({ name: ex.name, category });
    renderExercises(container, settings);
    close();
    showToast(`Moved to ${capitalize(category)}`);
  });
}

function addExerciseToWorkout(name, category, container, settings) {
  const prev = getLastPerformance(store.getWorkouts(), name);
  previousCache.set(name.toLowerCase(), prev);
  const count = prev?.length || 3;
  activeWorkout.exercises.push({
    name,
    category,
    sets: Array.from({ length: count }, () => ({ reps: 0, weight: 0, completed: false }))
  });
  saveActive();
  renderExercises(container, settings);
  // Bring the new exercise into view
  const blocks = container.querySelectorAll('.exercise-block');
  blocks[blocks.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===== FINISH =====

async function finishWorkout(container) {
  const total = activeWorkout.exercises.reduce((a, e) => a + e.sets.length, 0);
  const done = countCompletedSets(activeWorkout);

  if (done === 0) {
    const ok = await confirmDialog({
      title: 'No sets completed',
      message: 'Check off at least one set to save this workout. Discard it instead?',
      confirmText: 'Discard workout',
      cancelText: 'Keep going',
      danger: true
    });
    if (ok) {
      discardActive();
      showToast('Workout discarded');
      renderWorkoutStart(container);
    }
    return;
  }

  if (done < total) {
    const ok = await confirmDialog({
      title: 'Finish workout?',
      message: `${plural(total - done, 'set')} ${total - done === 1 ? 'isn’t' : 'aren’t'} checked off and won’t be saved.`,
      confirmText: 'Finish',
      cancelText: 'Keep going'
    });
    if (!ok) return;
  }

  const previous = store.getWorkouts();
  const workout = {
    ...activeWorkout,
    endTime: new Date().toISOString(),
    exercises: activeWorkout.exercises
      .map(ex => ({ ...ex, sets: ex.sets.filter(s => s.completed) }))
      .filter(ex => ex.sets.length > 0)
  };
  store.saveWorkout(workout);
  discardActive();
  sounds.success();
  vibrate([30, 60, 30]);

  const prs = findNewPRs(workout, previous);
  const volume = workoutVolume(workout);
  const unit = store.getSettings().weightUnit;
  const duration = formatDurationMs(new Date(workout.endTime) - new Date(workout.startTime));

  renderWorkoutStart(container);

  const el = document.createElement('div');
  el.innerHTML = `
    <div class="finish-summary">
      <div class="finish-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>
      </div>
      <h3 class="modal-title">Workout complete!</h3>
      <p class="text-muted mb-16">${escapeHtml(workout.name || '')}</p>
      <div class="summary-stats">
        <div><span class="summary-value">${duration}</span><span class="summary-label">Duration</span></div>
        <div><span class="summary-value">${done}</span><span class="summary-label">Sets</span></div>
        <div><span class="summary-value">${formatVolume(volume)}</span><span class="summary-label">Volume (${escapeHtml(unit)})</span></div>
      </div>
      ${prs.length ? `
        <div class="pr-list">
          <p class="section-title">New personal records</p>
          ${prs.map(pr => `
            <div class="pr-item">
              <span class="pr-icon" aria-hidden="true">★</span>
              <span class="pr-name">${escapeHtml(pr.name)}</span>
              <span class="pr-value">${formatNumber(pr.weight)} ${escapeHtml(unit)}</span>
              <span class="pr-prev">was ${formatNumber(pr.previous)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="modal-actions">
        ${workout.templateId ? '' : '<button class="btn btn-secondary btn-block" id="finish-save-template">Save as template</button>'}
        <button class="btn btn-primary btn-block" data-close>Done</button>
      </div>
    </div>
  `;
  showModal(el);

  el.querySelector('#finish-save-template')?.addEventListener('click', async () => {
    const name = await promptDialog({
      title: 'Save as template',
      label: 'Template name',
      value: workout.name || '',
      placeholder: 'e.g. Push Day'
    });
    if (!name) return;
    store.saveTemplate({
      id: generateId('t_'),
      name,
      exercises: workout.exercises.map(ex => ({
        name: ex.name,
        category: ex.category,
        targetSets: ex.sets.length,
        targetReps: ex.sets[0]?.reps || 10
      }))
    });
    showToast('Template saved');
    renderWorkoutStart(container);
  });
}

function startElapsedTimer(container) {
  clearInterval(elapsedInterval);
  const el = container.querySelector('#elapsed-time');
  if (!el) return;
  const start = new Date(activeWorkout.startTime).getTime();
  const update = () => { el.textContent = formatTime((Date.now() - start) / 1000); };
  update();
  elapsedInterval = setInterval(update, 1000);
}

// ===== TEMPLATE EDITOR =====

function showTemplateEditor(container, existing = null) {
  let name = existing?.name || '';
  const items = (existing?.exercises || []).map(ex => ({
    name: ex.name,
    category: ex.category,
    targetSets: ex.targetSets || 3,
    targetReps: ex.targetReps || 10
  }));

  function render() {
    container.innerHTML = `
      <header class="page-header">
        <button class="icon-btn" id="tpl-cancel" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 class="page-title">${existing ? 'Edit Template' : 'New Template'}</h1>
      </header>

      <div class="input-group">
        <label class="input-label" for="tpl-name">Template name</label>
        <input type="text" class="input" id="tpl-name" placeholder="e.g. Push Day" maxlength="100" value="${escapeHtml(name)}" autocomplete="off">
      </div>

      <div id="tpl-exercises-list">
        ${items.map((ex, i) => `
          <div class="tpl-item">
            <span class="cat-bar" style="background:${categoryColor(ex.category)}" aria-hidden="true"></span>
            <div class="tpl-item-main">
              <div class="tpl-item-head">
                <div>
                  <div class="exercise-block-name">${escapeHtml(ex.name)}</div>
                  <div class="exercise-block-category">${escapeHtml(capitalize(ex.category))}</div>
                </div>
                <div class="tpl-item-tools">
                  <button class="icon-btn sm" data-move="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 15l-6-6-6 6"/></svg>
                  </button>
                  <button class="icon-btn sm" data-move="down" data-i="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move down">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <button class="icon-btn sm danger" data-remove="${i}" aria-label="Remove ${escapeHtml(ex.name)}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
              <div class="tpl-steppers">
                ${stepper('Sets', 'targetSets', i, ex.targetSets)}
                ${stepper('Reps', 'targetReps', i, ex.targetReps)}
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <button class="add-exercise-btn mb-16" id="tpl-add-exercise">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Add Exercise
      </button>

      <button class="btn btn-primary btn-lg btn-block" id="tpl-save" ${items.length ? '' : 'disabled'}>
        ${existing ? 'Save Changes' : 'Save Template'}
      </button>
    `;

    const nameInput = container.querySelector('#tpl-name');
    nameInput.addEventListener('input', () => { name = nameInput.value; });

    container.querySelector('#tpl-cancel').addEventListener('click', () => renderWorkoutStart(container));

    container.querySelector('#tpl-add-exercise').addEventListener('click', () => {
      openExercisePicker({
        exclude: items.map(e => e.name),
        onPick: (ex) => {
          const prev = getLastPerformance(store.getWorkouts(), ex.name);
          items.push({
            ...ex,
            targetSets: prev?.length || 3,
            targetReps: prev?.[0]?.reps || 10
          });
          render();
        }
      });
    });

    container.querySelectorAll('[data-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        const field = btn.dataset.field;
        const max = field === 'targetSets' ? 20 : 100;
        items[i][field] = Math.max(1, Math.min(max, items[i][field] + parseInt(btn.dataset.step, 10)));
        btn.closest('.stepper').querySelector('.stepper-value').textContent = items[i][field];
      });
    });

    container.querySelectorAll('[data-move]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        const to = btn.dataset.move === 'up' ? i - 1 : i + 1;
        [items[i], items[to]] = [items[to], items[i]];
        render();
      });
    });

    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        items.splice(parseInt(btn.dataset.remove, 10), 1);
        render();
      });
    });

    container.querySelector('#tpl-save').addEventListener('click', () => {
      const finalName = name.trim().slice(0, 100);
      if (!finalName) {
        showToast('Give your template a name', 'error');
        nameInput.focus();
        return;
      }
      store.saveTemplate({
        id: existing?.id || generateId('t_'),
        name: finalName,
        exercises: items.map(ex => ({
          name: ex.name,
          category: ex.category,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps
        }))
      });
      showToast(existing ? 'Template updated' : 'Template saved');
      renderWorkoutStart(container);
    });
  }

  render();
}

function stepper(label, field, i, value) {
  return `
    <div class="stepper">
      <span class="stepper-label">${label}</span>
      <button class="stepper-btn" data-step="-1" data-field="${field}" data-i="${i}" aria-label="Decrease ${label.toLowerCase()}">−</button>
      <span class="stepper-value">${value}</span>
      <button class="stepper-btn" data-step="1" data-field="${field}" data-i="${i}" aria-label="Increase ${label.toLowerCase()}">+</button>
    </div>
  `;
}

// ===== REST TIMER POPUP =====

function showRestTimerPopup(seconds) {
  dismissRestTimer(true);
  globalTimer.startRest(seconds);

  const popup = document.createElement('div');
  popup.id = 'rest-timer-popup';
  popup.className = 'rest-timer-popup';
  popup.setAttribute('role', 'timer');
  popup.setAttribute('aria-label', 'Rest timer');
  popup.innerHTML = `
    <div class="rest-timer-bar"><div class="rest-timer-fill" id="rest-fill"></div></div>
    <div class="rest-timer-body">
      <button class="rest-adjust" data-adjust="-15" aria-label="Subtract 15 seconds">−15</button>
      <div class="rest-timer-center">
        <span class="rest-timer-title">Rest</span>
        <span class="rest-timer-time" id="rest-time">${formatTime(seconds)}</span>
      </div>
      <button class="rest-adjust" data-adjust="15" aria-label="Add 15 seconds">+15</button>
      <button class="btn btn-primary btn-sm" id="rest-skip">Skip</button>
      <button class="icon-btn sm" id="rest-dismiss" aria-label="Hide rest timer">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    </div>
  `;
  document.body.appendChild(popup);
  document.body.classList.add('has-floating-timer');
  requestAnimationFrame(() => popup.classList.add('visible'));
  refreshFloatingTimer();

  const timeEl = popup.querySelector('#rest-time');
  const fillEl = popup.querySelector('#rest-fill');

  restTimerUnsubscribe = globalTimer.subscribe((state) => {
    if (!state.isActive || state.mode !== 'rest') {
      dismissRestTimer();
      return;
    }
    timeEl.textContent = formatTime(state.timeLeft);
    fillEl.style.transform = `scaleX(${Math.max(0, state.progress)})`;
    popup.classList.toggle('urgent', state.timeLeft <= 5);
  });

  popup.querySelector('#rest-dismiss').addEventListener('click', () => dismissRestTimer());
  popup.querySelector('#rest-skip').addEventListener('click', () => {
    globalTimer.stop();
  });
  popup.querySelectorAll('[data-adjust]').forEach(btn => {
    btn.addEventListener('click', () => {
      globalTimer.addTime(parseInt(btn.dataset.adjust, 10));
    });
  });
}

// `replacing` skips the floating-timer refresh while a new popup is coming
function dismissRestTimer(replacing = false) {
  if (restTimerUnsubscribe) {
    restTimerUnsubscribe();
    restTimerUnsubscribe = null;
  }
  const popup = document.getElementById('rest-timer-popup');
  if (popup) {
    popup.removeAttribute('id');
    popup.classList.remove('visible');
    setTimeout(() => popup.remove(), 250);
  }
  if (!replacing) {
    document.body.classList.remove('has-floating-timer');
    refreshFloatingTimer();
  }
}
