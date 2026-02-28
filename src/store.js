// Simple localStorage wrapper with JSON serialization

const PREFIX = 'fitcoach_';

export const store = {
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage write failed:', e);
    }
  },

  remove(key) {
    localStorage.removeItem(PREFIX + key);
  },

  // Workout operations
  getWorkouts() {
    return this.get('workouts', []);
  },

  saveWorkout(workout) {
    const workouts = this.getWorkouts();
    const idx = workouts.findIndex(w => w.id === workout.id);
    if (idx >= 0) {
      workouts[idx] = workout;
    } else {
      workouts.unshift(workout);
    }
    this.set('workouts', workouts);
  },

  deleteWorkout(id) {
    const workouts = this.getWorkouts().filter(w => w.id !== id);
    this.set('workouts', workouts);
  },

  getTodayWorkout() {
    const today = new Date().toISOString().split('T')[0];
    return this.getWorkouts().find(w => w.date === today) || null;
  },

  // Template operations
  getTemplates() {
    return this.get('templates', []);
  },

  saveTemplate(template) {
    const templates = this.getTemplates();
    const idx = templates.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      templates[idx] = template;
    } else {
      templates.push(template);
    }
    this.set('templates', templates);
  },

  deleteTemplate(id) {
    const templates = this.getTemplates().filter(t => t.id !== id);
    this.set('templates', templates);
  },

  // Body stats operations
  getBodyStats() {
    return this.get('bodyStats', []);
  },

  addBodyStat(entry) {
    const stats = this.getBodyStats();
    // Replace if same date exists
    const idx = stats.findIndex(s => s.date === entry.date);
    if (idx >= 0) {
      stats[idx] = entry;
    } else {
      stats.unshift(entry);
    }
    stats.sort((a, b) => b.date.localeCompare(a.date));
    this.set('bodyStats', stats);
  },

  deleteBodyStat(date) {
    const stats = this.getBodyStats().filter(s => s.date !== date);
    this.set('bodyStats', stats);
  },

  // Settings
  getSettings() {
    return this.get('settings', {
      theme: 'dark',
      weightUnit: 'kg',
      defaultRestTime: 90,
      soundEnabled: true,
      weeklyGoal: 4
    });
  },

  updateSettings(updates) {
    const settings = { ...this.getSettings(), ...updates };
    this.set('settings', settings);
    return settings;
  },

  // Custom exercises
  getCustomExercises() {
    return this.get('customExercises', []);
  },

  saveCustomExercise(exercise) {
    const exercises = this.getCustomExercises();
    const existing = exercises.find(e => e.name.toLowerCase() === exercise.name.toLowerCase());
    if (existing) {
      return { saved: false, existing };
    }
    exercises.push(exercise);
    this.set('customExercises', exercises);
    return { saved: true };
  },

  updateCustomExercise(exercise) {
    const exercises = this.getCustomExercises();
    const idx = exercises.findIndex(e => e.name.toLowerCase() === exercise.name.toLowerCase());
    if (idx >= 0) {
      exercises[idx] = { ...exercises[idx], ...exercise };
    } else {
      exercises.push(exercise);
    }
    this.set('customExercises', exercises);
    this.propagateExerciseCategory(exercise.name, exercise.category);
  },

  propagateExerciseCategory(name, category) {
    const workouts = this.getWorkouts();
    let changed = false;
    for (const w of workouts) {
      for (const ex of (w.exercises || [])) {
        if (ex.name.toLowerCase() === name.toLowerCase() && ex.category !== category) {
          ex.category = category;
          changed = true;
        }
      }
    }
    if (changed) this.set('workouts', workouts);
  },

  deleteCustomExercise(name) {
    const exercises = this.getCustomExercises().filter(
      e => e.name.toLowerCase() !== name.toLowerCase()
    );
    this.set('customExercises', exercises);
  },

  // Active workout (in progress)
  getActiveWorkout() {
    return this.get('activeWorkout', null);
  },

  setActiveWorkout(workout) {
    this.set('activeWorkout', workout);
  },

  clearActiveWorkout() {
    this.remove('activeWorkout');
  }
};
