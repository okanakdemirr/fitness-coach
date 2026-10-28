// Minimal hash-based SPA router
import { closeModal } from './utils.js';

const routes = {};
let currentCleanup = null;

// Secondary pages highlight the nav tab they belong to
const NAV_PARENT = {
  '/stats': '/history',
  '/weight': '/tools'
};

export function route(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentPath() {
  return window.location.hash.slice(1).split('?')[0] || '/';
}

function resolve() {
  const path = getCurrentPath();
  const content = document.getElementById('page-content');

  // Cleanup previous page
  if (currentCleanup) {
    try { currentCleanup(); } catch (err) { console.error('Page cleanup error:', err); }
    currentCleanup = null;
  }
  closeModal();

  const handler = routes[path] || routes['/'];
  if (handler) {
    content.innerHTML = '';
    // Restart the enter animation
    content.classList.remove('page-enter');
    void content.offsetWidth;
    content.classList.add('page-enter');
    window.scrollTo(0, 0);
    try {
      const cleanup = handler(content);
      if (typeof cleanup === 'function') {
        currentCleanup = cleanup;
      }
    } catch (err) {
      console.error('Page render error:', err);
      content.innerHTML = `
        <div class="empty-state">
          <p class="empty-title text-danger">Something went wrong</p>
          <p class="mb-16">This page failed to load. Try another page or reload the app.</p>
          <button id="page-error-reload" class="btn btn-primary">Reload App</button>
        </div>
      `;
      content.querySelector('#page-error-reload')?.addEventListener('click', () => location.reload());
    }
  }

  // Update nav active state and aria-current
  const navPath = NAV_PARENT[path] || path;
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href')?.slice(1) || '/';
    const isActive = href === navPath;
    item.classList.toggle('active', isActive);
    if (isActive) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  if (!window.location.hash) {
    history.replaceState(null, '', '#/');
  }
  resolve();
}
