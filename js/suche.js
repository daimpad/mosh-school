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
