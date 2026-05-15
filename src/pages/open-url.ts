import type { OneDriveOpenState } from '../onedrive/onedrive-state';

export type OpenMode = 'preview' | 'editor';

/**
 * Replace the inbound query string with a compact, readable form so the
 * address bar stays clean while the editor is loaded. `mode` is preserved
 * across refreshes so a deep-link into the editor still skips the preview
 * screen.
 */
export function cleanOpenUrl(
  state: OneDriveOpenState,
  options: { mode: OpenMode },
): void {
  const itemId = state.itemId;
  if (!itemId) {
    return;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('itemId', itemId);
  if (state.driveId) {
    url.searchParams.set('driveId', state.driveId);
  }
  if (state.userId) {
    url.searchParams.set('userId', state.userId);
  }
  if (options.mode === 'editor') {
    url.searchParams.set('mode', 'editor');
  }
  window.history.replaceState(null, '', url.toString());
}

export function setOpenMode(mode: OpenMode): void {
  const url = new URL(window.location.href);
  if (mode === 'editor') {
    url.searchParams.set('mode', 'editor');
  } else {
    url.searchParams.delete('mode');
  }
  window.history.replaceState(null, '', url.toString());
}

export function parseOpenMode(params: URLSearchParams): OpenMode {
  return params.get('mode') === 'editor' ? 'editor' : 'preview';
}
