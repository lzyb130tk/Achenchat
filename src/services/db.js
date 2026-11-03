const DB_NAME = 'achat';
const DB_VERSION = 2;
const KV_STORE = 'kv';
const MESSAGE_STORE = 'messages';
const IMAGE_STORE = 'images';

let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        const messages = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
        messages.createIndex('by-character-seq', ['characterId', 'seq']);
        messages.createIndex('by-character', 'characterId');
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function withStore(storeName, mode, operation) {
  return openDatabase().then(async (db) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = operation(store);
    await transactionDone(transaction);
    return result;
  });
}

function withStores(storeNames, mode, operation) {
  return openDatabase().then(async (db) => {
    const transaction = db.transaction(storeNames, mode);
    const result = operation(transaction);
    await transactionDone(transaction);
    return result;
  });
}

/* ------------------------------------------------------------------ *
 * Key/value state store
 * ------------------------------------------------------------------ */

export function dbGet(key) {
  return withStore(KV_STORE, 'readonly', (store) => requestResult(store.get(key)));
}

export function dbSet(key, value) {
  return withStore(KV_STORE, 'readwrite', (store) => requestResult(store.put(value, key)));
}

export function dbDelete(key) {
  return withStore(KV_STORE, 'readwrite', (store) => requestResult(store.delete(key)));
}

/* ------------------------------------------------------------------ *
 * Message records, indexed by [characterId, seq]
 * ------------------------------------------------------------------ */

export function dbGetMessage(id) {
  return withStore(MESSAGE_STORE, 'readonly', (store) => requestResult(store.get(id)));
}

export function dbPutMessage(message) {
  return withStore(MESSAGE_STORE, 'readwrite', (store) =>
    requestResult(store.put(message)),
  );
}

export function dbPutMessages(messages) {
  if (!messages.length) return Promise.resolve();
  return withStores([MESSAGE_STORE], 'readwrite', (transaction) => {
    const store = transaction.objectStore(MESSAGE_STORE);
    for (const message of messages) store.put(message);
    return messages.length;
  });
}

export function dbDeleteMessage(id) {
  return withStore(MESSAGE_STORE, 'readwrite', (store) =>
    requestResult(store.delete(id)),
  );
}

export function dbDeleteMessages(ids) {
  if (!ids.length) return Promise.resolve();
  return withStores([MESSAGE_STORE], 'readwrite', (transaction) => {
    const store = transaction.objectStore(MESSAGE_STORE);
    for (const id of ids) store.delete(id);
    return ids.length;
  });
}

export function dbCountMessages(characterId) {
  return withStore(MESSAGE_STORE, 'readonly', (store) => {
    const index = store.index('by-character');
    return requestResult(index.count(IDBKeyRange.only(characterId)));
  });
}

function cursorPage(characterId, beforeSeq, limit) {
  return withStore(MESSAGE_STORE, 'readonly', (store) => {
    const index = store.index('by-character-seq');
    const upper = beforeSeq
      ? IDBKeyRange.bound([characterId, 0], [characterId, beforeSeq], false, true)
      : IDBKeyRange.bound([characterId, 0], [characterId, Number.MAX_SAFE_INTEGER]);
    return new Promise((resolve, reject) => {
      const collected = [];
      const request = index.openCursor(upper, 'prev');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          collected.reverse();
          resolve(collected);
          return;
        }
        collected.push(cursor.value);
        if (collected.length >= limit) {
          collected.reverse();
          resolve(collected);
          return;
        }
        cursor.continue();
      };
    });
  });
}

export async function dbGetRecentMessages(characterId, limit) {
  const rows = await cursorPage(characterId, 0, limit);
  return rows;
}

/**
 * Returns one page of messages, oldest first, plus whether more remain.
 * `beforeSeq` is exclusive so the cursor never repeats a message.
 */
export async function dbGetMessagePage(characterId, { beforeSeq = 0, limit = 50 } = {}) {
  const rows = await cursorPage(characterId, beforeSeq, limit + 1);
  const hasMore = rows.length > limit;
  return {
    messages: hasMore ? rows.slice(1) : rows,
    hasMore,
  };
}

export function dbGetMessagesSince(characterId, seq) {
  return withStore(MESSAGE_STORE, 'readonly', (store) => {
    const index = store.index('by-character-seq');
    const range = IDBKeyRange.bound(
      [characterId, seq],
      [characterId, Number.MAX_SAFE_INTEGER],
      true,
    );
    return new Promise((resolve, reject) => {
      const rows = [];
      const request = index.openCursor(range, 'next');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(rows);
          return;
        }
        rows.push(cursor.value);
        cursor.continue();
      };
    });
  });
}

export function dbGetAllMessages() {
  return withStore(MESSAGE_STORE, 'readonly', (store) =>
    requestResult(store.getAll()),
  );
}

export async function dbDeleteMessagesForCharacter(characterId) {
  return withStore(MESSAGE_STORE, 'readwrite', (store) => {
    const index = store.index('by-character');
    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(characterId));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
    });
  });
}

/* ------------------------------------------------------------------ *
 * Image blobs
 * ------------------------------------------------------------------ */

export function dbGetImage(id) {
  return withStore(IMAGE_STORE, 'readonly', (store) => requestResult(store.get(id)));
}

export function dbPutImage(image) {
  return withStore(IMAGE_STORE, 'readwrite', (store) =>
    requestResult(store.put(image)),
  );
}

export function dbDeleteImages(ids) {
  if (!ids.length) return Promise.resolve();
  return withStores([IMAGE_STORE], 'readwrite', (transaction) => {
    const store = transaction.objectStore(IMAGE_STORE);
    for (const id of ids) store.delete(id);
    return ids.length;
  });
}

export function dbGetAllImages() {
  return withStore(IMAGE_STORE, 'readonly', (store) => requestResult(store.getAll()));
}

export async function dbClearAllData() {
  return withStores([KV_STORE, MESSAGE_STORE, IMAGE_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(KV_STORE).clear();
    transaction.objectStore(MESSAGE_STORE).clear();
    transaction.objectStore(IMAGE_STORE).clear();
  });
}

export async function dbClearMessagesAndImages() {
  return withStores([MESSAGE_STORE, IMAGE_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(MESSAGE_STORE).clear();
    transaction.objectStore(IMAGE_STORE).clear();
  });
}
