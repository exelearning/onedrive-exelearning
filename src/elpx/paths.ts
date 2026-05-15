/**
 * Path helpers shared between the ZIP reader, the Service Worker client and
 * the iframe renderer. All entry-path normalization lives here so request
 * matching and traversal-safety checks behave identically wherever a path
 * comes from (a ZIP central directory, an in-iframe relative href, or a
 * runtime URL produced by `buildRuntimeUrl`).
 */

export const RUNTIME_PREFIX = '/runtime';

const PROTOCOL_LIKE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Returns a canonical, slash-separated path with no `.`/`..` segments and no
 * leading slash, or null if the input is not safe (path traversal, NUL byte,
 * empty after stripping). Mirrors the SW-side check in `public/runtime/sw.js`.
 */
export function normalizeEntryPath(input: string): string | null {
  if (input.length === 0 || input.includes('\0')) {
    return null;
  }
  const replaced = input.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = replaced.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      if (stack.length === 0) {
        return null;
      }
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  if (stack.length === 0) {
    return null;
  }
  return stack.join('/');
}

/**
 * True when `href` points at something that should leave the package sandbox.
 */
export function isExternalUrl(href: string): boolean {
  if (href.startsWith('//')) {
    return true;
  }
  if (PROTOCOL_LIKE.test(href)) {
    const scheme = href.slice(0, href.indexOf(':')).toLowerCase();
    return scheme !== 'data' && scheme !== 'blob';
  }
  return false;
}

export interface RuntimeUrl {
  sessionId: string;
  entry: string;
}

export function buildRuntimeUrl(
  base: string,
  sessionId: string,
  entry: string,
): string {
  const normalized = normalizeEntryPath(entry);
  if (normalized === null) {
    throw new Error(`Refusing to build runtime URL for unsafe entry: ${entry}`);
  }
  const cleanBase = base.replace(/\/+$/, '');
  return `${cleanBase}/${encodeURIComponent(sessionId)}/${normalized
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
