import { store } from '../store.js';
import { exercises as exerciseDB, categories } from '../data/exercises.js';
import { generateId, todayStr, showToast, showModal, formatTime, playBeep, playTripleBeep, escapeHtml } from '../utils.js';
import { globalTimer } from '../globalTimer.js';

let activeWorkout = null;
let elapsedInterval = null;
let startTimestamp = null;
let restTimerInterval = null;
let restTimerUnsubscribe = null;

export function workoutPage(container) {
  activeWorkout = store.getActiveWorkout();

  if (activeWorkout) {
    renderActiveWorkout(container);
  } else {
    renderWorkoutStart(container);
  }

  return () => {
    clearInterval(elapsedInterval);
    clearInterval(restTimerInterval);
    elapsedInterval = null;
    restTimerInterval = null;
    startTimestamp = null;
    dismissRestTimer();
  };
}

function renderWorkoutStart(container) {
  const templates = store.getTemplates();

  container.innerHTML = `
    <p class="page-title">Start Workout</p>

    <div class="flex gap-8 mb-24">
      <button class="btn btn-primary btn-lg btn-block" id="start-empty">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Start Workout
      </button>
      <button class="btn btn-secondary btn-lg" id="create-template" style="flex-shrink:0">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <path d="M9 12h6M12 9v6"/>
        </svg>
      </button>
    </div>

    ${templates.length > 0 ? `
      <p class="section-title">Templates</p>
      ${templates.map(t => `
        <div class="template-card" data-template="${t.id}">
          <div class="template-name">${escapeHtml(t.name)}</div>
          <div class="template-exercises">${t.exercises.map(e => escapeHtml(e.name)).join(' · ')}</div>
          <div class="template-actions">
            <button class="btn btn-sm btn-primary start-template" data-id="${t.id}">Start</button>
            <button class="btn btn-sm btn-danger delete-template" data-id="${t.id}">Delete</button>
          </div>
        </div>
      `).join('')}
    ` : `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <path d="M9 12h6M12 9v6"/>
        </svg>
        <p>No templates yet.<br>Create one using the button above!</p>
      </div>
    `}
  `;

  container.querySelector('#start-empty').addEventListener('click', () => {
    startNewWorkout([]);
    renderActiveWorkout(container);
  });

  container.querySelector('#create-template').addEventListener('click', () => {
    showTemplateCreator(container);
  });

  container.querySelectorAll('.start-template').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tpl = templates.find(t => t.id === btn.dataset.id);
      if (tpl) {
        const exercises = tpl.exercises.map(ex => ({
          name: ex.name,
          category: ex.category,
          sets: Array.from({ length: ex.targetSets || 3 }, () => ({
            reps: ex.targetReps || 10,
            weight: 0,
            completed: false
          }))
        }));
        startNewWorkout(exercises);
        renderActiveWorkout(container);
      }
    });
  });

  container.querySelectorAll('.delete-template').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.deleteTemplate(btn.dataset.id);
      showToast('Template deleted');
      renderWorkoutStart(container);
    });
  });
}

function startNewWorkout(exercises) {
  activeWorkout = {
    id: generateId('w_'),
    date: todayStr(),
    startTime: new Date().toISOString(),
    endTime: null,
    exercises: exercises,
    notes: ''
  };
  store.setActiveWorkout(activeWorkout);
}

