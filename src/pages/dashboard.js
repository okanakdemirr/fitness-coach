import { store } from '../store.js';
import { formatDate, formatDuration, todayStr, escapeHtml } from '../utils.js';

export function dashboardPage(container) {
  const settings = store.getSettings();
  const workouts = store.getWorkouts();
  const todayWorkout = store.getTodayWorkout();
  const activeWorkout = store.getActiveWorkout();

  // Calculate stats
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // Monday
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const workoutsThisWeek = workouts.filter(w => w.date >= weekStartStr).length;

  // Streak calculation
  let streak = 0;
  const checkDate = new Date();
  // If no workout today, start checking from yesterday
  if (!todayWorkout) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (workouts.some(w => w.date === dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  const greeting = getGreeting();

  container.innerHTML = `
    <p class="dashboard-greeting">${greeting}</p>
    <p class="dashboard-date">${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

    ${activeWorkout ? `
      <div class="card card-clickable mb-24" id="resume-workout" style="border-color: var(--accent)">
        <div class="flex items-center justify-between mb-8">
          <span class="workout-timer-badge"><span class="dot"></span> Active Workout</span>
          <span class="text-sm text-muted">${(activeWorkout.exercises || []).length} exercises</span>
        </div>
        <p class="text-sm text-muted">Tap to resume your workout</p>
      </div>
    ` : ''}

    ${renderWeeklyGoal(workoutsThisWeek, settings.weeklyGoal || 4)}

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value">${streak}</div>
        <div class="stat-label">Day Streak</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${workoutsThisWeek}</div>
        <div class="stat-label">This Week</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${workouts.length}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${getTotalVolume(workouts, settings.weightUnit)}</div>
        <div class="stat-label">Weekly Vol (${settings.weightUnit})</div>
      </div>
    </div>

    <p class="section-title">Quick Actions</p>
    <div class="quick-actions">
      <a href="#/workout" class="quick-action">
        <div class="quick-action-icon" style="background: var(--accent-dim)">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
        <span class="quick-action-label">New Workout</span>
      </a>
      <a href="#/timer" class="quick-action">
        <div class="quick-action-icon" style="background: var(--warning-dim)">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2">
            <circle cx="12" cy="13" r="9"/>
            <polyline points="12 9 12 13 15 14"/>
            <path d="M9 2h6"/>
          </svg>
        </div>
        <span class="quick-action-label">Timer</span>
      </a>
      <a href="#/history" class="quick-action">
        <div class="quick-action-icon" style="background: rgba(102,126,234,0.15)">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" stroke-width="2">
            <path d="M12 8v4l3 3"/>
            <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
          </svg>
        </div>
        <span class="quick-action-label">History</span>
      </a>
      <a href="#/tools" class="quick-action">
        <div class="quick-action-icon" style="background: rgba(165,94,234,0.15)">
          <svg viewBox="0 0 24 24" fill="none" stroke="#a55eea" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <span class="quick-action-label">Tools</span>
      </a>
    </div>

    ${todayWorkout ? `
      <p class="section-title">Today's Workout</p>
      <div class="card mb-16">
        <div class="flex items-center justify-between mb-8">
          <span class="font-bold">${(todayWorkout.exercises || []).length} Exercises</span>
          <span class="text-sm text-muted">${formatDuration(todayWorkout.startTime, todayWorkout.endTime)}</span>
        </div>
        ${(todayWorkout.exercises || []).map(ex => `
          <div class="text-sm mb-8">
            <span class="font-bold">${escapeHtml(ex.name)}</span>
            <span class="text-muted"> — ${(ex.sets || []).filter(s => s.completed).length} sets</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${getRecentWorkouts(workouts)}
  `;

  // Event listener for resume workout
  const resumeBtn = container.querySelector('#resume-workout');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      window.location.hash = '#/workout';
    });
  }

  // Event listeners for recent workout cards
  container.querySelectorAll('[data-nav="history"]').forEach(card => {
    card.addEventListener('click', () => {
      location.hash = '#/history';
    });
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 17) return 'Good afternoon!';
  return 'Good evening!';
}

function getTotalVolume(workouts, unit) {
  const now = new Date();
  const weekStart = new Date(now);
  const dayOfWeek = now.getDay();
  weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const weekStartStr = weekStart.toISOString().split('T')[0];

  let volume = 0;
  workouts
    .filter(w => w.date >= weekStartStr)
    .forEach(w => {
      (w.exercises || []).forEach(ex => {
        (ex.sets || []).forEach(s => {
          if (s.completed && s.weight && s.reps) {
            volume += s.weight * s.reps;
          }
        });
      });
    });

  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
  return String(volume);
}

function renderWeeklyGoal(current, goal) {
  const pct = Math.min(1, current / goal);
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - pct);
  const goalMet = current >= goal;

  return `
    <div class="weekly-goal-card mb-24">
      <div class="weekly-goal-ring">
        <svg viewBox="0 0 100 100" width="80" height="80">
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-tertiary)" stroke-width="8"/>
          <circle cx="50" cy="50" r="40" fill="none"
            stroke="${goalMet ? 'var(--accent)' : 'var(--accent-secondary)'}"
            stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            transform="rotate(-90 50 50)"
            style="transition: stroke-dashoffset 0.5s ease"/>
        </svg>
        <span class="weekly-goal-text">${current}/${goal}</span>
      </div>
      <div class="weekly-goal-info">
        <div class="font-bold">${goalMet ? 'Goal reached!' : `${goal - current} more to go`}</div>
        <div class="text-sm text-muted">Weekly workout goal</div>
      </div>
    </div>
  `;
}

function getRecentWorkouts(workouts) {
  const recent = workouts.slice(0, 3);
  if (recent.length === 0) return '';

  return `
    <p class="section-title">Recent Workouts</p>
    ${recent.map(w => `
      <div class="workout-summary-card" data-nav="history">
        <div class="workout-summary-header">
          <span class="workout-summary-title">${formatDate(w.date)}</span>
          <span class="workout-summary-time">${formatDuration(w.startTime, w.endTime)}</span>
        </div>
        <div class="workout-summary-exercises">
          ${(w.exercises || []).map(ex => `<span class="workout-summary-exercise">${escapeHtml(ex.name)}</span>`).join('')}
        </div>
      </div>
    `).join('')}
  `;
}
