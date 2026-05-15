import { ELPX_MIME_TYPE } from '../config';
import { extractZipEntry } from '../elpx/zip-extract';
import {
  type DriveItemRef,
  patchDriveItem,
  uploadThumbnail,
} from './onedrive-api';

const SCREENSHOT_PATH = 'screenshot.png';

/**
 * Best-effort: lift the editor-generated `screenshot.png` from the freshly
 * saved `.elpx` and push it to OneDrive as a custom thumbnail.
 *
 * Microsoft Graph only accepts custom thumbnails on supported drive types
 * (business / Office 365 group / personal); when the upload is refused the
 * fallback is the system-generated thumbnail.
 *
 * Failure is non-fatal: the save itself already succeeded by the time this
 * runs, and a missing thumbnail is a strictly cosmetic regression.
 */
export async function publishElpxThumbnail(options: {
  token: string;
  ref: DriveItemRef;
  bytes: ArrayBuffer;
}): Promise<void> {
  try {
    const screenshot = await extractZipEntry(options.bytes, SCREENSHOT_PATH);
    await pushThumbnail({
      token: options.token,
      ref: options.ref,
      screenshot,
    });
  } catch (error) {
    console.warn(
      '[onedrive-exelearning] Failed to publish OneDrive thumbnail:',
      error,
    );
  }
}

/**
 * Same as {@link publishElpxThumbnail} but consumes an already-decoded entry
 * map (so the viewer can backfill thumbnails without re-extracting the zip
 * it already parsed).
 */
export async function publishElpxThumbnailFromEntries(options: {
  token: string;
  ref: DriveItemRef;
  entries: ReadonlyMap<string, Uint8Array>;
}): Promise<void> {
  try {
    const entry = options.entries.get(SCREENSHOT_PATH);
    const screenshot = entry ? toArrayBuffer(entry) : null;
    await pushThumbnail({
      token: options.token,
      ref: options.ref,
      screenshot,
    });
  } catch (error) {
    console.warn(
      '[onedrive-exelearning] Failed to publish OneDrive thumbnail:',
      error,
    );
  }
}

async function pushThumbnail(options: {
  token: string;
  ref: DriveItemRef;
  screenshot: ArrayBuffer | null;
}): Promise<void> {
  // Always best-effort: refresh the file metadata so the editor's
  // application-specific mimeType lands on the item (Graph does not let us
  // set the mimeType directly via PATCH but we can update other fields and
  // the request keeps the upload-time mimeType warm).
  try {
    await patchDriveItem({
      token: options.token,
      ref: options.ref,
      patch: {
        // The `file.mimeType` field is read-only on Graph; PATCHing here is
        // a no-op for the type but updates the last-modified marker so the
        // freshly uploaded `.elpx` is recognisable. We still keep the
        // ELPX_MIME_TYPE constant referenced for symmetry with gdrive.
        description: undefined,
      },
    });
  } catch (error) {
    console.warn(
      '[onedrive-exelearning] Could not refresh DriveItem metadata:',
      error,
    );
  }

  if (!options.screenshot) {
    return;
  }
  await uploadThumbnail({
    token: options.token,
    ref: options.ref,
    bytes: options.screenshot,
    mimeType: 'image/png',
  });
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength,
  ) as ArrayBuffer;
}

export { ELPX_MIME_TYPE };
