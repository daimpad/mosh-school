// Werkzeug: Genre-Mix-Zufallsgenerator (Grenzgänger-Zweig). Stößt Ideen an, baut
// keine fertigen Songs. Zieht aus der Gefühlslandkarte ein Genre-Paar (optional
// Trio) — im Serendipitäts-Modus gewichtet nach Score (ferne, seltene Paare
// häufiger), im gezielten Modus zu einem gewählten Zielgefühl. Gibt die
// kontrastierenden Merkmale, die verbindende Gefühlslinie und einen Kreativ-Prompt
// aus und visualisiert das Paar auf einer Mini-Landkarte mit Spannungslinie.
//
// Kein Audio, kein Fortschritt — Referenzbereich. Koppelt an Klick/Loops zum
// Ausprobieren und an den Riff-Recorder zum Festhalten (→ Kreativ-Meilenstein).

import { t } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { landkarteName } from '../genre-namen.js';
import { holeZiele, setzeZiel } from '../zustand.js';
import {
  alleTags,
  atmoSchluessel,
  distanz,
  drittesGenre,
  gemeinsamesGefuehl,
  paarFuerTag,
  tempoSchluessel,
  ziehePaarGewichtet,
} from '../genre-mix.js';

const zustand = {
  modus: 'serendipitaet', // | 'gezielt'
  zielTag: null,
  trio: false,
  vorbelegt: null, // { a, b } aus der URL (Übung zwei_genres_ein_riff)
  ergebnis: null, // { a, b, c? }
};

// --- Mini-Landkarte (kompakt, mit Spannungslinie zwischen den Punkten) ---
const B = 300;
const H = 200;
const RAND = { l: 22, r: 14, o: 14, u: 24 };
const mx = (x) => RAND.l + (x / 10) * (B - RAND.l - RAND.r);
const my = (y) => H - RAND.u - (y / 10) * (H - RAND.o - RAND.u);

function miniKarte(genres, gewaehlt) {
  const idSet = new Set(gewaehlt.map((g) => g.genre));
  const linien = [];
  for (let i = 0; i < gewaehlt.length; i++) {
    for (let j = i + 1; j < gewaehlt.length; j++) {
      linien.push(
        `<line class="gm-spannung" x1="${mx(gewaehlt[i].x).toFixed(1)}" y1="${my(gewaehlt[i].y).toFixed(1)}" x2="${mx(gewaehlt[j].x).toFixed(1)}" y2="${my(gewaehlt[j].y).toFixed(1)}"></line>`
      );
    }
  }
  const punkte = genres
    .map((g) => {
      const an = idSet.has(g.genre);
      const cx = mx(g.x).toFixed(1);
      const cy = my(g.y).toFixed(1);
      const name = an ? `<text class="gm-name" x="${cx}" y="${(Number(cy) - 9).toFixed(1)}" text-anchor="middle">${esc(landkarteName(g.genre))}</text>` : '';
      return `<g class="gm-punkt ${an ? 'aktiv' : 'blass'}"><circle cx="${cx}" cy="${cy}" r="${an ? 6 : 3}"></circle>${name}</g>`;
    })
    .join('');
  return `<svg class="gm-svg" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(t('wz_gm_svg_aria'))}">
    ${linien.join('')}${punkte}</svg>`;
}

