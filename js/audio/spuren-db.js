// IndexedDB-Speicher für Mehrspur-Skizzen (themenneutral, DOM-frei). Analog zu
// riff-db.js, aber eigene Datenbank/Store: eine Spur = Blob + Metadaten
// (Name, Mute, Solo, Pegel, Reihenfolge). Audio gehört nicht in localStorage.

const DB_NAME = 'moshschool-mehrspur';
const DB_VERSION = 1;
const STORE = 'spuren';

function oeffne() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('kein-indexeddb'));
      return;
    }
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}
function alsPromise(anfrage) {
  return new Promise((resolve, reject) => {
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

export async function speichereSpur(spur) {
  const db = await oeffne();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(spur);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(spur);
    tx.onerror = () => reject(tx.error);
  });
}

// Alle Spuren, älteste zuerst (Aufnahme-Reihenfolge = Spurreihenfolge).
export async function alleSpuren() {
  const db = await oeffne();
  const tx = db.transaction(STORE, 'readonly');
  const spuren = await alsPromise(tx.objectStore(STORE).getAll());
  return (spuren || []).sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
}

export async function aktualisiereSpur(id, teil) {
  const db = await oeffne();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const spur = await alsPromise(store.get(id));
  if (spur) store.put({ ...spur, ...teil });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loescheSpur(id) {
  const db = await oeffne();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
