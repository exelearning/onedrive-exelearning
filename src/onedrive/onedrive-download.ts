import {
  type DriveItem,
  type DriveItemRef,
  downloadDriveItem,
  getDriveItem,
  getDriveItemPermissions,
} from './onedrive-api';

export async function fetchEditableDriveFile(options: {
  token: string;
  ref: DriveItemRef;
}): Promise<{ metadata: DriveItem; bytes: ArrayBuffer }> {
  const metadata = await getDriveItem({
    token: options.token,
    ref: options.ref,
  });
  const permissions = getDriveItemPermissions(metadata);
  if (!permissions.canDownload) {
    throw new Error(
      `Microsoft OneDrive does not allow downloading "${metadata.name}".`,
    );
  }
  const bytes = await downloadDriveItem({
    token: options.token,
    ref: options.ref,
  });
  return { metadata, bytes };
}
