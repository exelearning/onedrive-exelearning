import { describe, expect, it } from 'vitest';
import { buildItemUrl } from './onedrive-api';

describe('buildItemUrl', () => {
  it('uses /me/drive/root for the alias item id "root"', () => {
    expect(buildItemUrl({ itemId: 'root' }).toString()).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/root',
    );
  });

  it('uses /drives/{driveId}/root for "root" with an explicit drive', () => {
    expect(buildItemUrl({ itemId: 'root', driveId: 'b!abc' }).toString()).toBe(
      'https://graph.microsoft.com/v1.0/drives/b!abc/root',
    );
  });

  it('uses /me/drive/items/{id} for a normal item', () => {
    expect(buildItemUrl({ itemId: '01ABC' }).toString()).toBe(
      'https://graph.microsoft.com/v1.0/me/drive/items/01ABC',
    );
  });

  it('uses /drives/{driveId}/items/{id} when both are present', () => {
    expect(buildItemUrl({ itemId: '01ABC', driveId: 'b!abc' }).toString()).toBe(
      'https://graph.microsoft.com/v1.0/drives/b!abc/items/01ABC',
    );
  });
});
