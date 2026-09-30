// Sichtbare Genre-Namen für die Gefühlslandkarte (Grenzgänger-Zweig).
//
// Die Landkarte trägt eigene Genre-Schlüssel (u. a. `post_metal`, `stoner`), die
// nicht deckungsgleich mit der `stil`-Vokabel sind (dort steht z. B. das
// kombinierte „stoner_post"). Darum liegen die Anzeigenamen unter
// `vokabeln.gefuehlsgenre` in labels/de.json — die Views lesen sie nur über
// diesen Helfer, nie hart verdrahtet (CLAUDE.md: kein Anzeigetext in JS).

import { label } from './i18n.js';

export function landkarteName(genre) {
  return label('gefuehlsgenre', genre);
}

// Landkarten-Genres, die im `stil`-Vokabular unter einem kombinierten Schlüssel
// stehen. Beide Richtungen des Stoner/Post-Zweigs führen auf denselben Stilpfad.
const LANDKARTE_ZU_STIL = { post_metal: 'stoner_post', stoner: 'stoner_post' };

// Stilpfad-Schlüssel zu einem Landkarten-Genre — oder null, wenn es keinen
// Stilpfad gibt. `stile` ist `daten.vokabulare.stil`. Ohne diese Prüfung zeigte
// ein Link auf #/pfad/stil/<genre> ins Leere (Nicht-gefunden statt Genre-Seite).
export function landkarteStil(genre, stile = []) {
  const stil = LANDKARTE_ZU_STIL[genre] || genre;
  return stile.includes(stil) ? stil : null;
}
