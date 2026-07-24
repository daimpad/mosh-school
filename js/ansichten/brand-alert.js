// Brand Alert: der einzige markierte Ausnahmebereich der App, an dem Modellnamen
// genannt werden. Klang entsteht sonst aus Bauteilen und Physik — hier steht die
// historische Einordnung weniger Geräte, deren Name zum Verständnis eines
// Genre-Klangs nötig ist. Referenzbereich wie Songs/Patterns: NICHT im
// Baustein-Pool, kein Fortschritt.
//
// Rahmung (nicht abschwächen): keine Werbung/Kaufempfehlung, keine Preise/Links/
// Bewertungen; das `alternative`-Feld jedes Eintrags wird GLEICHWERTIG dargestellt
// (bezahlbares Equipment existiert). Der einleitende Baustein `brand_alert` steht
// vor der Liste, der `hinweis` sichtbar oben.

import { label, t } from '../i18n.js';
import { bausteinIcon, esc } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

const INTRO_BAUSTEIN = 'brand_alert';

// Ein Eintrag: Bezeichnung + „warum" + „einordnung", darunter die gleichrangig
// gesetzte bezahlbare Alternative (eigener Block, nicht kleingedruckt).
function eintragKarte(e) {
  return `
    <li class="ba-eintrag">
      <h3 class="ba-eintrag-titel">${esc(e.bezeichnung)}</h3>
      ${e.warum ? `<p class="ba-warum">${esc(e.warum)}</p>` : ''}
      ${e.einordnung ? `<p class="ba-einordnung">${esc(e.einordnung)}</p>` : ''}
      ${
        e.alternative
          ? `<p class="ba-alternative"><span class="ba-alternative-label">${esc(t('ba_alternative_label'))}</span> ${esc(e.alternative)}</p>`
          : ''
      }
    </li>`;
}

// Nach Kategorie gruppiert (Reihenfolge aus dem Datenfeld `kategorien`, damit die
// deklarierte Ordnung führt; unbekannte Kategorien hängen hinten an).
function kategorieAbschnitt(kategorie, eintraege) {
  return `
    <section class="ba-kategorie" aria-label="${esc(kategorie)}">
      <h2 class="ba-kategorie-titel">${esc(kategorie)}</h2>
      <ul class="ba-liste">${eintraege.map(eintragKarte).join('')}</ul>
    </section>`;
}

export function renderBrandAlert(el, daten) {
  const ba = daten.brandAlert || {};
  const eintraege = ba.eintraege || [];
  if (eintraege.length === 0) {
    el.innerHTML = `<article><p class="leise">${esc(t('ba_leer'))}</p></article>`;
    return;
  }

  // Reihenfolge: deklarierte Kategorien zuerst, dann evtl. übrige.
  const reihenfolge = [...(ba.kategorien || [])];
  for (const e of eintraege) if (!reihenfolge.includes(e.kategorie)) reihenfolge.push(e.kategorie);
  const gruppen = reihenfolge
    .map((k) => [k, eintraege.filter((e) => e.kategorie === k)])
    .filter(([, es]) => es.length > 0);

  // Einleitender Baustein (steht vor der Liste, als anklickbarer Link).
  const introTitel = label('baustein', INTRO_BAUSTEIN);
  const introVorhanden = daten.bausteinNach?.has?.(INTRO_BAUSTEIN) ?? daten.bausteine?.some((b) => b.id === INTRO_BAUSTEIN);
  const introHtml = introVorhanden
    ? `<a class="karte karte-link geraete-eintrag ba-intro" href="#/baustein/${esc(INTRO_BAUSTEIN)}?kontext=kompetenz">
        <span class="geraete-eintrag-icon">${bausteinIcon(INTRO_BAUSTEIN) || '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>'}</span>
        <span class="geraete-eintrag-text">${esc(introTitel)}</span>
        <i class="fa-solid fa-arrow-right geraete-eintrag-pfeil" aria-hidden="true"></i>
      </a>`
    : '';

  el.innerHTML = `
    <article class="ba-seite">
      ${landingHeroHtml('fa-triangle-exclamation', t('ba_titel'), t('ba_untertitel'), 'pf-magenta')}

      ${ba.hinweis ? `<p class="ba-hinweis">${esc(ba.hinweis)}</p>` : ''}
      ${introHtml}

      <div class="ba-gruppen">${gruppen.map(([k, es]) => kategorieAbschnitt(k, es)).join('')}</div>
    </article>`;
}
