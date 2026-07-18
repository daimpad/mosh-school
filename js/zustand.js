// Persistenter Zustand der Person: Diagnose, baustein-gebundener Fortschritt,
// Kontinuität und Einstellungen. Ein localStorage-Schlüssel, versioniertes Schema.
// Der Abschluss-Status ist ein erweiterbarer Zustandsraum: heute offen/erledigt,
// „beherrscht" ist später nur ein weiterer Wert, keine Migration.

const SPEICHER_KEY = 'crossminton.zustand.v1';
const SCHEMA_VERSION = 1;

let z = null;
let speicherVerfuegbar = true;

function vorgabe() {
  return {
    schemaVersion: SCHEMA_VERSION,
    onboardingAbgeschlossen: false,
    diagnose: { stufe: null, trainer: false, herkunft: null, ziel: null },
    fortschritt: {},
    kontinuitaet: { gesamt: 0, jeEinheit: {} },
    einstellungen: { sprache: 'de', transferKuerzelSichtbar: true, thema: 'auto' },
    // Persönlicher Trainingsplan (generiert, anpassbar): null = noch keiner erstellt.
    plan: null,
  };
}

// Tiefer Merge: gespeicherte Werte überlagern die Vorgabe rekursiv, sodass auch
// künftige verschachtelte Default-Keys erhalten bleiben. Arrays und Skalare ersetzen.
function tiefMerge(basis, gespeichert) {
  if (gespeichert == null || typeof gespeichert !== 'object' || Array.isArray(gespeichert)) return basis;
  const ergebnis = { ...basis };
  for (const [k, v] of Object.entries(gespeichert)) {
    const b = basis[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v)) {
      ergebnis[k] = tiefMerge(b, v);
    } else {
      ergebnis[k] = v;
    }
  }
  return ergebnis;
}

function verschmelze(basis, gespeichert) {
  if (gespeichert == null || typeof gespeichert !== 'object') return basis;
  const ergebnis = tiefMerge(basis, gespeichert);
  ergebnis.schemaVersion = SCHEMA_VERSION;
  return ergebnis;
}

export function ladeZustand() {
  let gespeichert = null;
  try {
    const roh = globalThis.localStorage?.getItem(SPEICHER_KEY);
    if (roh) gespeichert = JSON.parse(roh);
  } catch {
    gespeichert = null;
  }
  z = verschmelze(vorgabe(), gespeichert);
  speichereZustand();
  return z;
}

function stelleSicher() {
  if (!z) ladeZustand();
  return z;
}

export function speichereZustand() {
  try {
    globalThis.localStorage?.setItem(SPEICHER_KEY, JSON.stringify(z));
    speicherVerfuegbar = typeof globalThis.localStorage !== 'undefined';
  } catch {
    speicherVerfuegbar = false;
  }
}

export function speicherIstVerfuegbar() {
  stelleSicher();
  return speicherVerfuegbar;
}

export function aktuellerZustand() {
  return stelleSicher();
}

export function diagnose() {
  return stelleSicher().diagnose;
}

export function setzeDiagnose(patch) {
  Object.assign(stelleSicher().diagnose, patch);
  speichereZustand();
}

export function istOnboardingAbgeschlossen() {
  return stelleSicher().onboardingAbgeschlossen;
}

export function schliesseOnboardingAb() {
  stelleSicher().onboardingAbgeschlossen = true;
  speichereZustand();
}

// Abschluss-Status je Teil: 'offen' | 'erledigt' (getrennt für Erklär- und Übungsteil).
export function teilStatus(bausteinId, teil) {
  const eintrag = stelleSicher().fortschritt[bausteinId];
  return eintrag?.[teil] === 'erledigt' ? 'erledigt' : 'offen';
}

export function setzeTeilStatus(bausteinId, teil, status) {
  const fortschritt = stelleSicher().fortschritt;
  if (!fortschritt[bausteinId]) fortschritt[bausteinId] = {};
  fortschritt[bausteinId][teil] = status;
  speichereZustand();
}

export function einstellungen() {
  return stelleSicher().einstellungen;
}

export function setzeEinstellung(schluessel, wert) {
  stelleSicher().einstellungen[schluessel] = wert;
  speichereZustand();
}

export function kontinuitaet() {
  return stelleSicher().kontinuitaet;
}

// Kumulativ, ohne Abbruchmechanik: Sitzungen summieren sich, Pausen entwerten nichts.
export function registriereEinheitAbschluss(einheitId) {
  const k = stelleSicher().kontinuitaet;
  k.gesamt += 1;
  k.jeEinheit[einheitId] = (k.jeEinheit[einheitId] || 0) + 1;
  speichereZustand();
  return k.gesamt;
}

// Trainingsplan: ein generierter, danach anpassbarer Wochenplan. Rein persistent,
// kein Fortschritt (der bleibt baustein-gebunden über die Einheiten-Referenzen).
export function plan() {
  return stelleSicher().plan;
}

export function setzePlan(neu) {
  stelleSicher().plan = neu;
  speichereZustand();
  return neu;
}

export function loeschePlan() {
  stelleSicher().plan = null;
  speichereZustand();
}

export function setzeZurueck() {
  try {
    globalThis.localStorage?.removeItem(SPEICHER_KEY);
  } catch {
    /* egal — Neuaufbau folgt ohnehin */
  }
  z = vorgabe();
  speichereZustand();
  return z;
}
