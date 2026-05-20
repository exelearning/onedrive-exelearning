import { requestAccessToken } from '../auth/msal-token-client';
import { BLANK_TEMPLATE_PATH, ELPX_MIME_TYPE } from '../config';
import { EditorFrame } from '../editor/editor-frame';
import {
  createDriveItem,
  type DriveItemRef,
  listDriveChildren,
} from '../onedrive/onedrive-api';
import {
  type OneDriveCreateState,
  type OpenedDriveFileSnapshot,
  parseOneDriveStateFromParams,
} from '../onedrive/onedrive-state';
import { publishElpxThumbnail } from '../onedrive/onedrive-thumbnail';
import { saveDriveFile } from '../onedrive/onedrive-upload';
import { confirmOverwriteRemoteChange, SavingModal } from '../ui/dialogs';
import {
  closeEditor,
  renderEditorPage,
  requiredElement,
  setEditorTitle,
} from '../ui/editor-shell';
import { formatError, StatusView } from '../ui/status';

export async function renderCreate(root: HTMLElement): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const state = parseOneDriveStateFromParams(params, 'create');
  if (state.action !== 'create') {
    throw new Error('This endpoint only supports OneDrive create actions.');
  }
  const createState = state;
  cleanCreateUrl(createState);

  renderEditorPage(root, 'Connecting to Microsoft OneDrive…');
  const status = new StatusView(requiredElement(root, '#status'));
  const saveButton = requiredElement(root, '#save-drive') as HTMLButtonElement;
  const openButton = requiredElement(
    root,
    '#authorize-open',
  ) as HTMLButtonElement;
  const closeButton = requiredElement(
    root,
    '#back-to-drive',
  ) as HTMLButtonElement;
  const savingModal = new SavingModal();

  openButton.textContent = 'Authorize and create';
  closeButton.addEventListener('click', () => closeEditor());

  openButton.addEventListener('click', () => {
    openButton.disabled = true;
    void createInDrive(true).catch((error: unknown) => {
      openButton.disabled = false;
      status.set(formatError(error), 'error');
    });
  });

  void attemptSilentCreate();

  async function attemptSilentCreate(): Promise<void> {
    openButton.disabled = true;
    try {
      await createInDrive(false);
    } catch {
      if (openButton.hidden) {
        return;
      }
      openButton.disabled = false;
      status.set('Click "Authorize and create" to continue.');
    }
  }

  async function createInDrive(interactive: boolean): Promise<void> {
    status.set('Requesting Microsoft authorization…');
    const token = await requestAccessToken({
      interactive,
      prompt: interactive ? 'select_account' : 'none',
    });
    openButton.hidden = true;

    status.set('Loading blank .elpx template…');
    const templateResponse = await fetch(BLANK_TEMPLATE_PATH);
    if (!templateResponse.ok) {
      throw new Error(`Blank template is missing at ${BLANK_TEMPLATE_PATH}.`);
    }
    const driveBytes = await templateResponse.clone().arrayBuffer();
    const editorBytes = await templateResponse.arrayBuffer();

    status.set('Creating OneDrive file…');
    const parent: DriveItemRef = {
      itemId: createState.folderId ?? 'root',
      driveId: createState.driveId,
    };
    const filename = await pickUntitledFilename(token, parent);
    const created = await createDriveItem({
      token,
      parent,
      name: filename,
      bytes: driveBytes,
      mimeType: ELPX_MIME_TYPE,
      conflictBehavior: 'rename',
    });

    const snapshot: OpenedDriveFileSnapshot = {
      itemId: created.id,
      driveId: created.parentReference?.driveId,
      name: created.name,
      eTag: created.eTag,
      cTag: created.cTag,
      lastModifiedDateTime: created.lastModifiedDateTime,
      canEdit: true,
    };
    setEditorTitle(root, created.name);

    status.set('Loading eXeLearning editor…');
    const editor = new EditorFrame(requiredElement(root, '#editor-host'), {
      hideUI: { fileMenu: true, saveButton: true, userMenu: true },
    });
    let dirty = false;
    editor.onMessage(message => {
      if (
        message.type === 'EXELEARNING_EVENT' &&
        (message as { event?: string }).event === 'PROJECT_DIRTY'
      ) {
        dirty = true;
        status.set('Unsaved changes.', 'warning');
      }
      if (message.type === 'REQUEST_SAVE') {
        void save();
      }
    });

    await editor.load();
    await editor.openFile({ bytes: editorBytes, filename: created.name });
    saveButton.disabled = false;
    status.set('Created.', 'success');
    saveButton.addEventListener('click', () => void save());

    async function save(): Promise<void> {
      try {
        saveButton.disabled = true;
        savingModal.showSaving();
        status.set('Requesting updated .elpx from the editor…');
        const savePayload = await editor.requestSave();
        status.set('Checking for remote changes…');
        const saved = await saveDriveFile({
          token,
          snapshot,
          bytes: savePayload.bytes,
          resolveConflict: () => confirmOverwriteRemoteChange(snapshot.name),
        });
        if (!saved) {
          status.set('Save cancelled.', 'warning');
          savingModal.hide();
          return;
        }
        snapshot.eTag = saved.eTag;
        snapshot.cTag = saved.cTag;
        snapshot.lastModifiedDateTime = saved.lastModifiedDateTime;
        dirty = false;
        status.set('Saved to OneDrive.', 'success');
        savingModal.hide();
        void publishElpxThumbnail({
          token,
          ref: { itemId: snapshot.itemId, driveId: snapshot.driveId },
          bytes: savePayload.bytes,
        });
      } catch (error) {
        savingModal.showError(formatError(error));
        status.set(formatError(error), 'error');
      } finally {
        saveButton.disabled = false;
      }
    }

    window.addEventListener('beforeunload', event => {
      if (dirty) {
        event.preventDefault();
      }
    });
  }
}

const DEFAULT_FILENAME = 'Untitled.elpx';
const NUMBERED_FILENAME_REGEX = /^Untitled \((\d+)\)\.elpx$/;

/**
 * Pick a non-colliding filename by listing existing items under the target
 * folder. Microsoft Graph's `$filter` does not support `startswith` over the
 * `name` field reliably for personal drives, so the matching happens locally
 * over a `name eq` shortlist.
 */
async function pickUntitledFilename(
  token: string,
  parent: DriveItemRef,
): Promise<string> {
  const existing = new Set<string>();
  try {
    const result = await listDriveChildren({
      token,
      parent,
      top: 200,
      select: ['name'],
    });
    for (const file of result.value) {
      if (typeof file.name === 'string') {
        existing.add(file.name);
      }
    }
    console.log('[onedrive-exelearning] Existing files in folder:', [
      ...existing,
    ]);
  } catch (error) {
    console.warn(
      '[onedrive-exelearning] Could not list existing files; using default name:',
      error,
    );
    return DEFAULT_FILENAME;
  }

  if (!existing.has(DEFAULT_FILENAME)) {
    return DEFAULT_FILENAME;
  }

  let highest = 0;
  for (const name of existing) {
    const match = NUMBERED_FILENAME_REGEX.exec(name);
    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value > highest) {
        highest = value;
      }
    }
  }
  return `Untitled (${highest + 1}).elpx`;
}

function cleanCreateUrl(state: OneDriveCreateState): void {
  const url = new URL(window.location.href);
  url.search = '';
  if (state.folderId) {
    url.searchParams.set('folderId', state.folderId);
  }
  if (state.driveId) {
    url.searchParams.set('driveId', state.driveId);
  }
  if (state.userId) {
    url.searchParams.set('userId', state.userId);
  }
  window.history.replaceState(null, '', url.toString());
}
