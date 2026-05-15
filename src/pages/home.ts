import {
  authorizeMicrosoft,
  getDefaultMsTokenClient,
  requestAccessToken,
} from '../auth/msal-token-client';
import { APP_BASE_URL, EDITOR_INDEX_PATH, MS_CLIENT_ID } from '../config';
import { pickOneDriveFile } from '../onedrive/onedrive-picker';

const ONEDRIVE_URL = 'https://onedrive.live.com/';
const EXELEARNING_SITE = 'https://exelearning.net';
const LOGO_SRC =
  'https://raw.githubusercontent.com/exelearning/exelearning/main/public/images/logo.svg';
const FOOTER_LOGO_SRC =
  'https://raw.githubusercontent.com/exelearning/exelearning/main/public/exelearning.png';

const AUTHORIZE_ICON = `
  <svg width="14" height="14" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
  </svg>`;

const AUTHORIZED_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2 20 8.2l-1.5-1.5z"/>
  </svg>`;

export function renderHome(root: HTMLElement): void {
  const homeHref = APP_BASE_URL;
  const createHref = `${APP_BASE_URL}create`;
  const clientStatus = MS_CLIENT_ID
    ? '<span class="diag-ok">Configured</span>'
    : '<span class="diag-error">Missing VITE_MS_CLIENT_ID</span>';

  root.innerHTML = `
    <div class="landing-page">
      <header class="nav">
        <div class="nav-left">
          <a href="${homeHref}" class="nav-logo">
            <img src="${LOGO_SRC}" alt="" />
            <span class="nav-brand">eXeLearning</span>
          </a>
          <span class="nav-pill">Microsoft OneDrive Add-on</span>
        </div>
        <div class="nav-right">
          <a href="${EXELEARNING_SITE}" target="_blank" rel="noopener">eXeLearning.net</a>
          <a href="#start" class="cta">Get started</a>
        </div>
      </header>

      <section class="hero">
        <div>
          <span class="hero-eyebrow">
            <svg width="16" height="16" viewBox="0 0 32 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="#0364B8" d="M19.5 11.2l5.9-5.6A10.1 10.1 0 0 0 16.7 0 10.1 10.1 0 0 0 7.3 6.3a5.6 5.6 0 0 1 1-.1c.3 0 .5 0 .8.1A8.5 8.5 0 0 1 19.5 11.2z"/>
              <path fill="#0078D4" d="M9.3 6.3a5.7 5.7 0 0 0-4.9 8.4l4.8-2A3.4 3.4 0 0 1 13.7 11.1l4-3.9A8.5 8.5 0 0 0 9.3 6.3z"/>
              <path fill="#1490DF" d="M14.5 11.1A3.4 3.4 0 0 0 13.2 11.4L4.4 15.1a5.6 5.6 0 0 0 4.7 2.5h14.5a5 5 0 0 0 4.4-7.4l-10-4.2A3.4 3.4 0 0 0 14.5 11.1z"/>
              <path fill="#28A8EA" d="M14.5 11.1l13.4 5.6A5 5 0 0 0 23.5 9.6l-5.9 5.6A3.4 3.4 0 0 1 14.5 11.1z"/>
            </svg>
            Free · Open source · Runs in your browser
          </span>
          <h1>Edit your <span class="accent">eXeLearning</span> resources, right inside <span class="accent-blue">Microsoft OneDrive</span>.</h1>
          <p class="hero-sub">Open, edit and save <strong>.elpx</strong> files without leaving OneDrive. Authorize once — no installs, no uploads.</p>
          <div class="hero-meta">
            <span><span class="check">✓</span> Works with .elpx files</span>
            <span><span class="check">✓</span> Files stay in your OneDrive</span>
            <span><span class="check">✓</span> Free &amp; open source</span>
          </div>
        </div>

        <div class="mock" aria-hidden="true">
          <div class="mock-bar">
            <span class="dot" style="background:#ee6a5f"></span>
            <span class="dot" style="background:#f5bf3f"></span>
            <span class="dot" style="background:#62c554"></span>
            <span class="url">onedrive.live.com</span>
          </div>
          <div class="mock-body">
            <p class="mock-section-title">Suggested · eXeLearning files</p>
            <div class="mock-files">
              <div class="mock-file highlight">
                <div class="mock-file-thumb"><img src="${LOGO_SRC}" alt="" /></div>
                <div class="mock-file-name"><span class="exetag">ELPX</span> Photosynthesis</div>
                <div class="mock-file-meta">You edited · 2 h ago</div>
              </div>
              <div class="mock-file">
                <div class="mock-file-thumb"><img src="${LOGO_SRC}" alt="" /></div>
                <div class="mock-file-name"><span class="exetag">ELPX</span> Roman history</div>
                <div class="mock-file-meta">Yesterday</div>
              </div>
              <div class="mock-file">
                <div class="mock-file-thumb"><img src="${LOGO_SRC}" alt="" /></div>
                <div class="mock-file-name"><span class="exetag">ELPX</span> Math · Unit&nbsp;3</div>
                <div class="mock-file-meta">Apr 18</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="action-section" id="start">
        <div class="action-card">
          <div class="action-card-head">
            <img src="${LOGO_SRC}" alt="eXeLearning" />
            <div>
              <div class="action-card-title">onedrive-exelearning</div>
              <div style="font-size:12px;color:var(--ink-3);">Open, edit, save .elpx files in OneDrive</div>
            </div>
          </div>
          <hr />
          <div class="action-flow">
            <button class="action-btn primary" type="button" id="authorize-microsoft">
              ${AUTHORIZE_ICON}
              <span>Sign in with Microsoft</span>
            </button>
            <span class="action-divider" aria-hidden="true"></span>
            <button class="action-btn" type="button" id="open-drive" disabled aria-disabled="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6c.5 0 1 .2 1.4.5l1.6 1.5H18.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z"/></svg>
              Open from OneDrive
            </button>
            <span class="action-or" aria-hidden="true">or</span>
            <a class="action-btn" id="create-new" href="${createHref}" aria-disabled="true" tabindex="-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>
              New file
            </a>
          </div>
          <div class="diagnostics">
            <div class="diag-row"><strong>Microsoft client</strong>${clientStatus}</div>
            <div class="diag-row"><strong>Editor</strong><span id="editor-diagnostic">Checking…</span></div>
            <div class="diag-row"><strong>Status</strong><span id="auth-status">Awaiting authorization</span></div>
          </div>
        </div>
      </section>

      <footer class="landing-footer">
        <a class="foot-left" href="${EXELEARNING_SITE}" target="_blank" rel="noopener">
          <img src="${FOOTER_LOGO_SRC}" alt="eXeLearning" />
        </a>
        <nav>
          <a href="${APP_BASE_URL}privacy.html">Privacy Policy</a>
          <a href="${APP_BASE_URL}terms.html">Terms of Service</a>
          <a href="${ONEDRIVE_URL}" target="_blank" rel="noopener">OneDrive</a>
          <a href="https://github.com/exelearning/onedrive-exelearning" target="_blank" rel="noopener">Source code</a>
        </nav>
      </footer>
    </div>
  `;

  const authBtn = requiredElement<HTMLButtonElement>(
    root,
    '#authorize-microsoft',
  );
  const openBtn = requiredElement<HTMLButtonElement>(root, '#open-drive');
  const createLink = requiredElement<HTMLAnchorElement>(root, '#create-new');
  const authStatus = requiredElement(root, '#auth-status');
  const editorDiagnostic = requiredElement(root, '#editor-diagnostic');

  void checkEditorInstalled(editorDiagnostic);

  const setAuthState = (authed: boolean): void => {
    if (authed) {
      authBtn.innerHTML = `${AUTHORIZED_ICON}<span>Authorized</span>`;
      authBtn.classList.remove('primary');
      authBtn.classList.add('success');
      openBtn.disabled = false;
      openBtn.removeAttribute('aria-disabled');
      createLink.removeAttribute('aria-disabled');
      createLink.removeAttribute('tabindex');
      authStatus.textContent = 'Connected to Microsoft OneDrive';
      authStatus.className = 'diag-ok';
    } else {
      authBtn.innerHTML = `${AUTHORIZE_ICON}<span>Sign in with Microsoft</span>`;
      authBtn.classList.add('primary');
      authBtn.classList.remove('success');
      openBtn.disabled = true;
      openBtn.setAttribute('aria-disabled', 'true');
      createLink.setAttribute('aria-disabled', 'true');
      createLink.setAttribute('tabindex', '-1');
      authStatus.textContent = 'Awaiting authorization';
      authStatus.className = '';
    }
  };

  // The create link is gated on a valid auth state; if the user clicks it
  // while disabled, prevent the navigation.
  createLink.addEventListener('click', event => {
    if (createLink.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
    }
  });

  authBtn.addEventListener('click', async () => {
    authBtn.disabled = true;
    authStatus.textContent = 'Requesting authorization…';
    authStatus.className = '';
    try {
      await authorizeMicrosoft();
      setAuthState(true);
    } catch (error) {
      authStatus.textContent =
        error instanceof Error ? error.message : String(error);
      authStatus.className = 'diag-error';
    } finally {
      authBtn.disabled = false;
    }
  });

  openBtn.addEventListener('click', async () => {
    if (openBtn.disabled) {
      return;
    }
    openBtn.disabled = true;
    try {
      const token = await requestAccessToken({ prompt: 'none' });
      const picked = await pickOneDriveFile({ token });
      if (picked) {
        const target = new URL(`${APP_BASE_URL}open`, window.location.origin);
        target.searchParams.set('itemId', picked.itemId);
        if (picked.driveId) {
          target.searchParams.set('driveId', picked.driveId);
        }
        window.location.assign(target.toString());
      }
    } catch (error) {
      authStatus.textContent =
        error instanceof Error ? error.message : String(error);
      authStatus.className = 'diag-error';
    } finally {
      openBtn.disabled = !getDefaultMsTokenClient().hasValidToken();
    }
  });
}

async function checkEditorInstalled(target: HTMLElement): Promise<void> {
  try {
    const response = await fetch(EDITOR_INDEX_PATH, {
      method: 'HEAD',
      cache: 'no-cache',
    });
    if (response.ok) {
      target.textContent = 'Ready at /editor';
      target.className = 'diag-ok';
    } else {
      target.textContent = `Not found at ${EDITOR_INDEX_PATH}`;
      target.className = 'diag-error';
    }
  } catch {
    target.textContent = `Not found at ${EDITOR_INDEX_PATH}`;
    target.className = 'diag-error';
  }
}

function requiredElement<T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing UI element ${selector}.`);
  }
  return element;
}
