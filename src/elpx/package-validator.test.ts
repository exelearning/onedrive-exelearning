import { describe, expect, it } from 'vitest';
import { inspectPackage, validatePackage } from './package-validator';

const EMPTY_BYTES = new Uint8Array();

function packageOf(paths: string[]): ReadonlyMap<string, Uint8Array> {
  return new Map(paths.map(p => [p, EMPTY_BYTES] as const));
}

describe('inspectPackage', () => {
  it('finds an index.html at root and counts directory hints', () => {
    const shape = inspectPackage(
      packageOf([
        'index.html',
        'content.xml',
        'screenshot.png',
        'html/page1.html',
        'idevices/foo.js',
      ]),
    );
    expect(shape.indexEntry).toBe('index.html');
    expect(shape.hasContentXml).toBe(true);
    expect(shape.hasScreenshot).toBe(true);
    expect(shape.hintCount).toBe(2);
    expect(shape.legacyMarker).toBeNull();
  });

  it('falls back to index.htm when index.html is missing', () => {
    expect(inspectPackage(packageOf(['index.htm'])).indexEntry).toBe(
      'index.htm',
    );
  });

  it('flags a contentv3.xml legacy marker', () => {
    const shape = inspectPackage(packageOf(['contentv3.xml']));
    expect(shape.indexEntry).toBeNull();
    expect(shape.legacyMarker).toBe('contentv3.xml');
  });
});

describe('validatePackage', () => {
  it('returns valid when index.html is present', () => {
    const verdict = validatePackage(packageOf(['index.html']), 'foo.elpx');
    expect(verdict.valid).toBe(true);
    expect(verdict.legacy).toBe(false);
  });

  it('returns legacy when a contentv\\d+ marker exists', () => {
    const verdict = validatePackage(
      packageOf(['contentv3.xml', 'images/foo.png']),
      'foo.elp',
    );
    expect(verdict.valid).toBe(false);
    expect(verdict.legacy).toBe(true);
    expect(verdict.error).toMatch(/older version/);
  });

  it('returns legacy when filename ends in .elp without an index.html', () => {
    const verdict = validatePackage(packageOf(['data.dat']), 'sample.elp');
    expect(verdict.valid).toBe(false);
    expect(verdict.legacy).toBe(true);
  });

  it('returns plain invalid for a random zip without index.html', () => {
    const verdict = validatePackage(packageOf(['random.txt']), 'random.zip');
    expect(verdict.valid).toBe(false);
    expect(verdict.legacy).toBe(false);
    expect(verdict.error).toMatch(/index\.html/);
  });
});
