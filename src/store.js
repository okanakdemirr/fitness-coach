// Simple localStorage wrapper with JSON serialization

const PREFIX = 'fitcoach_';

export const DEFAULT_SETTINGS = {
  theme: 'dark', // 'dark' | 'light' | 'system'
  weightUnit: 'kg',
  defaultRestTime: 90,
  autoRestTimer: true,
  soundEnabled: true,
  vibrationEnabled: true,
  weeklyGoal: 4
};

const LBS_PER_KG = 2.20462;

// Round to 0.1 so unit conversions don't leave float noise behind
const round1 = (n) => Math.round(n * 10) / 10;

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
      return true;
    } catch (e) {
      console.warn('Storage write failed:', e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(PREFIX + key);
  },

  // Workout operations
  getWorkouts() {
    const workouts = this.get('workouts', []);
    return Array.isArray(workouts) ? workouts : [];
  },

  saveWorkout(workout) {
    const workouts = this.getWorkouts();
    const idx = workouts.findIndex(w => w.id === workout.id);
    if (idx >= 0) {
      workouts[idx] = workout;
    } else {
      workouts.push(workout);
    }
    // Newest first; ties broken by start time
    workouts.sort((a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      (b.startTime || '').localeCompare(a.startTime || '')
    );
    this.set('workouts', workouts);
  },

  deleteWorkout(id) {
    const workouts = this.getWorkouts().filter(w => w.id !== id);
    this.set('workouts', workouts);
  },

  // Template operations
  getTemplates() {
    const templates = this.get('templates', []);
    return Array.isArray(templates) ? templates : [];
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
    const stats = this.get('bodyStats', []);
    return Array.isArray(stats) ? stats : [];
  },

  addBodyStat(entry) {
    const stats = this.getBodyStats();
    // One entry per day: replace if same date exists
    const idx = stats.findIndex(s => s.date === entry.date);
    if (idx >= 0) {
      stats[idx] = entry;
    } else {
      stats.push(entry);
    }
    stats.sort((a, b) => b.date.localeCompare(a.date));
    this.set('bodyStats', stats);
  },

  deleteBodyStat(date) {
    const stats = this.getBodyStats().filter(s => s.date !== date);
    this.set('bodyStats', stats);
  },

  // Settings — always merged over defaults so older/imported settings
  // objects missing newer keys still behave
  getSettings() {
    const saved = this.get('settings', {});
    return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  },

  updateSettings(updates) {
    const settings = { ...this.getSettings(), ...updates };
    this.set('settings', settings);
    return settings;
  },

  // Custom exercises
  getCustomExercises() {
    const exercises = this.get('customExercises', []);
    return Array.isArray(exercises) ? exercises : [];
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
    const nameLower = name.toLowerCase();
    let changed = false;
    for (const w of workouts) {
      for (const ex of (w.exercises || [])) {
        if (ex.name.toLowerCase() === nameLower && ex.category !== category) {
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
  },

  // Convert every stored weight between kg and lbs
  convertAllWeights(from, to) {
    if (from === to) return;
    const factor = to === 'lbs' ? LBS_PER_KG : 1 / LBS_PER_KG;
    const convertSets = (exercises) => {
      for (const ex of (exercises || [])) {
        for (const s of (ex.sets || [])) {
          if (s.weight) s.weight = round1(s.weight * factor);
        }
      }
    };

    const workouts = this.getWorkouts();
    workouts.forEach(w => convertSets(w.exercises));
    this.set('workouts', workouts);

    const active = this.getActiveWorkout();
    if (active) {
      convertSets(active.exercises);
      this.setActiveWorkout(active);
    }

    const stats = this.getBodyStats().map(s => {
      const unit = s.unit || from;
      if (unit === to) return s;
      return { ...s, weight: round1(s.weight * factor), unit: to };
    });
    this.set('bodyStats', stats);
  },

  // Backup / restore
  exportData() {
    return {
      app: 'fitcoach',
      version: 2,
      exportDate: new Date().toISOString(),
      workouts: this.getWorkouts(),
      templates: this.getTemplates(),
      bodyStats: this.getBodyStats(),
      customExercises: this.getCustomExercises(),
      settings: this.getSettings()
    };
  },

  // Returns a summary of what was imported, or throws on invalid data
  importData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid backup file');
    }
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    const summary = {};

    if (Array.isArray(data.workouts)) {
      const workouts = data.workouts
        .filter(w => isObj(w) && typeof w.date === 'string' && Array.isArray(w.exercises))
        .slice(0, 10000);
      this.set('workouts', workouts);
      summary.workouts = workouts.length;
    }
    if (Array.isArray(data.templates)) {
      const templates = data.templates
        .filter(t => isObj(t) && typeof t.name === 'string' && Array.isArray(t.exercises))
        .slice(0, 500);
      this.set('templates', templates);
      summary.templates = templates.length;
    }
    if (Array.isArray(data.bodyStats)) {
      const stats = data.bodyStats
        .filter(s => isObj(s) && typeof s.date === 'string' && Number.isFinite(s.weight))
        .slice(0, 5000);
      this.set('bodyStats', stats);
      summary.bodyStats = stats.length;
    }
    if (Array.isArray(data.customExercises)) {
      const custom = data.customExercises
        .filter(e => isObj(e) && typeof e.name === 'string' && typeof e.category === 'string')
        .slice(0, 1000);
      this.set('customExercises', custom);
    }
    if (isObj(data.settings)) {
      const allowed = Object.keys(DEFAULT_SETTINGS);
      const clean = {};
      for (const k of allowed) if (k in data.settings) clean[k] = data.settings[k];
      this.set('settings', { ...this.getSettings(), ...clean });
    }
    if (Object.keys(summary).length === 0) {
      throw new Error('No FitCoach data found in file');
    }
    return summary;
  },

  clearAll() {
    this.set('workouts', []);
    this.set('templates', []);
    this.set('bodyStats', []);
    this.set('customExercises', []);
    this.clearActiveWorkout();
  }
};
