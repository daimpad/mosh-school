// Werkzeug: Play-along-Loops. Synthetisierte Genre-Beats auf dem gemeinsamen
// Lookahead-Scheduler — zum Mitspielen, wenn die Band fehlt. Kein Sample-Gewicht,
// voll offline. Teilt Scheduler + Stimmen mit dem Metronom.
//
// Muster sind ein Takt à 16 Sechzehntel (Beat-Raster-Konvention wie im Pattern-
// Werkzeug: oben Crash/Hi-Hat, dann Snare, unten Kick). Der Loop läuft endlos,
// bis gestoppt wird. Einstellungen sind flüchtiger Modul-State; #/werkzeug/loops
// ?stil=<genre> (oder ?beat=<id>) belegt den passenden Beat vor.

import { label, t } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { aktiviere, holeKontext, holeAusgang, istBereit } from '../audio/kontext.js';
import { erzeugeScheduler } from '../audio/scheduler.js';
import { klick, kick, snare, hihat, crash } from '../audio/stimmen.js';

const STIMME = { kick, snare, hihat, crash };
const SPUR_ORDNUNG = ['crash', 'hihat', 'snare', 'kick'];
const SCHRITTE = 16; // ein Takt in Sechzehnteln

// x = Schlag. Reihenfolge der Genre-Beats = Erzählreihenfolge im Umschalter.
function setze(indizes) {
  const a = new Array(SCHRITTE).fill(0);
  for (const i of indizes) a[i] = 1;
  return a;
}
const BEATS = [
  { id: 'd_beat', stil: 'hardcore', bpm: 180, spuren: {
    hihat: setze([0, 2, 4, 6, 8, 10, 12, 14]), kick: setze([0, 6, 8, 14]), snare: setze([4, 12]) } },
  { id: 'blastbeat', stil: 'black_metal', bpm: 200, spuren: {
    hihat: setze([0, 2, 4, 6, 8, 10, 12, 14]), kick: setze([0, 4, 8, 12]), snare: setze([2, 6, 10, 14]) } },
  { id: 'double_bass', stil: 'death_metal', bpm: 175, spuren: {
    hihat: setze([0, 2, 4, 6, 8, 10, 12, 14]), kick: setze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), snare: setze([4, 12]) } },
  { id: 'metalcore_groove', stil: 'metalcore', bpm: 140, spuren: {
    hihat: setze([0, 2, 4, 6, 8, 10, 12, 14]), kick: setze([0, 3, 6, 8, 10, 14]), snare: setze([4, 12]) } },
  { id: 'metalcore_breakdown', stil: 'deathcore', bpm: 120, spuren: {
    crash: setze([0]), hihat: setze([0, 4, 8, 12]), kick: setze([0, 2, 6, 8, 11, 14]), snare: setze([8]) } },
  { id: 'thrash_galopp', stil: 'thrash', bpm: 190, spuren: {
    hihat: setze([0, 2, 4, 6, 8, 10, 12, 14]), kick: setze([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]), snare: setze([4, 12]) } },
  { id: 'doom_feel', stil: 'doom', bpm: 70, spuren: {
    crash: setze([0]), hihat: setze([0, 4, 8, 12]), kick: setze([0, 10]), snare: setze([8]) } },
];

// Genre → passender Beat (für das ?stil-Preset der Verlinkungs-Konvention).
const STIL_ZU_BEAT = {
  hardcore: 'd_beat', crust: 'd_beat', powerviolence: 'blastbeat', grindcore: 'blastbeat',
  black_metal: 'blastbeat', death_metal: 'double_bass', thrash: 'thrash_galopp',
  metalcore: 'metalcore_groove', djent: 'metalcore_groove', deathcore: 'metalcore_breakdown',
  doom: 'doom_feel', sludge: 'doom_feel', stoner_post: 'doom_feel',
};

const zustand = {
  beatId: 'd_beat',
  bpm: 180,
  countin: false,
  klickMit: false, // Klick zusätzlich zu den Drums
  klickSolo: false, // nur Klick, keine Drums
};

let scheduler = null;
let laufTimer = [];

function reduziert() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function aktiverBeat() {
  return BEATS.find((b) => b.id === zustand.beatId) || BEATS[0];
}

function stoppeMarker() {
  laufTimer.forEach((id) => clearTimeout(id));
  laufTimer = [];
}

// --- Loop-Wiedergabe über den Scheduler ---
function starte(el) {
  const ctx = holeKontext();
  const ziel = holeAusgang();
  scheduler = scheduler || erzeugeScheduler(ctx);
  stoppeMarker();
  const beat = aktiverBeat();
  const countinSteps = zustand.countin ? SCHRITTE : 0;
  scheduler.starte({
    schrittDauer: () => 60 / zustand.bpm / 4, // Sechzehntel
    beiSchritt: (zeit, i) => {
      if (i < countinSteps) {
        if (i % 4 === 0) klick(ctx, ziel, zeit, { akzent: i === 0 });
        return;
      }
      const schritt = (i - countinSteps) % SCHRITTE;
      if (!zustand.klickSolo) {
        for (const spur of SPUR_ORDNUNG) {
          if (beat.spuren[spur]?.[schritt]) STIMME[spur](ctx, ziel, zeit);
        }
      }
      if (zustand.klickSolo || zustand.klickMit) {
        if (schritt % 4 === 0) klick(ctx, ziel, zeit, { akzent: schritt === 0, leise: !zustand.klickSolo });
      }
      markiere(el, ctx, zeit, schritt);
    },
  });
  setzeLaufZustand(el, true);
}

