import { describe, expect, it } from 'vitest';
import { buildAuthorizeUrl } from './msal-token-client';

describe('buildAuthorizeUrl', () => {
  it('emits a well-formed authorize URL with PKCE parameters', () => {
    const url = buildAuthorizeUrl({
      authorityBase: 'https://login.microsoftonline.com/common',
      clientId: 'abc-123',
      scope: 'Files.ReadWrite User.Read',
      redirectUri: 'https://example.test/auth-callback.html',
      state: 'state123',
      prompt: 'select_account',
      codeChallenge: 'challenge',
      responseMode: 'query',
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://login.microsoftonline.com');
    expect(parsed.pathname).toBe('/common/oauth2/v2.0/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('abc-123');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://example.test/auth-callback.html',
    );
    expect(parsed.searchParams.get('response_mode')).toBe('query');
    expect(parsed.searchParams.get('scope')).toBe('Files.ReadWrite User.Read');
    expect(parsed.searchParams.get('state')).toBe('state123');
    expect(parsed.searchParams.get('prompt')).toBe('select_account');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('omits prompt when blank and includes login_hint when provided', () => {
    const url = buildAuthorizeUrl({
      authorityBase: 'https://login.microsoftonline.com/common',
      clientId: 'abc',
      scope: 'Files.ReadWrite',
      redirectUri: 'https://example.test/auth-callback.html',
      state: 's',
      prompt: '',
      codeChallenge: 'c',
      responseMode: 'fragment',
      loginHint: 'user@example.com',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('prompt')).toBeNull();
    expect(parsed.searchParams.get('login_hint')).toBe('user@example.com');
    expect(parsed.searchParams.get('response_mode')).toBe('fragment');
  });
});
