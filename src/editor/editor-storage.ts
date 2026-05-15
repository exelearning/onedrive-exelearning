/**
 * Wipe the editor's local persistence before mounting a new iframe.
 *
 * The eXeLearning static editor restores the most recent project from Yjs
 * IndexedDB on boot. With a srcdoc iframe sharing the parent origin, that
 * IndexedDB is shared across sessions, so a /create flow that immediately
 * follows an /open would otherwise resurrect the previously opened file
 * before our OPEN_FILE message could swap it for the blank template.
 */
const EDITOR_DB_PREFIXES = ['y-indexeddb', 'exelearning'] as const;
const EDITOR_LOCAL_STORAGE_PREFIXES = ['exelearning', 'y-'] as const;

export async function resetEditorLocalStorage(): Promise<void> {
  await clearIndexedDb();
  clearLocalStorageKeys();
}

async function clearIndexedDb(): Promise<void> {
  const indexed = window.indexedDB;
  const databases = (
    indexed as IDBFactory & { databases?: () => Promise<IDBDatabaseInfo[]> }
  ).databases;
  if (typeof databases !== 'function') {
    return;
  }

  let infos: IDBDatabaseInfo[] = [];
  try {
    infos = await databases.call(indexed);
  } catch (error) {
    console.warn('[onedrive-exelearning] indexedDB.databases() failed:', error);
    return;
  }

  const editorDatabaseNames = infos
    .map(info => info.name)
    .filter(
      (name): name is string =>
        typeof name === 'string' &&
        EDITOR_DB_PREFIXES.some(prefix => name.startsWith(prefix)),
    );

  await Promise.all(editorDatabaseNames.map(deleteDatabase));
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise(resolve => {
    const request = window.indexedDB.deleteDatabase(name);
    const finish = () => resolve();
    request.onsuccess = finish;
    request.onerror = finish;
    request.onblocked = finish;
  });
}

function clearLocalStorageKeys(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (
        key &&
        EDITOR_LOCAL_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))
      ) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    console.warn(
      '[onedrive-exelearning] Failed to clear localStorage keys:',
      error,
    );
  }
}
