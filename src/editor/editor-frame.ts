import {
  type BuildEditorBootHtmlOptions,
  buildEditorBootHtml,
} from './editor-boot';
import {
  type EditorMessage,
  type OpenFileRequestData,
  type SaveFileResponse,
  isEditorMessage,
  normalizeBytes,
} from './editor-messages';
import { resetEditorLocalStorage } from './editor-storage';

type MessageHandler = (message: EditorMessage) => void;

export interface OpenFileOptions {
  bytes: ArrayBuffer;
  filename: string;
}

export interface SavedFile {
  bytes: ArrayBuffer;
  filename?: string;
}

export type EditorFrameOptions = Pick<BuildEditorBootHtmlOptions, 'hideUI'>;

export class EditorFrame {
  private readonly iframe: HTMLIFrameElement;
  private readonly handlers = new Set<MessageHandler>();
  private readonly options: EditorFrameOptions;
  private requestCounter = 0;
  private ready = false;

  constructor(container: HTMLElement, options: EditorFrameOptions = {}) {
    this.options = options;
    this.iframe = document.createElement('iframe');
    this.iframe.className = 'editor-frame';
    this.iframe.title = 'eXeLearning editor';
    this.iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
    container.replaceChildren(this.iframe);
    window.addEventListener('message', this.handleMessage);
  }

  async load(): Promise<void> {
    await resetEditorLocalStorage();

    const ready = this.waitForType('EXELEARNING_READY', 30_000);
    const html = await buildEditorBootHtml({
      parentOrigin: window.location.origin,
      hideUI: this.options.hideUI,
    });
    this.iframe.srcdoc = html;
    await ready;
    this.ready = true;
    if (this.options.hideUI) {
      this.post({
        type: 'CONFIGURE',
        requestId: this.nextRequestId('configure'),
        data: { hideUI: this.options.hideUI },
      });
    }
  }

  async openFile(options: OpenFileOptions): Promise<void> {
    this.ensureReady();
    const requestId = this.nextRequestId('open');
    const success = this.waitForReply(
      ['OPEN_FILE_SUCCESS'],
      ['OPEN_FILE_ERROR'],
      requestId,
      60_000,
    );
    this.post(
      {
        type: 'OPEN_FILE',
        requestId,
        data: {
          bytes: options.bytes,
          filename: options.filename,
        } satisfies OpenFileRequestData,
      },
      [options.bytes],
    );
    await success;
  }

  async requestSave(): Promise<SavedFile> {
    this.ensureReady();
    const requestId = this.nextRequestId('save');
    const replyPromise = this.waitForReply(
      ['SAVE_FILE'],
      ['REQUEST_SAVE_ERROR'],
      requestId,
      60_000,
    );
    this.post({ type: 'REQUEST_SAVE', requestId });
    const message = (await replyPromise) as unknown as SaveFileResponse;
    return {
      bytes: normalizeBytes(message.bytes),
      filename:
        typeof message.filename === 'string' ? message.filename : undefined,
    };
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    this.handlers.clear();
    this.iframe.remove();
  }

  private ensureReady(): void {
    if (!this.ready) {
      throw new Error('The eXeLearning editor is not ready yet.');
    }
  }

  private nextRequestId(prefix: string): string {
    this.requestCounter += 1;
    return `onedrive-exelearning-${prefix}-${this.requestCounter}`;
  }

  private post(message: EditorMessage, transfer: Transferable[] = []): void {
    const target = this.iframe.contentWindow;
    if (!target) {
      throw new Error('The editor iframe is not available.');
    }
    target.postMessage(message, '*', transfer);
  }

  private waitForType(type: string, timeoutMs: number): Promise<EditorMessage> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        unsubscribe();
        reject(
          new Error(
            `Timed out waiting for ${type} from the eXeLearning editor.`,
          ),
        );
      }, timeoutMs);

      const unsubscribe = this.onMessage(message => {
        if (message.type === type) {
          window.clearTimeout(timeout);
          unsubscribe();
          resolve(message);
        }
      });
    });
  }

  private waitForReply(
    successTypes: readonly string[],
    errorTypes: readonly string[],
    requestId: string,
    timeoutMs: number,
  ): Promise<EditorMessage> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        unsubscribe();
        reject(
          new Error(
            `Timed out waiting for the eXeLearning editor to respond to ${requestId}.`,
          ),
        );
      }, timeoutMs);

      const unsubscribe = this.onMessage(message => {
        if (message.requestId !== requestId) {
          return;
        }
        if (successTypes.includes(message.type)) {
          window.clearTimeout(timeout);
          unsubscribe();
          resolve(message);
          return;
        }
        if (errorTypes.includes(message.type)) {
          window.clearTimeout(timeout);
          unsubscribe();
          const errorMessage =
            typeof message.error === 'string' ? message.error : message.type;
          reject(
            new Error(
              `The eXeLearning editor reported an error: ${errorMessage}`,
            ),
          );
        }
      });
    });
  }

  private readonly handleMessage = (event: MessageEvent<unknown>): void => {
    if (
      event.source !== this.iframe.contentWindow ||
      !isEditorMessage(event.data)
    ) {
      return;
    }
    for (const handler of this.handlers) {
      handler(event.data);
    }
  };
}
