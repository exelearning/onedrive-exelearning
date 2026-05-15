/**
 * Microsoft identity platform OAuth 2.0 token client.
 *
 * Implements the Authorization Code Flow with PKCE for SPAs as documented at
 * https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow
 *
 * The token client:
 *   - Acquires an access token interactively via a popup window. The popup
 *     redirects back to `auth-callback.html`, which postMessages the code
 *     back to the opener.
 *   - Refreshes access tokens silently using a hidden iframe with
 *     `prompt=none`, which relies on the Microsoft identity platform SSO
 *     cookie. No refresh tokens are stored.
 *   - Keeps access tokens in tab-local memory only.
 *
 * The shape mirrors the Google Identity Services token client used by
 * gdrive-exelearning so call sites in `src/pages/**` stay symmetrical.
 */

import {
  AUTH_CALLBACK_PATH,
  MS_SCOPE,
  authorityBaseUrl,
  requireMsClientId,
} from '../config';
import { createPkcePair, randomState } from './pkce';

export interface MsAccessToken {
  accessToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
  account?: MsAccount;
}

export interface MsAccount {
  username?: string;
  name?: string;
  homeAccountId?: string;
  tenantId?: string;
}

export interface MsTokenClientOptions {
  clientId?: string;
  scope?: string;
  authorityBase?: string;
  redirectUri?: string;
  now?: () => number;
  expirySkewMs?: number;
  /** Override `window.open` (used by tests). */
  windowOpen?: (
    url: string,
    target?: string,
    features?: string,
  ) => Window | null;
}

export interface RequestMsAccessTokenOptions {
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  scope?: string;
  interactive?: boolean;
}

export interface InMemoryMsTokenClient {
  getAccessToken: (options?: RequestMsAccessTokenOptions) => Promise<string>;
  getCurrentToken: () => MsAccessToken | null;
  clearToken: () => void;
  signOut: () => Promise<void>;
  hasValidToken: () => boolean;
}

const DEFAULT_EXPIRY_SKEW_MS = 60_000;
const POPUP_FEATURES =
  'width=520,height=640,menubar=no,location=no,resizable=yes,scrollbars=yes,status=no';

let defaultTokenClient: InMemoryMsTokenClient | null = null;

export function createMsTokenClient(
  options: MsTokenClientOptions = {},
): InMemoryMsTokenClient {
  const clientId = options.clientId ?? requireMsClientId();
  const scope = options.scope ?? MS_SCOPE;
  const authorityBase = options.authorityBase ?? authorityBaseUrl();
  const redirectUri =
    options.redirectUri ??
    new URL(AUTH_CALLBACK_PATH, window.location.origin).toString();
  const now = options.now ?? Date.now;
  const expirySkewMs = options.expirySkewMs ?? DEFAULT_EXPIRY_SKEW_MS;
  const open = options.windowOpen ?? window.open.bind(window);

  let currentToken: MsAccessToken | null = null;
  let pendingInteractive: Promise<string> | null = null;
  let pendingSilent: Promise<string> | null = null;

  const valid = (): MsAccessToken | null =>
    currentToken !== null && currentToken.expiresAt - expirySkewMs > now()
      ? currentToken
      : null;

  const requestInteractive = async (
    requestOptions: RequestMsAccessTokenOptions,
  ): Promise<string> => {
    const code = await runInteractiveAuthCode({
      authorityBase,
      clientId,
      scope: requestOptions.scope ?? scope,
      redirectUri,
      prompt: requestOptions.prompt ?? 'select_account',
      open,
    });
    return exchangeAuthorizationCode({
      authorityBase,
      clientId,
      scope: requestOptions.scope ?? scope,
      redirectUri,
      code: code.code,
      codeVerifier: code.verifier,
      onToken: token => {
        currentToken = { ...token, account: code.account ?? token.account };
      },
    });
  };

  const requestSilent = async (
    requestOptions: RequestMsAccessTokenOptions,
  ): Promise<string> => {
    const code = await runSilentAuthCode({
      authorityBase,
      clientId,
      scope: requestOptions.scope ?? scope,
      redirectUri,
      loginHint: currentToken?.account?.username,
    });
    return exchangeAuthorizationCode({
      authorityBase,
      clientId,
      scope: requestOptions.scope ?? scope,
      redirectUri,
      code: code.code,
      codeVerifier: code.verifier,
      onToken: token => {
        currentToken = { ...token, account: code.account ?? token.account };
      },
    });
  };

  const getAccessToken = async (
    requestOptions: RequestMsAccessTokenOptions = {},
  ): Promise<string> => {
    const cached = valid();
    if (cached) {
      return cached.accessToken;
    }

    const interactive =
      requestOptions.interactive === true ||
      requestOptions.prompt === 'consent' ||
      requestOptions.prompt === 'login' ||
      requestOptions.prompt === 'select_account';

    if (interactive) {
      pendingInteractive ??= requestInteractive(requestOptions).finally(() => {
        pendingInteractive = null;
      });
      return pendingInteractive;
    }

    pendingSilent ??= requestSilent(requestOptions).finally(() => {
      pendingSilent = null;
    });
    return pendingSilent;
  };

  return {
    getAccessToken,
    getCurrentToken: () => currentToken,
    clearToken: () => {
      currentToken = null;
      pendingInteractive = null;
      pendingSilent = null;
    },
    signOut: async () => {
      currentToken = null;
      pendingInteractive = null;
      pendingSilent = null;
      // Best-effort: trigger the Microsoft identity platform logout endpoint
      // in a hidden iframe so the SSO cookie clears for this client. We
      // deliberately do not navigate the top-level window away.
      try {
        await runLogoutIframe({
          authorityBase,
          clientId,
          redirectUri,
        });
      } catch {
        // ignore — server-side signout failures should not break callers.
      }
    },
    hasValidToken: () => valid() !== null,
  };
}

