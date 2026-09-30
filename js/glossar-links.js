// Glossar-Auto-Verlinkung: verlinkt die ERSTE Fundstelle jedes Glossar-Begriffs
// im Baustein-Fließtext auf das Szene-Glossar (#/glossar?q=<begriff>). Rein
// textuell und DOM-frei — die Ansicht ruft `absaetzeMitGlossar()` statt
// `absaetze()` auf. Referenzbereich Glossar wie Songs/Patterns — kein Fortschritt.
//
// „Erste Fundstelle je Baustein": ein gemeinsames `gesehen`-Set über alle Prosa-
// Blöcke eines Bausteins (Erklär- + Reflexionsteil), damit ein Begriff höchstens
// einmal verlinkt wird — die Blöcke werden in Renderreihenfolge durchgereicht,
// der Erklärteil hat also Vorrang vor dem Reflexionsteil. „Begriff" heißt hier
// Glossar-EINTRAG: Bei „Monitor / Wedge" wird nur die erste der beiden Formen
// verlinkt, nicht jede einmal.

import { absaetze, esc } from './oberflaeche.js';
import { t } from './i18n.js';

// Weitere Schreibweisen je Glossar-Eintrag (per ID, nicht per Anzeigetext — der
// Begriff darf sich ändern, ohne dass diese Liste still ins Leere zeigt). Nur
// Formen, die im Bestand wirklich vorkommen: Der Matcher kennt keine Flexion,
// „Split-Veröffentlichung" träfe „Split-Veröffentlichungen" sonst nicht (der
// Buchstabe danach verletzt die Wortgrenze).
const ZUSATZFORMEN = {
  gl_007: ['In-Ear'],
  gl_026: ['Stagedive'],
  gl_034: ['Split-Veröffentlichungen'],
  gl_038: ['Re-Amping'],
  gl_062: ['Gang Vocals'],
  gl_063: ['Drop Tuning'],
};

// Begriffe, die in einem bestimmten Baustein etwas ANDERES meinen als im Glossar
// und dort deshalb nicht verlinkt werden (Baustein-ID → Liste von Formen, wie sie
// im Text stehen; Groß-/Kleinschreibung egal). Der Matcher ist rein textuell und
// kann „Feedback" (Rückmeldung) nicht von „Feedback" (Rückkopplung) unterscheiden.
// Die Bausteintexte bleiben unangetastet — die Ausnahme gehört hierher, nicht in
// eine Umformulierung, die das richtige Wort durch ein schlechteres ersetzt.
// Neuer Fall: grep nach dem Begriff über data/bausteine.*.json und hier eintragen.
const AUSNAHMEN = {
  // Feedback = Rückmeldung, nicht Rückkopplung
  erste_proben_struktur: ['Feedback'],
  vocal_aufnahme_feedback: ['Feedback'],
  feedback_geben: ['Feedback'],
  // Tape = Klebeband, nicht Kassette
  daempfung_definition: ['Tape'],
};

function regexEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Zerlegt einen Glossar-Begriff in seine Einzelformen: „Load-in / Get-in" steht
// so nie im Fließtext, „Load-in" und „Get-in" schon.
function formenVon(eintrag) {
  const formen = String(eintrag.begriff)
    .split('/')
    .map((f) => f.trim())
    .filter(Boolean);
  return [...formen, ...(ZUSATZFORMEN[eintrag.id] || [])];
}

// Baut aus dem Glossar einen wiederverwendbaren Verlinker: ein kombinierter,
// nach Länge absteigend sortierter Matcher (längere Formen schlagen kürzere an
// derselben Stelle, z. B. „Circle Pit" vor „Pit"). Wortgrenzen über Lookaround,
// das ASCII- UND deutsche Buchstaben (ä/ö/ü/ß) als Wortzeichen behandelt — sonst
// bliebe „Mix" in „Mixer" hängen. `bausteinId` (optional) schaltet die
// `AUSNAHMEN` dieses Bausteins ab. Gibt `null` zurück, wenn nichts zu verlinken ist.
export function baueGlossarVerlinker(glossar, bausteinId = '') {
  const ausgeschlossen = new Set((AUSNAHMEN[bausteinId] || []).map((f) => f.toLowerCase()));
  const eintragVonForm = new Map();
  for (const eintrag of glossar?.begriffe || []) {
    if (typeof eintrag?.begriff !== 'string' || !eintrag.begriff.trim()) continue;
    for (const form of formenVon(eintrag)) {
      const schluessel = form.toLowerCase();
      if (ausgeschlossen.has(schluessel) || eintragVonForm.has(schluessel)) continue;
      eintragVonForm.set(schluessel, eintrag);
    }
  }
  if (eintragVonForm.size === 0) return null;
  const formen = [...eintragVonForm.keys()].sort((a, b) => b.length - a.length);
  const muster = formen.map(regexEscape).join('|');
  const regex = new RegExp(`(?<![\\wäöüß])(?:${muster})(?![\\wäöüß])`, 'giu');
  return { regex, eintragVonForm };
}

// Verlinkt Begriffe in einem Rohtext-Absatz; escaped den Text HTML-sicher und
// setzt Anker nur um die erste (baustein-weit) Fundstelle je Glossar-Eintrag.
function verlinkeAbsatz(absatz, verlinker, gesehen) {
  const { regex, eintragVonForm } = verlinker;
  regex.lastIndex = 0;
  let ergebnis = '';
  let letzte = 0;
  let m;
  while ((m = regex.exec(absatz)) !== null) {
    const treffer = m[0];
    const eintrag = eintragVonForm.get(treffer.toLowerCase());
    const schluessel = eintrag?.id || eintrag?.begriff || treffer.toLowerCase();
    ergebnis += esc(absatz.slice(letzte, m.index));
    if (!eintrag || gesehen.has(schluessel)) {
      ergebnis += esc(treffer); // Begriff schon verlinkt → nur Text.
    } else {
      gesehen.add(schluessel);
      // Gesucht wird nach dem vollen Glossar-Begriff, nicht nach der Fundstelle:
      // Die Glossar-Suche prüft „Begriff enthält Suchtext", und „Stagedive" oder
      // „Split-Veröffentlichungen" stecken nicht in „Stagediving" bzw.
      // „Split-Veröffentlichung".
      const ziel = `#/glossar?q=${encodeURIComponent(eintrag.begriff)}`;
      ergebnis += `<a class="glossar-link" href="${esc(ziel)}" title="${esc(t('glossar_link_titel'))}: ${esc(eintrag.begriff)}">${esc(treffer)}</a>`;
    }
    letzte = m.index + treffer.length;
    if (regex.lastIndex === m.index) regex.lastIndex++; // Nullbreite-Schutz.
  }
  ergebnis += esc(absatz.slice(letzte));
  return ergebnis;
}

// Wie `absaetze()`, aber mit Glossar-Auto-Verlinkung. `gesehen` wird über mehrere
// Aufrufe je Baustein geteilt (erste Fundstelle baustein-weit). Ohne Verlinker
// (leeres Glossar) fällt es auf das reine `absaetze()` zurück.
export function absaetzeMitGlossar(rohtext, verlinker, gesehen) {
  if (!verlinker) return absaetze(rohtext);
  return String(rohtext ?? '')
    .split(/\n\s*\n/)
    .map((absatz) => `<p>${verlinkeAbsatz(absatz.trim(), verlinker, gesehen)}</p>`)
    .join('');
}
