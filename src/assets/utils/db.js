const DB_NAME = "BluMirai_ConGreen";
const STORE_NAME = "outbox";

// Initialize the database
export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = (e) => {
      // 2. EXPLICITLY resolve with the result, which is the DB object
      const db = e.target.result;
      if (db) {
        resolve(db);
      } else {
        reject(new Error("Database opened but result was null"));
      }
    };
request.onerror = (e) => {
  console.error("DATABASE ERROR:", e.target.error);
  reject(e.target.error);
};
  });
};

// Add a receipt to the offline queue
export const saveToOfflineQueue = async (file, metadata) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    
    const entry = {
      file, // The Blob/File object
      metadata,
      status: "pending",
      timestamp: Date.now(),
    };

    const request = store.add(entry);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// Get all pending receipts to sync
export const getPendingReceipts = async () => {
  try {
    const db = await initDB();
    
    // 3. Double-check that we have a valid DB connection
    if (!db || typeof db.transaction !== 'function') {
      throw new Error("Invalid DB instance received");
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Critical Sync Error:", err);
    return []; // Return empty array so the UI doesn't crash
  }
};

// Remove from queue after successful S3 upload
export const removeFromQueue = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};