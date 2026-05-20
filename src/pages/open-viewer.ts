import { requestAccessToken } from '../auth/msal-token-client';
import { createPackageIframe } from '../elpx/iframe-renderer';
import { validatePackage } from '../elpx/package-validator';
import { ViewerSession } from '../elpx/viewer-session';
import { readPackage, ZipReadError } from '../elpx/zip-reader';
import {
  type DriveItemRef,
  getDriveItemPermissions,
} from '../onedrive/onedrive-api';
import { fetchEditableDriveFile } from '../onedrive/onedrive-download';
import { publishElpxThumbnailFromEntries } from '../onedrive/onedrive-thumbnail';
import {
  ensureRuntimeWorker,
  type RuntimeWorker,
  registerSession,
  unregisterSession,
} from '../sw/service-worker-client';
import {
  closeEditor,
  requiredElement,
  setEditorTitle,
} from '../ui/editor-shell';
import { formatError, StatusView } from '../ui/status';
import {
  renderErrorCard,
  renderLegacyCard,
  renderViewerPage,
} from '../ui/viewer-shell';
import { renderEditorMode } from './open-editor';
import { setOpenMode } from './open-url';

export interface ViewerModeContext {
  ref: DriveItemRef;
}

export async function renderViewerMode(
  root: HTMLElement,
  ctx: ViewerModeContext,
): Promise<void> {
  renderViewerPage(root, 'Connecting to Microsoft OneDrive…');
  const status = new StatusView(requiredElement(root, '#status'));
  const authButton = requiredElement(
    root,
    '#authorize-open',
  ) as HTMLButtonElement;
  const editButton = requiredElement(root, '#edit-file') as HTMLButtonElement;
  const closeButton = requiredElement(
    root,
    '#back-to-drive',
  ) as HTMLButtonElement;
  const host = requiredElement(root, '#viewer-host');

  let activeWorker: RuntimeWorker | null = null;
  let activeSessionId: string | null = null;
  let transitionToEditor: (() => Promise<void>) | null = null;

  editButton.disabled = true;

  closeButton.addEventListener('click', () => closeEditor());

  editButton.addEventListener('click', () => {
    if (!transitionToEditor) {
      return;
    }
    editButton.disabled = true;
    void transitionToEditor().catch((error: unknown) => {
      editButton.disabled = false;
      status.set(formatError(error), 'error');
    });
  });

  authButton.addEventListener('click', () => {
    authButton.disabled = true;
    void openInViewer(true).catch((error: unknown) => {
      authButton.disabled = false;
      status.set(formatError(error), 'error');
    });
  });

  void attemptSilentOpen();

  async function attemptSilentOpen(): Promise<void> {
    authButton.disabled = true;
    try {
      await openInViewer(false);
    } catch {
      if (authButton.hidden) {
        return;
      }
      authButton.disabled = false;
      status.set('Click "Authorize and open" to preview this file.');
    }
  }

  async function openInViewer(interactive: boolean): Promise<void> {
    status.set('Requesting Microsoft authorization…');
    const token = await requestAccessToken({
      interactive,
      prompt: interactive ? 'select_account' : 'none',
    });
    authButton.hidden = true;

    status.set('Fetching OneDrive metadata…');
    const { metadata, bytes } = await fetchEditableDriveFile({
      token,
      ref: ctx.ref,
    });
    setEditorTitle(root, metadata.name);

    const isLegacyElp = isLegacyElpFilename(metadata.name);
    const permissions = getDriveItemPermissions(metadata);
    const canEdit = isLegacyElp ? true : permissions.canEdit;
    editButton.disabled = !canEdit;
    if (!canEdit) {
      editButton.title =
        'You do not have permission to edit this file in OneDrive.';
    }

    transitionToEditor = async () => {
      status.set('Opening editor…');
      await teardownViewerSession();
      host.replaceChildren();
      setOpenMode('editor');
      await renderEditorMode(root, {
        ref: ctx.ref,
        prefetched: { metadata, bytes },
      });
    };

    status.set('Reading package…');
    let validation: ReturnType<typeof validatePackage> | null = null;
    let entries: ReadonlyMap<string, Uint8Array> | null = null;
    try {
      const result = await readPackage(bytes);
      entries = result.entries;
      validation = validatePackage(entries, metadata.name);
    } catch (error) {
      if (!(error instanceof ZipReadError)) {
        throw error;
      }
      validation = validatePackageFallback(metadata.name);
    }

    if (entries) {
      // Backfill on first open: push a custom thumbnail when one is available.
      void publishElpxThumbnailFromEntries({
        token,
        ref: ctx.ref,
        entries,
      });
    }

    if (!validation?.valid || !entries) {
      const legacy = validation?.legacy ?? isLegacyElp;
      const message =
        validation?.error ??
        (legacy
          ? 'This file is from an older version of eXeLearning and cannot be previewed.'
          : 'The package could not be read.');
      if (legacy) {
        renderLegacyCard(host, {
          filename: metadata.name,
          message: `${message} Click Edit to open it in the editor.`,
        });
        status.set('Legacy file — click Edit to migrate it.', 'warning');
      } else {
        renderErrorCard(host, message);
        status.set(message, 'error');
      }
      return;
    }

    const indexEntry = validation.shape.indexEntry ?? 'index.html';
    const session = ViewerSession.create({
      entries,
      indexEntry,
      filename: metadata.name,
    });
    activeWorker = await ensureRuntimeWorker();
    activeSessionId = session.id;
    await registerSession(activeWorker, session);
    const iframe = createPackageIframe({
      runtimeBase: activeWorker.runtimeBase,
      sessionId: session.id,
      indexEntry: session.indexEntry,
      title: metadata.name,
    });
    host.replaceChildren(iframe);
    status.set('Preview loaded.', 'success');
  }

  async function teardownViewerSession(): Promise<void> {
    if (activeWorker && activeSessionId) {
      await unregisterSession(activeWorker, activeSessionId);
    }
    activeWorker = null;
    activeSessionId = null;
  }

  window.addEventListener('beforeunload', () => {
    void teardownViewerSession();
  });
}

function isLegacyElpFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.elp') && !lower.endsWith('.elpx');
}

function validatePackageFallback(
  filename: string,
): ReturnType<typeof validatePackage> {
  const isLegacyByExtension = filename.toLowerCase().endsWith('.elp');
  return {
    valid: false,
    legacy: isLegacyByExtension,
    shape: {
      indexEntry: null,
      hasContentXml: false,
      hasScreenshot: false,
      hintCount: 0,
      legacyMarker: null,
    },
    error: isLegacyByExtension
      ? 'This file is from an older version of eXeLearning and cannot be previewed.'
      : 'The file could not be read as a valid eXeLearning package.',
  };
}
