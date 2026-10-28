// Derived workout statistics shared across pages
import { toDateStr, todayStr, addDays, startOfWeek, parseDateStr } from './utils.js';

export function completedSets(exercise) {
  return (exercise.sets || []).filter(s => s.completed);
}

export function countCompletedSets(workout) {
  return (workout.exercises || []).reduce((a, ex) => a + completedSets(ex).length, 0);
}

export function workoutVolume(workout) {
  let volume = 0;
  for (const ex of (workout.exercises || [])) {
    for (const s of completedSets(ex)) {
      if (s.weight && s.reps) volume += s.weight * s.reps;
    }
  }
  return volume;
}

export function totalVolume(workouts) {
  return workouts.reduce((a, w) => a + workoutVolume(w), 0);
}

// Epley estimate; for 1 rep it is the weight itself
export function estimate1RM(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function workoutsSince(workouts, dateStr) {
  return workouts.filter(w => w.date >= dateStr);
}

export function thisWeekWorkouts(workouts) {
  return workoutsSince(workouts, toDateStr(startOfWeek()));
}

// Consecutive days with a workout, ending today (or yesterday if no workout yet today)
export function calcStreak(workouts) {
  const dates = new Set(workouts.map(w => w.date));
  let day = new Date();
  if (!dates.has(todayStr())) day = addDays(day, -1);
  let streak = 0;
  while (dates.has(toDateStr(day))) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

// Consecutive weeks (ending with last week, plus this week if already met)
// in which the weekly goal was hit
export function calcWeekStreak(workouts, goal) {
  const countByWeek = {};
  for (const w of workouts) {
    const wk = toDateStr(startOfWeek(parseDateStr(w.date)));
    countByWeek[wk] = (countByWeek[wk] || 0) + 1;
  }
  let week = startOfWeek();
  let streak = (countByWeek[toDateStr(week)] || 0) >= goal ? 1 : 0;
  week = addDays(week, -7);
  while ((countByWeek[toDateStr(week)] || 0) >= goal) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

// Per-session history for a single exercise, newest first
export function getExerciseHistory(workouts, name) {
  const nameLower = name.toLowerCase();
  const history = [];
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      if (ex.name.toLowerCase() !== nameLower) continue;
      const sets = completedSets(ex);
      if (sets.length === 0) continue;
      let best = sets[0];
      let bestE1rm = 0;
      let volume = 0;
      for (const s of sets) {
        const e = estimate1RM(s.weight || 0, s.reps || 0);
        if (e > bestE1rm || (e === bestE1rm && (s.weight || 0) > (best.weight || 0))) {
          bestE1rm = e;
          best = s;
        }
        volume += (s.weight || 0) * (s.reps || 0);
      }
      history.push({
        workoutId: w.id,
        date: w.date,
        startTime: w.startTime,
        sets,
        bestSet: best,
        maxWeight: Math.max(...sets.map(s => s.weight || 0)),
        maxReps: Math.max(...sets.map(s => s.reps || 0)),
        e1rm: bestE1rm,
        volume
      });
    }
  }
  history.sort((a, b) =>
    b.date.localeCompare(a.date) || (b.startTime || '').localeCompare(a.startTime || '')
  );
  return history;
}

// Sets from the most recent session of an exercise (for "previous" hints)
export function getLastPerformance(workouts, name) {
  const nameLower = name.toLowerCase();
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      if (ex.name.toLowerCase() !== nameLower) continue;
      const sets = completedSets(ex);
      if (sets.length > 0) return sets;
    }
  }
  return null;
}

// Best weight lifted per exercise
export function getPersonalRecords(workouts) {
  const records = {};
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      for (const s of completedSets(ex)) {
        if (!s.weight) continue;
        const r = records[ex.name];
        if (!r || s.weight > r.weight || (s.weight === r.weight && (s.reps || 0) > r.reps)) {
          records[ex.name] = {
            name: ex.name,
            category: ex.category,
            weight: s.weight,
            reps: s.reps || 0,
            date: w.date
          };
        }
      }
    }
  }
  return records;
}

// Exercises in `workout` where a weight beat everything in `previousWorkouts`
export function findNewPRs(workout, previousWorkouts) {
  const prev = getPersonalRecords(previousWorkouts);
  const prs = [];
  for (const ex of (workout.exercises || [])) {
    const sets = completedSets(ex).filter(s => s.weight);
    if (sets.length === 0) continue;
    const best = Math.max(...sets.map(s => s.weight));
    const before = prev[ex.name]?.weight || 0;
    if (before > 0 && best > before) {
      prs.push({ name: ex.name, weight: best, previous: before });
    }
  }
  return prs;
}

// Completed sets per category since a date
export function setsByCategory(workouts, sinceDateStr) {
  const counts = {};
  for (const w of workouts) {
    if (sinceDateStr && w.date < sinceDateStr) continue;
    for (const ex of (w.exercises || [])) {
      const n = completedSets(ex).length;
      if (n) counts[ex.category] = (counts[ex.category] || 0) + n;
    }
  }
  return counts;
}

// Last `weeks` weeks (oldest first) with workout count and volume
export function weeklySeries(workouts, weeks = 8) {
  const thisWeek = startOfWeek();
  const series = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const startStr = toDateStr(start);
    const endStr = toDateStr(addDays(start, 7));
    const inWeek = workouts.filter(w => w.date >= startStr && w.date < endStr);
    series.push({
      start,
      startStr,
      count: inWeek.length,
      volume: totalVolume(inWeek),
      sets: inWeek.reduce((a, w) => a + countCompletedSets(w), 0)
    });
  }
  return series;
}

// Names of exercises ordered by most recent use
export function recentExerciseNames(workouts, limit = 8) {
  const seen = new Set();
  const names = [];
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      const key = ex.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push({ name: ex.name, category: ex.category });
      if (names.length >= limit) return names;
    }
  }
  return names;
}

export function defaultWorkoutName(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Night Workout';
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  if (h < 21) return 'Evening Workout';
  return 'Night Workout';
}

export function workoutTitle(workout) {
  if (workout.name) return workout.name;
  const n = (workout.exercises || []).length;
  return `${n} exercise${n !== 1 ? 's' : ''}`;
}
