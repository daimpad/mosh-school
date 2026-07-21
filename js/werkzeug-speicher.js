// Werkzeug-Persistenz (themenneutral, DOM-frei): kleine, verlustunkritische
// Werkzeug-Strukturen (Pedalketten, später Song-Strukturen) in localStorage.
//
// BEWUSST getrennt vom versionierten `zustand.js`-Schema: Werkzeug-Daten sind
// Referenz-/Spielstände, kein Lern-Fortschritt. Eigener Schlüssel-Namespace
// `moshschool.werkzeuge.v1`, damit das Fortschritts-Schema unangetastet bleibt.
// Audio-Blobs (Rekorder) gehören später in IndexedDB, nicht hierher.

const SCHLUESSEL = 'moshschool.werkzeuge.v1';

function lies() {
  try {
    return JSON.parse(localStorage.getItem(SCHLUESSEL)) || {};
  } catch {
    return {};
  }
}

function schreib(objekt) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(objekt));
  } catch {
    /* localStorage voll/gesperrt (Privatmodus) — Werkzeug läuft ohne Persistenz weiter. */
  }
}

// Liest den Wert eines Werkzeugs (unter seinem Namespace), sonst den Vorgabewert.
export function holeWerkzeugDaten(werkzeug, vorgabe = null) {
  const alles = lies();
  return werkzeug in alles ? alles[werkzeug] : vorgabe;
}

// Speichert den Wert eines Werkzeugs (überschreibt nur dessen Namespace).
export function setzeWerkzeugDaten(werkzeug, wert) {
  const alles = lies();
  alles[werkzeug] = wert;
  schreib(alles);
}
