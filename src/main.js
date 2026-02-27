import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { route, startRouter } from './router.js';
import { store } from './store.js';
import { dashboardPage } from './pages/dashboard.js';
import { timerPage } from './pages/timer.js';
import { workoutPage } from './pages/workout.js';
import { historyPage } from './pages/history.js';
import { statsPage } from './pages/stats.js';
import { settingsPage } from './pages/settings.js';
import { toolsPage } from './pages/tools.js';

// Apply saved theme
const settings = store.getSettings();
document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

// Register routes
route('/', dashboardPage);
route('/timer', timerPage);
route('/workout', workoutPage);
route('/history', historyPage);
route('/stats', statsPage);
route('/tools', toolsPage);
route('/settings', settingsPage);

// Start the router
startRouter();

// PWA install prompt
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

// Detect iOS Safari (no beforeinstallprompt support)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

if (isIOS && !isStandalone) {
  // Show iOS-specific install banner after a short delay
  const dismissed = sessionStorage.getItem('ios-install-dismissed');
  if (!dismissed) {
    setTimeout(() => showIOSInstallBanner(), 2000);
  }
}

function showInstallBanner() {
  // Only show if not already installed
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  const banner = document.createElement('div');
  banner.className = 'card';
  banner.style.cssText = `
    position: fixed; bottom: calc(80px + env(safe-area-inset-bottom, 0px)); left: calc(16px + env(safe-area-inset-left, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); z-index: 150;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; max-width: 568px; margin: 0 auto;
    border-color: var(--accent); animation: page-fade-in 0.3s ease;
  `;
  banner.innerHTML = `
    <div>
      <div style="font-weight:700;font-size:15px">Install FitCoach</div>
      <div style="font-size:13px;color:var(--text-muted)">Add to home screen for quick access</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button class="btn btn-primary btn-sm" id="install-btn">Install</button>
      <button class="btn btn-ghost btn-sm" id="dismiss-btn">Later</button>
    </div>
  `;
  document.body.appendChild(banner);

  banner.querySelector('#install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch {
        // User cancelled or prompt failed
      }
      deferredPrompt = null;
    }
    banner.remove();
  });

  banner.querySelector('#dismiss-btn').addEventListener('click', () => {
    banner.remove();
  });
}

function showIOSInstallBanner() {
  // Don't show if already installed as standalone
  if (window.navigator.standalone) return;

  const banner = document.createElement('div');
  banner.className = 'card';
  banner.style.cssText = `
    position: fixed; bottom: calc(80px + env(safe-area-inset-bottom, 0px)); left: calc(16px + env(safe-area-inset-left, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); z-index: 150;
    max-width: 568px; margin: 0 auto;
    border-color: var(--accent); animation: page-fade-in 0.3s ease;
  `;
  banner.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div style="font-weight:700;font-size:15px;margin-bottom:6px">Install FitCoach</div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.4">
          Tap the
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin:0 2px">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Share button, then <strong>Add to Home Screen</strong>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" id="ios-dismiss" style="flex-shrink:0">&times;</button>
    </div>
  `;
  document.body.appendChild(banner);

  banner.querySelector('#ios-dismiss').addEventListener('click', () => {
    sessionStorage.setItem('ios-install-dismissed', '1');
    banner.remove();
  });
}

// Register service worker and handle updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.ready.then((registration) => {
      console.log('FitCoach PWA is ready for offline use');

      // Check for updates periodically
      setInterval(() => registration.update(), 60000);
    });

    // Auto-reload when a new service worker takes over
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