// --- Ergebnis in Text gießen ---
function ergebnisHtml(res) {
  const { a, b } = res;
  const tempoGeber = a.x >= b.x ? a : b;
  const atmoGeber = tempoGeber === a ? b : a;
  const gef = gemeinsamesGefuehl(a, b);
  const linie = gef.linie || t('wz_gm_linie_kontrast');
  const spannung = distanz(a, b);
  const spannungWort =
    spannung >= 7 ? t('wz_gm_spannung_hoch') : spannung >= 4 ? t('wz_gm_spannung_mittel') : t('wz_gm_spannung_nah');

  const prompt = t('wz_gm_prompt', {
    tempoGeber: landkarteName(tempoGeber.genre),
    tempo: t(tempoSchluessel(tempoGeber)),
    atmoGeber: landkarteName(atmoGeber.genre),
    atmo: t(atmoSchluessel(atmoGeber)),
    linie,
  });
  const bogen = t('wz_gm_arc', { a: landkarteName(a.genre), b: landkarteName(b.genre) });

  const tagChips = (g) =>
    (g.tags || []).map((tag) => `<span class="chip gm-tag">${esc(tag)}</span>`).join(' ');

  const trioZeile = res.c
    ? `<p class="gm-trio"><i class="fa-solid fa-users" aria-hidden="true"></i> ${esc(t('wz_gm_plus_trio', { genre: landkarteName(res.c.genre) }))}</p>`
    : '';

  // Recorder-Deep-Link mit Kreativ-Kennung (→ Meilenstein „Fusions-Riff").
  const mix = `${a.genre}-${b.genre}`;

  return `
    <div class="gm-ergebnis">
      <div class="gm-paar">
        <span class="gm-genre">${esc(landkarteName(a.genre))}</span>
        <span class="gm-mal" aria-hidden="true">×</span>
        <span class="gm-genre">${esc(landkarteName(b.genre))}</span>
      </div>
      ${trioZeile}
      <p class="gm-spannung-zeile leise">${esc(spannungWort)}</p>

      <div class="gm-merkmale">
        <div class="gm-merkmal">
          <span class="gm-merkmal-titel leise">${esc(landkarteName(a.genre))}</span>
          <span class="chip-zeile">${tagChips(a)}</span>
        </div>
        <div class="gm-merkmal">
          <span class="gm-merkmal-titel leise">${esc(landkarteName(b.genre))}</span>
          <span class="chip-zeile">${tagChips(b)}</span>
        </div>
      </div>

      <p class="gm-linie"><strong>${esc(t('wz_gm_linie_titel'))}:</strong> ${esc(linie)}</p>

      <blockquote class="gm-prompt">${esc(prompt)}</blockquote>
      <p class="gm-bogen leise">${esc(bogen)}</p>

      ${miniKarte(res.alle, res.c ? [a, b, res.c] : [a, b])}

      <p class="chip-zeile gm-anbindung">
        <a class="chip chip-waehlbar" href="#/werkzeug/metronom?bpm=160"><i class="fa-solid fa-stopwatch" aria-hidden="true"></i> ${esc(t('wz_gm_zum_klick'))}</a>
        <a class="chip chip-waehlbar" href="#/werkzeug/loops"><i class="fa-solid fa-repeat" aria-hidden="true"></i> ${esc(t('wz_gm_zu_loops'))}</a>
        <a class="chip chip-akzent" href="#/werkzeug/recorder?kreativ=1&mix=${encodeURIComponent(mix)}"><i class="fa-solid fa-bolt" aria-hidden="true"></i> ${esc(t('wz_gm_zum_recorder'))}</a>
      </p>
    </div>`;
}

function wuerfle(genres) {
  if (zustand.modus === 'gezielt' && zustand.zielTag) {
    zustand.ergebnis = paarFuerTag(genres, zustand.zielTag);
  } else {
    zustand.ergebnis = ziehePaarGewichtet(genres);
  }
  if (zustand.ergebnis) {
    zustand.ergebnis.alle = genres;
    if (zustand.trio) zustand.ergebnis.c = drittesGenre(genres, zustand.ergebnis.a, zustand.ergebnis.b);
  }
}

function wendePresetAn(genres, query) {
  if (!query) return;
  const a = query.get('a');
  const b = query.get('b');
  if (a && b) {
    const ga = genres.find((g) => g.genre === a);
    const gb = genres.find((g) => g.genre === b);
    if (ga && gb && ga !== gb) {
      zustand.vorbelegt = { a: ga, b: gb };
      zustand.ergebnis = { a: ga, b: gb, alle: genres };
    }
  }
  const tag = query.get('gefuehl');
  if (tag) {
    zustand.modus = 'gezielt';
    zustand.zielTag = tag;
  }
}

