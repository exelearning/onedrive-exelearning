/**
 * A viewer session owns one extracted `.elpx` package and the lifetime of its
 * Service Worker registration. Sessions are identified by a random id; the
 * iframe URL is built from that id, so two simultaneously open packages
 * cannot leak entries into each other.
 */

import { mimeForEntry } from './asset-map';

export interface SessionFile {
  bytes: Uint8Array;
  mime: string;
}

export interface ViewerSessionData {
  id: string;
  files: Map<string, SessionFile>;
  indexEntry: string;
  filename: string;
  createdAt: number;
}

export class ViewerSession {
  readonly data: ViewerSessionData;

  private constructor(data: ViewerSessionData) {
    this.data = data;
  }

  static create(input: {
    entries: ReadonlyMap<string, Uint8Array>;
    indexEntry: string;
    filename: string;
  }): ViewerSession {
    const files = new Map<string, SessionFile>();
    for (const [entry, bytes] of input.entries) {
      files.set(entry, { bytes, mime: mimeForEntry(entry) });
    }
    return new ViewerSession({
      id: randomSessionId(),
      files,
      indexEntry: input.indexEntry,
      filename: input.filename,
      createdAt: Date.now(),
    });
  }

  get id(): string {
    return this.data.id;
  }

  get indexEntry(): string {
    return this.data.indexEntry;
  }

  get filename(): string {
    return this.data.filename;
  }

  file(entry: string): SessionFile | undefined {
    return this.data.files.get(entry);
  }
}

function randomSessionId(): string {
  const cryptoApi =
    typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const buffer = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(buffer);
  } else {
    for (let i = 0; i < buffer.length; i += 1) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buffer, b => b.toString(16).padStart(2, '0')).join('');
}
