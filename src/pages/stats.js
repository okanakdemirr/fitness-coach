import { store } from '../store.js';
import {
  escapeHtml, toDateStr, addDays, startOfWeek, todayStr, parseDateStr, formatVolume, formatNumber,
  formatDate, capitalize, categoryColor
} from '../utils.js';
import {
  calcStreak, calcWeekStreak, thisWeekWorkouts, workoutsSince, countCompletedSets, totalVolume,
  getPersonalRecords, setsByCategory, weeklySeries
} from '../analytics.js';
import { barChart } from '../charts.js';
import { showExerciseProgress } from '../exerciseProgress.js';
import { progressTabs } from './history.js';

export function statsPage(container) {
  const workouts = store.getWorkouts();
  const settings = store.getSettings();
  const unit = settings.weightUnit;
  const goal = settings.weeklyGoal || 4;

  if (workouts.length === 0) {
    container.innerHTML = `
      <header class="page-header"><h1 class="page-title">Progress</h1></header>
      ${progressTabs('stats')}
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>
        </div>
        <p class="empty-title">No stats yet</p>
        <p>Log a few workouts and your trends, records and muscle balance will show up here.</p>
        <a href="#/workout" class="btn btn-primary mt-16">Start a workout</a>
      </div>
    `;
    return;
  }

  const now = new Date();
  const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const thisWeek = thisWeekWorkouts(workouts);
  const thisMonth = workoutsSince(workouts, monthStart);
  const streak = calcStreak(workouts);
  const weekStreak = calcWeekStreak(workouts, goal);

  // This week, sets per day
  const monday = startOfWeek();
  const today = todayStr();
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekBars = dayNames.map((label, i) => {
    const d = toDateStr(addDays(monday, i));
    const sets = workouts.filter(w => w.date === d).reduce((a, w) => a + countCompletedSets(w), 0);
    return { label, value: sets, highlight: d === today };
  });

  // Last 8 weeks
  const series = weeklySeries(workouts, 8);
  const volumeBars = series.map((s, i) => ({
    label: i === series.length - 1 ? 'Now' : s.start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
    value: s.volume,
    highlight: i === series.length - 1
  }));
  // Compare with last week up to the same weekday, not the whole week
  const daysIntoWeek = Math.round((parseDateStr(today) - monday) / 86400000) + 1;
  const lastWeekStart = toDateStr(addDays(monday, -7));
  const lastWeekSameDay = toDateStr(addDays(monday, -7 + daysIntoWeek));
  const lastWeekVol = totalVolume(workouts.filter(w => w.date >= lastWeekStart && w.date < lastWeekSameDay));
  const avgWorkouts = series.slice(0, -1).reduce((a, s) => a + s.count, 0) / Math.max(1, series.length - 1);

  // Muscle balance, last 30 days
  const since30 = toDateStr(addDays(now, -29));
  const byCat = Object.entries(setsByCategory(workouts, since30)).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...byCat.map(([, n]) => n));

  // Records
  const records = Object.values(getPersonalRecords(workouts))
    .sort((a, b) => b.date.localeCompare(a.date) || b.weight - a.weight);

  container.innerHTML = `
    <header class="page-header"><h1 class="page-title">Progress</h1></header>
    ${progressTabs('stats')}

    <div class="streak-banner mb-16">
      <div class="streak-main">
        <span class="streak-flame" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1 2.5 2 3 0-3 0-6 1-9.5z"/></svg>
        </span>
        <div>
          <div class="streak-number">${streak} <small>day${streak !== 1 ? 's' : ''}</small></div>
          <div class="streak-label">${streak ? 'Current streak — keep it alive!' : 'Train today to start a streak'}</div>
        </div>
      </div>
      <div class="streak-side">
        <div class="streak-side-value">${weekStreak}</div>
        <div class="streak-side-label">weeks on goal</div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-value">${thisWeek.length}<small>/${goal}</small></span>
        <span class="stat-label">This week</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${thisMonth.length}</span>
        <span class="stat-label">This month</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${workouts.length}</span>
        <span class="stat-label">All time</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${formatNumber(avgWorkouts, 1)}</span>
        <span class="stat-label">Avg / week</span>
      </div>
    </div>

    <section class="card mb-16">
      <div class="card-head">
        <span class="card-title">This week</span>
        <span class="section-meta">sets per day</span>
      </div>
      ${barChart(weekBars, { height: 110 })}
    </section>

    <section class="card mb-16">
      <div class="card-head">
        <span class="card-title">Weekly volume</span>
        ${trendBadge(series.at(-1).volume, lastWeekVol)}
      </div>
      <div class="card-big-number">${formatVolume(series.at(-1).volume)} <small>${escapeHtml(unit)} this week</small></div>
      ${barChart(volumeBars, { height: 110, format: formatVolume, showValues: false })}
    </section>

    ${byCat.length ? `
      <section class="card mb-16">
        <div class="card-head">
          <span class="card-title">Muscle balance</span>
          <span class="section-meta">sets · last 30 days</span>
        </div>
        <div class="hbar-list">
          ${byCat.map(([cat, n]) => `
            <div class="hbar">
              <span class="hbar-label">${escapeHtml(capitalize(cat))}</span>
              <div class="hbar-track"><div class="hbar-fill" style="width:${(n / maxCat) * 100}%;background:${categoryColor(cat)}"></div></div>
              <span class="hbar-value">${n}</span>
            </div>
          `).join('')}
        </div>
      </section>
    ` : ''}

    ${records.length ? `
      <div class="section-header">
        <h2 class="section-title">Personal records</h2>
        <button class="link-btn" id="all-progress">Exercise progress</button>
      </div>
      <div class="record-list">
        ${records.slice(0, 8).map(r => `
          <button class="record-item" data-name="${escapeHtml(r.name)}">
            <span class="cat-bar" style="background:${categoryColor(r.category)}"></span>
            <span class="record-text">
              <span class="record-name">${escapeHtml(r.name)}</span>
              <span class="record-date">${escapeHtml(formatDate(r.date))}</span>
            </span>
            <span class="record-value">${formatNumber(r.weight)} <small>${escapeHtml(unit)} × ${r.reps}</small></span>
          </button>
        `).join('')}
      </div>
    ` : ''}
  `;

  container.querySelectorAll('.record-item').forEach(btn => {
    btn.addEventListener('click', () => showExerciseProgress(btn.dataset.name));
  });
  container.querySelector('#all-progress')?.addEventListener('click', () => showExerciseProgress());
}

function trendBadge(current, previous) {
  if (!previous) return '';
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return `<span class="badge ${up ? 'badge-accent' : 'badge-muted'}">${up ? '▲' : '▼'} ${Math.abs(pct)}% vs last week so far</span>`;
}
