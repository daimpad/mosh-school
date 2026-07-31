// Mastery-Logik (Trainings-Loop §2/§5): rechnet aus dem selbst markierten
// Baustein-Status (neu/in_arbeit/sitzt) die weichen Pfad-Zustände, die
// fähigkeitsbasierten Fortschritts-Ringe je Instrument und die „Was als
// Nächstes"-Vorschläge. Reine Funktionen über Daten + Store, DOM-frei.
//
// Wichtig (Zwei-Ebenen-Logik): nichts hiervon sperrt — es ordnet und schlägt vor.
// „sitzt" ist selbst eingeschätzte Beherrschung, getrennt vom teil-genauen
// „erledigt" (durchgearbeitet) der bestehenden Fortschritts-Projektion.

import { alleStatus, feiereMeilenstein, holeZiele, kontinuitaet, onboarding, teilStatus } from './zustand.js';

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
// Hat der Nutzer diesen Baustein hinter sich? Die Frage ist je nach Inhaltsart
// eine ANDERE — und genau daran scheiterten die Meilensteine bisher:
//
// Ein Übungs-Baustein trägt den Mastery-Umschalter („Wie sitzt das bei dir?"),
// ein Reflexions-Baustein bewusst NICHT (die Frage passt inhaltlich nicht — man
// „beherrscht" keine Reflexion über Gehörschutz). Er trägt stattdessen seine
// eigene Quittierung, im Text „Mitgenommen".
//
// Geprüft wurde aber pauschal `status[id] === 'sitzt'`. Damit verlangten die
// Meilensteine von der Hälfte des Stoffs eine Markierung, die es dort gar nicht
// gibt: alle vier `grundlagen_*` waren unerreichbar (Gitarre 11 von 28
// Einsteiger-Bausteinen ohne Umschalter, Bass 10/23, Schlagzeug 5/20, Gesang
// 4/14), und dasselbe traf 10 der 20 Spielziele.
//
// Jetzt bekommt jeder Baustein die Frage, die er tatsächlich beantwortet.
function abgeschlossen(b, status) {
  return b.reflexionsaufgabe != null
    ? teilStatus(b.id, 'reflexionsaufgabe') === 'erledigt'
    : status[b.id] === 'sitzt';
}

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
    if (einsteiger.length >= GRUNDLAGEN_MIN && einsteiger.every((b) => abgeschlossen(b, status))) {
      feiere('grundlagen_' + dom);
    }
  }

  for (const z of holeZiele().filter((zz) => zz.art === 'spielziel')) {
    const bs = daten.bausteine.filter((b) => (b.spielziele || []).includes(z.wert));
    if (bs.length >= 2 && bs.every((b) => abgeschlossen(b, status))) feiere('spielziel_' + z.wert);
  }

  return neue;
}
