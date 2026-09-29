export interface LocalProject<State = Record<string, unknown>> {
  id: string;
  name: string;
  product_id: string;
  current_step: number;
  state: State;
}

async function localDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ceriga-local-projects', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local draft storage is unavailable.'));
    request.onblocked = () => reject(new Error('Close other studio tabs and retry saving.'));
  });
}

export async function saveLocalProject<State>(project: LocalProject<State>): Promise<void> {
  const database = await localDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('projects', 'readwrite');
      transaction.objectStore('projects').put(project);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error('Local draft could not be saved. Check available browser storage.'));
      transaction.onerror = () => reject(new Error('Local draft could not be saved. Check available browser storage.'));
    });
  } finally { database.close(); }
}

export async function getLocalProject<State>(id: string): Promise<LocalProject<State> | undefined> {
  const database = await localDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction('projects', 'readonly').objectStore('projects').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Local draft could not be loaded.'));
    });
  } finally { database.close(); }
}