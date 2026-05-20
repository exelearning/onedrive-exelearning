/**
 * Helpers for the Microsoft identity platform OAuth 2.0 Authorization Code
 * Flow with Proof Key for Code Exchange (PKCE). Single-page apps registered
 * with redirect URIs of type "SPA" must use PKCE; there is no client secret.
 *
 * Reference:
 *   https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow
 *   https://datatracker.ietf.org/doc/html/rfc7636
 */

const PKCE_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

export async function createPkcePair(length = 64): Promise<PkcePair> {
  const verifier = generateCodeVerifier(length);
  const challenge = await sha256UrlSafeBase64(verifier);
  return { verifier, challenge, method: 'S256' };
}

export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new Error('PKCE verifier length must be between 43 and 128.');
  }
  const buffer = new Uint8Array(length);
  cryptoGetRandomValues(buffer);
  let out = '';
  for (let i = 0; i < buffer.length; i += 1) {
    out += PKCE_CHARSET[buffer[i] % PKCE_CHARSET.length];
  }
  return out;
}

export async function sha256UrlSafeBase64(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await cryptoSubtleDigest('SHA-256', data);
  return arrayBufferToUrlSafeBase64(digest);
}

export function arrayBufferToUrlSafeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomState(byteLength = 16): string {
  const buffer = new Uint8Array(byteLength);
  cryptoGetRandomValues(buffer);
  return Array.from(buffer, b => b.toString(16).padStart(2, '0')).join('');
}

function cryptoGetRandomValues(buffer: Uint8Array<ArrayBuffer>): void {
  const cryptoApi =
    typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(buffer);
    return;
  }
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
}

function cryptoSubtleDigest(
  algorithm: AlgorithmIdentifier,
  data: BufferSource,
): Promise<ArrayBuffer> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SubtleCrypto is not available.');
  }
  return subtle.digest(algorithm, data);
}
