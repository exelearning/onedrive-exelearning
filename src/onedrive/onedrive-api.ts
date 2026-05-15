/**
 * Microsoft Graph DriveItem client.
 *
 * Wraps the subset of Microsoft Graph endpoints the editor needs:
 *
 *   - GET /me/drive/items/{id}                              (metadata)
 *   - GET /drives/{driveId}/items/{id}                      (metadata, shared)
 *   - GET /me/drive/items/{id}/content                      (download)
 *   - PUT /me/drive/items/{id}/content                      (small upload, < 4 MB)
 *   - POST /me/drive/items/{parentId}:/{name}:/createUploadSession (upload session for large files)
 *   - PATCH /me/drive/items/{id}                            (metadata update)
 *   - GET /me/drive/items/{id}/children                     (folder listing)
 *
 * Microsoft Graph documentation references:
 *   - https://learn.microsoft.com/graph/api/resources/driveitem
 *   - https://learn.microsoft.com/graph/api/driveitem-get
 *   - https://learn.microsoft.com/graph/api/driveitem-get-content
 *   - https://learn.microsoft.com/graph/api/driveitem-put-content
 *   - https://learn.microsoft.com/graph/api/driveitem-createuploadsession
 *   - https://learn.microsoft.com/graph/api/driveitem-update
 *   - https://learn.microsoft.com/graph/api/driveitem-list-children
 *   - https://learn.microsoft.com/graph/throttling
 */

import { GRAPH_BASE } from '../config';

export interface DriveItemRef {
  /** Drive id; undefined uses the signed-in user's default drive (`/me/drive`). */
  driveId?: string;
  /** DriveItem id. Required for item-scoped calls. */
  itemId: string;
}

export interface DriveItem {
  id: string;
  name: string;
  size?: number;
  eTag?: string;
  cTag?: string;
  webUrl?: string;
  /** ISO-8601. Matches Drive's `modifiedTime`. */
  lastModifiedDateTime?: string;
  createdDateTime?: string;
  file?: {
    mimeType?: string;
    hashes?: { sha1Hash?: string; quickXorHash?: string };
  };
  folder?: { childCount?: number };
  parentReference?: {
    driveId?: string;
    driveType?: string;
    id?: string;
    path?: string;
  };
  /** Tells us whether the user can write to this item. */
  '@microsoft.graph.downloadUrl'?: string;
}

export interface DriveItemPermissions {
  canDownload: boolean;
  canEdit: boolean;
}

