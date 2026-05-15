/**
 * Client-side bridge to the eXeLearning runtime Service Worker.
 *
 * The SW only intercepts URLs under `runtimeBase`. The page hands extracted
 * bytes to the SW via postMessage; the SW stores them in memory and serves
 * `<runtimeBase>/<sessionId>/<entry>` requests for the iframe.
 */

import { APP_BASE_URL } from '../config';
import type { ViewerSession } from '../elpx/viewer-session';

export interface RuntimeWorker {
  registration: ServiceWorkerRegistration;
  scriptUrl: string;
  scope: string;
  runtimeBase: string;
}

let activeWorker: RuntimeWorker | null = null;
let pendingRegistration: Promise<RuntimeWorker> | null = null;

function runtimeScope(): string {
  return `${APP_BASE_URL}runtime/`;
}

function runtimeScriptUrl(): string {
  return `${APP_BASE_URL}runtime/sw.js`;
}

export async function ensureRuntimeWorker(): Promise<RuntimeWorker> {
  if (activeWorker) {
    return activeWorker;
  }
  if (pendingRegistration) {
    return pendingRegistration;
  }
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error(
      'Service Workers are not available in this browser context.',
    );
  }
  pendingRegistration = registerRuntimeWorker().finally(() => {
    pendingRegistration = null;
  });
  return pendingRegistration;
}

async function registerRuntimeWorker(): Promise<RuntimeWorker> {
  const scriptUrl = runtimeScriptUrl();
  const scope = runtimeScope();
  const runtimeBase = scope.replace(/\/+$/, '');
  const registration = await navigator.serviceWorker.register(scriptUrl, {
    scope,
    type: 'classic',
  });
  await waitForActive(registration);
  const worker: RuntimeWorker = {
    registration,
    scriptUrl,
    scope,
    runtimeBase,
  };
  activeWorker = worker;
  return worker;
}

function waitForActive(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active && navigator.serviceWorker.controller) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const sw =
      registration.installing || registration.waiting || registration.active;
    if (!sw) {
      resolve();
      return;
    }
    if (sw.state === 'activated') {
      resolve();
      return;
    }
    sw.addEventListener('statechange', () => {
      if (sw.state === 'activated') {
        resolve();
      }
    });
  });
}

export async function registerSession(
  worker: RuntimeWorker,
  session: ViewerSession,
): Promise<void> {
  const target =
    worker.registration.active ??
    worker.registration.waiting ??
    worker.registration.installing;
  if (!target) {
    throw new Error('The eXeLearning Service Worker is not active.');
  }
  const files: Array<{ path: string; mime: string; bytes: ArrayBuffer }> = [];
  for (const [path, file] of session.data.files) {
    const sliced = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength,
    );
    files.push({
      path,
      mime: file.mime,
      bytes: sliced as ArrayBuffer,
    });
  }
  await postWithReply(target, {
    type: 'EXELEARNING_REGISTER_SESSION',
    sessionId: session.id,
    indexEntry: session.indexEntry,
    filename: session.filename,
    files,
  });
}

export async function unregisterSession(
  worker: RuntimeWorker,
  sessionId: string,
): Promise<void> {
  const target =
    worker.registration.active ??
    worker.registration.waiting ??
    worker.registration.installing;
  if (!target) {
    return;
  }
  try {
    await postWithReply(target, {
      type: 'EXELEARNING_UNREGISTER_SESSION',
      sessionId,
    });
  } catch {
    // Session cleanup failures must not surface.
  }
}

interface RuntimeMessage {
  type: string;
  [key: string]: unknown;
}

function postWithReply(
  target: ServiceWorker,
  message: RuntimeMessage,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = event => {
      channel.port1.close();
      const data = event.data as { ok?: boolean; error?: string } | undefined;
      if (data?.ok) {
        resolve();
      } else {
        reject(
          new Error(data?.error ?? 'Service Worker rejected the message.'),
        );
      }
    };
    try {
      target.postMessage(message, [channel.port2]);
    } catch (error) {
      channel.port1.close();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
