// IndexedDB-Speicher für Audio-Aufnahmen (themenneutral, DOM-frei). Audio-Blobs
// gehören NICHT in localStorage (Größe) und nicht ins versionierte Zustand-Schema
// — sie leben hier in einer eigenen Datenbank. Metadaten (Name, Tempo, Notiz,
// Datum) liegen im selben Objekt wie der Blob, ein Store pro Werkzeug.
//
// Bewusst schlank: kein Framework, promisifizierte IndexedDB-Aufrufe. Fällt
// IndexedDB aus (Privatmodus), werfen die Aufrufe — die View fängt das ab.

const DB_NAME = 'moshschool-aufnahmen';
const DB_VERSION = 1;
const STORE = 'riffs';

function oeffne() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('kein-indexeddb'));
      return;
    }
    const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
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

// Speichert einen Clip (mit Blob + Metadaten). `clip.id` muss gesetzt sein.
export async function speichereClip(clip) {
  const db = await oeffne();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(clip);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(clip);
    tx.onerror = () => reject(tx.error);
  });
}

// Alle Clips, neueste zuerst.
export async function alleClips() {
  const db = await oeffne();
  const tx = db.transaction(STORE, 'readonly');
  const clips = await alsPromise(tx.objectStore(STORE).getAll());
  return (clips || []).sort((a, b) => (b.datum || 0) - (a.datum || 0));
}

// Aktualisiert nur die Metadaten eines vorhandenen Clips.
export async function aktualisiereMeta(id, teil) {
  const db = await oeffne();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const clip = await alsPromise(store.get(id));
  if (clip) store.put({ ...clip, ...teil });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loescheClip(id) {
  const db = await oeffne();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
