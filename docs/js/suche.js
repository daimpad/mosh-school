// Volltext-Suche über den Baustein-Pool. Reine Engine (kein DOM, testbar):
// nimmt die Anfrage und einen Titel-Auflöser (die Titel leben in den Labels,
// die die Engine nicht kennt — der View reicht `id => label('baustein', id)`
// herein) und liefert nach Relevanz sortierte Treffer mit Textausschnitt.
//
// Durchsucht ALLE Bausteine des Pools (nie gesperrt, Zwei-Ebenen-Logik) über
// Titel + Erklär-/Übungs-/Reflexionstext. Deltas (Herkunftsvarianten) und die
// Referenz-Reiter (Regeln, Turnier) bleiben außen vor — Suche zielt auf die Lernbausteine.

import { text } from './i18n.js';

// Kleinschreiben + Diakritika falten, damit „Täuschung" auch bei Eingabe
// „tauschung" trifft. NFD zerlegt Umlaute in Basisbuchstabe + Kombizeichen,
// die dann entfernt werden (ä→a, ö→o, ü→u).
export function normalisiere(wert) {
  return String(wert ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Alle durchsuchbaren Textbestandteile eines Bausteins rekursiv einsammeln —
// Erklärteil (String), Übungsteil (heterogenes Objekt mit Listen), Reflexion (String).
function sammle(wert, aus) {
  if (wert == null) return;
  if (typeof wert === 'string') aus.push(wert);
  else if (Array.isArray(wert)) for (const w of wert) sammle(w, aus);
  else if (typeof wert === 'object') for (const w of Object.values(wert)) sammle(w, aus);
}

export function bausteinText(baustein) {
  const teile = [];
  sammle(text(baustein.erklaerteil), teile);
  sammle(text(baustein.uebungsteil), teile);
  sammle(text(baustein.reflexionsaufgabe), teile);
  return teile.join(' ');
}

// Textausschnitt um den ersten Treffer herum (für die Ergebnisliste). Fällt der
// Term nicht in den Inhalt (nur Titeltreffer), wird der Anfang gezeigt.
export function ausschnitt(inhalt, term, laenge = 140) {
  const roh = String(inhalt ?? '');
  if (!roh) return '';
  const idx = term ? normalisiere(roh).indexOf(term) : -1;
  if (idx < 0) return roh.slice(0, laenge).trim() + (roh.length > laenge ? ' …' : '');
  const start = Math.max(0, idx - Math.floor(laenge / 3));
  const ende = Math.min(roh.length, idx + term.length + Math.floor((laenge * 2) / 3));
  return (start > 0 ? '… ' : '') + roh.slice(start, ende).trim() + (ende < roh.length ? ' …' : '');
}

// Suche: jeder Term muss vorkommen (UND-Verknüpfung). Titeltreffer wiegen
// schwerer als Inhaltstreffer; steht die ganze Anfrage im Titel, rankt der
// Baustein zusätzlich oben. Gleichstand → Pool-Reihenfolge (deterministisch).
export function sucheBausteine(daten, anfrage, titelVon) {
  const roh = normalisiere(anfrage);
  const terme = roh.split(/\s+/).filter(Boolean);
  if (terme.length === 0) return [];
  const treffer = [];
  for (const baustein of daten.bausteine) {
    const titel = titelVon ? titelVon(baustein.id) || '' : '';
    const inhalt = bausteinText(baustein);
    const titelN = normalisiere(titel);
    const inhaltN = normalisiere(inhalt);
    let score = 0;
    let alle = true;
    for (const term of terme) {
      const imTitel = titelN.includes(term);
      const imInhalt = inhaltN.includes(term);
      if (!imTitel && !imInhalt) {
        alle = false;
        break;
      }
      score += (imTitel ? 5 : 0) + (imInhalt ? 1 : 0);
    }
    if (!alle) continue;
    if (titelN.includes(roh)) score += 10; // ganze Anfrage im Titel
    treffer.push({ baustein, score, ausschnitt: ausschnitt(inhalt, terme[0]) });
  }
  treffer.sort(
    (a, b) => b.score - a.score || daten.poolIndex.get(a.baustein.id) - daten.poolIndex.get(b.baustein.id),
  );
  return treffer;
}

// --- Facetten-Suche über den vorgebauten Index (Trainings-Loop §3c) ---
// Arbeitet über daten.suchindex (Bausteine + Fehlerbilder): Volltext (voller,
// ungekürzter Inhalt aus scripts/build_index.py) plus UND-verknüpfte Facetten-
// Filter. Titeltreffer wiegen schwerer als Volltext; die ganze Anfrage im Titel
// rankt zusätzlich oben. Rein clientseitig, in-memory, keine Lib.

// Facetten-Dimensionen (Reihenfolge = Anzeige) und ihr Index-Feld. `typ` ist ein
// Skalar, die übrigen Listen — `facetWerte` vereinheitlicht das.
export const FACETTEN = ['domaene', 'kompetenzstufe', 'stil', 'spielziel', 'typ'];
const FACET_FELD = {
  domaene: 'domaene',
  kompetenzstufe: 'kompetenzstufe',
  stil: 'stil',
  spielziel: 'spielziele',
  typ: 'typ',
};

function facetWerte(eintrag, facette) {
  const feld = eintrag[FACET_FELD[facette]];
  if (Array.isArray(feld)) return feld;
  return feld != null ? [feld] : [];
}

// Ein Eintrag passt, wenn er in JEDER belegten Facette mindestens einen gewählten
// Wert trägt (UND über Dimensionen, ODER innerhalb einer Dimension).
export function passtFacetten(eintrag, filter) {
  for (const facette of FACETTEN) {
    const gewaehlt = filter?.[facette];
    if (!gewaehlt || gewaehlt.size === 0) continue;
    if (!facetWerte(eintrag, facette).some((w) => gewaehlt.has(w))) return false;
  }
  return true;
}

// Faltet Titel/Text jedes Index-Eintrags EINMAL in `_titelN`/`_textN` (idempotent).
// Ohne diesen Cache würde jede Tastatureingabe den ganzen Index neu normalisieren.
export function normalisiereIndex(index) {
  for (const eintrag of index) {
    if (eintrag._titelN === undefined) {
      eintrag._titelN = normalisiere(eintrag.titel);
      eintrag._textN = normalisiere(eintrag.text);
    }
  }
  return index;
}

export function sucheIndex(index, anfrage, filter) {
  const roh = normalisiere(anfrage);
  const terme = roh.split(/\s+/).filter(Boolean);
  const treffer = [];
  index.forEach((eintrag, pos) => {
    if (!passtFacetten(eintrag, filter)) return;
    let score = 0;
    if (terme.length > 0) {
      // Normalisierte Felder werden einmalig gecacht (siehe `normalisiereIndex`),
      // damit die Suche je Tastendruck nicht den ganzen Index neu faltet.
      const titelN = eintrag._titelN ?? normalisiere(eintrag.titel);
      const textN = eintrag._textN ?? normalisiere(eintrag.text);
      let alle = true;
      for (const term of terme) {
        const imTitel = titelN.includes(term);
        const imText = textN.includes(term);
        if (!imTitel && !imText) {
          alle = false;
          break;
        }
        score += (imTitel ? 5 : 0) + (imText ? 1 : 0);
      }
      if (!alle) return;
      if (titelN.includes(roh)) score += 10;
    }
    treffer.push({ eintrag, score, pos });
  });
  // Ohne Anfrage (nur Facetten) bleibt die Index-Reihenfolge; sonst Score zuerst.
  treffer.sort((a, b) => b.score - a.score || a.pos - b.pos);
  return treffer;
}

// Häufigkeit je Facettenwert über eine Treffermenge — für die Filter-Chips mit
// Zähler. Liefert { facette: Map(wert -> anzahl) }.
export function facettenZaehlung(eintraege) {
  const zaehlung = {};
  for (const facette of FACETTEN) zaehlung[facette] = new Map();
  for (const eintrag of eintraege) {
    for (const facette of FACETTEN) {
      for (const wert of facetWerte(eintrag, facette)) {
        zaehlung[facette].set(wert, (zaehlung[facette].get(wert) || 0) + 1);
      }
    }
  }
  return zaehlung;
}
