import { ELPX_MIME_TYPE } from '../config';
import {
  type DriveItem,
  type DriveItemRef,
  GraphApiError,
  createDriveItem,
  createUploadSession,
  putItemContent,
  uploadInUploadSession,
} from './onedrive-api';
import { getDriveItem } from './onedrive-api';
import {
  type OpenedDriveFileSnapshot,
  hasRemoteRevisionChanged,
} from './onedrive-state';

export type SaveConflictResolution = 'overwrite' | 'copy' | 'cancel';

const SIMPLE_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

export async function saveDriveFile(options: {
  token: string;
  snapshot: OpenedDriveFileSnapshot;
  bytes: ArrayBuffer;
  resolveConflict: (metadata: DriveItem) => SaveConflictResolution;
}): Promise<DriveItem | undefined> {
  const ref: DriveItemRef = {
    itemId: options.snapshot.itemId,
    driveId: options.snapshot.driveId,
  };
  const current = await getDriveItem({ token: options.token, ref });

  if (hasRemoteRevisionChanged(options.snapshot, current)) {
    const choice = options.resolveConflict(current);
    if (choice === 'cancel') {
      return undefined;
    }
    if (choice === 'copy') {
      if (!current.parentReference?.id) {
        throw new Error(
          'Cannot save as copy: the OneDrive parent folder is unknown.',
        );
      }
      return createDriveItem({
        token: options.token,
        parent: {
          itemId: current.parentReference.id,
          driveId: current.parentReference.driveId,
        },
        name: copyName(options.snapshot.name),
        bytes: options.bytes,
        mimeType: ELPX_MIME_TYPE,
        conflictBehavior: 'rename',
      });
    }
  }

  return uploadContent({
    token: options.token,
    ref,
    bytes: options.bytes,
    mimeType: ELPX_MIME_TYPE,
  });
}

export async function uploadContent(options: {
  token: string;
  ref: DriveItemRef;
  bytes: ArrayBuffer;
  mimeType?: string;
}): Promise<DriveItem> {
  if (options.bytes.byteLength <= SIMPLE_UPLOAD_LIMIT_BYTES) {
    return putItemContent({
      token: options.token,
      ref: options.ref,
      bytes: options.bytes,
      mimeType: options.mimeType,
    });
  }
  const session = await createUploadSession({
    token: options.token,
    ref: options.ref,
    fileSize: options.bytes.byteLength,
    conflictBehavior: 'replace',
  });
  return uploadInUploadSession({
    uploadUrl: session.uploadUrl,
    bytes: options.bytes,
  });
}

export function isThrottlingError(error: unknown): boolean {
  return (
    error instanceof GraphApiError &&
    (error.status === 429 || error.status === 503)
  );
}

function copyName(name: string): string {
  if (name.toLowerCase().endsWith('.elpx')) {
    return `${name.slice(0, -5)} copy.elpx`;
  }
  return `${name} copy`;
}
