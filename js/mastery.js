// Mastery-Logik (Trainings-Loop §2/§5): rechnet aus dem selbst markierten
// Baustein-Status (neu/in_arbeit/sitzt) die weichen Pfad-Zustände, die
// fähigkeitsbasierten Fortschritts-Ringe je Instrument und die „Was als
// Nächstes"-Vorschläge. Reine Funktionen über Daten + Store, DOM-frei.
//
// Wichtig (Zwei-Ebenen-Logik): nichts hiervon sperrt — es ordnet und schlägt vor.
// „sitzt" ist selbst eingeschätzte Beherrschung, getrennt vom teil-genauen
// „erledigt" (durchgearbeitet) der bestehenden Fortschritts-Projektion.

import { alleStatus, feiereMeilenstein, holeLog, holeZiele, kontinuitaet, onboarding } from './zustand.js';

export const INSTRUMENTE = ['gitarre', 'bass', 'schlagzeug', 'gesang'];

// Mind. so viele Einsteiger-Bausteine, damit ein „Grundlagen"-Meilenstein etwas
// bedeutet (nicht bei Instrumenten mit nur ein, zwei Einsteiger-Bausteinen feuern).
const GRUNDLAGEN_MIN = 3;

// Weicher Pfad-Zustand eines Bausteins (§2b): gemeistert, verfügbar (alle
// Voraussetzungen sitzen) oder baut-auf (noch offene Voraussetzung). Reihenfolge
// ordnet, sperrt nie.
export function masteryZustand(baustein, status = alleStatus()) {
  if (status[baustein.id] === 'sitzt') return 'gemeistert';
  const voraus = baustein.voraussetzungen || [];
  return voraus.every((v) => status[v] === 'sitzt') ? 'verfuegbar' : 'baut_auf';
}

// Offene Voraussetzungen (noch nicht „sitzt") — für den weichen Hinweis.
export function offeneVoraussetzungen(baustein, status = alleStatus()) {
  return (baustein.voraussetzungen || []).filter((v) => status[v] !== 'sitzt');
}

// Fortschritts-Ringe je Instrument: Anteil der Bausteine einer Instrument-Domäne,
// die „sitzt" sind (fähigkeitsbasiert, kein Punktezähler). Nur belegte Instrumente.
export function instrumentRinge(daten) {
  const status = alleStatus();
  return INSTRUMENTE.map((domaene) => {
    const inDom = daten.bausteine.filter((b) => (b.domaene || []).includes(domaene));
    const gesamt = inDom.length;
    const sitzt = inDom.filter((b) => status[b.id] === 'sitzt').length;
    return { domaene, sitzt, gesamt, quote: gesamt ? sitzt / gesamt : 0 };
  }).filter((r) => r.gesamt > 0);
}

// „Was als Nächstes" (§2c): verfügbare Bausteine (alle Voraussetzungen sitzen,
// selbst noch nicht „sitzt"), priorisiert nach Nähe zum gewählten Ziel (geteiltes
// stil/spielziel), zum Onboarding-Instrument und ob schon „in Arbeit".
export function wasAlsNaechstes(daten, anzahl = 5) {
  const status = alleStatus();
  const ziele = holeZiele();
  const zielStile = new Set(ziele.filter((z) => z.art === 'stil').map((z) => z.wert));
  const zielSpielziele = new Set(ziele.filter((z) => z.art === 'spielziel').map((z) => z.wert));
  const instrumente = new Set(onboarding().instrumente || []);

  const verfuegbar = daten.bausteine.filter(
    (b) => status[b.id] !== 'sitzt' && masteryZustand(b, status) === 'verfuegbar',
  );

  const bewerte = (b) => {
    let s = 0;
    if ((b.stil || []).some((x) => zielStile.has(x))) s += 4;
    if ((b.spielziele || []).some((x) => zielSpielziele.has(x))) s += 4;
    if ((b.domaene || []).some((x) => instrumente.has(x))) s += 2;
    if (status[b.id] === 'in_arbeit') s += 3; // Angefangenes zuerst weiterführen
    return s;
  };

  return verfuegbar
    .map((b) => ({ b, s: bewerte(b) }))
    .sort((a, z) => z.s - a.s || daten.poolIndex.get(a.b.id) - daten.poolIndex.get(z.b.id))
    .slice(0, anzahl)
    .map((x) => x.b);
}

// --- Meilensteine (§5): wenige, echte. Prüft die Bedingungen gegen den Store und
// feiert neu erreichte (feiereMeilenstein ist idempotent). Gibt die NEU erreichten
// IDs zurück — der Aufrufer zeigt die Feier. IDs: erste_trainingseinheit,
// grundlagen_<instrument>, spielziel_<wert>, erstes_riff (extern am Recorder).
export function pruefeMeilensteine(daten) {
  const neue = [];
  const status = alleStatus();
  const feiere = (id) => {
    if (feiereMeilenstein(id)) neue.push(id);
  };

  if (kontinuitaet().gesamt >= 1) feiere('erste_trainingseinheit');

  for (const dom of INSTRUMENTE) {
    const einsteiger = daten.bausteine.filter(
      (b) => (b.domaene || []).includes(dom) && (b.kompetenzstufe || []).includes('einsteiger'),
    );
    if (einsteiger.length >= GRUNDLAGEN_MIN && einsteiger.every((b) => status[b.id] === 'sitzt')) {
      feiere('grundlagen_' + dom);
    }
  }

  for (const z of holeZiele().filter((zz) => zz.art === 'spielziel')) {
    const bs = daten.bausteine.filter((b) => (b.spielziele || []).includes(z.wert));
    if (bs.length >= 2 && bs.every((b) => status[b.id] === 'sitzt')) feiere('spielziel_' + z.wert);
  }

  return neue;
}

// Übe-Kalender (§5): geloggte Tage der letzten `tage` Tage als { iso, anzahl }.
// Pausen werden NICHT bestraft — es gibt bewusst keinen Streak-Zähler.
export function uebeKalender(tage = 70, heuteIso = null) {
  const zaehlung = new Map();
  for (const e of holeLog()) {
    const iso = (e.ts || '').slice(0, 10);
    if (iso) zaehlung.set(iso, (zaehlung.get(iso) || 0) + 1);
  }
  const heute = heuteIso ? new Date(heuteIso + 'T00:00:00Z') : new Date();
  const raster = [];
  for (let i = tage - 1; i >= 0; i--) {
    const d = new Date(heute);
    d.setUTCDate(heute.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    raster.push({ iso, anzahl: zaehlung.get(iso) || 0 });
  }
  return raster;
}

export function geuebteTage() {
  return new Set(holeLog().map((e) => (e.ts || '').slice(0, 10)).filter(Boolean)).size;
}
