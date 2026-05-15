/**
 * MIME detection for the assets served out of an `.elpx` package. Pure so it
 * can be reused by the Service Worker (no DOM there) and by the in-page
 * iframe renderer.
 */

const MIME_BY_EXTENSION: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  xhtml: 'application/xhtml+xml; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
  m4v: 'video/mp4',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  ogv: 'video/ogg',
  wav: 'audio/wav',
  webm: 'video/webm',
  vtt: 'text/vtt',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  pdf: 'application/pdf',
};

export function mimeForEntry(entry: string): string {
  const dot = entry.lastIndexOf('.');
  if (dot < 0 || dot === entry.length - 1) {
    return 'application/octet-stream';
  }
  const extension = entry.slice(dot + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}
