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

function showInstallBanner() {
  // Only show if not already installed
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  const banner = document.createElement('div');
  banner.className = 'card';
  banner.style.cssText = `
    position: fixed; bottom: 80px; left: 16px; right: 16px; z-index: 150;
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
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
    banner.remove();
  });

  banner.querySelector('#dismiss-btn').addEventListener('click', () => {
    banner.remove();
  });
}

// Register service worker (handled by vite-plugin-pwa but log status)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.ready.then(() => {
      console.log('FitCoach PWA is ready for offline use');
    });
  });
}
