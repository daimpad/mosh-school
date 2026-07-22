// Persistenter Zustand der Person: Diagnose, baustein-gebundener Fortschritt,
// Kontinuität und Einstellungen. Ein localStorage-Schlüssel, versioniertes Schema.
// Der Abschluss-Status ist ein erweiterbarer Zustandsraum: heute offen/erledigt,
// „beherrscht" ist später nur ein weiterer Wert, keine Migration.

const SPEICHER_KEY = 'moshschool.zustand.v1';
// Schema 2 fügt den Trainings-Loop-Unterbau hinzu (baustein-gebundener Mastery-
// Zustand, Übe-Log, selbstgesetzte Ziele, persönliche Bestwerte, Meilensteine,
// Onboarding-Profil). Alle neuen Felder sind additiv — Alt-Stände (Schema 1)
// heben sich per tiefMerge verlustfrei; der localStorage-Schlüssel bleibt gleich.
const SCHEMA_VERSION = 2;

let z = null;
let speicherVerfuegbar = true;

// Persistiert nach jeder Mutation. Sichten rendern nach einer Änderung über das
// 'app:rendern'-Ereignis neu (neuRendern in js/oberflaeche.js) — ein separater
// Abonnenten-Mechanismus ist dafür nicht nötig.
function schreibe() {
  speichereZustand();
}

