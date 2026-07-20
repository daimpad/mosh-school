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

// Intervall/Akkord: mehrere Töne über einem Grundton gleichzeitig — so wird der
// Klangcharakter (etwa die Reibung des Tritonus) hörbar. Grundton tiefes E (E2),
// der klassische Metal-Bezugston. Halbtöne sind Offsets zum Grundton.
function spieleAkkord(halbtoene, grundton = 'E2') {
  const basis = frequenzVon(grundton);
  if (!basis) return;
  audioKontext = audioKontext || new (window.AudioContext || window.webkitAudioContext)();
  if (audioKontext.state === 'suspended') audioKontext.resume();
  const jetzt = audioKontext.currentTime;
  const summe = audioKontext.createGain();
  // Gesamtpegel auf die Stimmenzahl normieren, damit ein Akkord nicht übersteuert.
  const pegel = 0.13 / Math.max(1, halbtoene.length);
  summe.gain.setValueAtTime(0.0001, jetzt);
  summe.gain.exponentialRampToValueAtTime(pegel, jetzt + 0.02);
  summe.gain.exponentialRampToValueAtTime(0.0001, jetzt + 1.9);
  summe.connect(audioKontext.destination);
  for (const h of halbtoene) {
    const osc = audioKontext.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = basis * 2 ** (h / 12);
    osc.connect(summe);
    osc.start(jetzt);
    osc.stop(jetzt + 2);
  }
}

// Skala/Modus: dieselben Halbton-Offsets nacheinander aufwärts — so wird der
// melodische Charakter (etwa der finstere Halbton-Auftakt von Phrygisch) hörbar.
function spieleSequenz(halbtoene, grundton = 'E2') {
  const basis = frequenzVon(grundton);
  if (!basis) return;
  audioKontext = audioKontext || new (window.AudioContext || window.webkitAudioContext)();
  if (audioKontext.state === 'suspended') audioKontext.resume();
  const start = audioKontext.currentTime;
  const dauer = 0.22;
  halbtoene.forEach((h, i) => {
    const t0 = start + i * dauer;
    const osc = audioKontext.createOscillator();
    const huelle = audioKontext.createGain();
    osc.type = 'triangle';
    osc.frequency.value = basis * 2 ** (h / 12);
    huelle.gain.setValueAtTime(0.0001, t0);
    huelle.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    huelle.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer * 0.95);
    osc.connect(huelle).connect(audioKontext.destination);
    osc.start(t0);
    osc.stop(t0 + dauer);
  });
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
      <button type="button" class="chip chip-waehlbar ${aktivesInstrument === inst ? 'chip-akzent' : ''}" data-instrument="${inst}" aria-pressed="${aktivesInstrument === inst}">
        ${domaeneIcon(inst)} ${esc(label('domaene', inst))}
      </button>`
    )
    .join(' ');

  const stimmungsKnoepfe = verfuegbar
    .map(
      (s) => `
      <button type="button" class="chip chip-waehlbar ${s.id === aktiveStimmung ? 'chip-akzent' : ''}" data-stimmung="${esc(s.id)}" aria-pressed="${s.id === aktiveStimmung}">
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

  // art bestimmt Label-Gruppe + aria-Text; spielart entscheidet die Wiedergabe
  // (akkord = gleichzeitig, sequenz = aufwärts).
  const ARIA = { intervall: 'klang_intervall_aria', akkord: 'klang_akkord_aria', skala: 'klang_skala_aria' };
  const klangKnopf = (art, spielart, eintrag) => `
    <button type="button" class="chip chip-waehlbar klang-knopf" data-spielart="${spielart}" data-halbtoene="${eintrag.halbtoene.join(',')}"
      data-hinweis="${esc(text(eintrag.hinweis) || '')}"
      aria-label="${esc(t(ARIA[art], { name: label(art, eintrag.id) }))}">
      <i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(label(art, eintrag.id))}
    </button>`;
  const intervalle = werkzeug.intervalle || [];
  const akkorde = werkzeug.akkorde || [];
  const skalen = werkzeug.skalen || [];
  const klangSektion = intervalle.length || akkorde.length || skalen.length
    ? `
      <section class="klang-werkzeug">
        <h2>${esc(t('klang_titel'))}</h2>
        <p class="marke-hero-untertitel">${esc(t('klang_untertitel'))}</p>
        <h3>${esc(t('klang_intervalle'))}</h3>
        <p class="chip-zeile">${intervalle.map((e) => klangKnopf('intervall', 'akkord', e)).join(' ')}</p>
        <h3>${esc(t('klang_akkorde'))}</h3>
        <p class="chip-zeile">${akkorde.map((e) => klangKnopf('akkord', 'akkord', e)).join(' ')}</p>
        <h3>${esc(t('klang_skalen'))}</h3>
        <p class="chip-zeile">${skalen.map((e) => klangKnopf('skala', 'sequenz', e)).join(' ')}</p>
        <p class="klang-hinweis leise" aria-live="polite"></p>
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
      ${klangSektion}
      <p class="leise">${esc(t('stimm_hinweis_pegel'))}</p>
    </article>`;

  for (const knopf of el.querySelectorAll('[data-instrument]')) {
    knopf.addEventListener('click', () => {
      aktivesInstrument = knopf.dataset.instrument;
      aktiveStimmung = null;
      renderStimmungen(el, daten);
      // Fokus nach dem Neu-Rendern auf den nun aktiven Chip zurückholen.
      el.querySelector(`[data-instrument="${CSS.escape(aktivesInstrument)}"]`)?.focus();
    });
  }
  for (const knopf of el.querySelectorAll('[data-stimmung]')) {
    knopf.addEventListener('click', () => {
      aktiveStimmung = knopf.dataset.stimmung;
      renderStimmungen(el, daten);
      el.querySelector(`[data-stimmung="${CSS.escape(aktiveStimmung)}"]`)?.focus();
    });
  }
  for (const saite of el.querySelectorAll('.saite')) {
    saite.addEventListener('click', () => spieleTon(frequenzVon(saite.dataset.note)));
  }
  const hinweisFeld = el.querySelector('.klang-hinweis');
  for (const knopf of el.querySelectorAll('.klang-knopf')) {
    knopf.addEventListener('click', () => {
      const halbtoene = knopf.dataset.halbtoene.split(',').map(Number);
      if (knopf.dataset.spielart === 'sequenz') spieleSequenz(halbtoene);
      else spieleAkkord(halbtoene);
      if (hinweisFeld) hinweisFeld.textContent = knopf.dataset.hinweis;
    });
  }
}
