// Mastery-Logik (Trainings-Loop §2/§5): rechnet aus dem selbst markierten
// Baustein-Status (neu/in_arbeit/sitzt) die weichen Pfad-Zustände, die
// fähigkeitsbasierten Fortschritts-Ringe je Instrument und die „Was als
// Nächstes"-Vorschläge. Reine Funktionen über Daten + Store, DOM-frei.
//
// Wichtig (Zwei-Ebenen-Logik): nichts hiervon sperrt — es ordnet und schlägt vor.
// „sitzt" ist selbst eingeschätzte Beherrschung, getrennt vom teil-genauen
// „erledigt" (durchgearbeitet) der bestehenden Fortschritts-Projektion.

import { alleStatus, holeZiele, onboarding } from './zustand.js';

export const INSTRUMENTE = ['gitarre', 'bass', 'schlagzeug', 'gesang'];

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
