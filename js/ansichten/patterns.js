// Pattern-Werkzeug: interaktive Referenz typischer Riffs (TAB) und Drumpattern
// pro Genre. Buildfrei, offline-fähig, keine Samples — Gitarrentöne als Oszillator
// mit Hüllkurve, Drums synthetisch (Kick = fallende Sinus, Snare/Hi-Hat/China =
// gefiltertes Rauschen). Referenzbereich wie das Stimmungs-Werkzeug: NICHT im
// Baustein-Pool, kein Fortschritt.
//
// Zustand ist flüchtig und gerätelokal (Modul-State wie in der Suche): das gewählte
// Genre überlebt ein Neu-Rendern, aber keinen Reload.

import { label, t, text } from '../i18n.js';
import { domaeneIcon, esc } from '../oberflaeche.js';
import { frequenzVon } from './stimmungen.js';

let aktivesGenre = null;
let audioKontext = null;
let rauschPuffer = null;
let laufTimer = [];

function holeKontext() {
  audioKontext = audioKontext || new (window.AudioContext || window.webkitAudioContext)();
  if (audioKontext.state === 'suspended') audioKontext.resume();
  return audioKontext;
}

// Ein Sekunde weißes Rauschen, einmal erzeugt — Basis für Snare/Hi-Hat/China.
function holeRauschen(ctx) {
  if (rauschPuffer) return rauschPuffer;
  const puffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const daten = puffer.getChannelData(0);
  for (let i = 0; i < daten.length; i++) daten[i] = Math.random() * 2 - 1;
  rauschPuffer = puffer;
  return puffer;
}

// --- Gitarrenton: weicher Dreieck-Oszillator, leicht überlappend gehalten. ---
function spieleNote(ctx, frequenz, t0, dauer, pegel) {
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = frequenz;
  huelle.gain.setValueAtTime(0.0001, t0);
  huelle.gain.exponentialRampToValueAtTime(pegel, t0 + 0.008);
  huelle.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer * 1.5);
  osc.connect(huelle).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dauer * 1.6);
}

// --- Drum-Stimmen (synthetisch) ---
function kick(ctx, t0) {
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(125, t0);
  osc.frequency.exponentialRampToValueAtTime(46, t0 + 0.11);
  huelle.gain.setValueAtTime(0.9, t0);
  huelle.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  osc.connect(huelle).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.18);
}

function rauschStimme(ctx, t0, { typ, frequenz, guete, dauer, pegel }) {
  const quelle = ctx.createBufferSource();
  quelle.buffer = holeRauschen(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = typ;
  filter.frequency.value = frequenz;
  if (guete) filter.Q.value = guete;
  const huelle = ctx.createGain();
  huelle.gain.setValueAtTime(pegel, t0);
  huelle.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
  quelle.connect(filter).connect(huelle).connect(ctx.destination);
  quelle.start(t0);
  quelle.stop(t0 + dauer + 0.02);
}

function snare(ctx, t0) {
  rauschStimme(ctx, t0, { typ: 'highpass', frequenz: 1400, dauer: 0.19, pegel: 0.5 });
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 190;
  huelle.gain.setValueAtTime(0.3, t0);
  huelle.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  osc.connect(huelle).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.14);
}

function hihat(ctx, t0) {
  rauschStimme(ctx, t0, { typ: 'highpass', frequenz: 8000, dauer: 0.05, pegel: 0.22 });
}

function crash(ctx, t0) {
  rauschStimme(ctx, t0, { typ: 'highpass', frequenz: 5200, dauer: 0.45, pegel: 0.3 });
}

const DRUM_STIMME = { kick, snare, hihat, crash };
// Anzeigereihenfolge oben→unten und Symbol je Spur (Beat-Raster-Konvention).
const SPUR_ORDNUNG = ['crash', 'hihat', 'snare', 'kick'];

