/**
 * Minimal pure-DOM ZIP reader: extract one file by name from an `.elpx`
 * archive. Used only to lift the editor-generated `screenshot.png` so we can
 * push it to OneDrive as a thumbnail.
 *
 * Implements just enough of PKZIP to find an entry in the central directory
 * and decompress its payload via the browser's DecompressionStream.
 */

const SIGNATURE_END_OF_CENTRAL_DIR = 0x06054b50;
const SIGNATURE_CENTRAL_DIR_FILE = 0x02014b50;
const MAX_EOCD_COMMENT_LENGTH = 65535;
const EOCD_FIXED_LENGTH = 22;

export async function extractZipEntry(
  zipBytes: ArrayBuffer,
  filename: string,
): Promise<ArrayBuffer | null> {
  const view = new DataView(zipBytes);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    return null;
  }

  const cdEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');

  let offset = cdOffset;
  for (let i = 0; i < cdEntries; i += 1) {
    if (view.getUint32(offset, true) !== SIGNATURE_CENTRAL_DIR_FILE) {
      return null;
    }
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const filenameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const entryName = decoder.decode(
      new Uint8Array(zipBytes, offset + 46, filenameLength),
    );

    if (entryName === filename) {
      return readEntryData(
        zipBytes,
        view,
        localHeaderOffset,
        compressedSize,
        compressionMethod,
      );
    }

    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return null;
}

async function readEntryData(
  zipBytes: ArrayBuffer,
  view: DataView,
  localHeaderOffset: number,
  compressedSize: number,
  compressionMethod: number,
): Promise<ArrayBuffer | null> {
  const lfhFilenameLength = view.getUint16(localHeaderOffset + 26, true);
  const lfhExtraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataOffset =
    localHeaderOffset + 30 + lfhFilenameLength + lfhExtraLength;
  const compressedData = zipBytes.slice(
    dataOffset,
    dataOffset + compressedSize,
  );

  if (compressionMethod === 0) {
    return compressedData;
  }
  if (compressionMethod === 8) {
    return inflateRaw(compressedData);
  }
  return null;
}

async function inflateRaw(deflated: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([deflated])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer();
}

function findEndOfCentralDirectory(view: DataView): number {
  const length = view.byteLength;
  const minStart = Math.max(
    0,
    length - EOCD_FIXED_LENGTH - MAX_EOCD_COMMENT_LENGTH,
  );
  for (let i = length - EOCD_FIXED_LENGTH; i >= minStart; i -= 1) {
    if (view.getUint32(i, true) === SIGNATURE_END_OF_CENTRAL_DIR) {
      return i;
    }
  }
  return -1;
}
