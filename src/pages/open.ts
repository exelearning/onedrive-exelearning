import { parseOneDriveStateFromParams } from '../onedrive/onedrive-state';
import { renderEditorMode } from './open-editor';
import { cleanOpenUrl, parseOpenMode } from './open-url';
import { renderViewerMode } from './open-viewer';

/**
 * Entry point for `/open`. Decides between preview and editor mode based on
 * `?mode=` and forwards to the matching renderer. Default is preview.
 */
export async function renderOpen(root: HTMLElement): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const state = parseOneDriveStateFromParams(params, 'open');
  if (state.action !== 'open') {
    throw new Error('This endpoint only supports OneDrive open actions.');
  }
  const mode = parseOpenMode(params);
  cleanOpenUrl(state, { mode });

  const ref = { itemId: state.itemId, driveId: state.driveId };

  if (mode === 'editor') {
    await renderEditorMode(root, { ref });
  } else {
    await renderViewerMode(root, { ref });
  }
}

export { renderEditorPage } from '../ui/editor-shell';
