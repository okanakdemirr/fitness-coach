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
    try { currentCleanup(); } catch { /* ignore cleanup errors */ }
    currentCleanup = null;
  }

  // Find matching route
  const handler = routes[path] || routes['/'];
  if (handler) {
    content.innerHTML = '';
    content.className = 'page-enter';
    try {
      const cleanup = handler(content);
      if (typeof cleanup === 'function') {
        currentCleanup = cleanup;
      }
    } catch (err) {
      console.error('Page render error:', err);
      content.innerHTML = `
        <div style="text-align:center;padding:48px 24px;color:var(--text-muted)">
          <p style="font-size:18px;font-weight:700;margin-bottom:12px;color:var(--danger)">Something went wrong</p>
          <p style="font-size:14px;margin-bottom:20px">This page failed to load. Try navigating to another page or refreshing.</p>
          <button onclick="location.reload()" style="padding:10px 24px;background:var(--accent);color:#0f0f1a;border:none;border-radius:8px;font-weight:600;cursor:pointer">Reload App</button>
        </div>
      `;
    }
  }

  // Update nav active state and aria-current
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href')?.slice(1) || '/';
    const isActive = href === path;
    item.classList.toggle('active', isActive);
    if (isActive) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

  // Toggle modal overlay aria-hidden based on visibility
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.setAttribute('aria-hidden', 'true');
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  // Set default hash if none
  if (!window.location.hash) {
    window.location.hash = '#/';
  }
  resolve();
}
