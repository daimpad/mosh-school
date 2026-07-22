// Werkzeug: Gefühlslandkarte (Grenzgänger-Zweig). Eine Punktwolke der 13 Genres
// aus data/gefuehlslandkarte.json — x=Energie/Tempo, y=Grundton. Monochrom über
// currentColor. Antippen/Fokussieren eines Genres zeigt seine Gefühls-Tags.
//
// Kein Audio, kein Fortschritt — Referenzbereich wie Stimmungen/Patterns. Der
// Hinweis „Tendenzen, keine Gesetze" (Datenfeld `hinweis`) steht prominent oben.
// Zugänglichkeit: jeder Punkt ist fokussierbar (Tab), trägt ein aria-label und
// eine sichtbare Beschriftung — nicht nur farbliche Kodierung.

import { t } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { landkarteName } from '../genre-namen.js';

// SVG-Maße. Rand lässt Platz für Achsenbeschriftung.
const B = 340;
const H = 260;
const RAND = { l: 28, r: 16, o: 16, u: 30 };

function px(x) {
  return RAND.l + (x / 10) * (B - RAND.l - RAND.r);
}
function py(y) {
  // y invertiert: hoher Grundton = oben.
  return H - RAND.u - (y / 10) * (H - RAND.o - RAND.u);
}

function punkteSvg(genres) {
  const rahmen = `
    <line class="lk-achse" x1="${RAND.l}" y1="${H - RAND.u}" x2="${B - RAND.r}" y2="${H - RAND.u}"></line>
    <line class="lk-achse" x1="${RAND.l}" y1="${RAND.o}" x2="${RAND.l}" y2="${H - RAND.u}"></line>`;
  const punkte = genres
    .map((g, i) => {
      const cx = px(g.x).toFixed(1);
      const cy = py(g.y).toFixed(1);
      const name = landkarteName(g.genre);
      return `<g class="lk-punkt" data-i="${i}" data-genre="${esc(g.genre)}" tabindex="0" role="button"
        aria-label="${esc(t('wz_lk_punkt_aria', { genre: name }))}" aria-pressed="false">
        <circle class="lk-kreis" cx="${cx}" cy="${cy}" r="6"></circle>
        <text class="lk-name" x="${cx}" y="${(Number(cy) - 10).toFixed(1)}" text-anchor="middle">${esc(name)}</text>
      </g>`;
    })
    .join('');
  return `<svg class="lk-svg" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(t('wz_lk_svg_aria'))}">
    ${rahmen}${punkte}</svg>`;
}

// Legende: klickbare Chips für alle 13 Genres. Nötig, weil sich Punkte im
// Karten-Raum überlagern können (z. B. Crust und Black Metal auf derselben
// Koordinate) — die Chips halten jeden Namen lesbar und per Tastatur erreichbar.
function legende(genres) {
  const chips = genres
    .map(
      (g, i) =>
        `<button type="button" class="chip chip-waehlbar lk-legende-chip" data-i="${i}" aria-pressed="false">${esc(landkarteName(g.genre))}</button>`
    )
    .join(' ');
  return `<div class="chip-zeile lk-legende" role="group" aria-label="${esc(t('wz_lk_legende_aria'))}">${chips}</div>`;
}

function tagsPanel(g) {
  if (!g) {
    return `<p class="leise lk-tags-leer">${esc(t('wz_lk_tipp'))}</p>`;
  }
  const chips = (g.tags || []).map((tag) => `<span class="chip lk-tag">${esc(tag)}</span>`).join(' ');
  return `<div class="lk-tags-kopf"><strong>${esc(landkarteName(g.genre))}</strong>
      <span class="leise">${esc(t('wz_lk_koordinate', { x: g.x, y: g.y }))}</span></div>
    <p class="chip-zeile lk-tag-zeile">${chips}</p>`;
}

export function renderWerkzeugLandkarte(el, daten) {
  const lk = daten.gefuehlslandkarte || { genres: [], achsen: {}, hinweis: '' };
  const genres = lk.genres || [];
  const achsen = lk.achsen || {};

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-compass" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_landkarte_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_landkarte_untertitel'))}</p>
        </div>
      </section>

      <p class="lk-hinweis banner-hinweis" role="note">
        <span><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ${esc(lk.hinweis || t('wz_lk_hinweis_fallback'))}</span>
      </p>

      <div class="lk-karte">
        <span class="lk-achse-y leise" aria-hidden="true">${esc(achsen.y || '')}</span>
        ${punkteSvg(genres)}
        <span class="lk-achse-x leise" aria-hidden="true">${esc(achsen.x || '')}</span>
      </div>

      ${legende(genres)}

      <div class="lk-tags" role="status" aria-live="polite">${tagsPanel(null)}</div>

      <p class="chip-zeile lk-fuss">
        <a class="chip chip-waehlbar" href="#/werkzeug/genremix"><i class="fa-solid fa-right-left" aria-hidden="true"></i> ${esc(t('wz_lk_zum_generator'))}</a>
      </p>
      <p class="leise wz-metro-fuss">${esc(t('wz_landkarte_fuss'))}</p>
    </article>`;

  verdrahte(el, genres);
}

function verdrahte(el, genres) {
  const panel = el.querySelector('.lk-tags');
  const punkte = [...el.querySelectorAll('.lk-punkt')];
  const chips = [...el.querySelectorAll('.lk-legende-chip')];
  const waehle = (i) => {
    const g = genres[i];
    if (panel) panel.innerHTML = tagsPanel(g);
    for (const p of punkte) {
      const an = Number(p.dataset.i) === i;
      p.classList.toggle('aktiv', an);
      p.setAttribute('aria-pressed', String(an));
    }
    for (const c of chips) {
      const an = Number(c.dataset.i) === i;
      c.classList.toggle('chip-akzent', an);
      c.setAttribute('aria-pressed', String(an));
    }
  };
  for (const p of punkte) {
    const i = Number(p.dataset.i);
    p.addEventListener('click', () => waehle(i));
    p.addEventListener('focus', () => waehle(i));
    p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        waehle(i);
      }
    });
  }
  for (const c of chips) {
    c.addEventListener('click', () => waehle(Number(c.dataset.i)));
  }
}