export class GraphApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  readonly code: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    status: number,
    message: string,
    details: unknown,
    code: string | undefined,
    retryAfterSeconds: number | undefined,
  ) {
    super(message);
    this.name = 'GraphApiError';
    this.status = status;
    this.details = details;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface GraphRequestOptions {
  token: string;
  signal?: AbortSignal;
}

export interface GetItemOptions extends GraphRequestOptions {
  ref: DriveItemRef;
  select?: string[];
  expand?: string[];
}

const DEFAULT_ITEM_SELECT = [
  'id',
  'name',
  'size',
  'eTag',
  'cTag',
  'webUrl',
  'lastModifiedDateTime',
  'createdDateTime',
  'file',
  'folder',
  'parentReference',
];

export async function getDriveItem(
  options: GetItemOptions,
): Promise<DriveItem> {
  const url = buildItemUrl(options.ref);
  url.searchParams.set(
    '$select',
    (options.select ?? DEFAULT_ITEM_SELECT).join(','),
  );
  if (options.expand && options.expand.length > 0) {
    url.searchParams.set('$expand', options.expand.join(','));
  }
  return parseJson<DriveItem>(
    await graphFetch(url.toString(), {
      method: 'GET',
      token: options.token,
      signal: options.signal,
    }),
  );
}

export interface DownloadItemOptions extends GraphRequestOptions {
  ref: DriveItemRef;
}

/**
 * Download the bytes for a DriveItem. Issues a GET against `/content`, which
 * Microsoft Graph answers with a `302` redirect to a short-lived
 * `@microsoft.graph.downloadUrl`. `fetch` transparently follows the redirect.
 */
export async function downloadDriveItem(
  options: DownloadItemOptions,
): Promise<ArrayBuffer> {
  const url = `${buildItemUrl(options.ref).toString()}/content`;
  const response = await graphFetch(url, {
    method: 'GET',
    token: options.token,
    signal: options.signal,
  });
  return response.arrayBuffer();
}

export interface UpdateContentOptions extends GraphRequestOptions {
  ref: DriveItemRef;
  bytes: ArrayBuffer | Uint8Array | Blob;
  mimeType?: string;
}

/**
 * Replace the bytes of an existing DriveItem using a simple PUT to `/content`.
 * Suitable for the typical `.elpx` sizes the editor produces. For uploads
 * larger than 4 MB callers should use {@link createUploadSession} +
 * {@link uploadInUploadSession}.
 */
export async function putItemContent(
  options: UpdateContentOptions,
): Promise<DriveItem> {
  const url = `${buildItemUrl(options.ref).toString()}/content`;
  const headers = new Headers();
  if (options.mimeType) {
    headers.set('Content-Type', options.mimeType);
  } else {
    headers.set('Content-Type', 'application/octet-stream');
  }
  return parseJson<DriveItem>(
    await graphFetch(url, {
      method: 'PUT',
      token: options.token,
      signal: options.signal,
      headers,
      body: normalizeBody(options.bytes),
    }),
  );
}

export interface CreateFileOptions extends GraphRequestOptions {
  /** Parent folder reference. Use `{ itemId: 'root' }` for the drive root. */
  parent: DriveItemRef;
  name: string;
  bytes: ArrayBuffer | Uint8Array | Blob;
  mimeType?: string;
  /** When the target file already exists. Defaults to "rename". */
  conflictBehavior?: 'fail' | 'replace' | 'rename';
}

/**
 * Create a brand-new DriveItem with content. Microsoft Graph exposes this as a
 * `PUT` to `<parent>:/<filename>:/content` against the user's drive.
 */
export async function createDriveItem(
  options: CreateFileOptions,
): Promise<DriveItem> {
  const parentUrl = buildItemUrl(options.parent).toString();
  const conflict = options.conflictBehavior ?? 'rename';
  const url = `${parentUrl}:/${encodeURIComponent(options.name)}:/content?@microsoft.graph.conflictBehavior=${encodeURIComponent(conflict)}`;
  const headers = new Headers();
  headers.set('Content-Type', options.mimeType ?? 'application/octet-stream');
  return parseJson<DriveItem>(
    await graphFetch(url, {
      method: 'PUT',
      token: options.token,
      signal: options.signal,
      headers,
      body: normalizeBody(options.bytes),
    }),
  );
}

export interface CreateFolderOptions extends GraphRequestOptions {
  parent: DriveItemRef;
  name: string;
  conflictBehavior?: 'fail' | 'replace' | 'rename';
}

export async function createDriveFolder(
  options: CreateFolderOptions,
): Promise<DriveItem> {
  const parentUrl = `${buildItemUrl(options.parent).toString()}/children`;
  const body = {
    name: options.name,
    folder: {},
    '@microsoft.graph.conflictBehavior': options.conflictBehavior ?? 'rename',
  };
  return parseJson<DriveItem>(
    await graphFetch(parentUrl, {
      method: 'POST',
      token: options.token,
      signal: options.signal,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
    }),
  );
}

export interface ListChildrenOptions extends GraphRequestOptions {
  parent: DriveItemRef;
  filter?: string;
  top?: number;
  select?: string[];
}

export async function listDriveChildren(
  options: ListChildrenOptions,
): Promise<{ value: DriveItem[]; nextLink?: string }> {
  const url = new URL(`${buildItemUrl(options.parent).toString()}/children`);
  if (options.filter) {
    url.searchParams.set('$filter', options.filter);
  }
  if (typeof options.top === 'number') {
    url.searchParams.set('$top', String(options.top));
  }
  url.searchParams.set(
    '$select',
    (options.select ?? DEFAULT_ITEM_SELECT).join(','),
  );
  const result = await parseJson<{
    value: DriveItem[];
    '@odata.nextLink'?: string;
  }>(
    await graphFetch(url.toString(), {
      method: 'GET',
      token: options.token,
      signal: options.signal,
    }),
  );
  return { value: result.value, nextLink: result['@odata.nextLink'] };
}

export interface UploadSessionOptions extends GraphRequestOptions {
  ref: DriveItemRef;
  fileSize: number;
  conflictBehavior?: 'fail' | 'replace' | 'rename';
}

export interface UploadSession {
  uploadUrl: string;
  expirationDateTime?: string;
}

/**
 * Create a Microsoft Graph upload session for an existing item. The caller can
 * then PUT byte ranges to `uploadUrl` to perform a chunked upload.
 *
 * https://learn.microsoft.com/graph/api/driveitem-createuploadsession
 */
export async function createUploadSession(
  options: UploadSessionOptions,
): Promise<UploadSession> {
  const url = `${buildItemUrl(options.ref).toString()}/createUploadSession`;
  const body = {
    item: {
      '@microsoft.graph.conflictBehavior':
        options.conflictBehavior ?? 'replace',
    },
  };
  return parseJson<UploadSession>(
    await graphFetch(url, {
      method: 'POST',
      token: options.token,
      signal: options.signal,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
    }),
  );
}

export interface UploadInSessionOptions {
  uploadUrl: string;
  bytes: ArrayBuffer | Uint8Array;
  chunkSize?: number;
  signal?: AbortSignal;
}

const DEFAULT_CHUNK_SIZE = 5 * 320 * 1024; // ~1.6 MB, must be multiple of 320 KiB.

export async function uploadInUploadSession(
  options: UploadInSessionOptions,
): Promise<DriveItem> {
  const bytes =
    options.bytes instanceof Uint8Array
      ? options.bytes
      : new Uint8Array(options.bytes);
  const total = bytes.byteLength;
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;

  let offset = 0;
  let lastResponse: Response | null = null;
  while (offset < total) {
    const end = Math.min(offset + chunkSize, total);
    const slice = bytes.subarray(offset, end);
    const headers = new Headers();
    headers.set('Content-Length', String(slice.byteLength));
    headers.set('Content-Range', `bytes ${offset}-${end - 1}/${total}`);
    const chunkBody = slice.buffer.slice(
      slice.byteOffset,
      slice.byteOffset + slice.byteLength,
    ) as ArrayBuffer;
    lastResponse = await fetch(options.uploadUrl, {
      method: 'PUT',
      headers,
      body: chunkBody,
      signal: options.signal,
    });
    if (!lastResponse.ok && lastResponse.status !== 202) {
      throw await readGraphError(lastResponse);
    }
    offset = end;
  }
  if (!lastResponse) {
    throw new Error('Upload session produced no response.');
  }
  return (await lastResponse.json()) as DriveItem;
}

export interface UpdateMetadataOptions extends GraphRequestOptions {
  ref: DriveItemRef;
  patch: Partial<DriveItem> & Record<string, unknown>;
}

export async function patchDriveItem(
  options: UpdateMetadataOptions,
): Promise<DriveItem> {
  return parseJson<DriveItem>(
    await graphFetch(buildItemUrl(options.ref).toString(), {
      method: 'PATCH',
      token: options.token,
      signal: options.signal,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(options.patch),
    }),
  );
}

export interface SetThumbnailOptions extends GraphRequestOptions {
  ref: DriveItemRef;
  bytes: ArrayBuffer | Uint8Array | Blob;
  mimeType?: string;
}

/**
 * Upload a custom thumbnail for the DriveItem. Note: Microsoft Graph only
 * accepts custom thumbnails for items inside drives whose `driveType` is
 * `business`, `documentLibrary`, or `personal` (with sufficient permissions).
 * Failures are caller-handled; the surrounding `publishElpxThumbnail` swallows
 * errors and falls back to the system-generated thumbnail.
 *
 * https://learn.microsoft.com/graph/api/thumbnailset-update
 */
export async function uploadThumbnail(
  options: SetThumbnailOptions,
): Promise<void> {
  const url = `${buildItemUrl(options.ref).toString()}/thumbnails/0/source/content`;
  const headers = new Headers();
  headers.set('Content-Type', options.mimeType ?? 'application/octet-stream');
  const response = await graphFetch(url, {
    method: 'PUT',
    token: options.token,
    signal: options.signal,
    headers,
    body: normalizeBody(options.bytes),
  });
  // Consume body so the connection can be reused; the response body is empty.
  await response.text().catch(() => '');
}

export function getDriveItemPermissions(item: DriveItem): DriveItemPermissions {
  // Microsoft Graph does not expose a Drive-style `capabilities` object.
  // Read/write permission is implicit from the user's role on the item; if
  // the OAuth scope is `Files.ReadWrite`, a successful `getDriveItem` means
  // we can both download and (attempt to) write. Items the user only has
  // read access to surface as 403 on write, which the caller handles.
  return {
    canDownload: true,
    canEdit: true,
    ..._maybeExtractPermissionsHints(item),
  };
}

function _maybeExtractPermissionsHints(
  _item: DriveItem,
): Partial<DriveItemPermissions> {
  // Reserved for future use — Graph's `@microsoft.graph.delta` may carry
  // additional hints in future versions. Today we have no reliable hint.
  return {};
}

export function buildItemUrl(ref: DriveItemRef): URL {
  const isRoot = ref.itemId === 'root';
  if (ref.driveId) {
    return new URL(
      isRoot
        ? `${GRAPH_BASE}/drives/${encodeURIComponent(ref.driveId)}/root`
        : `${GRAPH_BASE}/drives/${encodeURIComponent(ref.driveId)}/items/${encodeURIComponent(ref.itemId)}`,
    );
  }
  return new URL(
    isRoot
      ? `${GRAPH_BASE}/me/drive/root`
      : `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(ref.itemId)}`,
  );
}

interface GraphFetchOptions {
  method: string;
  token: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

async function graphFetch(
  url: string,
  options: GraphFetchOptions,
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${options.token}`);
  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body ?? null,
    signal: options.signal,
  });
  if (!response.ok) {
    throw await readGraphError(response);
  }
  return response;
}

async function readGraphError(response: Response): Promise<GraphApiError> {
  let details: unknown = null;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      details = await response.json();
    } catch {
      details = null;
    }
  } else {
    try {
      details = await response.text();
    } catch {
      details = null;
    }
  }
  const retryAfter = response.headers.get('Retry-After');
  return new GraphApiError(
    response.status,
    extractGraphErrorMessage(details, response.statusText),
    details,
    extractGraphErrorCode(details),
    retryAfter ? parseRetryAfter(retryAfter) : undefined,
  );
}

function parseRetryAfter(value: string): number | undefined {
  const seconds = Number.parseInt(value, 10);
  if (!Number.isNaN(seconds)) {
    return seconds;
  }
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }
  return undefined;
}

function extractGraphErrorMessage(details: unknown, fallback: string): string {
  if (
    typeof details === 'object' &&
    details !== null &&
    'error' in details &&
    typeof (details as { error: unknown }).error === 'object' &&
    (details as { error: { message?: unknown } }).error.message !== undefined
  ) {
    const message = (details as { error: { message: unknown } }).error.message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return fallback || 'Microsoft Graph request failed.';
}

function extractGraphErrorCode(details: unknown): string | undefined {
  if (
    typeof details === 'object' &&
    details !== null &&
    'error' in details &&
    typeof (details as { error: unknown }).error === 'object' &&
    typeof (details as { error: { code?: unknown } }).error.code === 'string'
  ) {
    return (details as { error: { code: string } }).error.code;
  }
  return undefined;
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function normalizeBody(content: ArrayBuffer | Uint8Array | Blob): BodyInit {
  if (content instanceof Uint8Array) {
    return content.slice().buffer as ArrayBuffer;
  }
  return content;
}
