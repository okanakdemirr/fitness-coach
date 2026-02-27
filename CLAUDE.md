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
index.html                  # Single HTML entry point (inline critical CSS)
vite.config.js              # Vite + PWA plugin config (base: /fitness-coach/)
src/
  main.js                   # App init, theme, PWA install prompts, service worker
  router.js                 # Hash-based SPA router
  store.js                  # LocalStorage data layer
  utils.js                  # Shared helpers (toasts, modals, audio, wake lock)
  globalTimer.js             # Global timer state
  floatingTimer.js           # Floating timer widget
  data/
    exercises.js             # Built-in exercise database (56 exercises, 8 categories)
  pages/
    dashboard.js             # Home — stats overview, quick actions
    workout.js               # Workout session management
    timer.js                 # Countdown, rest, interval timers
    history.js               # Workout history + calendar heatmap
    stats.js                 # Analytics and charts
    tools.js                 # Fitness calculators + stopwatch
    settings.js              # App configuration + data management
  styles/
    main.css                 # CSS variables, layout, reset
    components.css           # Reusable UI components
    pages.css                # Page-specific styles
public/                      # Static assets (icons, favicons)
```

## Architecture

### Router
Hash-based SPA router (`src/router.js`). Routes are registered in `main.js` via `route(path, handler)`. Each page handler is a function that receives the content container element and optionally returns a cleanup function called on navigation away.

### Data Layer
`src/store.js` exports a `store` object wrapping LocalStorage with JSON serialization. All keys use the `fitcoach_` prefix. Domain methods: `getWorkouts()`, `saveWorkout()`, `getTemplates()`, `getSettings()`, `getActiveWorkout()`, etc.

### Pages
Each page module in `src/pages/` exports a single function (e.g., `dashboardPage`, `workoutPage`). The function receives a container DOM element, builds the UI via `innerHTML` and DOM APIs, attaches event listeners, and returns a cleanup function if needed.

### Theming
Dark/light themes controlled by `data-theme` attribute on `<html>`. CSS variables defined in `index.html` inline styles and `src/styles/main.css`. Theme preference stored in settings.

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