function stoppe(el) {
  if (scheduler) scheduler.stoppe();
  stoppeMarker();
  setzeLaufZustand(el, false);
  for (const z of el.querySelectorAll('.schritt-aktiv')) z.classList.remove('schritt-aktiv');
}

function markiere(el, ctx, zeit, schritt) {
  if (reduziert()) return;
  const verzoegerung = Math.max(0, (zeit - ctx.currentTime) * 1000);
  laufTimer.push(
    window.setTimeout(() => {
      for (const z of el.querySelectorAll('.schritt-aktiv')) z.classList.remove('schritt-aktiv');
      for (const z of el.querySelectorAll(`[data-schritt="${schritt}"]`)) z.classList.add('schritt-aktiv');
    }, verzoegerung)
  );
}

function setzeLaufZustand(el, laeuft) {
  const start = el.querySelector('.wz-loop-start');
  const status = el.querySelector('.wz-loop-status');
  if (start) {
    start.setAttribute('aria-pressed', String(laeuft));
    start.classList.toggle('chip-akzent', laeuft);
    start.querySelector('.wz-start-text').textContent = laeuft ? t('wz_stopp') : t('wz_start');
    const icon = start.querySelector('i');
    if (icon) icon.className = laeuft ? 'fa-solid fa-stop' : 'fa-solid fa-play';
  }
  if (status) status.textContent = laeuft ? t('wz_loop_laeuft', { name: t('wz_beat_' + zustand.beatId) }) : t('wz_status_gestoppt');
}

// --- Beat-Raster (Beat-Raster-Konvention, wie im Pattern-Werkzeug) ---
function rasterHtml(beat) {
  const spuren = SPUR_ORDNUNG.filter((s) => beat.spuren[s]?.some((v) => v));
  const pause = t('pattern_pause');
  const reihen = spuren
    .map((spur) => {
      const spurName = t('pattern_spur_' + spur);
      const zellen = [];
      for (let i = 0; i < SCHRITTE; i++) {
        const an = beat.spuren[spur][i];
        const srText = an ? spurName : pause;
        zellen.push(
          `<td class="drum-zelle${an ? ` drum-an drum-${spur}` : ''}" data-schritt="${i}"><span class="drum-mark" aria-hidden="true"></span><span class="nur-sr">${esc(srText)}</span></td>`
        );
      }
      return `<tr><th scope="row" class="drum-spur">${esc(spurName)}</th>${zellen.join('')}</tr>`;
    })
    .join('');
  return `<table class="drum-raster" aria-label="${esc(t('pattern_drum_aria'))}"><tbody>${reihen}</tbody></table>`;
}

// --- Preset aus der URL ---
function wendePresetAn(query) {
  if (!query) return;
  const beatParam = query.get('beat');
  if (beatParam && BEATS.some((b) => b.id === beatParam)) zustand.beatId = beatParam;
  const stil = query.get('stil');
  if (stil && STIL_ZU_BEAT[stil]) zustand.beatId = STIL_ZU_BEAT[stil];
  zustand.bpm = aktiverBeat().bpm;
  const bpm = Number(query.get('bpm'));
  if (Number.isFinite(bpm) && bpm >= 40 && bpm <= 300) zustand.bpm = Math.round(bpm);
}

