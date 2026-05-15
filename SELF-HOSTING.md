# Self-hosting `onedrive-exelearning`

Deploy your own instance of the Microsoft OneDrive integration.

## 1. Build and host the static site

The app is a static site; any host that serves `dist/` works. The default
GitHub Actions workflow deploys to GitHub Pages on every push to `main`.

```sh
git clone https://github.com/exelearning/onedrive-exelearning.git
cd onedrive-exelearning
npm ci
make download-editor   # fetches the latest exelearning release
npm run build
```

`make download-editor` always tracks the **latest** GitHub release of
[`exelearning/exelearning`](https://github.com/exelearning/exelearning/releases).
Pin a specific version with `EXELEARNING_EDITOR_REF=vX.Y.Z`.

To build the editor from source instead of a release ZIP:

```sh
make build-editor                          # latest release (default)
EXELEARNING_EDITOR_REF=main \
  EXELEARNING_EDITOR_REF_TYPE=branch \
  make build-editor                         # bleeding-edge
```

## 2. Microsoft Entra (Azure AD) app registration

The app needs a Microsoft Entra app registration so it can request access to
Microsoft Graph on the signed-in user's behalf.

### 2.1 Create the registration

1. Sign in to the [Microsoft Entra admin center](https://entra.microsoft.com)
   with an account that has permission to create app registrations in the
   target tenant.
2. Go to **Identity → Applications → App registrations** and click
   **New registration**.
3. Fill in:
   - **Name**: `onedrive-exelearning` (any name; users do not see this).
   - **Supported account types**: pick the audience that matches your
     deploy:
     - *Accounts in any organizational directory (Any Microsoft Entra ID
       tenant – Multitenant) and personal Microsoft accounts* — use
       `VITE_MS_TENANT=common`. Most general-purpose deploys want this.
     - *Accounts in any organizational directory* — use
       `VITE_MS_TENANT=organizations`.
     - *Accounts in this organizational directory only* — single-tenant;
       use the tenant id as `VITE_MS_TENANT`.
     - *Personal Microsoft accounts only* — use `VITE_MS_TENANT=consumers`.
   - **Redirect URI**: select **Single-page application (SPA)** in the
     dropdown and enter the absolute callback URL, for example:
     ```text
     https://<your-host>/onedrive-exelearning/auth-callback.html
     ```
4. Click **Register**.

### 2.2 Confirm the SPA redirect URI

The redirect URI must be registered under **Single-page application (SPA)**,
not **Web** or **Public client**. Microsoft only enables the SPA-specific
CORS headers on the `/token` endpoint when the redirect URI is registered
under SPA, and the OAuth Authorization Code Flow with PKCE will not work
otherwise.

To verify, in the app registration go to **Authentication** and confirm
that the redirect URI appears under **Single-page application**. Add
extra redirect URIs here for any additional deploy origin (e.g. a staging
environment).

### 2.3 Microsoft Graph permissions

In the app registration, go to **API permissions** and add the following
**delegated** Microsoft Graph permissions:

| Permission        | Type      | Why                                                  |
| ----------------- | --------- | ---------------------------------------------------- |
| `Files.ReadWrite` | Delegated | Read and write the user's OneDrive files (least privilege for editing). |
| `User.Read`       | Delegated | Show the signed-in user in diagnostics.              |
| `openid`          | Delegated | Receive a signed ID token.                           |
| `profile`         | Delegated | Receive the user's display name in the ID token.     |

`offline_access` is intentionally **not** requested. The app does not store
refresh tokens; access tokens are renewed silently via the Microsoft
identity platform SSO cookie.

For single-tenant or work/school deploys, click **Grant admin consent for
<tenant>** so that end users do not have to consent individually.

For multi-tenant deploys, leave admin consent off; end users will be
prompted on first sign-in. Users always retain the ability to revoke
consent from the [Microsoft account consent
manager](https://account.live.com/consent/Manage) or the work/school
[My Apps portal](https://myapps.microsoft.com).

### 2.4 Authentication settings

On the **Authentication** page:

- Leave **Implicit grant and hybrid flows** *unchecked*. The app uses the
  Authorization Code Flow with PKCE; it does not need implicit tokens.
- Leave **Allow public client flows** *unchecked*. The app is a public SPA
  but the SPA redirect URI already handles this correctly.
- Set **Supported account types** consistently with the value of
  `VITE_MS_TENANT` (see the table in 2.1).

### 2.5 Client credentials (not required)

A confidential client secret is **not** required, must not be created, and
must not be embedded in the front-end bundle. SPAs use PKCE in place of a
client secret.

## 3. Configure the deploy

Pass the values to the build environment:

```text
VITE_MS_CLIENT_ID=<Application (client) ID from the registration overview>
VITE_MS_TENANT=common
```

For local development, copy `.env.example` to `.env.local` and fill in the
values. For GitHub Pages deploys, store them as repository **Secrets** or
**Variables** named `VITE_MS_CLIENT_ID` and (optionally) `VITE_MS_TENANT`;
the workflow consumes both `secrets.*` and `vars.*` fallbacks.

## 4. Verify

After the first deploy:

1. Open `https://<your-host>/onedrive-exelearning/` in a browser.
2. The footer diagnostic row should show **Microsoft client: Configured**
   and **Editor: Ready at /editor**.
3. Click **Sign in with Microsoft**. A Microsoft sign-in popup opens; pick
   the account that owns the target OneDrive.
4. Click **Open from OneDrive** and pick a `.elpx` file. The editor should
   open, the file should download, and **Save to OneDrive** should publish
   the updated bytes back to OneDrive.

## 5. Optional: file handler / deep linking

Microsoft does not expose a Drive UI "Open with" integration in the way
Google Drive does, but the app understands deep-link URLs identical in
shape to the parameters the OneDrive picker hands back:

```text
https://<your-host>/onedrive-exelearning/open?itemId=<DRIVE_ITEM_ID>&driveId=<DRIVE_ID>
https://<your-host>/onedrive-exelearning/open?itemId=<DRIVE_ITEM_ID>&driveId=<DRIVE_ID>&mode=editor
https://<your-host>/onedrive-exelearning/create?folderId=<FOLDER_ITEM_ID>&driveId=<DRIVE_ID>
```

You can register the app as a SharePoint / Microsoft 365 file handler so
that opening a `.elpx` file in the OneDrive web UI redirects to your
deployed instance. See the [SharePoint file handler
documentation](https://learn.microsoft.com/sharepoint/dev/spfx/extensions/get-started/build-a-hello-world-extension)
for the registration steps.
