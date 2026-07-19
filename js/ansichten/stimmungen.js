// Stimmungs-Werkzeug: interaktive Tuning-Referenz. Kuratierte Metal-Stimmungen
// (data/tunings.json) mit Genre-Landkarte, Saitenstärke-Empfehlung und
// anspielbaren Referenztönen über WebAudio — buildfrei, offline-fähig, keine
// Samples: ein Oszillator mit Hüllkurve genügt als Stimm-Referenz.
//
// Zustand ist flüchtig und gerätelokal (Modul-State wie in der Suche): gewählte
// Stimmung und Instrument-Filter überleben ein Neu-Rendern, aber keinen Reload.

import { label, t, text } from '../i18n.js';
import { domaeneIcon, esc } from '../oberflaeche.js';

let aktivesInstrument = 'gitarre';
let aktiveStimmung = null;
let audioKontext = null;

// Notenname (wissenschaftlich, A4 = 440 Hz) → Frequenz. Unterstützt # und b.
const HALBTON = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function frequenzVon(note) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!m) return null;
  let halbton = HALBTON[m[1]];
  if (m[2] === '#') halbton += 1;
  if (m[2] === 'b') halbton -= 1;
  const oktave = Number(m[3]);
  const abstandZuA4 = halbton - 9 + (oktave - 4) * 12;
  return 440 * 2 ** (abstandZuA4 / 12);
}

// Referenzton: leise, weich, kurz — eine Stimm-Hilfe, kein Instrument.
function spieleTon(frequenz) {
  if (!frequenz) return;
  audioKontext = audioKontext || new (window.AudioContext || window.webkitAudioContext)();
  if (audioKontext.state === 'suspended') audioKontext.resume();
  const jetzt = audioKontext.currentTime;
  const osc = audioKontext.createOscillator();
  const huelle = audioKontext.createGain();
  osc.type = 'triangle';
  osc.frequency.value = frequenz;
  huelle.gain.setValueAtTime(0.0001, jetzt);
  huelle.gain.exponentialRampToValueAtTime(0.14, jetzt + 0.02);
  huelle.gain.exponentialRampToValueAtTime(0.0001, jetzt + 1.6);
  osc.connect(huelle).connect(audioKontext.destination);
  osc.start(jetzt);
  osc.stop(jetzt + 1.7);
}

// Notenanzeige: b als ♭, # als ♯ — die Oktavzahl bleibt Fachschreibweise.
function notenText(note) {
  return note.replace('#', '♯').replace('b', '♭');
}

function stimmungenFuer(daten, instrument) {
  return (daten.stimmungen || []).filter((s) => s.instrument === instrument);
}

function saitenHtml(stimmung) {
  // Tiefste Saite zuerst (Index 0) — gezeichnet von oben (hoch/dünn) nach unten
  // (tief/dick), wie man auf ein liegendes Griffbrett schaut.
  const saiten = [...stimmung.saiten].reverse();
  const dickste = stimmung.saiten.length;
  return saiten
    .map((note, i) => {
      const staerke = 1.5 + ((i + 1) / dickste) * 4.5;
      return `
        <button type="button" class="saite" data-note="${esc(note)}" aria-label="${esc(t('stimm_saite_aria', { note: notenText(note) }))}">
          <span class="saite-note">${esc(notenText(note))}</span>
          <svg viewBox="0 0 200 12" aria-hidden="true" preserveAspectRatio="none"><line x1="4" y1="6" x2="196" y2="6" stroke="currentColor" stroke-width="${staerke.toFixed(1)}" stroke-linecap="round"/></svg>
        </button>`;
    })
    .join('');
}

export function renderStimmungen(el, daten) {
  const werkzeug = daten.tunings || { stimmungen: [] };
  const verfuegbar = stimmungenFuer(werkzeug, aktivesInstrument);
  if (!verfuegbar.some((s) => s.id === aktiveStimmung)) aktiveStimmung = verfuegbar[0]?.id || null;
  const gewaehlt = verfuegbar.find((s) => s.id === aktiveStimmung) || null;

  const instrumentKnoepfe = ['gitarre', 'bass']
    .map(
      (inst) => `
      <button type="button" class="chip chip-waehlbar ${aktivesInstrument === inst ? 'chip-akzent' : ''}" data-instrument="${inst}">
        ${domaeneIcon(inst)} ${esc(label('domaene', inst))}
      </button>`
    )
    .join(' ');

  const stimmungsKnoepfe = verfuegbar
    .map(
      (s) => `
      <button type="button" class="chip chip-waehlbar ${s.id === aktiveStimmung ? 'chip-akzent' : ''}" data-stimmung="${esc(s.id)}">
        ${esc(label('stimmung', s.id))}
      </button>`
    )
    .join(' ');

  const detail = gewaehlt
    ? `
      <section class="stimm-detail" aria-live="polite">
        <h2>${esc(label('stimmung', gewaehlt.id))}</h2>
        <div class="stimm-saiten">${saitenHtml(gewaehlt)}</div>
        <dl class="stimm-fakten">
          <dt>${esc(t('stimm_staerke'))}</dt><dd>${esc(gewaehlt.staerke)}</dd>
          <dt>${esc(t('stimm_genres'))}</dt>
          <dd>${gewaehlt.genres
            .map((g) => `<a class="chip" href="#/pfad/stil/${esc(g)}">${esc(label('stil', g))}</a>`)
            .join(' ')}</dd>
        </dl>
        <p>${esc(text(gewaehlt.hinweis) || '')}</p>
      </section>`
    : '';

  el.innerHTML = `
    <article>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-sliders" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('nav_stimmungen'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('stimm_untertitel'))}</p>
        </div>
      </section>
      <p class="chip-zeile">${instrumentKnoepfe}</p>
      <p class="chip-zeile">${stimmungsKnoepfe}</p>
      ${detail}
      <p class="leise">${esc(t('stimm_hinweis_pegel'))}</p>
    </article>`;

  for (const knopf of el.querySelectorAll('[data-instrument]')) {
    knopf.addEventListener('click', () => {
      aktivesInstrument = knopf.dataset.instrument;
      aktiveStimmung = null;
      renderStimmungen(el, daten);
    });
  }
  for (const knopf of el.querySelectorAll('[data-stimmung]')) {
    knopf.addEventListener('click', () => {
      aktiveStimmung = knopf.dataset.stimmung;
      renderStimmungen(el, daten);
    });
  }
  for (const saite of el.querySelectorAll('.saite')) {
    saite.addEventListener('click', () => spieleTon(frequenzVon(saite.dataset.note)));
  }
}
