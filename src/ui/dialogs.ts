export type ConflictChoice = 'overwrite' | 'copy' | 'cancel';

export function confirmOverwriteRemoteChange(filename: string): ConflictChoice {
  const overwrite = window.confirm(
    `"${filename}" has changed in Microsoft OneDrive since it was opened.\n\nPress OK to overwrite the OneDrive file, or Cancel to choose another option.`,
  );
  if (overwrite) {
    return 'overwrite';
  }

  const copy = window.confirm(
    'Save the editor contents as a new copy instead? Press Cancel to stop saving.',
  );
  return copy ? 'copy' : 'cancel';
}

export function showError(message: string): void {
  window.alert(message);
}

/**
 * Full-screen blocking overlay used while a save is in flight.
 */
export class SavingModal {
  private element: HTMLElement | null = null;
  private titleNode: HTMLElement | null = null;
  private hintNode: HTMLElement | null = null;
  private closeButton: HTMLButtonElement | null = null;

  showSaving(message = 'Saving to OneDrive…'): void {
    this.ensureElement();
    this.element?.classList.remove('saving-modal--error');
    this.element?.classList.add('saving-modal--visible');
    if (this.titleNode) {
      this.titleNode.textContent = message;
    }
    if (this.hintNode) {
      this.hintNode.textContent = 'Please wait while the file is being saved.';
    }
    if (this.closeButton) {
      this.closeButton.hidden = true;
    }
  }

  showError(message: string): void {
    this.ensureElement();
    this.element?.classList.add('saving-modal--visible', 'saving-modal--error');
    if (this.titleNode) {
      this.titleNode.textContent = 'Save failed';
    }
    if (this.hintNode) {
      this.hintNode.textContent = message;
    }
    if (this.closeButton) {
      this.closeButton.hidden = false;
    }
  }

  hide(): void {
    this.element?.classList.remove(
      'saving-modal--visible',
      'saving-modal--error',
    );
  }

  destroy(): void {
    this.element?.remove();
    this.element = null;
    this.titleNode = null;
    this.hintNode = null;
    this.closeButton = null;
  }

  private ensureElement(): void {
    if (this.element) {
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'saving-modal';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="saving-modal__card">
        <div class="saving-modal__spinner" aria-hidden="true"></div>
        <h3 class="saving-modal__title"></h3>
        <p class="saving-modal__hint"></p>
        <button type="button" class="saving-modal__close" hidden>Close</button>
      </div>
    `;
    document.body.append(overlay);
    this.element = overlay;
    this.titleNode = overlay.querySelector<HTMLElement>('.saving-modal__title');
    this.hintNode = overlay.querySelector<HTMLElement>('.saving-modal__hint');
    this.closeButton = overlay.querySelector<HTMLButtonElement>(
      '.saving-modal__close',
    );
    this.closeButton?.addEventListener('click', () => this.hide());
  }
}
