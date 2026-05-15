# Configuration guide

End-to-end walkthrough for getting `onedrive-exelearning` deployed and
talking to Microsoft OneDrive. Read this once when setting up a new
deploy; afterwards the [`SELF-HOSTING.md`](SELF-HOSTING.md) quick
reference is enough.

- [1. Overview](#1-overview)
- [2. Prerequisites](#2-prerequisites)
- [3. Microsoft Entra app registration](#3-microsoft-entra-app-registration)
- [4. Tenant choice and OneDrive licensing](#4-tenant-choice-and-onedrive-licensing)
- [5. GitHub repository secrets](#5-github-repository-secrets)
- [6. Local development](#6-local-development)
- [7. Deploy verification](#7-deploy-verification)
- [8. OneDrive UI integration: what is and isn't possible](#8-onedrive-ui-integration-what-is-and-isnt-possible)
- [9. (Optional) Registering a File Handler 2.0 for OneDrive for Business](#9-optional-registering-a-file-handler-20-for-onedrive-for-business)
- [10. Troubleshooting](#10-troubleshooting)

## 1. Overview

`onedrive-exelearning` is a static SPA hosted on GitHub Pages (or any
static host). At build time it bakes two values into the bundle:

| Variable | Where to get it | Example |
| --- | --- | --- |
| `VITE_MS_CLIENT_ID` | Application (client) ID of a Microsoft Entra app registration | `59ccd347-8991-406e-9678-6fa69589ad88` |
| `VITE_MS_TENANT` | Tenant identifier (`common`, `organizations`, `consumers`, or a tenant id/domain) | `common` |

The app authenticates with the **Microsoft identity platform** using
the Authorization Code Flow with PKCE — no client secret, no refresh
tokens, access tokens stay in tab-local memory. File operations go to
**Microsoft Graph** at `https://graph.microsoft.com/v1.0`.

## 2. Prerequisites

- A Microsoft Entra (Azure AD) tenant. A free personal Microsoft account
  (Outlook/Hotmail/Live) is enough for the *Personal accounts* audience
  if you do not have access to a paid tenant.
- Owner/admin access to a GitHub repository (forked or cloned from
  `exelearning/onedrive-exelearning`) so you can set Actions secrets.
- Node 22+ and npm if you plan to run locally.

## 3. Microsoft Entra app registration

### 3.1 Create the app registration

1. Sign in to the [Microsoft Entra admin center](https://entra.microsoft.com).
2. Open **Identity → Applications → App registrations** and click
   **New registration**.
3. Fill in:
   - **Name**: `onedrive-exelearning` (any name; not user-visible).
   - **Supported account types**: pick the audience that matches your
     deploy — see [§4 Tenant choice](#4-tenant-choice-and-onedrive-licensing)
     before clicking.
   - **Redirect URI**: select **Single-page application (SPA)** from
     the dropdown and enter:
     ```
     https://<your-host>/onedrive-exelearning/auth-callback.html
     ```
     For the canonical GitHub Pages deploy this is
     `https://exelearning.github.io/onedrive-exelearning/auth-callback.html`.
4. Click **Register**.

> **Important — must be SPA.** Microsoft only enables the CORS headers
> on the `/oauth2/v2.0/token` endpoint when the redirect URI is
> registered under **Single-page application**. If it appears under
> **Web** or **Public client**, PKCE will fail and sign-in will error.

### 3.2 Add the development redirect URI

If you plan to run `npm run dev`, also add:

```
http://localhost:5173/onedrive-exelearning/auth-callback.html
```

This goes in the same SPA section of the **Authentication** blade.

### 3.3 Configure Microsoft Graph permissions

In **API permissions → Add a permission → Microsoft Graph → Delegated
permissions**, add:

| Permission | Purpose |
| --- | --- |
| `Files.ReadWrite` | Read and write the user's OneDrive files |
| `User.Read` | Display the signed-in user in diagnostics |
| `openid` | Receive a signed ID token |
| `profile` | Receive the user's display name in the ID token |

`offline_access` is intentionally **not** requested: the app does not
store refresh tokens.

For single-tenant deployments, click **Grant admin consent for
\<tenant\>**. For multi-tenant deployments, leave admin consent off —
end users will be prompted on first sign-in.

### 3.4 Confirm authentication settings

On the **Authentication** blade:

- The redirect URI is listed under **Single-page application** ✅
- **Implicit grant and hybrid flows** → both *unchecked*.
- **Allow public client flows** → *unchecked*.

### 3.5 Do **not** create a client secret

SPAs use PKCE in place of a client secret. Embedding a secret in a
public web bundle would be a security incident. Skip the *Certificates
& secrets* blade entirely.

## 4. Tenant choice and OneDrive licensing

The `VITE_MS_TENANT` value is constrained by **whether your end users
actually have OneDrive**. The Microsoft identity platform will happily
issue access tokens for accounts that have no OneDrive at all — Graph
then returns `Tenant does not have a SPO license` when the app calls
`/me/drive`.

| Audience | `VITE_MS_TENANT` | Entra "Supported account types" | OneDrive access |
| --- | --- | --- | --- |
| **Anyone with a personal Microsoft account** (Outlook/Hotmail/Live) **or** any Microsoft 365 tenant | `common` | Multitenant + personal Microsoft accounts | ✅ Personal OneDrive for MSA; OneDrive for Business for licensed M365 tenants |
| Any Microsoft 365 work/school tenant | `organizations` | Multitenant | ✅ OneDrive for Business (tenant must have SharePoint Online license) |
| Single Microsoft 365 tenant | `<tenant-id>` or `<domain>` | Single tenant | ✅ OneDrive for Business (tenant must have SharePoint Online license) |
| Personal Microsoft accounts only | `consumers` | Personal Microsoft accounts only | ✅ Personal OneDrive |

> **The SPO license gotcha.** Microsoft 365 / Azure AD tenants without
> a SharePoint Online subscription do **not** provision OneDrive for
> Business for their users. Sign-in succeeds, but Graph returns
> `400 Bad Request — Tenant does not have a SPO license` for any
> `/me/drive` call. If your users hit this:
>
> 1. Confirm they actually have OneDrive (sign in to
>    [onedrive.live.com](https://onedrive.live.com)).
> 2. If they don't, the choices are: (a) buy a Microsoft 365
>    Business/Education plan that includes SharePoint Online, or (b)
>    sign in with a personal Microsoft account instead — those have
>    free OneDrive included.
>
> The canonical public deploy uses `VITE_MS_TENANT=common`, which lets
> both audiences in. Single-tenant only makes sense when *every* user
> in the tenant has an M365 license.

## 5. GitHub repository secrets

The deploy workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
reads the secrets and passes them to `npm run build`. Set them once
per repository.

### Via `gh` CLI

```sh
gh secret set VITE_MS_CLIENT_ID --repo <owner>/<repo>
gh secret set VITE_MS_TENANT    --repo <owner>/<repo>
```

`gh` prompts for each value securely.

### Via the GitHub web UI

Repository → **Settings → Secrets and variables → Actions → New
repository secret**. Add `VITE_MS_CLIENT_ID` and `VITE_MS_TENANT`.

### Trigger a deploy

The workflow runs automatically on every push to `main`. To force a
rebuild without code changes:

```sh
gh workflow run deploy.yml --ref main --repo <owner>/<repo>
gh run watch --repo <owner>/<repo>
```

## 6. Local development

```sh
git clone https://github.com/<owner>/onedrive-exelearning.git
cd onedrive-exelearning
npm ci

cp .env.example .env.local        # then fill in VITE_MS_CLIENT_ID / VITE_MS_TENANT

make download-editor              # fetch the latest eXeLearning static editor
npm run dev                       # http://localhost:5173/onedrive-exelearning/
```

Vite reads `.env.local` and injects the values into the bundle. The
auth redirect lands on `http://localhost:5173/onedrive-exelearning/auth-callback.html`
— make sure this URL is registered as an SPA redirect in Entra
(see [§3.2](#32-add-the-development-redirect-uri)).

Useful commands:

```sh
npm run typecheck     # tsc --noEmit, strict mode
npm test              # Vitest unit suite
npm run check         # Biome lint + format
npm run build         # production build into dist/
```

## 7. Deploy verification

After the first deploy:

1. Open the site (`https://<your-host>/onedrive-exelearning/`).
2. The diagnostic panel on the home page should show:
   - **Microsoft client**: Configured (green)
   - **Editor**: Ready at /editor (green)
   - **Status**: Awaiting authorization (neutral) → after sign-in,
     *Connected to Microsoft OneDrive*.
3. Click **Sign in with Microsoft**. A popup opens; pick the account.
4. Click **Open from OneDrive**. The picker lists your `.elpx`/`.elp`
   files in the OneDrive root. Pick one and the editor opens.
5. Click **New file** to create a fresh `Untitled.elpx` in the root.

## 8. OneDrive UI integration: what is and isn't possible

A frequent request is to make eXeLearning appear under **Open with**
and **New** inside the OneDrive web UI, the same way Google Drive's
*Drive UI integration* works. The relevant Microsoft mechanism is
**File Handlers 2.0**. According to the
[official documentation](https://learn.microsoft.com/onedrive/developer/file-handlers/?view=odsp-graph-online),
its availability is:

| Service | File Handlers 2.0 |
| --- | --- |
| SharePoint Online | ✅ Generally available |
| OneDrive for Business | ✅ Generally available |
| **OneDrive personal** (Outlook/Hotmail/Live accounts) | ❌ **Not available** |
| Outlook Web App | ❌ Not available |

> Microsoft does not expose File Handlers for personal OneDrive
> accounts. The `onedrive.live.com` web UI will not show "Open with
> eXeLearning" or "New eXeLearning" regardless of how the app is
> registered. This is a platform limitation, not a misconfiguration.

For personal OneDrive users, the supported flows are:

1. **In-app picker** (default): the home page **Open from OneDrive**
   button and the **New file** button work for every audience.
2. **Deep links**: any URL of the form
   ```
   https://<your-host>/onedrive-exelearning/open?itemId=<DRIVEITEM_ID>&driveId=<DRIVE_ID>
   ```
   opens the editor directly. Appending `&mode=editor` skips the
   preview screen. The `create` route accepts `?folderId=<FOLDER_ITEM_ID>`.
3. **Browser extension** *(not in this repo)*: a Chrome/Firefox/Edge
   extension that injects an "Edit with eXeLearning" button into the
   `onedrive.live.com` context menu would emulate "Open with" for
   personal accounts. Out of scope for this plugin.

If you have a Microsoft 365 work/school tenant with OneDrive for
Business or SharePoint Online, see the next section.

## 9. (Optional) Registering a File Handler 2.0 for OneDrive for Business

Only applies to deploys whose end users are on **OneDrive for Business**
or **SharePoint Online**. Personal accounts are unaffected (see §8).

### 9.1 Add the File Handler manifest to the app registration

The File Handler manifest goes into the `addIns` array of the same
Microsoft Entra app registration created in §3. There are two ways to
add it:

**Option A — Entra portal manifest editor:**

1. Open the app registration → **Manifest**.
2. Paste the following into the `addIns` array (replace the
   `https://<your-host>` and the GUID with a fresh one of your own):

```json
"addIns": [
  {
    "id": "f3d2c1b4-aaaa-bbbb-cccc-deadbeefcafe",
    "type": "FileHandler",
    "properties": [
      { "key": "version", "value": "2" },
      {
        "key": "fileTypeDisplayName",
        "value": "eXeLearning project"
      },
      {
        "key": "fileTypeIcon",
        "value": "{\"svg\":\"https://<your-host>/onedrive-exelearning/icons/exelearning.svg\"}"
      },
      {
        "key": "appIcon",
        "value": "{\"svg\":\"https://<your-host>/onedrive-exelearning/icons/exelearning.svg\"}"
      },
      {
        "key": "actions",
        "value": "[{\"type\":\"open\",\"url\":\"https://<your-host>/onedrive-exelearning/open\",\"availableOn\":{\"file\":{\"extensions\":[\".elpx\",\".elp\"]},\"web\":{}}},{\"type\":\"newFile\",\"url\":\"https://<your-host>/onedrive-exelearning/create\",\"availableOn\":{\"file\":{\"extensions\":[\".elpx\"]},\"web\":{}}}]"
      }
    ]
  }
]
```

3. **Save**.

**Option B — Microsoft Graph PATCH:**

```sh
TOKEN=<bearer token with Directory.ReadWrite.All scope>
OBJECT_ID=<Object Id of the Entra app — NOT the Application/Client Id>

curl -X PUT "https://graph.microsoft.com/v1.0/applications/$OBJECT_ID/addIns" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":[{"id":"f3d2c1b4-aaaa-bbbb-cccc-deadbeefcafe","type":"FileHandler","properties":[…same as Option A…]}]}'
```

### 9.2 How OneDrive activates the handler

When a user clicks a `.elpx` file in OneDrive for Business or
SharePoint, Microsoft does **NOT** redirect to your `open` URL with
query parameters. It instead issues a `POST` with
`Content-Type: application/x-www-form-urlencoded` containing:

| Form field | Meaning |
| --- | --- |
| `cultureName` | Locale, e.g. `en-us` |
| `client` | `OneDrive` or `SharePoint` |
| `userId` | UPN of the signed-in user |
| `domainHint` | `organizations` or `consumers` |
| `items` | JSON array of Microsoft Graph item URLs |

Today our `/open` route reads the file id from the query string. To
fully support File Handler 2.0 activation, a future change has to:

1. Detect a `POST` activation (or read the `items` form field if the
   web host runs server-side code).
2. Parse the first URL out of the `items` array, e.g.
   `https://graph.microsoft.com/v1.0/drives/{driveId}/items/{itemId}`,
   and redirect to `/open?driveId=…&itemId=…`.

This is a follow-up that is straightforward to add when a real
OneDrive for Business deploy lands. The current static site already
serves the right URLs; only the activation-parameter parser is
missing.

### 9.3 Cache propagation

File handler registrations are cached aggressively by Microsoft 365.
Allow **24–48 hours** after registering for "Open with eXeLearning"
and "New eXeLearning" to appear in the OneDrive UI. See
[Refresh file handler cache](https://learn.microsoft.com/onedrive/developer/file-handlers/reset-cache)
for the developer cache-bust endpoint.

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Home page shows **Microsoft client: Missing VITE_MS_CLIENT_ID** | Build env vars not wired up | Set the GitHub secret or `.env.local` and rebuild. |
| Sign-in popup → `AADSTS50011 — invalid redirect URI` | Redirect URI not registered or not SPA | Add `https://<host>/onedrive-exelearning/auth-callback.html` under **Single-page application** in the Entra app. |
| Sign-in popup → `AADSTS50194 — application is not configured as a multi-tenant application` | Tenant is single-tenant but `VITE_MS_TENANT=common` | Either change the audience in Entra → Authentication to *multitenant + personal*, or set `VITE_MS_TENANT` to your tenant id. |
| Status: `Tenant does not have a SPO license` | Signed-in user has no OneDrive for Business | Sign in with a personal Microsoft account (free OneDrive) **or** add a SharePoint Online license to the tenant user. See [§4](#4-tenant-choice-and-onedrive-licensing). |
| HTTP 429 from `graph.microsoft.com` | Graph throttling | The client surfaces `Retry-After`. Wait the indicated seconds and retry. |
| `Microsoft sign-in popup was blocked` | Browser popup blocker | Allow popups for the deploy origin. |
| "Open with eXeLearning" not appearing in OneDrive | Either personal account (not supported, see §8) or File Handler cache (24-48h, see §9.3) | Wait, or use the in-app picker. |
| Build error: `Top-level await is not available in the configured target environment` | Vite default target too old | Already addressed: `vite.config.ts` sets `build.target = 'es2022'`. |

If something else breaks, the browser DevTools console captures the
full Graph response under `[onedrive-exelearning]` log prefixes; open
an issue with the error code, the URL, and the response body.