export function getDefaultMsTokenClient(): InMemoryMsTokenClient {
  defaultTokenClient ??= createMsTokenClient();
  return defaultTokenClient;
}

export function requestAccessToken(
  options: RequestMsAccessTokenOptions = {},
): Promise<string> {
  return getDefaultMsTokenClient().getAccessToken(options);
}

export function authorizeMicrosoft(): Promise<string> {
  return requestAccessToken({ interactive: true, prompt: 'select_account' });
}

interface AuthCodeResult {
  code: string;
  verifier: string;
  account?: MsAccount;
}

interface AuthCodeContext {
  authorityBase: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  prompt: string;
  open: (url: string, target?: string, features?: string) => Window | null;
}

async function runInteractiveAuthCode(
  ctx: AuthCodeContext,
): Promise<AuthCodeResult> {
  const pair = await createPkcePair();
  const state = randomState();
  const authUrl = buildAuthorizeUrl({
    authorityBase: ctx.authorityBase,
    clientId: ctx.clientId,
    scope: ctx.scope,
    redirectUri: ctx.redirectUri,
    state,
    prompt: ctx.prompt,
    codeChallenge: pair.challenge,
    responseMode: 'query',
  });

  const popup = ctx.open(authUrl, 'onedrive-exelearning-auth', POPUP_FEATURES);
  if (!popup) {
    throw new Error(
      'Microsoft sign-in popup was blocked. Allow popups and try again.',
    );
  }

  try {
    const payload = await waitForAuthCallback({
      timeoutMs: 5 * 60_000,
      expectedOrigin: window.location.origin,
      isPopupClosed: () => popup.closed,
    });
    const params = new URLSearchParams(payload.query || payload.fragment || '');
    const error = params.get('error');
    if (error) {
      throw new Error(
        params.get('error_description') ?? `Microsoft sign-in failed: ${error}`,
      );
    }
    const code = params.get('code');
    const returnedState = params.get('state');
    if (returnedState && returnedState !== state) {
      throw new Error('Microsoft sign-in returned a mismatched state value.');
    }
    if (!code) {
      throw new Error(
        'Microsoft sign-in did not return an authorization code.',
      );
    }
    return { code, verifier: pair.verifier };
  } finally {
    try {
      popup.close();
    } catch {
      // ignore — the popup may already be closed.
    }
  }
}

async function runSilentAuthCode(ctx: {
  authorityBase: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  loginHint?: string;
}): Promise<AuthCodeResult> {
  const pair = await createPkcePair();
  const state = randomState();
  const authUrl = buildAuthorizeUrl({
    authorityBase: ctx.authorityBase,
    clientId: ctx.clientId,
    scope: ctx.scope,
    redirectUri: ctx.redirectUri,
    state,
    prompt: 'none',
    codeChallenge: pair.challenge,
    responseMode: 'fragment',
    loginHint: ctx.loginHint,
  });

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'absolute';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.src = authUrl;
  document.body.append(frame);

  try {
    const payload = await waitForAuthCallback({
      timeoutMs: 20_000,
      expectedOrigin: window.location.origin,
      isPopupClosed: () => false,
    });
    const params = new URLSearchParams(payload.fragment || payload.query || '');
    const error = params.get('error');
    if (error) {
      throw new Error(
        params.get('error_description') ?? `Silent sign-in failed: ${error}`,
      );
    }
    const code = params.get('code');
    const returnedState = params.get('state');
    if (returnedState && returnedState !== state) {
      throw new Error('Silent sign-in returned a mismatched state value.');
    }
    if (!code) {
      throw new Error('Silent sign-in did not return an authorization code.');
    }
    return { code, verifier: pair.verifier };
  } finally {
    frame.remove();
  }
}

