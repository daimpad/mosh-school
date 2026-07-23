// Werkzeuge-Hub: Übersicht der Audio-Werkzeuge, die die Lern-Bausteine praktisch
// stützen. Referenzbereich wie Stimmungen/Patterns — NICHT im Baustein-Pool, kein
// Fortschritt. Jedes Werkzeug hat eine eigene Route #/werkzeug/<name>.
//
// Der Hub listet auch noch nicht gebaute Werkzeuge als „geplant" (deaktiviert),
// damit der Bereich seinen Umfang zeigt; freigeschaltete tragen einen Link.

import { t } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

// Reihenfolge = Erzählreihenfolge. `bereit` schaltet den Link frei.
const WERKZEUGE = [
  { id: 'explorer', route: '#/werkzeug/explorer', icon: 'fa-magnifying-glass', bereit: true },
  { id: 'metronom', route: '#/werkzeug/metronom', icon: 'fa-stopwatch', bereit: true },
  { id: 'loops', route: '#/werkzeug/loops', icon: 'fa-drum', bereit: true },
  { id: 'stimmgeraet', route: '#/werkzeug/stimmgeraet', icon: 'fa-wave-square', bereit: true },
  { id: 'pedalboard', route: '#/werkzeug/pedalboard', icon: 'fa-layer-group', bereit: true },
  { id: 'ampbox', route: '#/werkzeug/ampbox', icon: 'fa-volume-high', bereit: true },
  { id: 'struktur', route: '#/werkzeug/struktur', icon: 'fa-list-check', bereit: true },
  { id: 'recorder', route: '#/werkzeug/recorder', icon: 'fa-microphone', bereit: true },
  { id: 'mehrspur', route: '#/werkzeug/mehrspur', icon: 'fa-sliders', bereit: true },
  { id: 'landkarte', route: '#/werkzeug/landkarte', icon: 'fa-compass', bereit: true },
  { id: 'genremix', route: '#/werkzeug/genremix', icon: 'fa-right-left', bereit: true },
];

function karte(wz) {
  const titel = t('wz_' + wz.id + '_titel');
  const beschreibung = t('wz_' + wz.id + '_kurz');
  const kopf = `
    <span class="wz-karte-icon"><i class="fa-solid ${wz.icon}" aria-hidden="true"></i></span>
    <span class="wz-karte-text">
      <span class="wz-karte-titel">${esc(titel)}</span>
      <span class="wz-karte-kurz leise">${esc(beschreibung)}</span>
    </span>`;
  if (wz.bereit) {
    return `<a class="wz-karte" href="${wz.route}">${kopf}<span class="wz-karte-pfeil" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span></a>`;
  }
  return `<div class="wz-karte wz-karte-geplant" aria-disabled="true">${kopf}<span class="wz-karte-marke leise">${esc(t('wz_geplant'))}</span></div>`;
}

export function renderWerkzeuge(el) {
  el.innerHTML = `
    <article>
      ${landingHeroHtml('fa-toolbox', t('nav_werkzeuge'), t('wz_hub_untertitel'), 'pf-teal', 'tools-hub')}
      <div class="wz-karten">${WERKZEUGE.map(karte).join('')}</div>
    </article>`;
}
