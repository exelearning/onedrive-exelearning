/**
 * eXeLearning runtime Service Worker for onedrive-exelearning.
 *
 * Scope: /onedrive-exelearning/runtime/ (derived at install time from the
 * registration scope so the same code works in `npm run dev`, on GitHub
 * Pages, or under any other base).
 *
 * Responsibilities:
 *   - Accept extracted package bytes from the page over postMessage.
 *   - Serve `${scope}{sessionId}/{entry}` requests from that in-memory map.
 *   - Stay out of the way for everything else (we only see in-scope fetches,
 *     but we double-check the URL anyway).
 *
 * Sessions live only in this worker's memory. Closing the tab (and the
 * subsequent SW termination) drops them. The page is the source of truth.
 *
 * This file is shipped as-is — not bundled by Vite — and served directly from
 * `public/runtime/sw.js`.
 */

/* eslint-env serviceworker */
/* global self */

const SW_VERSION = '1';
const sessions = new Map();

function scopePathname() {
  try {
    return new URL(self.registration.scope).pathname;
  } catch (_e) {
    return '/runtime/';
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
  const port = event.ports && event.ports[0];
  const reply = payload => {
    if (port) {
      try {
        port.postMessage(payload);
      } catch (_e) {
        /* port closed */
      }
    }
  };
  const data = event.data;
  if (!data || typeof data.type !== 'string') {
    reply({ ok: false, error: 'Invalid message' });
    return;
  }
  try {
    switch (data.type) {
      case 'EXELEARNING_REGISTER_SESSION':
        registerSession(data);
        reply({ ok: true });
        break;
      case 'EXELEARNING_UNREGISTER_SESSION':
        sessions.delete(data.sessionId);
        reply({ ok: true });
        break;
      case 'EXELEARNING_PING':
        reply({ ok: true, version: SW_VERSION, sessions: sessions.size });
        break;
      default:
        reply({ ok: false, error: `Unknown message type: ${data.type}` });
    }
  } catch (error) {
    reply({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
});

function registerSession(data) {
  if (!data.sessionId || typeof data.sessionId !== 'string') {
    throw new Error('Missing sessionId');
  }
  if (!Array.isArray(data.files)) {
    throw new Error('Missing files array');
  }
  const files = new Map();
  for (const entry of data.files) {
    if (!entry || typeof entry.path !== 'string') continue;
    const path = normalizeEntry(entry.path);
    if (path === null) continue;
    files.set(path, {
      mime:
        typeof entry.mime === 'string'
          ? entry.mime
          : 'application/octet-stream',
      bytes: entry.bytes instanceof ArrayBuffer ? entry.bytes : null,
    });
  }
  sessions.set(data.sessionId, {
    files,
    indexEntry:
      typeof data.indexEntry === 'string' ? data.indexEntry : 'index.html',
    filename: typeof data.filename === 'string' ? data.filename : '',
    createdAt: Date.now(),
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const match = matchRuntimeUrl(url.pathname);
  if (!match) return;
  event.respondWith(handleRuntimeFetch(match));
});

function handleRuntimeFetch(match) {
  const session = sessions.get(match.sessionId);
  if (!session) {
    return new Response('Session not registered. Reload the package.', {
      status: 410,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const file = session.files.get(match.entry);
  if (!file || !file.bytes) {
    return new Response(`Not found in package: ${match.entry}`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const headers = new Headers({
    'Content-Type': file.mime,
    'Content-Length': String(file.bytes.byteLength),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy':
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; img-src 'self' data: blob:; media-src 'self' data: blob:; frame-ancestors 'self'",
  });
  return new Response(file.bytes, { status: 200, headers });
}

function matchRuntimeUrl(pathname) {
  const scope = scopePathname();
  if (!pathname.startsWith(scope)) return null;
  const remainder = pathname.slice(scope.length);
  const slash = remainder.indexOf('/');
  if (slash <= 0) return null;
  const sessionId = safeDecode(remainder.slice(0, slash));
  const rawEntry = remainder.slice(slash + 1);
  const decoded = rawEntry.split('/').map(safeDecode).join('/');
  const entry = normalizeEntry(decoded);
  if (!sessionId || entry === null) return null;
  return { sessionId, entry };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (_e) {
    return value;
  }
}

/**
 * SW-side mirror of `normalizeEntryPath` from src/elpx/paths.ts. Kept inline
 * because the SW must not import bundled application code — it is loaded
 * out-of-band by the browser, not by Vite.
 */
function normalizeEntry(input) {
  if (
    typeof input !== 'string' ||
    input.length === 0 ||
    input.indexOf('\0') >= 0
  ) {
    return null;
  }
  const cleaned = input.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = cleaned.split('/');
  const stack = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.length === 0 ? null : stack.join('/');
}
