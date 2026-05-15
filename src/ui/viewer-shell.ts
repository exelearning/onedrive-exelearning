import { BACK_ICON_SVG, EXELEARNING_ICON_SVG } from './icons';

export function renderViewerPage(root: HTMLElement, statusText: string): void {
  root.innerHTML = `
    <main class="editor-shell">
      <header class="editor-toolbar">
        <button id="back-to-drive" type="button" class="editor-back" aria-label="Back to Microsoft OneDrive">${BACK_ICON_SVG}</button>
        <h1 class="editor-title">eXeLearning<span class="editor-title__separator"> – </span><span id="editor-filename" class="editor-title__filename">onedrive-exelearning</span></h1>
        <p id="status" class="editor-status" role="status" aria-live="polite">${escapeHtml(statusText)}</p>
        <div class="editor-actions">
          <button id="authorize-open" type="button" class="btn-primary">Authorize and open</button>
          <button id="edit-file" type="button" class="btn-primary" disabled>${EXELEARNING_ICON_SVG}<span>Edit in eXeLearning</span></button>
        </div>
      </header>
      <section id="viewer-host" class="viewer-host" aria-label="eXeLearning viewer"></section>
    </main>
  `;
}

export function renderLegacyCard(
  host: HTMLElement,
  options: { filename: string; message: string },
): void {
  host.innerHTML = `
    <div class="viewer-legacy">
      <div class="viewer-legacy__card">
        <h2 class="viewer-legacy__title">${escapeHtml(options.filename)}</h2>
        <p class="viewer-legacy__message">${escapeHtml(options.message)}</p>
      </div>
    </div>
  `;
}

export function renderErrorCard(host: HTMLElement, message: string): void {
  host.innerHTML = `
    <div class="viewer-legacy">
      <div class="viewer-legacy__card viewer-legacy__card--error">
        <h2 class="viewer-legacy__title">Could not open this file</h2>
        <p class="viewer-legacy__message">${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] ?? char;
  });
}
