import { requestAccessToken } from '../auth/msal-token-client';
import { ELPX_MIME_TYPE } from '../config';
import { EditorFrame } from '../editor/editor-frame';
import {
  createDriveItem,
  type DriveItem,
  type DriveItemRef,
  getDriveItemPermissions,
} from '../onedrive/onedrive-api';
import { fetchEditableDriveFile } from '../onedrive/onedrive-download';
import type { OpenedDriveFileSnapshot } from '../onedrive/onedrive-state';
import { publishElpxThumbnail } from '../onedrive/onedrive-thumbnail';
import { saveDriveFile } from '../onedrive/onedrive-upload';
import {
  confirmOverwriteRemoteChange,
  SavingModal,
  showError,
} from '../ui/dialogs';
import {
  closeEditor,
  renderEditorPage,
  requiredElement,
  setEditorTitle,
} from '../ui/editor-shell';
import { formatError, StatusView } from '../ui/status';

export interface EditorModeContext {
  ref: DriveItemRef;
  prefetched?: {
    metadata: DriveItem;
    bytes: ArrayBuffer;
  };
}

export async function renderEditorMode(
  root: HTMLElement,
  ctx: EditorModeContext,
): Promise<void> {
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

  closeButton.addEventListener('click', () => closeEditor());

  openButton.addEventListener('click', () => {
    openButton.disabled = true;
    void openFromDrive(true).catch((error: unknown) => {
      openButton.disabled = false;
      status.set(formatError(error), 'error');
    });
  });

  void attemptSilentOpen();

  async function attemptSilentOpen(): Promise<void> {
    openButton.disabled = true;
    try {
      await openFromDrive(false);
    } catch {
      if (openButton.hidden) {
        return;
      }
      openButton.disabled = false;
      status.set('Click "Authorize and open" to continue.');
    }
  }

  async function openFromDrive(interactive: boolean): Promise<void> {
    status.set('Requesting Microsoft authorization…');
    const token = await requestAccessToken({
      interactive,
      prompt: interactive ? 'select_account' : 'none',
    });
    openButton.hidden = true;

    let metadata: DriveItem;
    let bytes: ArrayBuffer;
    if (ctx.prefetched) {
      ({ metadata, bytes } = ctx.prefetched);
    } else {
      status.set('Fetching OneDrive metadata…');
      const fetched = await fetchEditableDriveFile({
        token,
        ref: ctx.ref,
      });
      metadata = fetched.metadata;
      bytes = fetched.bytes;
    }

    const isLegacyElp = isLegacyElpFilename(metadata.name);
    const permissions = getDriveItemPermissions(metadata);
    const canEdit = isLegacyElp ? true : permissions.canEdit;
    const targetName = isLegacyElp
      ? convertElpToElpxName(metadata.name)
      : metadata.name;
    const parentRef: DriveItemRef | undefined = metadata.parentReference?.id
      ? {
          itemId: metadata.parentReference.id,
          driveId: metadata.parentReference.driveId,
        }
      : undefined;

    let snapshot: OpenedDriveFileSnapshot | null = isLegacyElp
      ? null
      : {
          itemId: metadata.id,
          driveId: metadata.parentReference?.driveId,
          name: metadata.name,
          eTag: metadata.eTag,
          cTag: metadata.cTag,
          lastModifiedDateTime: metadata.lastModifiedDateTime,
          canEdit,
        };

    setEditorTitle(root, targetName);

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
      if (message.type === 'REQUEST_SAVE' && canEdit) {
        void save();
      }
    });

    await editor.load();
    status.set('Opening…');
    await editor.openFile({ bytes, filename: metadata.name });
    if (isLegacyElp) {
      status.set(
        'Opened legacy file. Saving will create a new .elpx in the same folder.',
        'warning',
      );
    } else {
      status.set(
        canEdit ? 'Opened.' : 'Opened in read-only mode.',
        canEdit ? 'success' : 'warning',
      );
    }
    saveButton.disabled = !canEdit;
    saveButton.addEventListener('click', () => void save());

    async function save(): Promise<void> {
      if (!canEdit) {
        showError('This OneDrive file is read-only and cannot be overwritten.');
        return;
      }
      try {
        saveButton.disabled = true;
        savingModal.showSaving();
        status.set('Requesting updated .elpx from the editor…');
        const savePayload = await editor.requestSave();

        if (snapshot === null) {
          // Legacy .elp first-save: create a fresh .elpx alongside the original.
          if (!parentRef) {
            throw new Error(
              'Cannot create the new .elpx: the OneDrive parent folder is unknown.',
            );
          }
          status.set('Creating in OneDrive…');
          const created = await createDriveItem({
            token,
            parent: parentRef,
            name: targetName,
            bytes: savePayload.bytes,
            mimeType: ELPX_MIME_TYPE,
            conflictBehavior: 'rename',
          });
          snapshot = {
            itemId: created.id,
            driveId: created.parentReference?.driveId,
            name: created.name,
            eTag: created.eTag,
            cTag: created.cTag,
            lastModifiedDateTime: created.lastModifiedDateTime,
            canEdit: true,
          };
          replaceItemIdInUrl(created.id);
          setEditorTitle(root, created.name);
        } else {
          status.set('Checking for remote changes…');
          const currentSnapshot = snapshot;
          const saved = await saveDriveFile({
            token,
            snapshot: currentSnapshot,
            bytes: savePayload.bytes,
            resolveConflict: () =>
              confirmOverwriteRemoteChange(currentSnapshot.name),
          });
          if (!saved) {
            status.set('Save cancelled.', 'warning');
            savingModal.hide();
            return;
          }
          currentSnapshot.eTag = saved.eTag;
          currentSnapshot.cTag = saved.cTag;
          currentSnapshot.lastModifiedDateTime = saved.lastModifiedDateTime;
        }

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
        saveButton.disabled = !canEdit;
      }
    }

    window.addEventListener('beforeunload', event => {
      if (dirty) {
        event.preventDefault();
      }
    });
  }
}

function isLegacyElpFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.elp') && !lower.endsWith('.elpx');
}

function convertElpToElpxName(name: string): string {
  return name.replace(/\.elp$/i, '.elpx');
}

function replaceItemIdInUrl(newItemId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('itemId', newItemId);
  window.history.replaceState(null, '', url.toString());
}
