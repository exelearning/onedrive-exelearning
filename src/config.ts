export const APP_NAME = 'onedrive-exelearning';

export const MS_CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID ?? '';
export const MS_TENANT = import.meta.env.VITE_MS_TENANT ?? 'common';

/**
 * Delegated Microsoft Graph scopes used by the app.
 *
 * - `Files.ReadWrite` is the least-privileged scope that allows reading and
 *   writing the user's own OneDrive files. It is the closest analogue to
 *   Google Drive's `drive.file`.
 * - `User.Read` is included to surface the signed-in user name/avatar in
 *   diagnostics. It is the lowest-privilege Microsoft Graph user scope.
 *
 * `offline_access` is intentionally **not** requested. Refresh tokens are out
 * of scope for this static web app; the access token lives in memory only
 * and is renewed via the Microsoft identity platform's silent SSO endpoint
 * (`prompt=none` in a hidden iframe).
 */
export const MS_SCOPES = ['Files.ReadWrite', 'User.Read', 'openid', 'profile'];

export const MS_SCOPE = MS_SCOPES.join(' ');

export const APP_BASE_URL = import.meta.env.BASE_URL;
export const EDITOR_PATH = `${APP_BASE_URL}editor/`;
export const EDITOR_INDEX_PATH = `${EDITOR_PATH}index.html`;
export const BLANK_TEMPLATE_PATH = `${APP_BASE_URL}templates/blank.elpx`;
export const AUTH_CALLBACK_PATH = `${APP_BASE_URL}auth-callback.html`;

export const ELPX_MIME_TYPE = 'application/vnd.exelearning.elpx';

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export function requireMsClientId(): string {
  if (!MS_CLIENT_ID) {
    throw new Error(
      'Missing VITE_MS_CLIENT_ID. Configure it in your environment before using Microsoft OneDrive.',
    );
  }
  return MS_CLIENT_ID;
}

export function authorityBaseUrl(tenant: string = MS_TENANT): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}`;
}
