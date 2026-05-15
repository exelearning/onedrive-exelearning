/**
 * Validates that an extracted archive looks like an eXeLearning project.
 *
 * The viewer only needs `index.html`. Everything else is a soft signal that
 * helps us recognise the package shape and surface clearer errors when the
 * user uploaded a `.zip` that is not an eXeLearning project.
 */

const ROOT_INDEX_CANDIDATES = ['index.html', 'index.htm'];
const DIR_HINTS = ['html/', 'content/', 'libs/', 'theme/', 'idevices/'];
const LEGACY_MARKER_REGEX = /^contentv\d+(?:\.|$)/;

export interface PackageShape {
  indexEntry: string | null;
  hasContentXml: boolean;
  hasScreenshot: boolean;
  hintCount: number;
  legacyMarker: string | null;
}

export interface PackageValidation {
  valid: boolean;
  legacy: boolean;
  shape: PackageShape;
  error?: string;
}

export function inspectPackage(
  entries: ReadonlyMap<string, Uint8Array>,
): PackageShape {
  let indexEntry: string | null = null;
  for (const candidate of ROOT_INDEX_CANDIDATES) {
    if (entries.has(candidate)) {
      indexEntry = candidate;
      break;
    }
  }
  let hintCount = 0;
  let legacyMarker: string | null = null;
  for (const entry of entries.keys()) {
    for (const dir of DIR_HINTS) {
      if (entry.startsWith(dir)) {
        hintCount += 1;
        break;
      }
    }
    if (legacyMarker === null && LEGACY_MARKER_REGEX.test(entry)) {
      legacyMarker = entry;
    }
  }
  return {
    indexEntry,
    hasContentXml: entries.has('content.xml'),
    hasScreenshot: entries.has('screenshot.png'),
    hintCount,
    legacyMarker,
  };
}

export function validatePackage(
  entries: ReadonlyMap<string, Uint8Array>,
  filename = '',
): PackageValidation {
  const shape = inspectPackage(entries);
  if (shape.indexEntry !== null) {
    return { valid: true, legacy: false, shape };
  }
  const isLegacyByMarker = shape.legacyMarker !== null;
  const isLegacyByExtension = filename.toLowerCase().endsWith('.elp');
  if (isLegacyByMarker || isLegacyByExtension) {
    return {
      valid: false,
      legacy: true,
      shape,
      error:
        'This file is from an older version of eXeLearning and cannot be previewed.',
    };
  }
  return {
    valid: false,
    legacy: false,
    shape,
    error: 'The package does not contain an index.html.',
  };
}
