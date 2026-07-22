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
