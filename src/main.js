import './styles/main.css';
import './styles/components.css';
import './styles/pages.css';
import { route, startRouter } from './router.js';
import { applyTheme } from './theme.js';
import { unlockAudio } from './utils.js';
import { dashboardPage } from './pages/dashboard.js';
import { timerPage } from './pages/timer.js';
import { workoutPage } from './pages/workout.js';
import { historyPage } from './pages/history.js';
import { statsPage } from './pages/stats.js';
import { settingsPage } from './pages/settings.js';
import { toolsPage } from './pages/tools.js';
import { weightPage } from './pages/weight.js';
import { initFloatingTimer } from './floatingTimer.js';

// Apply saved theme
try {
  applyTheme();
} catch (err) {
  console.error('Theme init failed:', err);
  document.documentElement.setAttribute('data-theme', 'dark');
}

// Register routes
route('/', dashboardPage);
route('/timer', timerPage);
route('/workout', workoutPage);
route('/history', historyPage);
route('/stats', statsPage);
route('/tools', toolsPage);
route('/weight', weightPage);
route('/settings', settingsPage);

// Start the router
startRouter();

// Signal to the self-healing script that JS loaded and rendered successfully
window.__FITCOACH_LOADED = true;

// Clean up cache-bust query param from self-healing recovery if present
if (window.location.search.includes('_fc=')) {
  const cleanUrl = window.location.pathname + window.location.hash;
  window.history.replaceState(null, '', cleanUrl);
}

// Initialize the global floating timer widget
try {
  initFloatingTimer();
} catch (err) {
  console.error('Floating timer init failed:', err);
}

// Audio can only start from a user gesture on mobile — unlock it on the
// first tap, and resume it on later taps in case the OS suspended it.
document.addEventListener('pointerdown', unlockAudio, { passive: true });

// PWA install prompt
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!localStorage.getItem('fitcoach_install_dismissed')) showInstallBanner();
});

// Detect iOS Safari (no beforeinstallprompt support)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

if (isIOS && !isStandalone && !localStorage.getItem('fitcoach_install_dismissed')) {
  setTimeout(showIOSInstallBanner, 2500);
}

function createBanner(html) {
  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Install FitCoach');
  banner.innerHTML = html;
  document.body.appendChild(banner);
  return banner;
}

function dismissBanner(banner) {
  localStorage.setItem('fitcoach_install_dismissed', '1');
  banner.classList.add('leaving');
  setTimeout(() => banner.remove(), 250);
}

function showInstallBanner() {
  if (isStandalone) return;
  const banner = createBanner(`
    <div class="install-banner-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
    </div>
    <div class="install-banner-text">
      <div class="install-banner-title">Install FitCoach</div>
      <div class="install-banner-desc">Works offline, launches like an app</div>
    </div>
    <button class="btn btn-primary btn-sm" id="install-btn">Install</button>
    <button class="icon-btn" id="dismiss-btn" aria-label="Dismiss">&times;</button>
  `);

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
    dismissBanner(banner);
  });
  banner.querySelector('#dismiss-btn').addEventListener('click', () => dismissBanner(banner));
}

function showIOSInstallBanner() {
  const banner = createBanner(`
    <div class="install-banner-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
    </div>
    <div class="install-banner-text">
      <div class="install-banner-title">Install FitCoach</div>
      <div class="install-banner-desc">Tap Share, then <strong>Add to Home Screen</strong></div>
    </div>
    <button class="icon-btn" id="ios-dismiss" aria-label="Dismiss">&times;</button>
  `);
  banner.querySelector('#ios-dismiss').addEventListener('click', () => dismissBanner(banner));
}

// Check for service worker updates periodically
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    setInterval(() => registration.update(), 60 * 60 * 1000);
  });
  // Note: controllerchange auto-reload is handled by the inline script in
  // index.html so it works even when this module fails to load.
}
