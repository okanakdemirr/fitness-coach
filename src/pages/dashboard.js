import { store } from '../store.js';
import {
  formatDate, formatDuration, escapeHtml, todayStr, toDateStr, addDays, startOfWeek,
  formatVolume, formatNumber, plural
} from '../utils.js';
import { renderMuscleMap } from '../muscleMap.js';
import {
  calcStreak, calcWeekStreak, thisWeekWorkouts, totalVolume, countCompletedSets, workoutTitle
} from '../analytics.js';
import { startWorkoutFrom } from './workout.js';

export function dashboardPage(container) {
  const settings = store.getSettings();
  const workouts = store.getWorkouts();
  const activeWorkout = store.getActiveWorkout();
  const templates = store.getTemplates();
  const goal = settings.weeklyGoal || 4;
  const unit = settings.weightUnit;

  const weekWorkouts = thisWeekWorkouts(workouts);
  const streak = calcStreak(workouts);
  const weekStreak = calcWeekStreak(workouts, goal);
  const weekVolume = totalVolume(weekWorkouts);
  const latestWeight = store.getBodyStats()[0] || null;
  const now = new Date();

  container.innerHTML = `
    <header class="dash-header">
      <p class="dash-date">${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      <h1 class="dash-greeting">${getGreeting()}</h1>
    </header>

    ${activeWorkout ? `
      <a href="#/workout" class="hero-card active-hero mb-16">
        <div class="hero-card-top">
          <span class="live-pill"><span class="live-dot"></span>In progress</span>
          <span class="hero-elapsed tabular" id="active-elapsed"></span>
        </div>
        <div class="hero-title">${escapeHtml(activeWorkout.name || 'Workout')}</div>
        <div class="hero-sub">${plural((activeWorkout.exercises || []).length, 'exercise')} · ${countCompletedSets(activeWorkout)} sets done</div>
        <span class="btn btn-primary btn-block mt-16">Resume workout</span>
      </a>
    ` : `
      <div class="hero-card mb-16">
        <div class="hero-title">${weekWorkouts.length >= goal ? 'Goal smashed this week' : 'Ready to train?'}</div>
        <div class="hero-sub">${weekWorkouts.length >= goal
          ? 'Every extra session is a bonus.'
          : `${plural(goal - weekWorkouts.length, 'workout')} left to hit your weekly goal.`}</div>
        <a href="#/workout" class="btn btn-primary btn-lg btn-block mt-16" id="dash-start">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Start workout
        </a>
        ${templates.length ? `
          <div class="hero-templates">
            ${templates.slice(0, 4).map(t => `
              <button class="chip quick-template" data-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `}

    ${renderWeekCard(workouts, weekWorkouts.length, goal, weekStreak)}

    <div class="stat-grid">
      <a href="#/stats" class="stat-card">
        <span class="stat-icon" style="--tone:var(--warning)" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1 2.5 2 3 0-3 0-6 1-9.5z"/></svg>
        </span>
        <span class="stat-value">${streak}</span>
        <span class="stat-label">Day streak</span>
      </a>
      <a href="#/stats" class="stat-card">
        <span class="stat-icon" style="--tone:var(--accent-secondary)" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6.5 6.5h11M6.5 17.5h11M6 12h12"/><rect x="2" y="6" width="4" height="12" rx="1.5"/><rect x="18" y="6" width="4" height="12" rx="1.5"/></svg>
        </span>
        <span class="stat-value">${workouts.length}</span>
        <span class="stat-label">Workouts</span>
      </a>
      <a href="#/stats" class="stat-card">
        <span class="stat-icon" style="--tone:var(--accent-ink)" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>
        </span>
        <span class="stat-value">${formatVolume(weekVolume)}</span>
        <span class="stat-label">Week volume · ${escapeHtml(unit)}</span>
      </a>
      <a href="#/weight" class="stat-card">
        <span class="stat-icon" style="--tone:#b18cff" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 7h14l-1.5 13h-11z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>
        </span>
        <span class="stat-value">${latestWeight ? formatNumber(latestWeight.weight) : '—'}</span>
        <span class="stat-label">${latestWeight ? `Body weight · ${escapeHtml(latestWeight.unit || unit)}` : 'Log body weight'}</span>
      </a>
    </div>

    <div id="muscle-map-container"></div>

    ${renderRecent(workouts, unit)}
  `;

  container.querySelectorAll('.quick-template').forEach(btn => {
    btn.addEventListener('click', () => {
      const tpl = templates.find(t => t.id === btn.dataset.id);
      if (!tpl) return;
      startWorkoutFrom({ name: tpl.name, exercises: tpl.exercises, templateId: tpl.id });
      window.location.hash = '#/workout';
    });
  });

  // Live elapsed time on the resume card
  let interval = null;
  const elapsedEl = container.querySelector('#active-elapsed');
  if (elapsedEl && activeWorkout) {
    const start = new Date(activeWorkout.startTime).getTime();
    const update = () => {
      const mins = Math.floor((Date.now() - start) / 60000);
      elapsedEl.textContent = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };
    update();
    interval = setInterval(update, 30000);
  }

  const muscleMapEl = container.querySelector('#muscle-map-container');
  if (muscleMapEl) renderMuscleMap(muscleMapEl);

  return () => clearInterval(interval);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late? 🌙';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function renderWeekCard(workouts, done, goal, weekStreak) {
  const pct = Math.min(1, done / goal);
  const r = 26;
  const circ = 2 * Math.PI * r;
  const today = todayStr();
  const monday = startOfWeek();
  const dates = new Set(workouts.map(w => w.date));
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return `
    <a href="#/history" class="card week-card mb-16">
      <div class="week-ring" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="64" height="64">
          <circle cx="32" cy="32" r="${r}" class="ring-bg"/>
          <circle cx="32" cy="32" r="${r}" class="ring-fill ${pct >= 1 ? 'complete' : ''}"
            stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}" transform="rotate(-90 32 32)"/>
        </svg>
        <span class="week-ring-text">${done}<small>/${goal}</small></span>
      </div>
      <div class="week-info">
        <div class="week-title">This week${weekStreak > 1 ? ` <span class="badge badge-warning">${weekStreak} wk streak</span>` : ''}</div>
        <div class="week-days" aria-label="Workout days this week">
          ${letters.map((l, i) => {
            const d = toDateStr(addDays(monday, i));
            const cls = dates.has(d) ? 'done' : d === today ? 'today' : d > today ? 'future' : '';
            return `<span class="week-day ${cls}" title="${d}">${l}</span>`;
          }).join('')}
        </div>
      </div>
    </a>
  `;
}

function renderRecent(workouts, unit) {
  const recent = workouts.slice(0, 3);
  if (recent.length === 0) {
    return `
      <div class="empty-state compact">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>
        </div>
        <p class="empty-title">Your journey starts here</p>
        <p>Finish your first workout and your progress will show up on this screen.</p>
      </div>
    `;
  }

  return `
    <div class="section-header">
      <h2 class="section-title">Recent workouts</h2>
      <a href="#/history" class="link-btn">See all</a>
    </div>
    ${recent.map(w => `
      <a href="#/history?w=${encodeURIComponent(w.id)}" class="workout-summary-card">
        <div class="workout-summary-header">
          <span class="workout-summary-title">${escapeHtml(workoutTitle(w))}</span>
          <span class="workout-summary-date">${escapeHtml(formatDate(w.date))}</span>
        </div>
        <div class="workout-summary-meta">
          <span>${formatDuration(w.startTime, w.endTime)}</span>
          <span>${countCompletedSets(w)} sets</span>
          <span>${formatVolume(totalVolume([w]))} ${escapeHtml(unit)}</span>
        </div>
        <div class="workout-summary-exercises">
          ${(w.exercises || []).map(ex => `<span class="workout-summary-exercise">${escapeHtml(ex.name)}</span>`).join('')}
        </div>
      </a>
    `).join('')}
  `;
}
