// Shared exercise picker sheet: search, filter, recent, and custom exercises
import { store } from './store.js';
import { exercises as exerciseDB, categories } from './data/exercises.js';
import { showModal, showToast, escapeHtml, confirmDialog, capitalize, categoryColor } from './utils.js';
import { recentExerciseNames } from './analytics.js';

const pickableCategories = categories.filter(c => c.id !== 'all');

export function categoryChips(selected, attr = 'data-pick-cat') {
  return pickableCategories.map(c => `
    <button type="button" class="chip ${c.id === selected ? 'active' : ''}" ${attr}="${c.id}">
      <span class="cat-dot" style="background:${categoryColor(c.id)}"></span>${c.name}
    </button>
  `).join('');
}

/**
 * Opens the picker. Calls onPick({ name, category }) for the chosen
 * exercise. `exclude` is a list of names already in the workout.
 */
export function openExercisePicker({ onPick, exclude = [], title = 'Add Exercise' }) {
  const el = document.createElement('div');
  el.className = 'picker';
  let filterCategory = 'all';
  let searchQuery = '';
  const excluded = new Set(exclude.map(n => n.toLowerCase()));

  function renderShell() {
    el.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <button class="modal-close" data-close aria-label="Close">&times;</button>
      </div>
      <div class="search-field mb-12">
        <svg class="search-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <input type="search" class="input" id="exercise-search" placeholder="Search exercises"
          value="${escapeHtml(searchQuery)}" autocomplete="off" enterkeyhint="search" aria-label="Search exercises">
      </div>
      <div class="chip-scroll mb-12" role="tablist" aria-label="Filter by muscle group">
        ${categories.map(c => `
          <button type="button" class="chip ${c.id === filterCategory ? 'active' : ''}" data-filter="${c.id}" role="tab"
            aria-selected="${c.id === filterCategory}">${c.name}</button>
        `).join('')}
      </div>
      <div class="picker-list" id="picker-list"></div>
    `;
    renderList();
  }

  function renderList() {
    const list = el.querySelector('#picker-list');
    if (!list) return;
    const custom = store.getCustomExercises();
    const customNames = new Set(custom.map(c => c.name.toLowerCase()));
    // Custom definitions override built-in categories with the same name
    const byName = new Map();
    for (const ex of [...exerciseDB, ...custom]) byName.set(ex.name.toLowerCase(), ex);
    const all = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

    const q = searchQuery.trim().toLowerCase();
    const filtered = all.filter(ex =>
      (filterCategory === 'all' || ex.category === filterCategory) &&
      (!q || ex.name.toLowerCase().includes(q))
    );

    const showRecent = !q && filterCategory === 'all';
    const recent = showRecent
      ? recentExerciseNames(store.getWorkouts(), 6).filter(r => !excluded.has(r.name.toLowerCase()))
      : [];

    const item = (ex) => {
      const isCustom = customNames.has(ex.name.toLowerCase());
      const added = excluded.has(ex.name.toLowerCase());
      return `
        <div class="picker-item ${added ? 'is-added' : ''}" role="button" tabindex="0"
          data-name="${escapeHtml(ex.name)}" data-cat="${escapeHtml(ex.category)}">
          <span class="cat-dot lg" style="background:${categoryColor(ex.category)}"></span>
          <div class="picker-item-text">
            <div class="picker-item-name">${escapeHtml(ex.name)}</div>
            <div class="picker-item-meta">${escapeHtml(capitalize(ex.category))}${isCustom ? ' · Custom' : ''}${added ? ' · In workout' : ''}</div>
          </div>
          ${isCustom ? `
            <button type="button" class="icon-btn sm delete-custom" data-custom-name="${escapeHtml(ex.name)}" aria-label="Delete ${escapeHtml(ex.name)}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
            </button>` : `
            <svg class="picker-item-add" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`}
        </div>
      `;
    };

    const exactMatch = q && all.some(ex => ex.name.toLowerCase() === q);

    list.innerHTML = `
      ${recent.length ? `
        <p class="picker-section">Recent</p>
        ${recent.map(item).join('')}
        <p class="picker-section">All exercises</p>
      ` : ''}
      ${filtered.map(item).join('')}
      ${filtered.length === 0 ? `<p class="picker-empty">No exercises match “${escapeHtml(searchQuery)}”.</p>` : ''}
      ${!exactMatch ? `
        <div class="picker-item picker-create" role="button" tabindex="0" id="create-custom">
          <span class="picker-create-icon">+</span>
          <div class="picker-item-text">
            <div class="picker-item-name">${q ? `Create “${escapeHtml(searchQuery.trim())}”` : 'Create custom exercise'}</div>
            <div class="picker-item-meta">Save your own exercise for next time</div>
          </div>
        </div>` : ''}
    `;
  }

  function renderCustomForm() {
    let customCategory = filterCategory !== 'all' ? filterCategory : '';
    el.innerHTML = `
      <div class="modal-header">
        <button class="icon-btn" id="custom-back" aria-label="Back">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h3 class="modal-title">New Exercise</h3>
        <button class="modal-close" data-close aria-label="Close">&times;</button>
      </div>
      <form id="custom-form">
        <div class="input-group">
          <label class="input-label" for="custom-name">Exercise name</label>
          <input type="text" class="input" id="custom-name" placeholder="e.g. Landmine Press" maxlength="100"
            value="${escapeHtml(searchQuery.trim())}" autofocus autocomplete="off">
        </div>
        <div class="input-group">
          <span class="input-label">Muscle group</span>
          <div class="chip-group">${categoryChips(customCategory, 'data-custom-cat')}</div>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="custom-add" disabled>Add Exercise</button>
      </form>
    `;
    const nameInput = el.querySelector('#custom-name');
    const addBtn = el.querySelector('#custom-add');
    const update = () => { addBtn.disabled = !(nameInput.value.trim() && customCategory); };
    update();
    setTimeout(() => nameInput.focus(), 50);

    nameInput.addEventListener('input', update);
    el.querySelectorAll('[data-custom-cat]').forEach(chip => {
      chip.addEventListener('click', () => {
        customCategory = chip.dataset.customCat;
        el.querySelectorAll('[data-custom-cat]').forEach(c => c.classList.toggle('active', c === chip));
        update();
      });
    });
    el.querySelector('#custom-back').addEventListener('click', renderShell);
    el.querySelector('#custom-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim().slice(0, 100);
      if (!name || !customCategory) return;
      const builtIn = exerciseDB.find(ex => ex.name.toLowerCase() === name.toLowerCase());
      if (builtIn) {
        pick({ name: builtIn.name, category: builtIn.category });
        return;
      }
      const result = store.saveCustomExercise({ name, category: customCategory });
      if (!result.saved && result.existing.category !== customCategory) {
        const ok = await confirmDialog({
          title: 'Exercise exists',
          message: `“<strong>${escapeHtml(result.existing.name)}</strong>” already exists in <strong>${escapeHtml(capitalize(result.existing.category))}</strong>. Move it to <strong>${escapeHtml(capitalize(customCategory))}</strong>? This also updates your history.`,
          confirmText: 'Update'
        });
        if (ok) {
          store.updateCustomExercise({ name: result.existing.name, category: customCategory });
          onPick({ name: result.existing.name, category: customCategory });
        } else {
          onPick({ name: result.existing.name, category: result.existing.category });
        }
        return;
      }
      pick({ name: result.saved ? name : result.existing.name, category: customCategory });
    });
  }

  function pick(ex) {
    close();
    onPick(ex);
  }

  renderShell();
  const close = showModal(el);

  el.addEventListener('input', (e) => {
    if (e.target.id === 'exercise-search') {
      searchQuery = e.target.value;
      renderList();
    }
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.picker-item')) {
      e.preventDefault();
      e.target.click();
    }
  });

  el.addEventListener('click', async (e) => {
    const filter = e.target.closest('[data-filter]');
    if (filter) {
      filterCategory = filter.dataset.filter;
      el.querySelectorAll('[data-filter]').forEach(c => {
        const on = c === filter;
        c.classList.toggle('active', on);
        c.setAttribute('aria-selected', on);
      });
      renderList();
      return;
    }

    const del = e.target.closest('.delete-custom');
    if (del) {
      e.stopPropagation();
      const name = del.dataset.customName;
      const ok = await confirmDialog({
        title: 'Delete custom exercise?',
        message: `“${escapeHtml(name)}” will be removed from the list. Past workouts keep it.`,
        confirmText: 'Delete',
        danger: true
      });
      if (ok) {
        store.deleteCustomExercise(name);
        showToast(`${name} deleted`);
      }
      // The confirm replaced our sheet; reopen the picker
      openExercisePicker({ onPick, exclude, title });
      return;
    }

    if (e.target.closest('#create-custom')) {
      renderCustomForm();
      return;
    }

    const item = e.target.closest('.picker-item[data-name]');
    if (item) {
      pick({ name: item.dataset.name, category: item.dataset.cat });
    }
  });
}
