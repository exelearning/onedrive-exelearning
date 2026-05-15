import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIMITS,
  ZipReadError,
  looksLikeZip,
  readPackage,
} from './zip-reader';

function buildZip(entries: Record<string, Uint8Array>): ArrayBuffer {
  const bytes = zipSync(entries);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

const enc = new TextEncoder();

describe('looksLikeZip', () => {
  it('returns false for tiny / non-zip buffers', () => {
    expect(looksLikeZip(new Uint8Array().buffer)).toBe(false);
    expect(looksLikeZip(enc.encode('not a zip').buffer as ArrayBuffer)).toBe(
      false,
    );
  });

  it('returns true for a real ZIP local-file header', () => {
    const zip = buildZip({ 'a.txt': enc.encode('hi') });
    expect(looksLikeZip(zip)).toBe(true);
  });
});

describe('readPackage', () => {
  it('returns a map of entry paths to bytes', async () => {
    const zip = buildZip({
      'index.html': enc.encode('<html></html>'),
      'assets/style.css': enc.encode('body{}'),
    });
    const result = await readPackage(zip);
    expect(result.entries.size).toBe(2);
    expect(result.entries.get('index.html')).toBeInstanceOf(Uint8Array);
    expect(result.entries.get('assets/style.css')).toBeInstanceOf(Uint8Array);
    expect(result.totalUncompressedBytes).toBeGreaterThan(0);
  });

  it('throws NOT_A_ZIP for random bytes', async () => {
    const garbage = enc.encode('definitely not a zip file');
    await expect(
      readPackage(garbage.buffer as ArrayBuffer),
    ).rejects.toMatchObject({
      name: 'ZipReadError',
      code: 'NOT_A_ZIP',
    });
  });

  it('throws TOO_MANY_ENTRIES when the entry-count limit trips', async () => {
    const zip = buildZip({
      'index.html': enc.encode('<html></html>'),
      'second.txt': enc.encode('x'),
    });
    await expect(
      readPackage(zip, { ...DEFAULT_LIMITS, maxEntries: 1 }),
    ).rejects.toMatchObject({
      name: 'ZipReadError',
      code: 'TOO_MANY_ENTRIES',
    });
  });

  it('throws PACKAGE_TOO_LARGE on oversized compressed input', async () => {
    const zip = buildZip({ 'index.html': enc.encode('<html></html>') });
    await expect(
      readPackage(zip, { ...DEFAULT_LIMITS, maxCompressedBytes: 1 }),
    ).rejects.toMatchObject({
      name: 'ZipReadError',
      code: 'PACKAGE_TOO_LARGE',
    });
  });

  it('exposes a typed ZipReadError', async () => {
    try {
      await readPackage(enc.encode('nope').buffer as ArrayBuffer);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ZipReadError);
    }
  });
});
