# onedrive-exelearning

[![Deploy to GitHub Pages](https://github.com/exelearning/onedrive-exelearning/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/exelearning/onedrive-exelearning/actions/workflows/deploy.yml)
![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)
![Last Commit](https://img.shields.io/github/last-commit/exelearning/onedrive-exelearning)
![Open Issues](https://img.shields.io/github/issues/exelearning/onedrive-exelearning)

Edit eXeLearning `.elpx` (and legacy `.elp`) projects directly from Microsoft
OneDrive. The bundled static editor opens in the browser, the file stays in
your OneDrive — there is no backend, no server-side storage, and no refresh
tokens.

Live deploy: <https://exelearning.github.io/onedrive-exelearning/>

## Features

- **Open from OneDrive**: sign in with Microsoft, pick a `.elpx` file in the
  built-in OneDrive picker, and the project opens in the embedded
  eXeLearning editor.
- **Initial preview**: a sandboxed preview of the `.elpx` is rendered before
  the editor loads, mirroring the Google Drive integration. Click *Edit in
  eXeLearning* to switch to the editor.
- **Create new projects**: start with a blank `Untitled.elpx` (auto-numbered
  if a file with that name already exists in the target folder).
- **Legacy `.elp` upgrade**: opening a v2 `.elp` project loads it in the
  editor and the next save creates a fresh `.elpx` alongside the original
  (the legacy file is left untouched).
- **Conflict detection**: if OneDrive changed the file between open and
  save, the user is offered *overwrite*, *save as copy*, or *cancel*.
- **Custom thumbnails**: after every save we publish the editor-generated
  `screenshot.png` as the OneDrive item's thumbnail when the drive type
  allows it; otherwise we fall back to OneDrive's system-generated preview.

## Usage

1. Visit the deployed site and click **Sign in with Microsoft**.
2. Pick a `.elpx` file from your OneDrive, or click **New file** to create
   one. The editor opens in the same tab.
3. Edit the project and use **Save to OneDrive** (or `Ctrl/Cmd+S`).
4. OneDrive metadata (`lastModifiedDateTime`, thumbnail) is updated to
   reflect the new content.

Deep links are supported. Opening
`/onedrive-exelearning/open?itemId=<DRIVE_ITEM_ID>&driveId=<DRIVE_ID>`
takes the user straight to the preview, and adding `&mode=editor` skips the
preview and opens the editor directly.

## Limitations

- The app is static and runs entirely in the browser; there is no
  server-side token exchange or backend persistence.
- There is no collaborative editing.
- Large `.elpx` files are constrained by browser memory and OneDrive
  upload limits (chunked upload via `createUploadSession` kicks in
  automatically above ~4 MB).
- Custom thumbnails are only persisted on drive types that allow custom
  thumbnails. On personal OneDrive accounts the system-generated
  thumbnail is used instead.

## Required Microsoft Graph scopes

The app only requests delegated scopes. The minimum set is:

- `Files.ReadWrite` — read and write the user's OneDrive files.
- `User.Read` — read the signed-in user's display name for diagnostics.
- `openid`, `profile` — to receive a signed ID token that carries the
  account identity.

No refresh tokens or `offline_access` are requested. Access tokens live in
the tab's memory only and are renewed silently via the Microsoft identity
platform's `prompt=none` flow in a hidden iframe.

## Configuration

```sh
cp .env.example .env.local
```

Then fill in:

```text
VITE_MS_CLIENT_ID=<Application (client) ID from Microsoft Entra admin center>
VITE_MS_TENANT=common
```

`VITE_MS_TENANT` is the tenant the app authenticates against. Use:

| Value           | Who can sign in                                  |
| --------------- | ------------------------------------------------ |
| `common`        | Any work/school AND personal Microsoft account   |
| `organizations` | Any Microsoft Entra (work/school) tenant         |
| `consumers`     | Personal Microsoft accounts only                 |
| `<tenant-id>`   | A single Microsoft Entra tenant                  |

## Development

```sh
npm ci                          # install dependencies
cp .env.example .env.local       # then fill in VITE_MS_CLIENT_ID
make download-editor             # fetch the latest eXeLearning static editor
make dev                         # start the Vite dev server
```

`make download-editor` always tracks the **latest** GitHub release of
[`exelearning/exelearning`](https://github.com/exelearning/exelearning/releases).
Pin a specific version with `EXELEARNING_EDITOR_REF=vX.Y.Z`.

## Tests

```sh
npm run typecheck      # tsc --noEmit (strict mode)
npm run lint           # biome lint
npm run check          # biome check (lint + format)
npm test               # vitest (unit tests in src/**/*.test.ts)
```

The Vitest suite covers PKCE helpers, the Microsoft Graph state model,
package validation, zip reading, the viewer session and path normalization.
All tests run in jsdom and require no network access.

## Build and packaging

```sh
make download-editor
npm run build          # tsc --noEmit && vite build && stub /open, /create
```

The output lands in `dist/`. The build copies `dist/index.html` to
`dist/open/index.html` and `dist/create/index.html` so a static host can
serve the SPA routes directly. GitHub Pages deploys are handled by
`.github/workflows/deploy.yml`.

## Self-hosting and Microsoft Entra app registration

See [`SELF-HOSTING.md`](SELF-HOSTING.md) for a step-by-step Microsoft Entra
admin center walkthrough.

## Troubleshooting

| Symptom                                                        | Likely cause                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Missing VITE_MS_CLIENT_ID`                                    | The Application (client) ID is not set in the build environment.          |
| `Microsoft sign-in popup was blocked`                          | The browser blocked the popup. Allow popups for the deploy origin.        |
| `Silent sign-in failed: login_required` after first authorize  | First-time consent requires a user gesture; click *Sign in with Microsoft*. |
| `AADSTS50011` (invalid redirect URI)                           | Add the deploy origin's `/auth-callback.html` to the Entra app's SPA redirect URIs. |
| `HTTP 429` from Microsoft Graph                                | Graph throttling. The client surfaces `Retry-After`; wait and retry.       |

## License

GNU Affero General Public License v3 — see [`LICENSE`](LICENSE).
