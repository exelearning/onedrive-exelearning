/**
 * Lightweight OneDrive file picker.
 *
 * Microsoft offers a fully-featured "OneDrive File Picker v8" JavaScript
 * SDK (https://learn.microsoft.com/onedrive/developer/controls/file-pickers)
 * but it requires loading a third-party script and ships with its own
 * branded UI. To keep this app's dependency surface comparable to its
 * Google Drive sibling we instead present a minimal modal that lists the
 * `.elpx` / `.elp` files in the signed-in user's drive via the Microsoft
 * Graph children endpoint and lets the user pick one.
 *
 * The picker promise resolves with `{ itemId, driveId }` references that
 * can be plugged directly into `/open?itemId=…&driveId=…`.
 */

import { type DriveItem, listDriveChildren } from './onedrive-api';

export interface PickedItem {
  itemId: string;
  driveId?: string;
  name: string;
}

export async function pickOneDriveFile(options: {
  token: string;
}): Promise<PickedItem | null> {
  const items = await listElpxItems(options.token);
  if (items.length === 0) {
    window.alert(
      'No .elpx or .elp files were found in your OneDrive root. Upload one first or use the "New file" button to create one.',
    );
    return null;
  }
  return new Promise<PickedItem | null>(resolve => {
    const overlay = renderPickerOverlay(items, resolve);
    document.body.append(overlay);
  });
}

async function listElpxItems(token: string): Promise<DriveItem[]> {
  const result = await listDriveChildren({
    token,
    parent: { itemId: 'root' },
    top: 200,
  });
  return result.value.filter(item => isElpxLike(item.name));
}

function isElpxLike(name: string | undefined): boolean {
  if (!name) {
    return false;
  }
  const lower = name.toLowerCase();
  return lower.endsWith('.elpx') || lower.endsWith('.elp');
}

function renderPickerOverlay(
  items: DriveItem[],
  resolve: (value: PickedItem | null) => void,
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'picker-modal picker-modal--visible';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="picker-modal__card">
      <header class="picker-modal__header">
        <h2>Open from OneDrive</h2>
        <button type="button" class="picker-modal__close" aria-label="Close">×</button>
      </header>
      <ul class="picker-modal__list"></ul>
    </div>
  `;
  const list = overlay.querySelector<HTMLUListElement>('.picker-modal__list');
  const closeButton = overlay.querySelector<HTMLButtonElement>(
    '.picker-modal__close',
  );
  if (!list || !closeButton) {
    overlay.remove();
    resolve(null);
    return overlay;
  }

  const finish = (value: PickedItem | null) => {
    overlay.remove();
    resolve(value);
  };

  closeButton.addEventListener('click', () => finish(null));
  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      finish(null);
    }
  });

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'picker-modal__item';
    li.innerHTML = `
      <button type="button" class="picker-modal__button">
        <span class="picker-modal__name"></span>
        <span class="picker-modal__meta"></span>
      </button>
    `;
    const button = li.querySelector<HTMLButtonElement>('.picker-modal__button');
    const nameSpan = li.querySelector<HTMLElement>('.picker-modal__name');
    const metaSpan = li.querySelector<HTMLElement>('.picker-modal__meta');
    if (!button || !nameSpan || !metaSpan) {
      continue;
    }
    nameSpan.textContent = item.name;
    metaSpan.textContent = item.lastModifiedDateTime
      ? new Date(item.lastModifiedDateTime).toLocaleString()
      : '';
    button.addEventListener('click', () => {
      finish({
        itemId: item.id,
        driveId: item.parentReference?.driveId,
        name: item.name,
      });
    });
    list.append(li);
  }

  return overlay;
}
