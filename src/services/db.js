const DB_NAME = 'achat';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function runTransaction(mode, operation) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = operation(store);
        transaction.oncomplete = () => resolve(request?.result);
        transaction.onerror = () => reject(transaction.error || request?.error);
        transaction.onabort = () => reject(transaction.error);
      }),
  );
}

export function dbGet(key) {
  return runTransaction('readonly', (store) => store.get(key));
}

export function dbSet(key, value) {
  return runTransaction('readwrite', (store) => store.put(value, key));
}

export function dbDelete(key) {
  return runTransaction('readwrite', (store) => store.delete(key));
}
