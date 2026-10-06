import type { AssetProject } from './assetLibrary';

export type StoredAsset = { scope: string; id: string; asset: AssetProject; pending: boolean };

const DATABASE = 'ceriga-asset-library-v1';
const STORE = 'assets';

async function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new Error('Asset storage requires IndexedDB in this browser.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: ['scope', 'id'] });
      store.createIndex('scope', 'scope');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other Studio tabs to upgrade asset storage.'));
    };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, result: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let value: T;
      let failure: unknown;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Asset storage transaction aborted.'));
      tx.onerror = event => { failure ??= (event.target as IDBRequest).error; };
      const fail = (error: unknown) => { failure = error; tx.abort(); };
      try {
        run(tx.objectStore(STORE), next => { value = next; }, fail);
      } catch (error) {
        fail(error);
      }
    });
  } finally {
    db.close();
  }
}

export function readStoredAssets(scope: string): Promise<StoredAsset[]> {
  return transaction('readonly', (store, result) => {
    const request = store.index('scope').getAll(scope);
    request.onsuccess = () => result(request.result);
  });
}

export function writeStoredAsset(record: StoredAsset): Promise<void> {
  return transaction('readwrite', store => { store.put(record); });
}

export function deleteStoredAsset(scope: string, id: string): Promise<void> {
  return transaction('readwrite', store => { store.delete([scope, id]); });
}

/** Replace clean cache entries, but never discard unsynced drafts. */
export function cacheRemoteAssets(scope: string, assets: AssetProject[]): Promise<StoredAsset[]> {
  return transaction('readwrite', (store, result, fail) => {
    const request = store.index('scope').getAll(scope);
    request.onsuccess = () => {
      try {
        const existing = request.result as StoredAsset[];
        const pending = new Map(existing.filter(record => record.pending).map(record => [record.id, record]));
        existing.filter(record => !record.pending).forEach(record => store.delete([scope, record.id]));
        const merged = new Map(pending);
        for (const asset of assets) {
          if (pending.has(asset.id)) continue;
          const record = { scope, id: asset.id, asset, pending: false };
          store.put(record);
          merged.set(asset.id, record);
        }
        result([...merged.values()]);
      } catch (error) {
        fail(error);
      }
    };
  });
}

const queues = new Map<string, Promise<unknown>>();

/** Web Locks serialize saves/cache refreshes across tabs; queue fallback covers this context. */
export function withAssetLock<T>(scope: string, action: () => Promise<T>): Promise<T> {
  if (globalThis.navigator?.locks) return navigator.locks.request(`ceriga-assets:${scope}`, action);
  const previous = queues.get(scope) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(action);
  queues.set(scope, next);
  void next.finally(() => { if (queues.get(scope) === next) queues.delete(scope); }).catch(() => undefined);
  return next;
}
