<!-- AGENTS.md -->

# Agents Coding Conventions for "onedrive-exelearning"

These are natural-language guidelines for agents to follow when developing
the `onedrive-exelearning` static Microsoft OneDrive integration for
eXeLearning.

## Project conventions

- This project is a **static Vite + TypeScript web app**. Do not add a
  backend, server-side session storage, server-side secrets, or refresh-token
  flow.
- The "treat `.elpx` as binary, do not unzip" rule has **one** narrow
  exception: extracting `screenshot.png` after a successful save in order to
  push it as a custom OneDrive thumbnail. The dedicated
  `src/elpx/zip-extract.ts` reader only walks the central directory and
  decompresses a single named entry — it never reads `content.xml`,
  `content.dtd`, anything inside `idevices/`, or any HTML.
- The app is published at:
  ```text
  https://exelearning.github.io/onedrive-exelearning/
  ```
- Keep Vite configured with:
  ```ts
  base: '/onedrive-exelearning/'
  ```
- Use **plain browser APIs** and minimal dependencies. Do not introduce
  React, Vue, Angular, server frameworks, the official MSAL.js SDK, the
  Microsoft Graph JavaScript SDK, or state-management libraries unless
  explicitly requested. The auth flow is implemented directly against the
  Microsoft identity platform using PKCE.
- Use English for source code, identifiers, comments, documentation, and
  first-version UI strings.
- Keep `.elpx` files as **binary files**. Do not inspect, parse, patch,
  unzip, regenerate, or edit internals such as `content.xml`.
- Do not implement a new editor. The editor is the existing eXeLearning
  static editor installed under `public/editor/`.
- Do not commit downloaded or built editor files. `public/editor/` should
  keep only `.gitkeep` tracked.

## Documentation lookup

- Use the official Microsoft Learn documentation as the primary source for
  Microsoft Graph and Microsoft identity platform API behavior. Prefer
  Microsoft Graph (`graph.microsoft.com/v1.0`) over the legacy OneDrive
  REST API (`api.onedrive.com`).
- Relevant Microsoft Graph reference areas:
  - `driveItem` resource and CRUD operations.
  - `driveItem: createUploadSession` for large uploads.
  - `thumbnailSet` and custom thumbnails.
  - Microsoft Graph permissions reference for delegated scopes.
  - Microsoft Graph throttling and retry guidance.
- Microsoft identity platform references:
  - Authorization Code Flow with PKCE for SPAs.
  - Silent SSO via `prompt=none`.
  - SPA redirect URI registration.

## Testing and development workflow

- Use TypeScript strict mode.
- Add focused tests for pure parsing, state, Microsoft Graph helpers, PKCE
  helpers, and conflict logic.
- Keep tests under `src/**/*.test.ts` and run them with Vitest.
- Before submitting changes, run:
  ```sh
  npm ci
  npm run typecheck
  npm test
  npm run build
  git diff --check
  ```
- Do not claim a workflow, build, or deployment works without fresh command
  output.

## Tooling quick start

- Install dependencies:
  ```sh
  npm ci
  ```
- Create local environment:
  ```sh
  cp .env.example .env.local
  ```
- Fill in:
  ```text
  VITE_MS_CLIENT_ID=
  VITE_MS_TENANT=common
  ```
- Download the static editor:
  ```sh
  make download-editor
  ```
- Start local development:
  ```sh
  make dev
  ```
- Build the app:
  ```sh
  make build
  ```

## Microsoft OAuth and Graph conventions

- Use the Microsoft identity platform Authorization Code Flow with PKCE:
  - `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/authorize`
  - `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token`
  - PKCE `S256` only; never store or send a `client_secret`.
  - Interactive sign-in uses a popup whose redirect lands on
    `public/auth-callback.html`; that page posts the auth code back to the
    opener.
  - Silent renewal uses a hidden iframe with `prompt=none` and
    `response_mode=fragment` so the SSO cookie carries the session.
  - Access tokens are kept in memory only. Refresh tokens and
    `offline_access` are intentionally **not** requested.