function schrittDauer(pattern) {
  return 30 / pattern.bpm; // eine Achtel in Sekunden
}

function stoppeLauf() {
  laufTimer.forEach((id) => clearTimeout(id));
  laufTimer = [];
}

// Markiert die laufende Spalte im Raster mit; rein visuell, an die Audio-Zeit
// gekoppelt. Bei erneutem Start werden alte Timer verworfen.
function markiereLauf(karte, ctx, start, step, anzahl) {
  stoppeLauf();
  for (const zelle of karte.querySelectorAll('.schritt-aktiv')) zelle.classList.remove('schritt-aktiv');
  for (let i = 0; i < anzahl; i++) {
    const verzoegerung = Math.max(0, (start + i * step - ctx.currentTime) * 1000);
    laufTimer.push(
      setTimeout(() => {
        for (const zelle of karte.querySelectorAll('.schritt-aktiv')) zelle.classList.remove('schritt-aktiv');
        for (const zelle of karte.querySelectorAll(`[data-schritt="${i}"]`)) zelle.classList.add('schritt-aktiv');
      }, verzoegerung)
    );
  }
  const ende = Math.max(0, (start + anzahl * step - ctx.currentTime) * 1000);
  laufTimer.push(
    setTimeout(() => {
      for (const zelle of karte.querySelectorAll('.schritt-aktiv')) zelle.classList.remove('schritt-aktiv');
    }, ende)
  );
}

function spieleTab(pattern, karte) {
  const ctx = holeKontext();
  const step = schrittDauer(pattern);
  const start = ctx.currentTime + 0.07;
  pattern.schritte.forEach((schritt, i) => {
    const t0 = start + i * step;
    const pegel = 0.16 / Math.max(1, schritt.length);
    for (const { saite, bund } of schritt) {
      const offen = frequenzVon(pattern.stimmung[saite]);
      if (offen) spieleNote(ctx, offen * 2 ** (bund / 12), t0, step, pegel);
    }
  });
  markiereLauf(karte, ctx, start, step, pattern.schritte.length);
}

function spieleDrums(pattern, karte) {
  const ctx = holeKontext();
  const step = schrittDauer(pattern);
  const start = ctx.currentTime + 0.07;
  const anzahl = Math.max(...SPUR_ORDNUNG.map((s) => pattern.spuren[s]?.length || 0));
  for (let i = 0; i < anzahl; i++) {
    const t0 = start + i * step;
    for (const spur of SPUR_ORDNUNG) {
      if (pattern.spuren[spur]?.[i]) DRUM_STIMME[spur](ctx, t0);
    }
  }
  markiereLauf(karte, ctx, start, step, anzahl);
}

// --- Rendern ---
function tabRasterHtml(pattern) {
  // Saiten von hoch (oben) nach tief (unten) — wie klassische TAB-Notation.
  const zeilen = [...pattern.stimmung.keys()].reverse();
  const kopf = pattern.stimmung
    .map((note) => note.replace('#', '♯').replace('b', '♭').replace(/-?\d/, ''))
    .reverse();
  const reihen = zeilen
    .map((saiteIndex, z) => {
      const zellen = pattern.schritte
        .map((schritt, i) => {
          const treffer = schritt.find((n) => n.saite === saiteIndex);
          const inhalt = treffer ? String(treffer.bund) : '';
          return `<td class="tab-zelle${treffer ? ' tab-treffer' : ''}" data-schritt="${i}">${esc(inhalt)}</td>`;
        })
        .join('');
      return `<tr><th scope="row" class="tab-saite">${esc(kopf[z])}</th>${zellen}</tr>`;
    })
    .join('');
  return `<table class="tab-raster" aria-label="${esc(t('pattern_tab_aria'))}"><tbody>${reihen}</tbody></table>`;
}

