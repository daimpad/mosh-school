// Powerchord-Griffe: grafische Griffbild-Referenz der wichtigsten Powerchord-
// Formen. Referenzbereich wie Stimmungen/Patterns — NICHT im Baustein-Pool,
// kein Fortschritt. Die Griffbilder werden deterministisch aus den Griff-Daten
// (data/griffe.json) gezeichnet: ein Chord-Box-Diagramm je Form.

import { t, text } from '../i18n.js';
import { domaeneIcon, esc } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

// Chord-Box-Griffbild: 6 Saiten als Spalten (links = tiefe E-Saite, 6. Saite),
// N Bünde als Zeilen. × über der Saite = stumm, Kreis über dem Sattel = leer,
// gefüllter Punkt = gegriffen (R markiert den Grundton). currentColor + Tokens,
// wirkt nur inline (wie die übrigen Grafiken).
function griffbild(griff) {
  const saiten = griff.saiten || [];
  const baende = griff.baende || 4;
  const B = 26; // Saitenabstand
  const H = 26; // Bundabstand
  const links = 18;
  const oben = 26;
  const breite = links * 2 + B * 5; // 6 Saiten = 5 Zwischenräume
  const hoehe = oben + H * baende + 10;
  const sx = (i) => links + i * B;
  const fy = (bund) => oben + (bund - 0.5) * H;

  let el = '';
  // Bundlinien (die oberste dick = Sattel).
  for (let b = 0; b <= baende; b++) {
    const y = oben + b * H;
    el += `<line x1="${sx(0)}" y1="${y}" x2="${sx(5)}" y2="${y}" stroke-width="${b === 0 ? 3.4 : 1.3}"/>`;
  }
  // Saitenlinien.
  for (let i = 0; i < 6; i++) {
    el += `<line x1="${sx(i)}" y1="${oben}" x2="${sx(i)}" y2="${oben + baende * H}" stroke-width="1.3"/>`;
  }
  // Marker über dem Sattel + gegriffene Punkte.
  saiten.forEach((s, i) => {
    const x = sx(i);
    if (s.status === 'stumm') {
      el += `<text x="${x}" y="${oben - 7}" class="griff-x" text-anchor="middle" dominant-baseline="middle">×</text>`;
    } else if (s.status === 'offen' || s.status === 'leer') {
      el += `<circle cx="${x}" cy="${oben - 11}" r="4.5" fill="none" stroke-width="1.5"/>`;
    } else {
      const y = fy(s.bund || 1);
      const grund = s.status === 'grundton';
      el += `<circle cx="${x}" cy="${y}" r="9" class="${grund ? 'griff-grundton' : 'griff-ton'}"/>`;
      if (grund) el += `<text x="${x}" y="${y}" class="griff-r" text-anchor="middle" dominant-baseline="central">R</text>`;
    }
  });
  return `<svg class="griff-svg" viewBox="0 0 ${breite} ${hoehe}" role="img" aria-label="${esc(text(griff.name))}">${el}</svg>`;
}

function griffKarte(gr) {
  const chips = [
    gr.toene ? `<span class="chip">${esc(text(gr.toene))}</span>` : '',
    gr.stimmung ? `<span class="chip">${esc(text(gr.stimmung))}</span>` : '',
    gr.beweglich ? `<span class="chip">${esc(t('griffe_beweglich'))}</span>` : '',
  ].join(' ');
  return `
    <article class="griff-karte karte">
      <div class="griff-bild">${griffbild(gr)}</div>
      <div class="griff-info">
        <h2 class="griff-name">${esc(text(gr.name))}</h2>
        ${chips.trim() ? `<p class="chip-zeile griff-chips">${chips}</p>` : ''}
        <p class="griff-kurz">${esc(text(gr.kurz))}</p>
      </div>
    </article>`;
}

// Anzeigereihenfolge der Kategorien; die Überschrift kommt aus den Labels
// (t('griffe_kat_<key>')). Griffe ohne bekannte Kategorie landen unter „sonstige".
const KATEGORIEN = ['powerchord', 'barre', 'oktave', 'offen'];

export function renderGriffe(el, daten) {
  const g = daten.griffe || {};
  const griffe = g.griffe || [];
  if (griffe.length === 0) {
    el.innerHTML = `<article><p class="leise">${esc(t('griffe_leer'))}</p></article>`;
    return;
  }
  // Nach Kategorie gruppieren (Reihenfolge = KATEGORIEN, Unbekanntes ans Ende).
  const reihenfolge = [...KATEGORIEN];
  for (const gr of griffe) {
    const k = gr.kategorie || 'sonstige';
    if (!reihenfolge.includes(k)) reihenfolge.push(k);
  }
  const gruppen = reihenfolge
    .map((k) => {
      const eintraege = griffe.filter((gr) => (gr.kategorie || 'sonstige') === k);
      if (eintraege.length === 0) return '';
      return `
        <section class="griff-gruppe">
          <h2 class="griff-gruppe-titel">${esc(t('griffe_kat_' + k))}</h2>
          <div class="griff-gitter">${eintraege.map(griffKarte).join('')}</div>
        </section>`;
    })
    .join('');
  el.innerHTML = `
    <article class="griffe-seite">
      ${landingHeroHtml('', t('griffe_titel'), t('griffe_untertitel'), 'pf-magenta', 'griffe', '', domaeneIcon('gitarre'))}
      ${g.hinweis ? `<p class="griffe-hinweis leise">${esc(g.hinweis)}</p>` : ''}
      ${gruppen}
    </article>`;
}
