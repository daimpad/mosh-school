// Zerrtypen: Referenz der Verzerrer- und Verstärkerzerre-Bauarten
// (data/zerrtypen.json). Referenzbereich wie Stimmungen/Griffe/Patterns —
// NICHT im Baustein-Pool, kein Fortschritt.
//
// Alle Typen sind funktional benannt (Mittenbuckel-Booster,
// Gegenkopplungs-Overdrive …), nicht nach Modellen: Der Klang entsteht aus
// Schaltung und Physik, nicht aus dem Logo. Konkrete Geräte stehen
// ausschließlich in der Ausnahmeliste (data/brand-alert.json) und lassen sich
// von dort über die Typbezeichnung zurückverfolgen.

import { t } from '../i18n.js';
import { domaeneIcon, esc } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

function typKarte(typ) {
  // `achtung` ist der Fallstrick-Hinweis und trägt deshalb eine eigene,
  // abgesetzte Zeile statt in den Fließtext gemischt zu werden.
  const zeilen = [
    ['zerrtypen_prinzip', typ.prinzip],
    ['zerrtypen_klang', typ.klang],
    ['zerrtypen_anwendung', typ.anwendung],
  ]
    .filter(([, wert]) => wert)
    .map(
      ([schluessel, wert]) => `
        <div class="zerrtyp-zeile">
          <dt class="leise">${esc(t(schluessel))}</dt>
          <dd>${esc(wert)}</dd>
        </div>`
    )
    .join('');
  return `
    <article class="zerrtyp-karte karte">
      <h3 class="zerrtyp-name">${esc(typ.bezeichnung)}</h3>
      <dl class="zerrtyp-liste">${zeilen}</dl>
      ${typ.achtung ? `<p class="zerrtyp-achtung"><span class="leise">${esc(t('zerrtypen_achtung'))}</span> ${esc(typ.achtung)}</p>` : ''}
    </article>`;
}

export function renderZerrtypen(el, daten) {
  const z = daten.zerrtypen || {};
  const typen = z.typen || [];
  if (typen.length === 0) {
    el.innerHTML = `<article><p class="leise">${esc(t('zerrtypen_leer'))}</p></article>`;
    return;
  }
  // Gruppenreihenfolge kommt aus der Datei (Booster → … → Verstärker, also von
  // der schwächsten zur stärksten Eingriffstiefe). Typen mit unbekannter Gruppe
  // hängen hinten an, statt lautlos zu verschwinden.
  const reihenfolge = [...(z.gruppen || [])];
  for (const typ of typen) {
    const g = typ.gruppe || '';
    if (g && !reihenfolge.includes(g)) reihenfolge.push(g);
  }
  const gruppen = reihenfolge
    .map((g) => {
      const eintraege = typen.filter((typ) => typ.gruppe === g);
      if (eintraege.length === 0) return '';
      return `
        <section class="zerrtyp-gruppe">
          <h2 class="zerrtyp-gruppe-titel">${esc(g)}</h2>
          <div class="zerrtyp-gitter">${eintraege.map(typKarte).join('')}</div>
        </section>`;
    })
    .join('');
  el.innerHTML = `
    <article class="zerrtypen-seite">
      ${landingHeroHtml('', t('zerrtypen_titel'), t('zerrtypen_untertitel'), 'pf-schiefer', 'zerrtypen', '', domaeneIcon('ausruestung'))}
      ${z.hinweis ? `<p class="zerrtypen-hinweis leise">${esc(z.hinweis)}</p>` : ''}
      ${gruppen}
    </article>`;
}
