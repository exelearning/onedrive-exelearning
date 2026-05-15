import { renderCreate } from './pages/create';
import { renderHome } from './pages/home';
import { renderOpen } from './pages/open';
import './style.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('Missing #app root element.');
}

try {
  const path = normalizeRoute(window.location.pathname);
  if (path === '/open') {
    await renderOpen(root);
  } else if (path === '/create') {
    await renderCreate(root);
  } else {
    renderHome(root);
  }
} catch (error) {
  root.innerHTML = `<main class="app-shell"><h1>onedrive-exelearning</h1><p class="status" data-kind="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p></main>`;
}

function normalizeRoute(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let route = pathname;
  if (base && pathname.startsWith(base)) {
    route = pathname.slice(base.length) || '/';
  }
  if (route.length > 1 && route.endsWith('/')) {
    return route.slice(0, -1);
  }
  return route || '/';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] ?? char;
  });
}
