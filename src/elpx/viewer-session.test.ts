import { describe, expect, it } from 'vitest';
import { ViewerSession } from './viewer-session';

function entriesOf(
  items: Array<[string, Uint8Array]>,
): Map<string, Uint8Array> {
  return new Map(items);
}

describe('ViewerSession.create', () => {
  it('assigns a session id and maps mimes per entry', () => {
    const html = new TextEncoder().encode('<html></html>');
    const css = new TextEncoder().encode('body{}');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const session = ViewerSession.create({
      entries: entriesOf([
        ['index.html', html],
        ['style.css', css],
        ['images/logo.png', png],
      ]),
      indexEntry: 'index.html',
      filename: 'demo.elpx',
    });

    expect(session.id).toMatch(/^[0-9a-f-]{16,}$/i);
    expect(session.indexEntry).toBe('index.html');
    expect(session.filename).toBe('demo.elpx');

    expect(session.file('index.html')?.mime).toMatch(/text\/html/);
    expect(session.file('style.css')?.mime).toMatch(/text\/css/);
    expect(session.file('images/logo.png')?.mime).toBe('image/png');
    expect(session.file('does-not-exist')).toBeUndefined();
  });

  it('produces a different id for each session', () => {
    const a = ViewerSession.create({
      entries: new Map(),
      indexEntry: 'index.html',
      filename: 'a.elpx',
    });
    const b = ViewerSession.create({
      entries: new Map(),
      indexEntry: 'index.html',
      filename: 'b.elpx',
    });
    expect(a.id).not.toBe(b.id);
  });
});