function renderActiveWorkout(container) {
  startTimestamp = new Date(activeWorkout.startTime);
  const settings = store.getSettings();

  container.innerHTML = `
    <div class="workout-active-header">
      <div class="workout-timer-badge">
        <span class="dot"></span>
        <span id="elapsed-time">00:00</span>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-sm btn-secondary" id="btn-finish">Finish</button>
        <button class="btn btn-sm btn-danger" id="btn-discard">Discard</button>
      </div>
    </div>

    <div id="exercises-list"></div>

    <button class="add-exercise-btn" id="btn-add-exercise">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Add Exercise
    </button>

    <div class="mt-16">
      <label class="input-label">Workout Notes</label>
      <textarea class="input" id="workout-notes" rows="2" placeholder="How did it feel?">${activeWorkout.notes || ''}</textarea>
    </div>
  `;

  renderExercises(container, settings);
  startElapsedTimer(container);

  container.querySelector('#btn-add-exercise').addEventListener('click', () => {
    showExercisePicker(container, settings);
  });

  container.querySelector('#btn-finish').addEventListener('click', () => {
    finishWorkout(container);
  });

  container.querySelector('#btn-discard').addEventListener('click', () => {
    const close = showModal(`
      <div class="modal-header">
        <h3 class="modal-title">Discard Workout?</h3>
        <button class="modal-close" id="modal-cancel">&times;</button>
      </div>
      <p class="text-muted mb-16">This will delete all progress for this workout.</p>
      <div class="flex gap-8">
        <button class="btn btn-danger btn-block" id="modal-confirm">Discard</button>
        <button class="btn btn-secondary btn-block" id="modal-cancel2">Cancel</button>
      </div>
    `);

    setTimeout(() => {
      document.querySelector('#modal-confirm')?.addEventListener('click', () => {
        store.clearActiveWorkout();
        activeWorkout = null;
        clearInterval(elapsedInterval);
        close();
        showToast('Workout discarded');
        renderWorkoutStart(container);
      });
      document.querySelector('#modal-cancel')?.addEventListener('click', close);
      document.querySelector('#modal-cancel2')?.addEventListener('click', close);
    }, 50);
  });

  container.querySelector('#workout-notes').addEventListener('input', (e) => {
    activeWorkout.notes = e.target.value;
    store.setActiveWorkout(activeWorkout);
  });
}

function renderExercises(container, settings) {
  const list = container.querySelector('#exercises-list');
  if (!list) return;
  const unit = settings.weightUnit || 'kg';

  list.innerHTML = activeWorkout.exercises.map((ex, exIdx) => `
    <div class="exercise-block" data-exercise="${exIdx}">
      <div class="exercise-block-header">
        <div>
          <div class="exercise-block-name">${escapeHtml(ex.name)}</div>
          <div class="exercise-block-category editable-category" data-ex="${exIdx}" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px">${ex.category} <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
        </div>
        <button class="btn btn-sm btn-ghost remove-exercise" data-idx="${exIdx}">Remove</button>
      </div>
      <div class="exercise-block-body">
        <div class="set-header">
          <span>Set</span>
          <span>${unit}</span>
          <span>Reps</span>
          <span></span>
          <span></span>
        </div>
        ${ex.sets.map((set, setIdx) => `
          <div class="set-row">
            <span class="set-number">${setIdx + 1}</span>
            <input type="number" class="input set-weight" data-ex="${exIdx}" data-set="${setIdx}"
              value="${set.weight || ''}" placeholder="0" min="0" inputmode="decimal">
            <input type="number" class="input set-reps" data-ex="${exIdx}" data-set="${setIdx}"
              value="${set.reps || ''}" placeholder="0" min="0" inputmode="numeric">
            <button class="set-check ${set.completed ? 'checked' : ''}" data-ex="${exIdx}" data-set="${setIdx}">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <button class="remove-set" data-ex="${exIdx}" data-set="${setIdx}" title="Remove set">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        `).join('')}
        <button class="add-set-btn" data-ex="${exIdx}">+ Add Set</button>
      </div>
    </div>
  `).join('');

  // Bind events
  list.querySelectorAll('.set-weight').forEach(input => {
    input.addEventListener('change', (e) => {
      const ex = parseInt(e.target.dataset.ex, 10);
      const set = parseInt(e.target.dataset.set, 10);
      let val = parseFloat(e.target.value) || 0;
      val = Math.max(0, Math.min(val, 9999));
      e.target.value = val || '';
      activeWorkout.exercises[ex].sets[set].weight = val;
      store.setActiveWorkout(activeWorkout);
    });
  });

  list.querySelectorAll('.set-reps').forEach(input => {
    input.addEventListener('change', (e) => {
      const ex = parseInt(e.target.dataset.ex, 10);
      const set = parseInt(e.target.dataset.set, 10);
      let val = parseInt(e.target.value, 10) || 0;
      val = Math.max(0, Math.min(val, 9999));
      e.target.value = val || '';
      activeWorkout.exercises[ex].sets[set].reps = val;
      store.setActiveWorkout(activeWorkout);
    });
  });

  list.querySelectorAll('.set-check').forEach(btn => {
    btn.addEventListener('click', () => {
      const ex = parseInt(btn.dataset.ex, 10);
      const set = parseInt(btn.dataset.set, 10);
      const wasCompleted = activeWorkout.exercises[ex].sets[set].completed;
      activeWorkout.exercises[ex].sets[set].completed = !wasCompleted;
      btn.classList.toggle('checked');
      store.setActiveWorkout(activeWorkout);

      // Auto-start rest timer when completing a set (not uncompleting)
      if (!wasCompleted) {
        const restTime = settings.defaultRestTime || 90;
        showRestTimerPopup(restTime);
      }
    });
  });

  list.querySelectorAll('.add-set-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const exIdx = parseInt(btn.dataset.ex, 10);
      const lastSet = activeWorkout.exercises[exIdx].sets.at(-1);
      activeWorkout.exercises[exIdx].sets.push({
        reps: lastSet?.reps || 10,
        weight: lastSet?.weight || 0,
        completed: false
      });
      store.setActiveWorkout(activeWorkout);
      renderExercises(container, settings);
    });
  });

  list.querySelectorAll('.remove-exercise').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      activeWorkout.exercises.splice(idx, 1);
      store.setActiveWorkout(activeWorkout);
      renderExercises(container, settings);
    });
  });

  list.querySelectorAll('.editable-category').forEach(el => {
    el.addEventListener('click', () => {
      const exIdx = parseInt(el.dataset.ex, 10);
      showCategoryPicker(exIdx, container, settings);
    });
  });

  list.querySelectorAll('.remove-set').forEach(btn => {
    btn.addEventListener('click', () => {
      const exIdx = parseInt(btn.dataset.ex, 10);
      const setIdx = parseInt(btn.dataset.set, 10);
      const exercise = activeWorkout.exercises[exIdx];
      if (exercise.sets.length <= 1) {
        showToast('Use "Remove" to delete the exercise');
        return;
      }
      exercise.sets.splice(setIdx, 1);
      store.setActiveWorkout(activeWorkout);
      renderExercises(container, settings);
    });
  });
}

