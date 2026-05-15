import { EDITOR_INDEX_PATH, EDITOR_PATH } from '../config';

export interface BuildEditorBootHtmlOptions {
  parentOrigin: string;
  trustedOrigins?: string[];
  hideUI?: Partial<EditorHideUI>;
}

export interface EditorHideUI {
  fileMenu: boolean;
  saveButton: boolean;
  shareButton: boolean;
  userMenu: boolean;
  downloadButton: boolean;
  helpMenu: boolean;
}

const DEFAULT_HIDE_UI: EditorHideUI = {
  fileMenu: true,
  saveButton: true,
  shareButton: false,
  userMenu: true,
  downloadButton: false,
  helpMenu: false,
};

const FORCE_HIDE_SELECTORS = [
  '#dropdownFile',
  '#head-top-save-button',
  '#head-bottom-user-logged',
  '#exe-concurrent-users',
  '#mobile-navbar-button-save',
  '#mobile-navbar-button-openuserodefiles',
] as const;

export async function buildEditorBootHtml(
  options: BuildEditorBootHtmlOptions,
): Promise<string> {
  const response = await fetch(EDITOR_INDEX_PATH, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(
      `The eXeLearning static editor is not installed at ${EDITOR_INDEX_PATH}. Run "make download-editor" or "make build-editor".`,
    );
  }

  const html = await response.text();
  const dom = new DOMParser().parseFromString(html, 'text/html');

  const editorBaseHref = new URL(
    EDITOR_PATH,
    window.location.origin,
  ).toString();
  const editorBasePath = new URL(
    EDITOR_PATH,
    window.location.origin,
  ).pathname.replace(/\/+$/, '');

  dom.querySelector('base')?.remove();
  const base = dom.createElement('base');
  base.href = editorBaseHref;
  dom.head.prepend(base);

  const trustedOrigins = options.trustedOrigins ?? [options.parentOrigin];
  const hideUI: EditorHideUI = { ...DEFAULT_HIDE_UI, ...options.hideUI };
  const config = dom.createElement('script');
  config.textContent = `window.__EXE_EMBEDDING_CONFIG__ = ${JSON.stringify({
    basePath: editorBasePath,
    parentOrigin: options.parentOrigin,
    trustedOrigins,
    hideUI,
  })};`;
  dom.head.insertBefore(config, base.nextSibling);

  const style = dom.createElement('style');
  style.textContent = `${FORCE_HIDE_SELECTORS.join(',\n')} { display: none !important; }`;
  dom.head.append(style);

  const bridge = dom.createElement('script');
  bridge.textContent = `
(() => {
  if (window.tinymce && document.baseURI) {
    try { window.tinymce.documentBaseURL = document.baseURI; } catch (_) {}
  }
  console.log('[onedrive-exelearning][diag]', {
    href: document.location.href,
    baseURI: document.baseURI,
    tinymceDocumentBaseURL: (window.tinymce && window.tinymce.documentBaseURL) || null,
    tinymceBaseURL: (window.tinymce && window.tinymce.baseURL) || null,
    ua: navigator.userAgent,
  });
  const send = (message) => {
    try {
      window.parent.postMessage(message, '*');
    } catch (error) {
      console.warn('[onedrive-exelearning] Failed to forward message to parent:', error);
    }
  };
  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      send({ type: 'REQUEST_SAVE', requestId: 'onedrive-exelearning-shortcut-' + Date.now() });
    }
  }, true);

  const waitForReady = () => new Promise((resolve) => {
    const tick = () => {
      const ready = window.eXeLearning && window.eXeLearning.ready;
      if (ready && typeof ready.then === 'function') {
        ready.then(resolve);
      } else {
        setTimeout(tick, 50);
      }
    };
    tick();
  });

  waitForReady().then(() => {
    const bridge = window.eXeLearning && window.eXeLearning.app && window.eXeLearning.app.embeddingBridge;
    if (!bridge) {
      console.warn('[onedrive-exelearning] EmbeddingBridge missing, save will fail.');
      return;
    }

    bridge.handleSaveRequest = async function (requestId) {
      const project = this.app.project;
      const yjsBridge = project && project._yjsBridge;
      const documentManager = yjsBridge && yjsBridge.documentManager;

      if (!window.SharedExporters || typeof window.SharedExporters.createExporter !== 'function') {
        throw new Error('SharedExporters not available');
      }
      if (!documentManager) {
        throw new Error('Project document manager not available');
      }

      if (typeof documentManager._updateVersionMetadata === 'function') {
        try { await documentManager._updateVersionMetadata(); } catch (error) { console.warn('[onedrive-exelearning] _updateVersionMetadata failed:', error); }
      }

      const exporter = window.SharedExporters.createExporter(
        'elpx',
        documentManager,
        yjsBridge.assetCache,
        yjsBridge.resourceFetcher,
        yjsBridge.assetManager,
      );

      const exportOptions = {};
      if (window.MermaidPreRenderer && typeof window.MermaidPreRenderer.preRender === 'function') {
        exportOptions.preRenderMermaid = window.MermaidPreRenderer.preRender.bind(window.MermaidPreRenderer);
      }

      const result = await exporter.export(exportOptions);
      if (!result || !result.success || !result.data) {
        throw new Error((result && result.error) || 'SharedExporters returned no data');
      }

      const data = result.data;
      const bytes = data instanceof ArrayBuffer
        ? data
        : (ArrayBuffer.isView(data) ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data);
      const filename = result.filename || 'project.elpx';

      this.postToParent({
        type: 'SAVE_FILE',
        requestId,
        bytes,
        filename,
        size: bytes.byteLength || (data && data.byteLength) || 0,
      });
    };
  });
})();`;
  dom.body.append(bridge);

  return `<!doctype html>\n${dom.documentElement.outerHTML}`;
}
