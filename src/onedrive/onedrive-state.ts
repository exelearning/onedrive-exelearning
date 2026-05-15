/**
 * Open/Create state for OneDrive.
 *
 * Microsoft does not have a built-in "Open with" Drive UI integration the way
 * Google Drive does. Two entry-point conventions are supported:
 *
 *   1. URL params from a custom deep link / OneDrive file handler:
 *        /open?itemId=…&driveId=…&userId=…
 *        /create?folderId=…&driveId=…&userId=…
 *      Both forms are produced after the OneDrive picker selects a file.
 *   2. Picker selection from the home page launches `/open` with the same
 *      parameters in the address bar.
 *
 * The shape mirrors `drive-state.ts` from gdrive-exelearning so the surrounding
 * page code stays symmetrical.
 */

import type { DriveItem } from './onedrive-api';

export type OneDriveOpenState = {
  action: 'open';
  itemId: string;
  driveId?: string;
  userId?: string;
};

export type OneDriveCreateState = {
  action: 'create';
  folderId?: string;
  driveId?: string;
  userId?: string;
};

export type OneDriveState = OneDriveOpenState | OneDriveCreateState;

export type LocalDriveSnapshot = {
  itemId: string;
  driveId?: string;
  eTag?: string;
  cTag?: string;
  lastModifiedDateTime?: string;
};

export type OpenedDriveFileSnapshot = {
  itemId: string;
  driveId?: string;
  name: string;
  eTag?: string;
  cTag?: string;
  lastModifiedDateTime?: string;
  canEdit?: boolean;
};

export type RemoteModificationComparison =
  | { status: 'same'; remote: DriveItem }
  | {
      status: 'remote-newer';
      remote: DriveItem;
      reason: 'eTag' | 'cTag' | 'lastModifiedDateTime';
    }
  | {
      status: 'local-newer';
      remote: DriveItem;
      reason: 'lastModifiedDateTime';
    }
  | {
      status: 'unknown';
      remote: DriveItem;
      reason: 'missing-local-snapshot' | 'missing-comparable-fields';
    };

export function compareRemoteModification(
  local: LocalDriveSnapshot | null,
  remote: DriveItem,
): RemoteModificationComparison {
  if (!local) {
    return { status: 'unknown', remote, reason: 'missing-local-snapshot' };
  }

  if (local.cTag && remote.cTag && local.cTag !== remote.cTag) {
    return { status: 'remote-newer', remote, reason: 'cTag' };
  }

  if (local.eTag && remote.eTag && local.eTag !== remote.eTag) {
    return { status: 'remote-newer', remote, reason: 'eTag' };
  }

  if (local.lastModifiedDateTime && remote.lastModifiedDateTime) {
    const localTime = Date.parse(local.lastModifiedDateTime);
    const remoteTime = Date.parse(remote.lastModifiedDateTime);

    if (Number.isNaN(localTime) || Number.isNaN(remoteTime)) {
      return { status: 'unknown', remote, reason: 'missing-comparable-fields' };
    }
    if (remoteTime > localTime) {
      return {
        status: 'remote-newer',
        remote,
        reason: 'lastModifiedDateTime',
      };
    }
    if (localTime > remoteTime) {
      return {
        status: 'local-newer',
        remote,
        reason: 'lastModifiedDateTime',
      };
    }
    return { status: 'same', remote };
  }

  if (
    (local.cTag && remote.cTag && local.cTag === remote.cTag) ||
    (local.eTag && remote.eTag && local.eTag === remote.eTag)
  ) {
    return { status: 'same', remote };
  }

  return { status: 'unknown', remote, reason: 'missing-comparable-fields' };
}

export function createLocalDriveSnapshot(
  metadata: DriveItem,
): LocalDriveSnapshot {
  return {
    itemId: metadata.id,
    driveId: metadata.parentReference?.driveId,
    eTag: metadata.eTag,
    cTag: metadata.cTag,
    lastModifiedDateTime: metadata.lastModifiedDateTime,
  };
}

export function hasRemoteRevisionChanged(
  local: Pick<
    OpenedDriveFileSnapshot,
    'eTag' | 'cTag' | 'lastModifiedDateTime'
  >,
  remote: Pick<DriveItem, 'eTag' | 'cTag' | 'lastModifiedDateTime'>,
): boolean {
  if (local.cTag && remote.cTag) {
    return local.cTag !== remote.cTag;
  }
  if (local.eTag && remote.eTag) {
    return local.eTag !== remote.eTag;
  }
  if (local.lastModifiedDateTime && remote.lastModifiedDateTime) {
    return (
      Date.parse(remote.lastModifiedDateTime) >
      Date.parse(local.lastModifiedDateTime)
    );
  }
  return false;
}

/**
 * Reconstruct an {@link OneDriveState} from the current page query string.
 *
 * OneDrive entry points send compact `?itemId=…&driveId=…` (open) or
 * `?folderId=…&driveId=…` (create) parameters. A `state=<JSON>` parameter is
 * also accepted for parity with the Google Drive flow so that the OneDrive
 * picker can hand off a multi-field payload in a single parameter when
 * required.
 */
export function parseOneDriveStateFromParams(
  params: URLSearchParams,
  expectedAction: 'open' | 'create',
): OneDriveState {
  const rawState = params.get('state');
  if (rawState) {
    return parseOneDriveState(rawState);
  }
  const userId = params.get('userId') ?? undefined;
  const driveId = params.get('driveId') ?? undefined;
  if (expectedAction === 'open') {
    const itemId = params.get('itemId');
    if (itemId) {
      return { action: 'open', itemId, driveId, userId };
    }
    throw new Error('Missing OneDrive item id.');
  }
  const folderId = params.get('folderId') ?? undefined;
  return { action: 'create', folderId, driveId, userId };
}

export function parseOneDriveState(rawState: string | null): OneDriveState {
  if (!rawState) {
    throw new Error('Missing OneDrive state.');
  }
  const parsed = JSON.parse(decodeURIComponent(rawState)) as unknown;
  if (!isRecord(parsed) || typeof parsed.action !== 'string') {
    throw new Error('Invalid OneDrive state.');
  }
  if (parsed.action === 'open') {
    const itemId =
      typeof parsed.itemId === 'string'
        ? parsed.itemId
        : Array.isArray(parsed.ids) && typeof parsed.ids[0] === 'string'
          ? parsed.ids[0]
          : null;
    if (!itemId) {
      throw new Error('OneDrive open state must include an item id.');
    }
    return {
      action: 'open',
      itemId,
      driveId: typeof parsed.driveId === 'string' ? parsed.driveId : undefined,
      userId: typeof parsed.userId === 'string' ? parsed.userId : undefined,
    };
  }
  if (parsed.action === 'create') {
    return {
      action: 'create',
      folderId:
        typeof parsed.folderId === 'string' ? parsed.folderId : undefined,
      driveId: typeof parsed.driveId === 'string' ? parsed.driveId : undefined,
      userId: typeof parsed.userId === 'string' ? parsed.userId : undefined,
    };
  }
  throw new Error(`Unsupported OneDrive action "${parsed.action}".`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
