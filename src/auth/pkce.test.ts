import { describe, expect, it } from 'vitest';
import {
  arrayBufferToUrlSafeBase64,
  createPkcePair,
  generateCodeVerifier,
  randomState,
  sha256UrlSafeBase64,
} from './pkce';

describe('generateCodeVerifier', () => {
  it('produces a string of the requested length within the unreserved set', () => {
    const verifier = generateCodeVerifier(64);
    expect(verifier).toHaveLength(64);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('rejects out-of-range lengths', () => {
    expect(() => generateCodeVerifier(10)).toThrow();
    expect(() => generateCodeVerifier(200)).toThrow();
  });
});

describe('sha256UrlSafeBase64', () => {
  it('matches the known S256 challenge for the RFC 7636 example verifier', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await sha256UrlSafeBase64(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('createPkcePair', () => {
  it('returns a verifier/challenge pair using S256', async () => {
    const pair = await createPkcePair(64);
    expect(pair.verifier).toHaveLength(64);
    expect(pair.method).toBe('S256');
    const recomputed = await sha256UrlSafeBase64(pair.verifier);
    expect(pair.challenge).toBe(recomputed);
  });
});

describe('arrayBufferToUrlSafeBase64', () => {
  it('strips padding and converts to url-safe alphabet', () => {
    const bytes = new Uint8Array([0xfb, 0xff]).buffer;
    expect(arrayBufferToUrlSafeBase64(bytes)).toBe('-_8');
  });
});

describe('randomState', () => {
  it('produces hex strings of the requested byte length', () => {
    const state = randomState(8);
    expect(state).toHaveLength(16);
    expect(state).toMatch(/^[0-9a-f]+$/);
  });

  it('produces a different value on each call', () => {
    expect(randomState(8)).not.toBe(randomState(8));
  });
});
