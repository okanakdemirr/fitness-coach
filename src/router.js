// Minimal hash-based SPA router

const routes = {};
let currentCleanup = null;

export function route(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentPath() {
  return window.location.hash.slice(1) || '/';
}

function resolve() {
  const path = getCurrentPath();
  const content = document.getElementById('page-content');

  // Cleanup previous page
  if (currentCleanup && typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  // Find matching route
  const handler = routes[path] || routes['/'];
  if (handler) {
    content.innerHTML = '';
    content.className = 'page-enter';
    const cleanup = handler(content);
    if (typeof cleanup === 'function') {
      currentCleanup = cleanup;
    }
  }

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href')?.slice(1) || '/';
    item.classList.toggle('active', href === path);
  });
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  // Set default hash if none
  if (!window.location.hash) {
    window.location.hash = '#/';
  }
  resolve();
}