- Required delegated scopes:
  ```text
  Files.ReadWrite
  User.Read
  openid
  profile
  ```
- Microsoft Graph calls go directly to `https://graph.microsoft.com/v1.0`
  via `fetch`. Always pass:
  ```http
  Authorization: Bearer <token>
  ```
- Download `.elpx` content with `GET /me/drive/items/{id}/content`.
- Update existing files with `PUT /me/drive/items/{id}/content` for sizes
  ≤ 4 MB, or with a `createUploadSession` upload for larger files.
- Before saving, fetch metadata again and compare `cTag`, `eTag`, or
  `lastModifiedDateTime` with the open snapshot.
- If the remote file changed, show overwrite, save as copy, and cancel
  choices.
- For 429 / 503 responses, surface the `Retry-After` header to the user
  and wait before retrying.

## Editor integration conventions

- Embed the static editor in an iframe.
- Load the editor by fetching `public/editor/index.html` and writing the
  transformed HTML to `iframe.srcdoc`. Always inject these into the iframe
  HTML before any editor `<script>` tag:
  1. A `<base>` tag pointing at the absolute editor folder
     (`https://<host>/onedrive-exelearning/editor/`).
  2. A `<script>` that defines `window.__EXE_EMBEDDING_CONFIG__` with at
     least:
     ```js
     {
       basePath: '/onedrive-exelearning/editor',
       parentOrigin: window.location.origin,
       trustedOrigins: [window.location.origin],
       hideUI: { fileMenu: true, saveButton: true, userMenu: true },
     }
     ```
- Use the official postMessage protocol exactly:
  - `EXELEARNING_READY`
  - `OPEN_FILE` (parent → editor): `{ type, requestId, data: { bytes, filename } }`.
  - `OPEN_FILE_SUCCESS` / `OPEN_FILE_ERROR`.
  - `DOCUMENT_LOADED` (Stage 2).
  - `REQUEST_SAVE` (parent → editor).
  - `SAVE_FILE` (editor → parent): `{ type, requestId, bytes, filename, size }`.
  - `EXELEARNING_EVENT` for change notifications.
- The v4.0.0 `REQUEST_SAVE` workaround in `editor-boot.ts` patches the
  bridge so the editor returns bytes via `SAVE_FILE`. Keep the patch until
  the upstream editor exposes a proper `exportToElpxBlob` /
  `exportToBytes` API.

## Route conventions

- `/` is the home page:
  - app title
  - "Sign in with Microsoft" button
  - OneDrive picker button (enabled after sign-in)
  - editor installation diagnostics
- `/open` opens a OneDrive item by `itemId` (and optional `driveId`).
- `/create` creates a new `.elpx` in `folderId` (or the user's drive root).

## Repository structure

```text
.
├── README.md
├── LICENSE
├── Makefile
├── package.json
├── vite.config.ts
├── index.html
├── .env.example
├── .github/workflows/deploy.yml
├── public/
│   ├── auth-callback.html
│   ├── editor/
│   ├── templates/
│   │   └── blank.elpx
│   ├── runtime/sw.js
│   └── icons/
└── src/
    ├── main.ts
    ├── config.ts
    ├── pages/
    ├── auth/
    ├── onedrive/
    ├── editor/
    ├── elpx/
    ├── sw/
    └── ui/
```

## Code style and structure

- Prefer explicit TypeScript interfaces for DriveItem metadata, OneDrive
  state, editor messages, and save payloads.
- Keep DOM creation simple; avoid framework-like abstractions.
- Use `URL` and `URLSearchParams` for URL manipulation.
- Avoid ad hoc string manipulation except where building injected iframe
  bootstrap HTML requires it.
- Keep comments short and only where they explain non-obvious integration
  behavior.