function showCategoryPicker(exIdx, container, settings) {
  const currentCat = activeWorkout.exercises[exIdx].category;
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">Change Target Group</h3>
      <button class="modal-close" id="catpick-close">&times;</button>
    </div>
    <div class="chip-group mb-16">
      ${categories.filter(c => c.id !== 'all').map(c => `
        <button class="chip ${c.id === currentCat ? 'active' : ''}" data-pick-cat="${c.id}">${c.name}</button>
      `).join('')}
    </div>
  `;

  const close = showModal(el);

  el.addEventListener('click', (e) => {
    if (e.target.closest('#catpick-close')) { close(); return; }
    const chip = e.target.closest('[data-pick-cat]');
    if (chip) {
      activeWorkout.exercises[exIdx].category = chip.dataset.pickCat;
      store.setActiveWorkout(activeWorkout);
      renderExercises(container, settings);
      close();
      showToast(`Target group changed to ${chip.dataset.pickCat}`);
    }
  });
}

function showExercisePicker(container, settings) {
  const el = document.createElement('div');
  let filterCategory = 'all';
  let searchQuery = '';
  let customName = '';
  let customCategory = '';

  function updateCustomAddButton() {
    const btn = el.querySelector('#custom-add');
    if (btn) btn.disabled = !(customName.trim() && customCategory);
  }

  function renderCustomForm() {
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Create Custom Exercise</h3>
        <button class="modal-close" id="picker-close">&times;</button>
      </div>
      <div class="mb-16">
        <label class="input-label">Exercise Name</label>
        <input type="text" class="input" id="custom-name" placeholder="Exercise name" maxlength="100">
      </div>
      <div class="mb-16">
        <label class="input-label">Target Group</label>
        <div class="chip-group">
          ${categories.filter(c => c.id !== 'all').map(c => `
            <button class="chip ${c.id === customCategory ? 'active' : ''}" data-custom-cat="${c.id}">${c.name}</button>
          `).join('')}
        </div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-primary btn-block" id="custom-add" disabled>Add Exercise</button>
        <button class="btn btn-secondary btn-block" id="custom-back">Back</button>
      </div>
    `;
  }

  function render() {
    const customExercises = store.getCustomExercises();
    const allExercises = [...exerciseDB, ...customExercises];
    const filtered = allExercises.filter(ex => {
      const matchCat = filterCategory === 'all' || ex.category === filterCategory;
      const matchSearch = !searchQuery || ex.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Add Exercise</h3>
        <button class="modal-close" id="picker-close">&times;</button>
      </div>
      <div class="exercise-search mb-12">
        <svg class="exercise-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input type="text" class="input" id="exercise-search" placeholder="Search exercises..." value="${searchQuery}">
      </div>
      <div class="chip-group mb-16">
        ${categories.map(c => `
          <button class="chip ${c.id === filterCategory ? 'active' : ''}" data-cat="${c.id}">${c.name}</button>
        `).join('')}
      </div>
      <div style="max-height:300px;overflow-y:auto">
        ${filtered.map(ex => {
          const isCustom = customExercises.some(c => c.name === ex.name);
          return `
          <div class="list-item exercise-pick" data-name="${escapeHtml(ex.name)}" data-cat="${ex.category}">
            <div class="list-item-content">
              <div class="list-item-title">${escapeHtml(ex.name)}${isCustom ? ' <span class="text-sm text-accent">(custom)</span>' : ''}</div>
              <div class="list-item-subtitle">${ex.category}</div>
            </div>
            ${isCustom ? '<button class="btn btn-sm btn-ghost delete-custom-exercise" data-custom-name="' + escapeHtml(ex.name) + '" title="Delete custom exercise" style="flex-shrink:0">&times;</button>' : ''}
          </div>`;
        }).join('')}
        <div class="list-item exercise-pick" data-name="custom" data-cat="custom">
          <div class="list-item-content">
            <div class="list-item-title text-accent">+ Custom Exercise</div>
            <div class="list-item-subtitle">Create and save your own exercise</div>
          </div>
        </div>
      </div>
    `;
  }

  render();
  const close = showModal(el);

  // Use event delegation to avoid listener accumulation on re-renders
  el.addEventListener('click', (e) => {
    // Close button
    if (e.target.closest('#picker-close')) {
      close();
      return;
    }

    // Category filter chips
    const chip = e.target.closest('[data-cat]');
    if (chip && !chip.classList.contains('exercise-pick')) {
      filterCategory = chip.dataset.cat;
      render();
      // Re-focus search if it had text
      const search = el.querySelector('#exercise-search');
      if (search) { search.value = searchQuery; search.focus(); }
      return;
    }

    // Custom form: category chip selection
    const customChip = e.target.closest('[data-custom-cat]');
    if (customChip) {
      customCategory = customChip.dataset.customCat;
      el.querySelectorAll('[data-custom-cat]').forEach(c => c.classList.remove('active'));
      customChip.classList.add('active');
      updateCustomAddButton();
      return;
    }

    // Custom form: Add button
    if (e.target.closest('#custom-add')) {
      const name = (el.querySelector('#custom-name')?.value || '').trim().slice(0, 100);
      if (name && customCategory) {
        store.saveCustomExercise({ name, category: customCategory });
        addExerciseToWorkout(name, customCategory, container, settings);
        close();
      }
      return;
    }

    // Delete custom exercise
    const deleteBtn = e.target.closest('.delete-custom-exercise');
    if (deleteBtn) {
      e.stopPropagation();
      const nameToDelete = deleteBtn.dataset.customName;
      store.deleteCustomExercise(nameToDelete);
      showToast(`${nameToDelete} removed from custom exercises`);
      render();
      const search = el.querySelector('#exercise-search');
      if (search) { search.value = searchQuery; search.focus(); }
      return;
    }

    // Custom form: Back button
    if (e.target.closest('#custom-back')) {
      customName = '';
      customCategory = '';
      render();
      const search = el.querySelector('#exercise-search');
      if (search) { search.value = searchQuery; search.focus(); }
      return;
    }

    // Exercise selection
    const item = e.target.closest('.exercise-pick');
    if (item) {
      if (item.dataset.name === 'custom') {
        customName = '';
        customCategory = '';
        renderCustomForm();
        setTimeout(() => el.querySelector('#custom-name')?.focus(), 50);
        return;
      } else {
        addExerciseToWorkout(item.dataset.name, item.dataset.cat, container, settings);
        close();
      }
    }
  });

  el.addEventListener('input', (e) => {
    if (e.target.id === 'exercise-search') {
      searchQuery = e.target.value;
      render();
      // Keep focus and cursor position in search
      const search = el.querySelector('#exercise-search');
      if (search) { search.value = searchQuery; search.focus(); }
    }
    if (e.target.id === 'custom-name') {
      customName = e.target.value;
      updateCustomAddButton();
    }
  });
}

function addExerciseToWorkout(name, category, container, settings) {
  activeWorkout.exercises.push({
    name,
    category,
    sets: [{ reps: 10, weight: 0, completed: false }]
  });
  store.setActiveWorkout(activeWorkout);
  renderExercises(container, settings);
  showToast(`${name} added`);
}

function showTemplateCreator(container) {
  const templateExercises = [];

  function renderCreator() {
    const settings = store.getSettings();
    const unit = settings.weightUnit || 'kg';
    container.innerHTML = `
      <div class="flex items-center justify-between mb-16">
        <p class="page-title" style="margin:0">Create Template</p>
        <button class="btn btn-sm btn-ghost" id="tpl-cancel">Cancel</button>
      </div>
      <div class="mb-16">
        <label class="input-label">Template Name</label>
        <input type="text" class="input" id="tpl-name" placeholder="e.g. Chest Day" maxlength="100">
      </div>

      <div id="tpl-exercises-list">
        ${templateExercises.map((ex, exIdx) => `
          <div class="exercise-block" data-exercise="${exIdx}">
            <div class="exercise-block-header">
              <div>
                <div class="exercise-block-name">${escapeHtml(ex.name)}</div>
                <div class="exercise-block-category">${ex.category}</div>
              </div>
              <button class="btn btn-sm btn-ghost tpl-remove-exercise" data-idx="${exIdx}">Remove</button>
            </div>
            <div class="exercise-block-body">
              <div class="set-header" style="grid-template-columns:40px 1fr 1fr">
                <span>Set</span>
                <span>Reps</span>
                <span></span>
              </div>
              ${ex.sets.map((set, setIdx) => `
                <div class="set-row" style="grid-template-columns:40px 1fr 36px">
                  <span class="set-number">${setIdx + 1}</span>
                  <input type="number" class="input tpl-set-reps" data-ex="${exIdx}" data-set="${setIdx}"
                    value="${set.reps || ''}" placeholder="10" min="0" inputmode="numeric">
                  <button class="remove-set tpl-remove-set" data-ex="${exIdx}" data-set="${setIdx}" title="Remove set">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              `).join('')}
              <button class="add-set-btn tpl-add-set" data-ex="${exIdx}">+ Add Set</button>
            </div>
          </div>
        `).join('')}
      </div>

      <button class="add-exercise-btn mb-16" id="tpl-add-exercise">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Add Exercise
      </button>

      ${templateExercises.length > 0 ? `
        <button class="btn btn-primary btn-lg btn-block" id="tpl-save">Save Template</button>
      ` : ''}
    `;

    container.querySelector('#tpl-cancel').addEventListener('click', () => {
      renderWorkoutStart(container);
    });

    container.querySelector('#tpl-add-exercise').addEventListener('click', () => {
      showTemplateExercisePicker(templateExercises, renderCreator);
    });

    container.querySelector('#tpl-save')?.addEventListener('click', () => {
      const name = container.querySelector('#tpl-name').value.trim().slice(0, 100);
      if (!name) {
        showToast('Please enter a template name', 'error');
        container.querySelector('#tpl-name').focus();
        return;
      }
      store.saveTemplate({
        id: generateId('t_'),
        name,
        exercises: templateExercises.map(ex => ({
          name: ex.name,
          category: ex.category,
          targetSets: ex.sets.length,
          targetReps: ex.sets[0]?.reps || 10
        }))
      });
      showToast('Template saved!');
      renderWorkoutStart(container);
    });

    container.querySelectorAll('.tpl-remove-exercise').forEach(btn => {
      btn.addEventListener('click', () => {
        templateExercises.splice(parseInt(btn.dataset.idx, 10), 1);
        renderCreator();
      });
    });

    container.querySelectorAll('.tpl-set-reps').forEach(input => {
      input.addEventListener('change', (e) => {
        const ex = parseInt(e.target.dataset.ex, 10);
        const set = parseInt(e.target.dataset.set, 10);
        templateExercises[ex].sets[set].reps = Math.max(0, Math.min(parseInt(e.target.value, 10) || 0, 9999));
      });
    });

    container.querySelectorAll('.tpl-add-set').forEach(btn => {
      btn.addEventListener('click', () => {
        const exIdx = parseInt(btn.dataset.ex, 10);
        const lastSet = templateExercises[exIdx].sets.at(-1);
        templateExercises[exIdx].sets.push({ reps: lastSet?.reps || 10 });
        renderCreator();
      });
    });

    container.querySelectorAll('.tpl-remove-set').forEach(btn => {
      btn.addEventListener('click', () => {
        const exIdx = parseInt(btn.dataset.ex, 10);
        const setIdx = parseInt(btn.dataset.set, 10);
        if (templateExercises[exIdx].sets.length <= 1) {
          showToast('Use "Remove" to delete the exercise');
          return;
        }
        templateExercises[exIdx].sets.splice(setIdx, 1);
        renderCreator();
      });
    });
  }

  renderCreator();
}

function showTemplateExercisePicker(templateExercises, onDone) {
  const el = document.createElement('div');
  let filterCategory = 'all';
  let searchQuery = '';
  let customName = '';
  let customCategory = '';

  function updateCustomAddButton() {
    const btn = el.querySelector('#custom-add');
    if (btn) btn.disabled = !(customName.trim() && customCategory);
  }

  function renderCustomForm() {
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Create Custom Exercise</h3>
        <button class="modal-close" id="picker-close">&times;</button>
      </div>
      <div class="mb-16">
        <label class="input-label">Exercise Name</label>
        <input type="text" class="input" id="custom-name" placeholder="Exercise name" maxlength="100">
      </div>
      <div class="mb-16">
        <label class="input-label">Target Group</label>
        <div class="chip-group">
          ${categories.filter(c => c.id !== 'all').map(c => `
            <button class="chip ${c.id === customCategory ? 'active' : ''}" data-custom-cat="${c.id}">${c.name}</button>
          `).join('')}
        </div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-primary btn-block" id="custom-add" disabled>Add Exercise</button>
        <button class="btn btn-secondary btn-block" id="custom-back">Back</button>
      </div>
    `;
  }

  function render() {
    const customExercises = store.getCustomExercises();
    const allExercises = [...exerciseDB, ...customExercises];
    const filtered = allExercises.filter(ex => {
      const matchCat = filterCategory === 'all' || ex.category === filterCategory;
      const matchSearch = !searchQuery || ex.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">Add Exercise</h3>
        <button class="modal-close" id="picker-close">&times;</button>
      </div>
      <div class="exercise-search mb-12">
        <svg class="exercise-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input type="text" class="input" id="exercise-search" placeholder="Search exercises..." value="${searchQuery}">
      </div>
      <div class="chip-group mb-16">
        ${categories.map(c => `
          <button class="chip ${c.id === filterCategory ? 'active' : ''}" data-cat="${c.id}">${c.name}</button>
        `).join('')}
      </div>
      <div style="max-height:300px;overflow-y:auto">
        ${filtered.map(ex => {
          const isCustom = customExercises.some(c => c.name === ex.name);
          return `
          <div class="list-item exercise-pick" data-name="${escapeHtml(ex.name)}" data-cat="${ex.category}">
            <div class="list-item-content">
              <div class="list-item-title">${escapeHtml(ex.name)}${isCustom ? ' <span class="text-sm text-accent">(custom)</span>' : ''}</div>
              <div class="list-item-subtitle">${ex.category}</div>
            </div>
          </div>`;
        }).join('')}
        <div class="list-item exercise-pick" data-name="custom" data-cat="custom">
          <div class="list-item-content">
            <div class="list-item-title text-accent">+ Custom Exercise</div>
            <div class="list-item-subtitle">Create and save your own exercise</div>
          </div>
        </div>
      </div>
    `;
  }

  render();
  const close = showModal(el);

  el.addEventListener('click', (e) => {
    if (e.target.closest('#picker-close')) { close(); return; }

    const chip = e.target.closest('[data-cat]');
    if (chip && !chip.classList.contains('exercise-pick')) {
      filterCategory = chip.dataset.cat;
      render();
      const search = el.querySelector('#exercise-search');
      if (search) { search.value = searchQuery; search.focus(); }
      return;
    }

    const customChip = e.target.closest('[data-custom-cat]');
    if (customChip) {
      customCategory = customChip.dataset.customCat;
      el.querySelectorAll('[data-custom-cat]').forEach(c => c.classList.remove('active'));
      customChip.classList.add('active');
      updateCustomAddButton();
      return;
    }

    if (e.target.closest('#custom-add')) {
      const name = (el.querySelector('#custom-name')?.value || '').trim().slice(0, 100);
      if (name && customCategory) {
        store.saveCustomExercise({ name, category: customCategory });
        templateExercises.push({ name, category: customCategory, sets: [{ reps: 10 }] });
        close();
        onDone();
        showToast(`${name} added`);
      }
      return;
    }

    if (e.target.closest('#custom-back')) {
      customName = '';
      customCategory = '';
      render();
      const search = el.querySelector('#exercise-search');
      if (search) { search.value = searchQuery; search.focus(); }
      return;
    }

    const item = e.target.closest('.exercise-pick');
    if (item) {
      if (item.dataset.name === 'custom') {
        customName = '';
        customCategory = '';
        renderCustomForm();
        setTimeout(() => el.querySelector('#custom-name')?.focus(), 50);
      } else {
        templateExercises.push({
          name: item.dataset.name,
          category: item.dataset.cat,
          sets: [{ reps: 10 }]
        });
        close();
        onDone();
        showToast(`${item.dataset.name} added`);
      }
    }
  });

  el.addEventListener('input', (e) => {
    if (e.target.id === 'exercise-search') {
      searchQuery = e.target.value;
      render();
      const search = el.querySelector('#exercise-search');
      if (search) { search.value = searchQuery; search.focus(); }
    }
    if (e.target.id === 'custom-name') {
      customName = e.target.value;
      updateCustomAddButton();
    }
  });
}

function finishWorkout(container) {
  activeWorkout.endTime = new Date().toISOString();
  store.saveWorkout(activeWorkout);

  // Capture data before clearing state
  const completedWorkout = activeWorkout;
  const exerciseCount = completedWorkout.exercises.length;
  const setsCompleted = completedWorkout.exercises.reduce(
    (a, e) => a + e.sets.filter(s => s.completed).length, 0
  );

  const close = showModal(`
    <div class="text-center">
      <div style="font-size:48px;margin-bottom:16px">&#127942;</div>
      <h3 class="modal-title mb-8">Workout Complete!</h3>
      <p class="text-muted mb-16">${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} · ${setsCompleted} sets completed</p>
      <div class="flex gap-8">
        <button class="btn btn-primary btn-block" id="finish-done">Done</button>
        <button class="btn btn-secondary btn-block" id="finish-save-template">Save as Template</button>
      </div>
    </div>
  `);

  function cleanup() {
    store.clearActiveWorkout();
    activeWorkout = null;
    clearInterval(elapsedInterval);
    close();
    renderWorkoutStart(container);
  }

  setTimeout(() => {
    document.querySelector('#finish-done')?.addEventListener('click', cleanup);

    document.querySelector('#finish-save-template')?.addEventListener('click', () => {
      const name = prompt('Template name:', 'My Workout');
      if (name?.trim()) {
        const templateName = name.trim().slice(0, 100);
        store.saveTemplate({
          id: generateId('t_'),
          name: templateName,
          exercises: completedWorkout.exercises
            .filter(ex => ex.sets && ex.sets.length > 0)
            .map(ex => ({
              name: ex.name,
              category: ex.category,
              targetSets: ex.sets.length,
              targetReps: ex.sets[0].reps || 10
            }))
        });
        showToast('Template saved!');
      }
      cleanup();
    });
  }, 100);
}

function startElapsedTimer(container) {
  const el = container.querySelector('#elapsed-time');
  if (!el) return;

  function update() {
    const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    el.textContent = formatTime(elapsed);
  }

  update();
  elapsedInterval = setInterval(update, 1000);
}

// ===== REST TIMER POPUP =====
function showRestTimerPopup(seconds) {
  dismissRestTimer();

  // Use the global timer for rest
  globalTimer.startRest(seconds);

  const restPresets = [30, 60, 90, 120, 180];

  // Create floating rest timer popup
  const popup = document.createElement('div');
  popup.id = 'rest-timer-popup';
  popup.className = 'rest-timer-popup';
  popup.innerHTML = `
    <div class="rest-timer-header">
      <span class="rest-timer-title">Rest</span>
      <button class="rest-timer-dismiss" id="rest-dismiss">&times;</button>
    </div>
    <div class="rest-timer-time" id="rest-time">${formatTime(seconds)}</div>
    <div class="rest-timer-bar">
      <div class="rest-timer-fill" id="rest-fill" style="width:100%"></div>
    </div>
    <div class="rest-timer-actions">
      ${restPresets.map(sec => `
        <button class="rest-timer-btn ${sec === seconds ? 'active' : ''}" data-rest="${sec}">${formatTime(sec)}</button>
      `).join('')}
      <button class="rest-timer-btn rest-skip" id="rest-skip">Skip</button>
    </div>
  `;
  document.body.appendChild(popup);

  // Animate in
  requestAnimationFrame(() => popup.classList.add('visible'));

  const timeEl = popup.querySelector('#rest-time');
  const fillEl = popup.querySelector('#rest-fill');

  // Subscribe to global timer for updates
  function subscribeToTimer() {
    return globalTimer.subscribe((state) => {
      if (!state.isActive || state.mode !== 'rest') {
        dismissRestTimer();
        return;
      }
      if (timeEl) timeEl.textContent = formatTime(Math.max(0, state.timeLeft));
      if (fillEl) fillEl.style.width = `${Math.max(0, state.progress * 100)}%`;
    });
  }
  restTimerUnsubscribe = subscribeToTimer();

  popup.querySelector('#rest-dismiss')?.addEventListener('click', dismissRestTimer);
  popup.querySelector('#rest-skip')?.addEventListener('click', () => {
    globalTimer.stop();
    dismissRestTimer();
    showToast('Rest skipped');
  });
  // Quick rest presets — restart rest timer at the selected duration
  popup.querySelectorAll('[data-rest]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newDuration = parseInt(btn.dataset.rest, 10);
      popup.querySelectorAll('[data-rest]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Unsubscribe before restarting so stop() inside startRest
      // doesn't trigger dismissRestTimer via the subscription
      if (restTimerUnsubscribe) restTimerUnsubscribe();
      globalTimer.startRest(newDuration);
      restTimerUnsubscribe = subscribeToTimer();
      // Immediately update display for the new duration (next tick is 1s away)
      if (timeEl) timeEl.textContent = formatTime(newDuration);
      if (fillEl) fillEl.style.width = '100%';
    });
  });
}

function dismissRestTimer() {
  if (restTimerUnsubscribe) {
    restTimerUnsubscribe();
    restTimerUnsubscribe = null;
  }
  clearInterval(restTimerInterval);
  restTimerInterval = null;
  const popup = document.getElementById('rest-timer-popup');
  if (popup) {
    popup.classList.remove('visible');
    setTimeout(() => popup.remove(), 200);
  }
}
