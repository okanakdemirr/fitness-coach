import { store } from '../store.js';
import { formatDate, formatDateFull, formatDuration, showModal } from '../utils.js';

export function historyPage(container) {
  const workouts = store.getWorkouts();
  const settings = store.getSettings();
  const unit = settings.weightUnit || 'kg';

  if (workouts.length === 0) {
    container.innerHTML = `
      <p class="page-title">History</p>
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 8v4l3 3"/>
          <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
        </svg>
        <p>No workouts yet.<br>Complete your first workout to see it here!</p>
      </div>
    `;
    return;
  }

  // Group workouts by date
  const grouped = {};
  workouts.forEach(w => {
    if (!grouped[w.date]) grouped[w.date] = [];
    grouped[w.date].push(w);
  });

  container.innerHTML = `
    <p class="page-title">History</p>
    <p class="text-muted mb-16">${workouts.length} workout${workouts.length !== 1 ? 's' : ''} logged</p>
    ${Object.entries(grouped).map(([date, dayWorkouts]) => `
      <div class="history-date-group">
        <div class="history-date">${formatDate(date)}</div>
        ${dayWorkouts.map(w => `
          <div class="workout-summary-card" data-workout-id="${w.id}">
            <div class="workout-summary-header">
              <span class="workout-summary-title">${w.exercises.length} exercise${w.exercises.length !== 1 ? 's' : ''}</span>
              <span class="workout-summary-time">${formatDuration(w.startTime, w.endTime)}</span>
            </div>
            <div class="workout-summary-exercises">
              ${w.exercises.map(ex => `<span class="workout-summary-exercise">${ex.name}</span>`).join('')}
            </div>
            ${w.exercises.length > 0 ? `
              <div class="text-sm text-muted mt-8">
                ${w.exercises.reduce((a, e) => a + e.sets.filter(s => s.completed).length, 0)} sets ·
                ${getWorkoutVolume(w)} ${unit} volume
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `).join('')}
  `;

  // Bind click to show details
  container.querySelectorAll('.workout-summary-card').forEach(card => {
    card.addEventListener('click', () => {
      const workout = workouts.find(w => w.id === card.dataset.workoutId);
      if (workout) showWorkoutDetail(workout, unit, container);
    });
  });
}

function getWorkoutVolume(workout) {
  let volume = 0;
  workout.exercises.forEach(ex => {
    ex.sets.forEach(s => {
      if (s.completed && s.weight && s.reps) {
        volume += s.weight * s.reps;
      }
    });
  });
  return volume.toLocaleString();
}

function showWorkoutDetail(workout, unit, container) {
  const el = document.createElement('div');

  el.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${formatDateFull(workout.date)}</h3>
      <button class="modal-close" id="detail-close">&times;</button>
    </div>
    <div class="flex items-center gap-16 mb-16">
      <div class="badge badge-accent">${formatDuration(workout.startTime, workout.endTime)}</div>
      <span class="text-sm text-muted">${workout.exercises.reduce((a, e) => a + e.sets.filter(s => s.completed).length, 0)} sets</span>
    </div>
    ${workout.notes ? `<p class="text-sm text-muted mb-16">"${workout.notes}"</p>` : ''}
    ${workout.exercises.map(ex => `
      <div class="card mb-8">
        <div class="font-bold mb-8">${ex.name} <span class="text-sm text-muted">${ex.category}</span></div>
        <div class="set-header">
          <span>Set</span>
          <span>${unit}</span>
          <span>Reps</span>
          <span></span>
        </div>
        ${ex.sets.map((set, i) => `
          <div class="set-row">
            <span class="set-number">${i + 1}</span>
            <span class="text-center text-sm">${set.weight || '—'}</span>
            <span class="text-center text-sm">${set.reps || '—'}</span>
            <span class="text-center">${set.completed ? '<span style="color:var(--accent)">&#10003;</span>' : '<span style="color:var(--text-muted)">—</span>'}</span>
          </div>
        `).join('')}
      </div>
    `).join('')}
    <div class="flex gap-8 mt-16">
      <button class="btn btn-danger btn-sm" id="delete-workout">Delete Workout</button>
    </div>
  `;

  const close = showModal(el);

  setTimeout(() => {
    el.querySelector('#detail-close')?.addEventListener('click', close);
    el.querySelector('#delete-workout')?.addEventListener('click', () => {
      store.deleteWorkout(workout.id);
      close();
      historyPage(container);
    });
  }, 50);
}
