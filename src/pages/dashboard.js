import { store } from '../store.js';
import { formatDate, formatDuration, todayStr } from '../utils.js';

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
          <span class="text-sm text-muted">${activeWorkout.exercises.length} exercises</span>
        </div>
        <p class="text-sm text-muted">Tap to resume your workout</p>
      </div>
    ` : ''}

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
      <a href="#/stats" class="quick-action">
        <div class="quick-action-icon" style="background: rgba(165,94,234,0.15)">
          <svg viewBox="0 0 24 24" fill="none" stroke="#a55eea" stroke-width="2">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
        </div>
        <span class="quick-action-label">Stats</span>
      </a>
    </div>

    ${todayWorkout ? `
      <p class="section-title">Today's Workout</p>
      <div class="card mb-16">
        <div class="flex items-center justify-between mb-8">
          <span class="font-bold">${todayWorkout.exercises.length} Exercises</span>
          <span class="text-sm text-muted">${formatDuration(todayWorkout.startTime, todayWorkout.endTime)}</span>
        </div>
        ${todayWorkout.exercises.map(ex => `
          <div class="text-sm mb-8">
            <span class="font-bold">${ex.name}</span>
            <span class="text-muted"> — ${ex.sets.filter(s => s.completed).length} sets</span>
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
      w.exercises.forEach(ex => {
        ex.sets.forEach(s => {
          if (s.completed && s.weight && s.reps) {
            volume += s.weight * s.reps;
          }
        });
      });
    });

  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
  return String(volume);
}

function getRecentWorkouts(workouts) {
  const recent = workouts.slice(0, 3);
  if (recent.length === 0) return '';

  return `
    <p class="section-title">Recent Workouts</p>
    ${recent.map(w => `
      <div class="workout-summary-card" onclick="location.hash='#/history'">
        <div class="workout-summary-header">
          <span class="workout-summary-title">${formatDate(w.date)}</span>
          <span class="workout-summary-time">${formatDuration(w.startTime, w.endTime)}</span>
        </div>
        <div class="workout-summary-exercises">
          ${w.exercises.map(ex => `<span class="workout-summary-exercise">${ex.name}</span>`).join('')}
        </div>
      </div>
    `).join('')}
  `;
}
