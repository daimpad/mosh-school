// Glossar-Auto-Verlinkung: verlinkt die ERSTE Fundstelle jedes Glossar-Begriffs
// im Baustein-Fließtext auf das Szene-Glossar (#/glossar?q=<begriff>). Rein
// textuell und DOM-frei — die Ansicht ruft `absaetzeMitGlossar()` statt
// `absaetze()` auf. Referenzbereich Glossar wie Songs/Patterns — kein Fortschritt.
//
// „Erste Fundstelle je Baustein": ein gemeinsames `gesehen`-Set über alle Prosa-
// Blöcke eines Bausteins (Erklär- + Reflexionsteil), damit ein Begriff höchstens
// einmal verlinkt wird — die Blöcke werden in Renderreihenfolge durchgereicht,
// der Erklärteil hat also Vorrang vor dem Reflexionsteil.

import { absaetze, esc } from './oberflaeche.js';
import { t } from './i18n.js';

function regexEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Baut aus dem Glossar einen wiederverwendbaren Verlinker: ein kombinierter,
// nach Länge absteigend sortierter Matcher (längere Begriffe schlagen kürzere an
// derselben Stelle, z. B. „Circle Pit" vor „Pit"). Wortgrenzen über Lookaround,
// das ASCII- UND deutsche Buchstaben (ä/ö/ü/ß) als Wortzeichen behandelt — sonst
// bliebe „Mix" in „Mixer" hängen. Gibt `null` zurück, wenn das Glossar leer ist.
export function baueGlossarVerlinker(glossar) {
  const begriffe = (glossar?.begriffe || [])
    .map((e) => e.begriff)
    .filter((b) => typeof b === 'string' && b.trim())
    .sort((a, b) => b.length - a.length);
  if (begriffe.length === 0) return null;
  const muster = begriffe.map(regexEscape).join('|');
  const regex = new RegExp(`(?<![\\wäöüß])(?:${muster})(?![\\wäöüß])`, 'giu');
  return { regex };
}

// Verlinkt Begriffe in einem Rohtext-Absatz; escaped den Text HTML-sicher und
// setzt Anker nur um die erste (baustein-weit) Fundstelle je Begriff.
function verlinkeAbsatz(absatz, verlinker, gesehen) {
  const { regex } = verlinker;
  regex.lastIndex = 0;
  let ergebnis = '';
  let letzte = 0;
  let m;
  while ((m = regex.exec(absatz)) !== null) {
    const treffer = m[0];
    const schluessel = treffer.toLowerCase();
    ergebnis += esc(absatz.slice(letzte, m.index));
    if (gesehen.has(schluessel)) {
      ergebnis += esc(treffer); // Begriff schon verlinkt → nur Text.
    } else {
      gesehen.add(schluessel);
      const ziel = `#/glossar?q=${encodeURIComponent(treffer)}`;
      ergebnis += `<a class="glossar-link" href="${esc(ziel)}" title="${esc(t('glossar_link_titel'))}: ${esc(treffer)}">${esc(treffer)}</a>`;
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