interface AuthCallbackPayload {
  source: 'onedrive-exelearning-auth';
  query?: string;
  fragment?: string;
}

function waitForAuthCallback(options: {
  timeoutMs: number;
  expectedOrigin: string;
  isPopupClosed: () => boolean;
}): Promise<AuthCallbackPayload> {
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== options.expectedOrigin) {
        return;
      }
      const data = event.data as AuthCallbackPayload | undefined;
      if (!data || data.source !== 'onedrive-exelearning-auth') {
        return;
      }
      cleanup();
      resolve(data);
    };

    const cleanup = () => {
      window.removeEventListener('message', handler);
      window.clearTimeout(timeout);
      window.clearInterval(closedCheck);
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for Microsoft sign-in.'));
    }, options.timeoutMs);

    const closedCheck = window.setInterval(() => {
      if (options.isPopupClosed()) {
        cleanup();
        reject(new Error('Microsoft sign-in window was closed.'));
      }
    }, 500);

    window.addEventListener('message', handler);
  });
}

interface AuthorizeUrlOptions {
  authorityBase: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  state: string;
  prompt: string;
  codeChallenge: string;
  responseMode: 'query' | 'fragment';
  loginHint?: string;
}

export function buildAuthorizeUrl(options: AuthorizeUrlOptions): string {
  const url = new URL(`${options.authorityBase}/oauth2/v2.0/authorize`);
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_mode', options.responseMode);
  url.searchParams.set('scope', options.scope);
  url.searchParams.set('state', options.state);
  if (options.prompt && options.prompt !== '') {
    url.searchParams.set('prompt', options.prompt);
  }
  url.searchParams.set('code_challenge', options.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (options.loginHint) {
    url.searchParams.set('login_hint', options.loginHint);
  }
  return url.toString();
}

interface ExchangeOptions {
  authorityBase: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  onToken: (token: MsAccessToken) => void;
}

async function exchangeAuthorizationCode(
  options: ExchangeOptions,
): Promise<string> {
  const tokenEndpoint = `${options.authorityBase}/oauth2/v2.0/token`;
  const body = new URLSearchParams();
  body.set('client_id', options.clientId);
  body.set('scope', options.scope);
  body.set('code', options.code);
  body.set('redirect_uri', options.redirectUri);
  body.set('grant_type', 'authorization_code');
  body.set('code_verifier', options.codeVerifier);

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  let payload: Record<string, unknown> | undefined;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload) {
    const message =
      (payload && typeof payload.error_description === 'string'
        ? payload.error_description
        : payload && typeof payload.error === 'string'
          ? payload.error
          : response.statusText) || 'Microsoft token exchange failed.';
    throw new Error(message);
  }

  const accessToken = payload.access_token;
  if (typeof accessToken !== 'string') {
    throw new Error(
      'Microsoft token response did not include an access_token.',
    );
  }

  const expiresIn =
    typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
  const tokenType =
    typeof payload.token_type === 'string' ? payload.token_type : 'Bearer';
  const tokenScope =
    typeof payload.scope === 'string' ? payload.scope : options.scope;

  const token: MsAccessToken = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: tokenScope,
    tokenType,
    account: parseAccountFromIdToken(payload.id_token),
  };
  options.onToken(token);
  return accessToken;
}

function parseAccountFromIdToken(idToken: unknown): MsAccount | undefined {
  if (typeof idToken !== 'string' || idToken.length === 0) {
    return undefined;
  }
  const parts = idToken.split('.');
  if (parts.length < 2) {
    return undefined;
  }
  try {
    const payload = JSON.parse(urlSafeBase64Decode(parts[1])) as Record<
      string,
      unknown
    >;
    return {
      username:
        typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      homeAccountId:
        typeof payload.oid === 'string' && typeof payload.tid === 'string'
          ? `${payload.oid}.${payload.tid}`
          : undefined,
      tenantId: typeof payload.tid === 'string' ? payload.tid : undefined,
    };
  } catch {
    return undefined;
  }
}

function urlSafeBase64Decode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLength);
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join(''),
  );
}

async function runLogoutIframe(options: {
  authorityBase: string;
  clientId: string;
  redirectUri: string;
}): Promise<void> {
  const url = new URL(`${options.authorityBase}/oauth2/v2.0/logout`);
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('post_logout_redirect_uri', options.redirectUri);
  await new Promise<void>(resolve => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'absolute';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.src = url.toString();
    const finish = () => {
      frame.remove();
      resolve();
    };
    frame.addEventListener('load', finish, { once: true });
    frame.addEventListener('error', finish, { once: true });
    window.setTimeout(finish, 10_000);
    document.body.append(frame);
  });
}
