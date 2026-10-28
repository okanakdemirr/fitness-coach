# CLAUDE.md

## Project Overview

FitCoach is a progressive web app (PWA) for tracking workouts, managing timers, and monitoring fitness progress. It works offline and installs on any device.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server with hot reload
npm run build     # Production build (outputs to dist/)
npm run preview   # Preview the production build locally
```

No test framework is configured. There are no lint or format scripts.

## Tech Stack

- **Language:** Vanilla JavaScript (ES modules, `"type": "module"`)
- **Build:** Vite 7 (`vite.config.js`)
- **PWA:** vite-plugin-pwa with Workbox (auto-update service worker)
- **Storage:** LocalStorage (all keys prefixed with `fitcoach_`)
- **Styling:** Custom CSS with CSS variables for theming (dark/light)
- **Deployment:** GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)
- **No TypeScript, no UI framework, no backend**

## Project Structure

```
index.html                  # Single HTML entry point (inline critical CSS + pre-paint theme script)
vite.config.js              # Vite + PWA plugin config (base: /fitness-coach/), defines __APP_VERSION__
src/
  main.js                   # App init, theme, PWA install prompts, audio unlock
  router.js                 # Hash-based SPA router (closes modals, scrolls to top on navigation)
  store.js                  # LocalStorage data layer (settings defaults, unit conversion, backup/restore)
  utils.js                  # Dates (local time), formatting, toasts, modals/dialogs, sound, vibration, wake lock
  analytics.js              # Derived stats: streaks, volume, PRs, e1RM, exercise history
  theme.js                  # dark / light / system theme handling
  charts.js                 # Dependency-free SVG line and bar charts
  exercisePicker.js         # Shared exercise picker sheet (search, filters, recent, custom exercises)
  exerciseProgress.js       # Per-exercise progress sheet (chart, bests, history)
  globalTimer.js            # Global timer state (persists across reloads)
  floatingTimer.js          # Floating timer widget
  muscleMap.js              # SVG muscle map visualization (front/back body views)
  data/
    exercises.js            # Built-in exercise database (81 exercises, 7 categories)
  pages/
    dashboard.js            # Home — start/resume, weekly goal, stats, muscle map, recent workouts
    workout.js              # Workout session, templates (create/edit), rest timer popup
    timer.js                # Countdown, rest, interval timers
    history.js              # Workout history + calendar heatmap (Progress tab)
    stats.js                # Analytics and charts (Progress tab)
    tools.js                # Plate/1RM/BMI calculators, percentage table, stopwatch
    weight.js               # Body weight tracking + chart
    settings.js             # App configuration + data management
  styles/
    main.css                # Design tokens (CSS variables), layout, reset, modal/toast
    components.css          # Reusable UI components
    pages.css               # Page-specific styles
public/                     # Static assets (icons, favicons)
```

## Architecture

### Router
Hash-based SPA router (`src/router.js`). Routes are registered in `main.js` via `route(path, handler)`. Each page handler is a function that receives the content container element and optionally returns a cleanup function called on navigation away.

### Data Layer
`src/store.js` exports a `store` object wrapping LocalStorage with JSON serialization. All keys use the `fitcoach_` prefix. Domain methods: `getWorkouts()`, `saveWorkout()`, `getTemplates()`, `getSettings()`, `getActiveWorkout()`, etc.

### Pages
Each page module in `src/pages/` exports a single function (e.g., `dashboardPage`, `workoutPage`). The function receives a container DOM element, builds the UI via `innerHTML` and DOM APIs, attaches event listeners, and returns a cleanup function if needed.

### Theming
Dark/light themes controlled by `data-theme` on `<html>` (`theme.js`; the "system" setting follows `prefers-color-scheme`). Design tokens live in `src/styles/main.css` and are mirrored in the inline critical CSS in `index.html` — keep them in sync. Use `--accent` for filled surfaces (with `--on-accent` text) and `--accent-ink` for accent-colored text, strokes and charts, since the light theme needs a darker ink for contrast.

### Dates
Workout and body-weight dates are local-time `YYYY-MM-DD` strings. Always use `todayStr()` / `toDateStr()` from `utils.js` — never `toISOString()`, which converts to UTC and shifts the day.

### Modals
`showModal(content, { onClose })` opens a bottom sheet and returns a `close` function. Elements with `data-close` close it automatically. Use `confirmDialog()` / `promptDialog()` (Promise-based) instead of `confirm()` / `prompt()`.

## Code Conventions

- ES module imports/exports (`import`/`export`)
- camelCase for variables, functions, and file names
- Use `escapeHtml()` from `src/utils.js` when interpolating user-provided strings into HTML
- Use `generateId(prefix)` from `src/utils.js` for unique IDs
- UI built with template literals and `innerHTML`, with event listeners attached via `querySelector`/`addEventListener`
- No classes — functional style with plain objects and module-level state
- Prefer `const`; use `let` only when reassignment is needed
- CSS class naming: lowercase with hyphens (e.g., `btn-primary`, `page-title`, `nav-item`)
- The `base` path in `vite.config.js` is `/fitness-coach/` for GitHub Pages deployment
