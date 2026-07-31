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

let dbVerbindung = null;
let dbOeffnung = null;

function oeffne() {
  // Verbindung wiederverwenden statt je Aufruf eine neue zu oeffnen. Vorher
  // legte JEDE Operation (speichern, laden, umbenennen, loeschen) eine eigene
  // IDBDatabase an, die nie geschlossen wurde — bei laengerer Arbeit im
  // Recorder sammeln sich so dutzende offene Verbindungen, und eine davon
  // blockiert spaeter jeden Versionswechsel der Datenbank.
  if (dbVerbindung) return Promise.resolve(dbVerbindung);
  if (dbOeffnung) return dbOeffnung;
  dbOeffnung = new Promise((resolve, reject) => {
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
    anfrage.onsuccess = () => {
      dbVerbindung = anfrage.result;
      // Wird die Verbindung von aussen beendet (Nutzer loescht Website-Daten,
      // anderer Tab erzwingt einen Versionswechsel), den Zwischenspeicher
      // leeren, damit der naechste Aufruf sauber neu oeffnet.
      dbVerbindung.onclose = () => { dbVerbindung = null; };
      dbVerbindung.onversionchange = () => {
        dbVerbindung?.close();
        dbVerbindung = null;
      };
      resolve(dbVerbindung);
    };
    anfrage.onerror = () => reject(anfrage.error);
    // Ohne onblocked bliebe das Promise ewig offen, wenn ein anderer Tab noch
    // eine aeltere DB-Version haelt — die aufrufende View wartet dann fuer immer.
    anfrage.onblocked = () => reject(new Error('indexeddb-blockiert'));
  }).catch((fehler) => {
    dbOeffnung = null; // beim naechsten Versuch neu aufbauen
    throw fehler;
  });
  return dbOeffnung;
}

// Eine Transaktion endet auf DREI Wegen: complete, error — und abort. Fehlte
// onabort, settlete das Promise bei einem Abbruch (Speicherkontingent voll,
// Nutzer loescht Website-Daten waehrend des Schreibens) NIE: `await
// speichereClip(...)` haengt, und die Aufnahme-Ansicht friert dauerhaft ein.
function alsTxPromise(tx, wert) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(wert);
    tx.onerror = () => reject(tx.error || new Error('indexeddb-fehler'));
    tx.onabort = () => reject(tx.error || new Error('indexeddb-abbruch'));
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
  return alsTxPromise(tx, clip);
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
  return alsTxPromise(tx);
}

export async function loescheClip(id) {
  const db = await oeffne();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  return alsTxPromise(tx);
}