export function renderWerkzeugGenremix(el, daten, query) {
  const lk = daten.gefuehlslandkarte || { genres: [], hinweis: '' };
  const genres = lk.genres || [];
  wendePresetAn(genres, query);

  const tags = alleTags(genres);
  const zielOptionen = [`<option value="">${esc(t('wz_gm_ziel_bitte'))}</option>`]
    .concat(tags.map((tag) => `<option value="${esc(tag)}" ${tag === zustand.zielTag ? 'selected' : ''}>${esc(tag)}</option>`))
    .join('');

  const zielGesetzt = holeZiele().some((z) => z.art === 'kreativ' && z.wert === 'genre_mix');

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-right-left" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_genremix_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_genremix_untertitel'))}</p>
        </div>
      </section>

      <p class="lk-hinweis banner-hinweis" role="note">
        <span><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ${esc(lk.hinweis || t('wz_lk_hinweis_fallback'))}</span>
      </p>

      <div class="gm-steuerung">
        <div class="gm-modus" role="group" aria-label="${esc(t('wz_gm_modus'))}">
          <button type="button" class="chip chip-waehlbar gm-modus-knopf ${zustand.modus === 'serendipitaet' ? 'chip-akzent' : ''}" data-modus="serendipitaet" aria-pressed="${zustand.modus === 'serendipitaet'}">
            <i class="fa-solid fa-arrows-spin" aria-hidden="true"></i> ${esc(t('wz_gm_modus_serendipitaet'))}
          </button>
          <button type="button" class="chip chip-waehlbar gm-modus-knopf ${zustand.modus === 'gezielt' ? 'chip-akzent' : ''}" data-modus="gezielt" aria-pressed="${zustand.modus === 'gezielt'}">
            <i class="fa-solid fa-bullseye" aria-hidden="true"></i> ${esc(t('wz_gm_modus_gezielt'))}
          </button>
        </div>

        <label class="gm-ziel-feld ${zustand.modus === 'gezielt' ? '' : 'gm-verborgen'}">
          <span class="wz-feld-titel">${esc(t('wz_gm_zielgefuehl'))}</span>
          <select class="gm-ziel-select">${zielOptionen}</select>
        </label>

        <label class="gm-trio-feld">
          <input type="checkbox" class="gm-trio" ${zustand.trio ? 'checked' : ''}>
          ${esc(t('wz_gm_trio'))}
        </label>

        <button type="button" class="knopf knopf-primaer gm-wuerfeln">
          <i class="fa-solid fa-arrows-spin" aria-hidden="true"></i> ${esc(t('wz_gm_wuerfeln'))}
        </button>
      </div>

      <div class="gm-ausgabe" role="status" aria-live="polite">${zustand.ergebnis ? ergebnisHtml(zustand.ergebnis) : `<p class="leise gm-leer">${esc(t('wz_gm_leer'))}</p>`}</div>

      <div class="gm-ziel-block">
        <button type="button" class="chip chip-waehlbar gm-kreativ-ziel" ${zielGesetzt ? 'aria-pressed="true"' : ''}>
          <i class="fa-solid fa-${zielGesetzt ? 'check' : 'star'}" aria-hidden="true"></i>
          <span class="gm-kreativ-text">${esc(zielGesetzt ? t('wz_gm_ziel_gesetzt') : t('wz_gm_ziel_setzen'))}</span>
        </button>
      </div>

      <p class="chip-zeile">
        <a class="chip chip-waehlbar" href="#/werkzeug/landkarte"><i class="fa-solid fa-compass" aria-hidden="true"></i> ${esc(t('wz_gm_zur_karte'))}</a>
      </p>
      <p class="leise wz-metro-fuss">${esc(t('wz_genremix_fuss'))}</p>
    </article>`;

  verdrahte(el, daten, genres);
}

function verdrahte(el, daten, genres) {
  const ausgabe = el.querySelector('.gm-ausgabe');
  const zielFeld = el.querySelector('.gm-ziel-feld');

  const zeichneErgebnis = () => {
    if (ausgabe) ausgabe.innerHTML = zustand.ergebnis ? ergebnisHtml(zustand.ergebnis) : `<p class="leise gm-leer">${esc(t('wz_gm_leer'))}</p>`;
  };

  for (const knopf of el.querySelectorAll('.gm-modus-knopf')) {
    knopf.addEventListener('click', () => {
      zustand.modus = knopf.dataset.modus;
      for (const k of el.querySelectorAll('.gm-modus-knopf')) {
        const an = k.dataset.modus === zustand.modus;
        k.classList.toggle('chip-akzent', an);
        k.setAttribute('aria-pressed', String(an));
      }
      if (zielFeld) zielFeld.classList.toggle('gm-verborgen', zustand.modus !== 'gezielt');
    });
  }

  el.querySelector('.gm-ziel-select')?.addEventListener('change', (e) => {
    zustand.zielTag = e.target.value || null;
  });

  el.querySelector('.gm-trio')?.addEventListener('change', (e) => {
    zustand.trio = e.target.checked;
    if (zustand.ergebnis) {
      zustand.ergebnis.c = zustand.trio ? drittesGenre(genres, zustand.ergebnis.a, zustand.ergebnis.b) : undefined;
      zeichneErgebnis();
    }
  });

  el.querySelector('.gm-wuerfeln')?.addEventListener('click', () => {
    wuerfle(genres);
    zeichneErgebnis();
  });

  const zielKnopf = el.querySelector('.gm-kreativ-ziel');
  zielKnopf?.addEventListener('click', () => {
    setzeZiel('kreativ', 'genre_mix');
    zielKnopf.setAttribute('aria-pressed', 'true');
    zielKnopf.querySelector('.gm-kreativ-text').textContent = t('wz_gm_ziel_gesetzt');
    const icon = zielKnopf.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-check';
  });
}
