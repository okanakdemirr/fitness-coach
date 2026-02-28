# FitCoach - Personal Fitness Tracker PWA

A progressive web app for tracking workouts, managing timers, and monitoring fitness progress. Works offline and installs on any device.

## Features

- **Workout Logging** - Create workouts, add exercises from a library of 59+ built-in exercises or add custom ones, track sets/reps/weight with auto rest timer
- **Timer Modes** - Countdown, rest, and interval timers with presets (Tabata, HIIT, EMOM), audio cues, and screen wake lock
- **History & Calendar** - View past workouts with a 12-week GitHub-style activity heatmap
- **Stats & Analytics** - Day streaks, weekly volume, bar charts, personal records, top muscle groups, and interactive muscle map
- **Body Weight Tracking** - Log daily weight entries, view progress chart, and track trends over time
- **Fitness Tools** - 1RM calculator, plate calculator, BMI calculator, RM table, exercise progress tracker, and stopwatch
- **Templates** - Save and reuse favorite workout routines
- **Settings** - Dark/light theme, weight units (kg/lbs), configurable rest times, weekly goals, body weight tracking
- **Data Management** - Export/import JSON backups, clear all data
- **PWA** - Installable on iOS and Android, offline support, auto-updating service worker

## Tech Stack

| Layer       | Technology                    |
|-------------|-------------------------------|
| Framework   | Vanilla JavaScript (ES modules) |
| Build       | Vite 7                        |
| PWA         | vite-plugin-pwa (Workbox)     |
| Storage     | LocalStorage                  |
| Styling     | Custom CSS with CSS variables |
| Deployment  | GitHub Pages (GitHub Actions) |

## Project Structure

```
fitness-coach/
├── index.html                  # Entry point
├── vite.config.js              # Vite + PWA config
├── package.json
├── .github/workflows/
│   └── deploy.yml              # CI/CD pipeline
├── public/
│   ├── favicon.svg
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── pwa-192x192.png
│   ├── pwa-192x192.svg
│   ├── pwa-512x512.png
│   └── pwa-512x512.svg
└── src/
    ├── main.js                 # App init, PWA install prompts
    ├── router.js               # Hash-based SPA router
    ├── store.js                # LocalStorage data layer
    ├── utils.js                # Shared utilities (toasts, modals, audio, wake lock)
    ├── globalTimer.js          # Global timer state management
    ├── floatingTimer.js        # Floating timer widget
    ├── muscleMap.js            # SVG muscle map visualization
    ├── data/
    │   └── exercises.js        # Built-in exercise database (59 exercises, 8 categories)
    ├── pages/
    │   ├── dashboard.js        # Home - stats overview, quick actions
    │   ├── workout.js          # Workout session management
    │   ├── timer.js            # Countdown, rest, interval timers
    │   ├── history.js          # Workout history + calendar heatmap
    │   ├── stats.js            # Analytics and charts
    │   ├── tools.js            # Fitness calculators + stopwatch
    │   ├── weight.js           # Body weight tracking + chart
    │   └── settings.js         # App configuration + data management
    └── styles/
        ├── main.css            # CSS variables, layout, reset
        ├── components.css      # Reusable UI components
        └── pages.css           # Page-specific styles
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

## Deployment

The app auto-deploys to GitHub Pages on every push to `main` via the GitHub Actions workflow in `.github/workflows/deploy.yml`.

**Live URL:** `https://<username>.github.io/fitness-coach/`

## Data Storage

All data is stored client-side in LocalStorage with the `fitcoach_` prefix. No server or database required. Users can export/import their data as JSON backups from the Settings page.

## License

MIT