export function renderWerkzeugLoops(el, daten, query) {
  wendePresetAn(query);
  if (scheduler) scheduler.stoppe();
  stoppeMarker();
  const beat = aktiverBeat();

  const beatKnoepfe = BEATS.map(
    (b) => `<button type="button" class="chip chip-waehlbar wz-beat ${b.id === zustand.beatId ? 'chip-akzent' : ''}" data-beat="${esc(b.id)}" aria-pressed="${b.id === zustand.beatId}">${esc(t('wz_beat_' + b.id))}</button>`
  ).join(' ');

  const audioBereit = istBereit();

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-drum" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_loops_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_loops_untertitel'))}</p>
        </div>
      </section>

      <div class="wz-audio-tor" ${audioBereit ? 'hidden' : ''}>
        <p class="leise">${esc(t('wz_audio_hinweis'))}</p>
        <button type="button" class="knopf knopf-primaer wz-audio-aktivieren">
          <i class="fa-solid fa-volume-high" aria-hidden="true"></i> ${esc(t('wz_audio_aktivieren'))}
        </button>
      </div>

      <div class="wz-loop-koerper" ${audioBereit ? '' : 'hidden'}>
        <p class="chip-zeile wz-beat-wahl">${beatKnoepfe}</p>
        <p class="leise wz-beat-genre">${esc(t('wz_loop_genre', { name: label('stil', beat.stil) }))}</p>
        <div class="wz-loop-raster pattern-raster">${rasterHtml(beat)}</div>
        <p class="wz-loop-status leise" role="status" aria-live="polite">${esc(t('wz_status_gestoppt'))}</p>

        <div class="wz-feld">
          <label class="wz-bpm-feld">${esc(t('wz_bpm'))}
            <span class="wz-bpm-zeile">
              <input type="range" class="wz-bpm-regler" min="40" max="280" step="1" value="${zustand.bpm}" aria-label="${esc(t('wz_bpm'))}">
              <input type="number" class="wz-bpm-zahl" min="40" max="280" step="1" value="${zustand.bpm}" aria-label="${esc(t('wz_bpm'))}">
            </span>
          </label>
        </div>

        <div class="wz-feld wz-feld-reihe">
          <button type="button" class="chip chip-waehlbar wz-countin ${zustand.countin ? 'chip-akzent' : ''}" aria-pressed="${zustand.countin}">
            <i class="fa-solid fa-hourglass-start" aria-hidden="true"></i> ${esc(t('wz_countin'))}
          </button>
          <button type="button" class="chip chip-waehlbar wz-klick-mit ${zustand.klickMit ? 'chip-akzent' : ''}" aria-pressed="${zustand.klickMit}">
            <i class="fa-solid fa-stopwatch" aria-hidden="true"></i> ${esc(t('wz_klick_mit'))}
          </button>
          <button type="button" class="chip chip-waehlbar wz-klick-solo ${zustand.klickSolo ? 'chip-akzent' : ''}" aria-pressed="${zustand.klickSolo}">
            <i class="fa-solid fa-stopwatch" aria-hidden="true"></i> ${esc(t('wz_klick_solo'))}
          </button>
        </div>

        <p class="wz-metro-knoepfe">
          <button type="button" class="knopf knopf-primaer wz-loop-start" aria-pressed="false">
            <i class="fa-solid fa-play" aria-hidden="true"></i> <span class="wz-start-text">${esc(t('wz_start'))}</span>
          </button>
        </p>

        <p class="leise wz-metro-fuss">${esc(t('wz_metronom_fuss'))}</p>
      </div>
    </article>`;

  verdrahte(el);
}

function verdrahte(el) {
  const koerper = el.querySelector('.wz-loop-koerper');
  const tor = el.querySelector('.wz-audio-tor');

  el.querySelector('.wz-audio-aktivieren')?.addEventListener('click', async () => {
    await aktiviere();
    if (istBereit()) {
      if (tor) tor.hidden = true;
      if (koerper) koerper.hidden = false;
    }
  });

  const lief = () => scheduler && scheduler.istLaufend();
  for (const knopf of el.querySelectorAll('.wz-beat')) {
    knopf.addEventListener('click', () => {
      zustand.beatId = knopf.dataset.beat;
      zustand.bpm = aktiverBeat().bpm;
      const war = lief();
      renderWerkzeugLoops(el, null, null);
      if (war) starte(el); // Umschalten im Lauf: nahtlos neu starten
      el.querySelector(`[data-beat="${CSS.escape(zustand.beatId)}"]`)?.focus();
    });
  }

  const regler = el.querySelector('.wz-bpm-regler');
  const zahl = el.querySelector('.wz-bpm-zahl');
  const setzeBpm = (v) => {
    const n = Math.max(40, Math.min(280, Math.round(Number(v) || zustand.bpm)));
    zustand.bpm = n;
    if (regler) regler.value = String(n);
    if (zahl) zahl.value = String(n);
  };
  regler?.addEventListener('input', () => setzeBpm(regler.value));
  zahl?.addEventListener('change', () => setzeBpm(zahl.value));

  const umschalter = (sel, feld, exklusiv) => {
    const knopf = el.querySelector(sel);
    knopf?.addEventListener('click', () => {
      zustand[feld] = !zustand[feld];
      knopf.classList.toggle('chip-akzent', zustand[feld]);
      knopf.setAttribute('aria-pressed', String(zustand[feld]));
      // Klick-solo und Klick-mit schließen sich gegenseitig aus.
      if (zustand[feld] && exklusiv) {
        zustand[exklusiv] = false;
        const anderer = el.querySelector(exklusiv === 'klickSolo' ? '.wz-klick-solo' : '.wz-klick-mit');
        if (anderer) {
          anderer.classList.remove('chip-akzent');
          anderer.setAttribute('aria-pressed', 'false');
        }
      }
    });
  };
  umschalter('.wz-countin', 'countin');
  umschalter('.wz-klick-mit', 'klickMit', 'klickSolo');
  umschalter('.wz-klick-solo', 'klickSolo', 'klickMit');

  const start = el.querySelector('.wz-loop-start');
  start?.addEventListener('click', () => {
    if (lief()) stoppe(el);
    else starte(el);
  });
}