function drumRasterHtml(pattern) {
  const spuren = SPUR_ORDNUNG.filter((s) => pattern.spuren[s]?.some((v) => v));
  const anzahl = Math.max(...spuren.map((s) => pattern.spuren[s].length));
  const reihen = spuren
    .map((spur) => {
      const zellen = [];
      for (let i = 0; i < anzahl; i++) {
        const an = pattern.spuren[spur][i];
        zellen.push(`<td class="drum-zelle${an ? ` drum-an drum-${spur}` : ''}" data-schritt="${i}"><span aria-hidden="true"></span></td>`);
      }
      return `<tr><th scope="row" class="drum-spur">${esc(t('pattern_spur_' + spur))}</th>${zellen.join('')}</tr>`;
    })
    .join('');
  return `<table class="drum-raster" aria-label="${esc(t('pattern_drum_aria'))}"><tbody>${reihen}</tbody></table>`;
}

function patternKarteHtml(pattern) {
  const raster = pattern.typ === 'drums' ? drumRasterHtml(pattern) : tabRasterHtml(pattern);
  const bpm = t('pattern_bpm', { n: pattern.bpm });
  return `
    <article class="pattern-karte" data-pattern="${esc(pattern.id)}">
      <div class="pattern-kopf">
        <h3>${domaeneIcon(pattern.domaene)} ${esc(text(pattern.titel))}</h3>
        <button type="button" class="chip chip-waehlbar pattern-play" aria-label="${esc(t('pattern_play_aria', { name: text(pattern.titel) }))}">
          <i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(t('pattern_play'))}
        </button>
      </div>
      <p class="leise pattern-meta">${esc(label('domaene', pattern.domaene))} · ${esc(bpm)}</p>
      <div class="pattern-raster">${raster}</div>
      <p class="pattern-hinweis">${esc(text(pattern.hinweis) || '')}</p>
    </article>`;
}

export function renderPatterns(el, daten) {
  stoppeLauf();
  const alle = (daten.patterns && daten.patterns.patterns) || [];
  // Genres in Erscheinungsreihenfolge, jedes nur einmal.
  const genres = [];
  for (const p of alle) if (!genres.includes(p.genre)) genres.push(p.genre);
  if (!genres.includes(aktivesGenre)) aktivesGenre = genres[0] || null;
  const sichtbar = alle.filter((p) => p.genre === aktivesGenre);

  const genreKnoepfe = genres
    .map(
      (g) => `
      <button type="button" class="chip chip-waehlbar ${g === aktivesGenre ? 'chip-akzent' : ''}" data-genre="${esc(g)}">
        ${esc(label('stil', g))}
      </button>`
    )
    .join(' ');

  const karten = sichtbar.map(patternKarteHtml).join('');
  const genreLink = aktivesGenre
    ? `<a class="chip" href="#/pfad/stil/${esc(aktivesGenre)}">${esc(t('pattern_zum_pfad', { name: label('stil', aktivesGenre) }))}</a>`
    : '';

  el.innerHTML = `
    <article>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-repeat" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('nav_patterns'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('pattern_untertitel'))}</p>
        </div>
      </section>
      <p class="chip-zeile">${genreKnoepfe}</p>
      <p class="chip-zeile">${genreLink}</p>
      <div class="pattern-liste">${karten}</div>
      <p class="leise">${esc(t('pattern_hinweis_pegel'))}</p>
    </article>`;

  for (const knopf of el.querySelectorAll('[data-genre]')) {
    knopf.addEventListener('click', () => {
      aktivesGenre = knopf.dataset.genre;
      renderPatterns(el, daten);
    });
  }
  for (const knopf of el.querySelectorAll('.pattern-play')) {
    knopf.addEventListener('click', () => {
      const karte = knopf.closest('.pattern-karte');
      const pattern = sichtbar.find((p) => p.id === karte.dataset.pattern);
      if (!pattern) return;
      if (pattern.typ === 'drums') spieleDrums(pattern, karte);
      else spieleTab(pattern, karte);
    });
  }
}
