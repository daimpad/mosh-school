// Geräte-Landing je Instrument (Gitarre/Bass/Schlagzeug/Gesang): listet die
// Ausrüstungs-Wissensbausteine des Instruments. Rein daten-getrieben — filtert
// den Pool nach domaene ⊇ {ausruestung, <instrument>}; keine hartkodierten Listen.
// Referenz-Landing, kein eigener Fortschritt (der hängt an den Bausteinen selbst).

import { label, t } from '../i18n.js';
import { bausteinIcon, domaeneIcon, esc } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';
import { INSTRUMENTE } from '../pfade.js';

const STUFE_ORDNUNG = { einsteiger: 0, fortgeschritten: 1, experte: 2 };

const ICON = { gitarre: 'fa-microchip', bass: 'fa-microchip', schlagzeug: 'fa-drum', gesang: 'fa-microphone' };

function stufeRang(baustein) {
  const stufen = baustein.kompetenzstufe || [];
  let min = 9;
  for (const s of stufen) if (s in STUFE_ORDNUNG && STUFE_ORDNUNG[s] < min) min = STUFE_ORDNUNG[s];
  return min;
}

// Ausrüstungs-Bausteine des Instruments, nach Könnensstufe sortiert.
function geraeteBausteine(daten, instrument) {
  return daten.bausteine
    .filter((b) => {
      const dom = b.domaene || [];
      return dom.includes('ausruestung') && dom.includes(instrument);
    })
    .sort((a, b) => stufeRang(a) - stufeRang(b) || label('baustein', a.id).localeCompare(label('baustein', b.id)));
}

export function renderGeraete(el, daten, instrument) {
  if (!INSTRUMENTE.includes(instrument)) {
    el.innerHTML = `<div class="karte"><p>${esc(t('nicht_gefunden'))}</p><a class="knopf knopf-sekundaer" href="#/werkzeug/explorer">${esc(t('wz_explorer_titel'))}</a></div>`;
    return;
  }
  const bausteine = geraeteBausteine(daten, instrument);
  const instrumentName = label('domaene', instrument);

  const liste = bausteine.length
    ? `<div class="geraete-liste">${bausteine
        .map(
          (b) => `<a class="karte karte-link geraete-eintrag" href="#/baustein/${esc(b.id)}">
            <span class="geraete-eintrag-icon">${bausteinIcon(b.id) || domaeneIcon(instrument)}</span>
            <span class="geraete-eintrag-text">${esc(label('baustein', b.id))}</span>
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </a>`,
        )
        .join('')}</div>`
    : `<p class="leise">${esc(t('geraete_leer'))}</p>`;

  el.innerHTML = `
    <article>
      <p><a class="chip" href="#/werkzeug/explorer"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_explorer_titel'))}</a></p>
      ${landingHeroHtml(ICON[instrument] || 'fa-microchip', t('geraete_titel', { instrument: instrumentName }), t('geraete_intro', { instrument: instrumentName }), 'pf-teal', null)}
      ${liste}
    </article>`;
}
