import { describe, expect, it } from 'vitest';
import { buildRuntimeUrl, isExternalUrl, normalizeEntryPath } from './paths';

describe('normalizeEntryPath', () => {
  it('strips leading slashes and collapses `.` segments', () => {
    expect(normalizeEntryPath('/foo/./bar.html')).toBe('foo/bar.html');
  });

  it('resolves `..` when it can cancel a previous segment', () => {
    expect(normalizeEntryPath('html/sub/../page.html')).toBe('html/page.html');
  });

  it('rejects paths that escape the root', () => {
    expect(normalizeEntryPath('../etc/passwd')).toBeNull();
  });

  it('rejects empty paths and NUL bytes', () => {
    expect(normalizeEntryPath('')).toBeNull();
    expect(normalizeEntryPath('foo\0bar')).toBeNull();
  });

  it('treats backslashes as path separators (Windows ZIPs)', () => {
    expect(normalizeEntryPath('html\\page.html')).toBe('html/page.html');
  });
});

describe('isExternalUrl', () => {
  it('flags absolute URLs and protocol-relative URLs', () => {
    expect(isExternalUrl('https://example.com')).toBe(true);
    expect(isExternalUrl('//example.com/x')).toBe(true);
    expect(isExternalUrl('mailto:user@example.com')).toBe(true);
  });

  it('allows in-package data: and blob: URLs', () => {
    expect(isExternalUrl('data:image/png;base64,AAA')).toBe(false);
    expect(isExternalUrl('blob:https://example.com/abc')).toBe(false);
  });

  it('treats relative paths as internal', () => {
    expect(isExternalUrl('./page.html')).toBe(false);
    expect(isExternalUrl('assets/style.css')).toBe(false);
  });
});

describe('buildRuntimeUrl', () => {
  it('joins base, session id and entry with URL encoding per segment', () => {
    expect(
      buildRuntimeUrl(
        '/onedrive-exelearning/runtime',
        'abc-123',
        'html/page one.html',
      ),
    ).toBe('/onedrive-exelearning/runtime/abc-123/html/page%20one.html');
  });

  it('throws on unsafe entries', () => {
    expect(() => buildRuntimeUrl('/runtime', 'sid', '../etc/passwd')).toThrow(
      /unsafe entry/,
    );
  });
});