function vorgabe() {
  return {
    schemaVersion: SCHEMA_VERSION,
    onboardingAbgeschlossen: false,
    diagnose: { stufe: null, trainer: false, herkunft: null, ziel: null },
    fortschritt: {},
    kontinuitaet: { gesamt: 0, jeEinheit: {} },
    einstellungen: { sprache: 'de', transferKuerzelSichtbar: true, thema: 'hell' },
    // Persönlicher Trainingsplan (generiert, anpassbar): null = noch keiner erstellt.
    plan: null,
    // --- Trainings-Loop-Unterbau (Schema 2) ---
    // Selbst markierter Mastery-Zustand je Baustein: 'neu' | 'in_arbeit' | 'sitzt'.
    // Getrennt vom teil-genauen `fortschritt` (offen/erledigt je Übungs-/Erklärteil).
    status: {},
    // Übe-Tagebuch: schlanke, chronologische Einträge (kein Druck, keine Streaks).
    log: [],
    // Selbstgesetzte Ziele ({ art:'spielziel'|'stil', wert, gesetzt }).
    ziele: [],
    // Persönliche Bestwerte (nicht-vergleichend), z. B. Tempo je Spielziel/Übung.
    bestwerte: {},
    // Gefeierte Meilensteine (IDs) — einmalig, wegklickbar.
    meilensteine: [],
    // Onboarding-Profil (speist Pfad & „Was als Nächstes"). Ergänzt `diagnose`.
    onboarding: { instrumente: [], level: null, zielsound: [], erledigt: false },
    // Zuletzt geöffneter Baustein (für die „Fortsetzen"-Kachel auf der Startseite).
    zuletzt: null,
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
  // Alt-Daten heben: die Fork-Stufe 'beginner' hieß im Vokabular nie so.
  if (ergebnis.diagnose?.stufe === 'beginner') ergebnis.diagnose.stufe = 'einsteiger';
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
  schreibe();
}

export function istOnboardingAbgeschlossen() {
  return stelleSicher().onboardingAbgeschlossen;
}

export function schliesseOnboardingAb() {
  stelleSicher().onboardingAbgeschlossen = true;
  schreibe();
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
  schreibe();
}

export function einstellungen() {
  return stelleSicher().einstellungen;
}

export function setzeEinstellung(schluessel, wert) {
  stelleSicher().einstellungen[schluessel] = wert;
  schreibe();
}

export function kontinuitaet() {
  return stelleSicher().kontinuitaet;
}

// Kumulativ, ohne Abbruchmechanik: Sitzungen summieren sich, Pausen entwerten nichts.
export function registriereEinheitAbschluss(einheitId) {
  const k = stelleSicher().kontinuitaet;
  k.gesamt += 1;
  k.jeEinheit[einheitId] = (k.jeEinheit[einheitId] || 0) + 1;
  schreibe();
  return k.gesamt;
}

// Trainingsplan: ein generierter, danach anpassbarer Wochenplan. Rein persistent,
// kein Fortschritt (der bleibt baustein-gebunden über die Einheiten-Referenzen).
export function plan() {
  return stelleSicher().plan;
}

export function setzePlan(neu) {
  stelleSicher().plan = neu;
  schreibe();
  return neu;
}

export function loeschePlan() {
  stelleSicher().plan = null;
  schreibe();
}

// --- Trainings-Loop-Unterbau (Schema 2) ---

const STATUS_WERTE = new Set(['neu', 'in_arbeit', 'sitzt']);

// Mastery-Zustand je Baustein (selbst markiert). Ohne Eintrag: 'neu'.
export function bausteinStatus(bausteinId) {
  return stelleSicher().status[bausteinId]?.zustand || 'neu';
}

export function setzeBausteinStatus(bausteinId, zustand, ts = null) {
  if (!STATUS_WERTE.has(zustand)) return;
  const s = stelleSicher().status;
  if (zustand === 'neu') delete s[bausteinId];
  else s[bausteinId] = { zustand, ts: ts || new Date().toISOString() };
  schreibe();
}

// Alle Status als flaches { id: 'zustand' } (für Pfad-/Fortschrittssichten).
export function alleStatus() {
  const s = stelleSicher().status;
  const out = {};
  for (const [id, e] of Object.entries(s)) out[id] = e.zustand;
  return out;
}

// Übe-Tagebuch (§2e): schlanke, chronologische Einträge. `ts` einspeisbar (Tests).
export function holeLog() {
  return stelleSicher().log;
}

export function ergaenzeLog(eintrag, ts = null) {
  stelleSicher().log.push({ ts: ts || new Date().toISOString(), ...eintrag });
  schreibe();
}

export function loescheLogEintrag(index) {
  const l = stelleSicher().log;
  if (index >= 0 && index < l.length) {
    l.splice(index, 1);
    schreibe();
  }
}

// Selbstgesetzte Ziele ({ art, wert, gesetzt }). Doppelte (art+wert) werden
// zusammengeführt, nicht dupliziert.
export function holeZiele() {
  return stelleSicher().ziele;
}

export function setzeZiel(art, wert) {
  const ziele = stelleSicher().ziele;
  if (!ziele.some((z2) => z2.art === art && z2.wert === wert)) {
    ziele.push({ art, wert, gesetzt: new Date().toISOString() });
    schreibe();
  }
}

export function entferneZiel(art, wert) {
  const zst = stelleSicher();
  const vorher = zst.ziele.length;
  zst.ziele = zst.ziele.filter((z2) => !(z2.art === art && z2.wert === wert));
  if (zst.ziele.length !== vorher) schreibe();
}

// Persönliche Bestwerte (nicht-vergleichend). Nur nach oben — ein neuer Wert
// zählt nur, wenn er den bisherigen übertrifft. Rückgabe: true, wenn neuer Best.
export function holeBestwert(schluessel, feld = 'tempo_bpm') {
  return stelleSicher().bestwerte[schluessel]?.[feld] ?? null;
}

export function meldeBestwert(schluessel, feld, wert) {
  const bw = stelleSicher().bestwerte;
  const bisher = bw[schluessel]?.[feld];
  if (typeof wert !== 'number' || (typeof bisher === 'number' && wert <= bisher)) return false;
  bw[schluessel] = { ...(bw[schluessel] || {}), [feld]: wert, ts: new Date().toISOString() };
  schreibe();
  return true;
}

// Meilensteine (§5): einmalig gefeiert, wegklickbar. `feiere` gibt true zurück,
// wenn der Meilenstein neu ist (Aufrufer zeigt dann die Feier).
export function hatMeilenstein(id) {
  return stelleSicher().meilensteine.includes(id);
}

export function meilensteine() {
  return stelleSicher().meilensteine;
}

export function alleBestwerte() {
  return stelleSicher().bestwerte;
}

export function feiereMeilenstein(id) {
  const m = stelleSicher().meilensteine;
  if (m.includes(id)) return false;
  m.push(id);
  schreibe();
  return true;
}

// Onboarding-Profil (§3a). Speist Pfad & Vorschläge; spiegelt Level/Ziel zusätzlich
// in `diagnose`, damit die bestehenden Pfad-Sichten unverändert weiterlaufen.
export function onboarding() {
  return stelleSicher().onboarding;
}

export function setzeOnboarding(patch) {
  Object.assign(stelleSicher().onboarding, patch);
  schreibe();
}

// Zuletzt geöffneter Baustein — leichtgewichtig (nur die ID + Zeitstempel), damit
// die Startseite „Fortsetzen wo du warst" anbieten kann. Kein Fortschritt.
export function zuletzt() {
  return stelleSicher().zuletzt;
}

export function merkeZuletzt(bausteinId) {
  const zst = stelleSicher();
  if (zst.zuletzt?.baustein === bausteinId) return; // kein unnötiges Schreiben/Benachrichtigen
  zst.zuletzt = { baustein: bausteinId, ts: new Date().toISOString() };
  schreibe();
}

// Export/Import als ein portables JSON-Envelope (Backup, kein Konto). Import
// verschmilzt defensiv über die Vorgabe, sodass fehlende/fremde Felder nicht
// crashen und das Schema aktuell bleibt.
export function exportiereZustand() {
  return JSON.parse(JSON.stringify(stelleSicher()));
}

export function importiereZustand(objekt) {
  if (!objekt || typeof objekt !== 'object') return false;
  z = verschmelze(vorgabe(), objekt);
  schreibe();
  return true;
}

export function setzeZurueck() {
  try {
    globalThis.localStorage?.removeItem(SPEICHER_KEY);
  } catch {
    /* egal — Neuaufbau folgt ohnehin */
  }
  z = vorgabe();
  schreibe();
  return z;
}
