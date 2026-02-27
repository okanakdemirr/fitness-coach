import { store } from '../store.js';
import { escapeHtml } from '../utils.js';

export function statsPage(container) {
  const workouts = store.getWorkouts();
  const settings = store.getSettings();
  const unit = settings.weightUnit || 'kg';

  // Calculate stats
  const now = new Date();
  const dayOfWeek = now.getDay();

  // This week (Monday-based)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const thisWeek = workouts.filter(w => w.date >= weekStartStr);

  // This month
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const thisMonth = workouts.filter(w => w.date >= monthStart);

  // Streak
  let streak = 0;
  const checkDate = new Date();
  const todayStr = checkDate.toISOString().split('T')[0];
  if (!workouts.some(w => w.date === todayStr)) {
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

  // Weekly volume
  let weeklyVolume = 0;
  thisWeek.forEach(w => {
    (w.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (s.completed && s.weight && s.reps) {
          weeklyVolume += s.weight * s.reps;
        }
      });
    });
  });

  // Weekly bar chart data (Mon-Sun)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekData = weekDays.map((day, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayWorkouts = workouts.filter(w => w.date === dateStr);
    const sets = dayWorkouts.reduce((a, w) =>
      a + (w.exercises || []).reduce((b, e) => b + (e.sets || []).filter(s => s.completed).length, 0), 0);
    return { day, sets, hasWorkout: dayWorkouts.length > 0 };
  });
  const maxSets = Math.max(...weekData.map(d => d.sets), 1);

  // Most trained muscle groups
  const categoryCount = {};
  workouts.forEach(w => {
    (w.exercises || []).forEach(ex => {
      categoryCount[ex.category] = (categoryCount[ex.category] || 0) + 1;
    });
  });
  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Personal records (highest weight per exercise)
  const records = {};
  workouts.forEach(w => {
    (w.exercises || []).forEach(ex => {
      (ex.sets || []).forEach(s => {
        if (s.completed && s.weight) {
          if (!records[ex.name] || s.weight > records[ex.name]) {
            records[ex.name] = s.weight;
          }
        }
      });
    });
  });
  const topRecords = Object.entries(records)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  container.innerHTML = `
    <p class="page-title">Stats</p>

    <div class="streak-display">
      <div class="streak-number">${streak}</div>
      <div class="streak-label">Day Streak</div>
    </div>

    <div class="stat-grid mb-24">
      <div class="stat-card">
        <div class="stat-value">${thisWeek.length}</div>
        <div class="stat-label">This Week</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${thisMonth.length}</div>
        <div class="stat-label">This Month</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${workouts.length}</div>
        <div class="stat-label">All Time</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatVolume(weeklyVolume)}</div>
        <div class="stat-label">Weekly Vol (${unit})</div>
      </div>
    </div>

    <p class="section-title">This Week</p>
    <div class="weekly-chart">
      ${weekData.map(d => `
        <div class="weekly-bar">
          <div class="weekly-bar-fill ${d.sets === 0 ? 'empty' : ''}"
            style="height: ${d.sets > 0 ? Math.max(10, (d.sets / maxSets) * 80) : 4}px">
          </div>
          <span class="weekly-bar-label">${d.day}</span>
        </div>
      `).join('')}
    </div>

    ${topCategories.length > 0 ? `
      <p class="section-title">Top Muscle Groups</p>
      <div class="card mb-24">
        ${topCategories.map(([cat, count]) => `
          <div class="flex items-center justify-between" style="padding:8px 0">
            <span style="text-transform:capitalize;font-weight:600">${cat}</span>
            <span class="text-muted text-sm">${count} exercises</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${topRecords.length > 0 ? `
      <p class="section-title">Personal Records</p>
      <div class="card mb-24">
        ${topRecords.map(([name, weight]) => `
          <div class="flex items-center justify-between" style="padding:8px 0">
            <span class="font-bold">${escapeHtml(name)}</span>
            <span class="text-accent font-bold">${weight} ${unit}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${workouts.length === 0 ? `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M18 20V10M12 20V4M6 20v-6"/>
        </svg>
        <p>Start logging workouts to see your stats!</p>
      </div>
    ` : ''}
  `;
}

function formatVolume(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}
