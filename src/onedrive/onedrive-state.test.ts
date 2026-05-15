import { describe, expect, it } from 'vitest';
import {
  hasRemoteRevisionChanged,
  parseOneDriveState,
  parseOneDriveStateFromParams,
} from './onedrive-state';

describe('parseOneDriveState', () => {
  it('accepts an open state with itemId and driveId', () => {
    const state = encodeURIComponent(
      JSON.stringify({
        action: 'open',
        itemId: 'abc',
        driveId: 'drive1',
        userId: 'user',
      }),
    );

    expect(parseOneDriveState(state)).toEqual({
      action: 'open',
      itemId: 'abc',
      driveId: 'drive1',
      userId: 'user',
    });
  });

  it('accepts an open state with legacy `ids` array', () => {
    const state = encodeURIComponent(
      JSON.stringify({ action: 'open', ids: ['abc'] }),
    );
    expect(parseOneDriveState(state)).toMatchObject({
      action: 'open',
      itemId: 'abc',
    });
  });

  it('rejects an open state without item id', () => {
    expect(() =>
      parseOneDriveState(JSON.stringify({ action: 'open', ids: [] })),
    ).toThrow('item id');
  });
});

describe('parseOneDriveStateFromParams', () => {
  it('reads compact params for open', () => {
    const params = new URLSearchParams('itemId=abc&driveId=d1&userId=u');
    expect(parseOneDriveStateFromParams(params, 'open')).toEqual({
      action: 'open',
      itemId: 'abc',
      driveId: 'd1',
      userId: 'u',
    });
  });

  it('reads compact params for create with no folderId', () => {
    const params = new URLSearchParams('userId=u');
    expect(parseOneDriveStateFromParams(params, 'create')).toEqual({
      action: 'create',
      folderId: undefined,
      driveId: undefined,
      userId: 'u',
    });
  });

  it('throws when opening with no item id', () => {
    expect(() =>
      parseOneDriveStateFromParams(new URLSearchParams(''), 'open'),
    ).toThrow();
  });
});

describe('hasRemoteRevisionChanged', () => {
  it('compares cTag first', () => {
    expect(
      hasRemoteRevisionChanged(
        { cTag: '1', eTag: '1', lastModifiedDateTime: 'a' },
        { cTag: '2', eTag: '1', lastModifiedDateTime: 'a' },
      ),
    ).toBe(true);
  });

  it('falls back to eTag, then time', () => {
    expect(hasRemoteRevisionChanged({ eTag: 'a' }, { eTag: 'b' })).toBe(true);
    expect(
      hasRemoteRevisionChanged(
        { lastModifiedDateTime: '2024-01-01T00:00:00Z' },
        { lastModifiedDateTime: '2024-01-02T00:00:00Z' },
      ),
    ).toBe(true);
    expect(hasRemoteRevisionChanged({}, {})).toBe(false);
  });
});
