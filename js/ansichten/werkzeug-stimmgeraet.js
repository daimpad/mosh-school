// Werkzeug: Stimmgerät + Drop-Tunings + Referenzton. Erstes Mikro-Werkzeug.
//
// Drei Bausteine, alle auf dem gemeinsamen Audio-Kern:
//  1. Live-Tuner über das Mikro (Autokorrelation in js/audio/tonhoehe.js): Note +
//     Cent-Abweichung, geglättete Nadel; nicht-farbliche Signale (Zahl + Text).
//  2. Preset-Tunings (Standard/Drop/7-Saiter/Bass) — jede Saite ein antippbarer
//     Zielton.
//  3. Referenzton-Drone: gehaltener Oszillator auf wählbarer Note — zum Stimmen
//     nach Gehör und als Grundton-Drone für Gesangsübungen.
//
// Einstellungen sind flüchtiger Modul-State; #/werkzeug/stimmgeraet?tuning=<id>
// bzw. ?note=<note> belegt vor. Mikro wird erst beim „Mikro starten" angefragt;
// Ablehnung wird sauber abgefangen.

import { label, t } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { frequenzVon } from './stimmungen.js';
import { aktiviere, holeKontext, holeAusgang, istBereit } from '../audio/kontext.js';
import { referenzDrone } from '../audio/stimmen.js';
import { holeMikro } from '../audio/mikro.js';
import { erkennePitch, frequenzTrifft } from '../audio/tonhoehe.js';

const TUNINGS = [
  { id: 'standard_e', instrument: 'gitarre', saiten: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'drop_d', instrument: 'gitarre', saiten: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'd_standard', instrument: 'gitarre', saiten: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  { id: 'drop_c', instrument: 'gitarre', saiten: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  { id: 'c_standard', instrument: 'gitarre', saiten: ['C2', 'F2', 'A#2', 'D#3', 'G3', 'C4'] },
  { id: 'drop_b', instrument: 'gitarre', saiten: ['B1', 'F#2', 'B2', 'E3', 'G#3', 'C#4'] },
  { id: 'drop_a', instrument: 'gitarre', saiten: ['A1', 'E2', 'A2', 'D3', 'F#3', 'B3'] },
  { id: 'sieben_standard', instrument: 'gitarre', saiten: ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'sieben_drop_a', instrument: 'gitarre', saiten: ['A1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'bass_standard', instrument: 'bass', saiten: ['E1', 'A1', 'D2', 'G2'] },
  { id: 'bass_drop_d', instrument: 'bass', saiten: ['D1', 'A1', 'D2', 'G2'] },
  { id: 'bass_fuenf', instrument: 'bass', saiten: ['B0', 'E1', 'A1', 'D2', 'G2'] },
];

const zustand = {
  tuningId: 'standard_e',
  droneNote: 'E2',
};

let mikro = null; // { analyser, liesZeitsignal, stop }
let rafId = null;
let drone = null; // aktives Referenzton-Handle
let geglaetteteCents = 0;

function aktivesTuning() {
  return TUNINGS.find((u) => u.id === zustand.tuningId) || TUNINGS[0];
}
function notenText(note) {
  return note.replace('#', '♯').replace('b', '♭');
}

// --- Live-Tuner ---
function starteTunerSchleife(el) {
  const anzeige = el.querySelector('.wz-tuner-note');
  const centsFeld = el.querySelector('.wz-tuner-cents');
  const nadel = el.querySelector('.wz-tuner-nadel');
  const richtung = el.querySelector('.wz-tuner-richtung');

  const tick = () => {
    if (!mikro) return;
    const buf = mikro.liesZeitsignal();
    const ctx = holeKontext();
    const freq = erkennePitch(buf, ctx.sampleRate);
    const treffer = freq ? frequenzTrifft(freq) : null;
    if (treffer) {
      geglaetteteCents += (treffer.cents - geglaetteteCents) * 0.25; // glätten
      const c = Math.round(geglaetteteCents);
      if (anzeige) anzeige.textContent = `${notenText(treffer.note)}${treffer.oktave}`;
      if (centsFeld) centsFeld.textContent = (c > 0 ? '+' : '') + c + ' ¢';
      if (nadel) nadel.style.left = `${Math.max(0, Math.min(100, 50 + geglaetteteCents))}%`;
      if (richtung) {
        richtung.textContent =
          Math.abs(c) <= 5 ? t('wz_tuner_passt') : c < 0 ? t('wz_tuner_tief') : t('wz_tuner_hoch');
        richtung.classList.toggle('passt', Math.abs(c) <= 5);
      }
    } else {
      if (anzeige) anzeige.textContent = '—';
      if (centsFeld) centsFeld.textContent = '';
      if (richtung) {
        richtung.textContent = t('wz_tuner_still');
        richtung.classList.remove('passt');
      }
    }
    rafId = window.requestAnimationFrame(tick);
  };
  rafId = window.requestAnimationFrame(tick);
}

function stoppeTuner() {
  if (rafId) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (mikro) {
    mikro.stop();
    mikro = null;
  }
}

async function starteMikro(el) {
  const status = el.querySelector('.wz-tuner-status');
  try {
    await aktiviere();
    mikro = await holeMikro();
    if (status) status.textContent = t('wz_tuner_laeuft');
    const tor = el.querySelector('.wz-tuner-start-zeile');
    if (tor) tor.hidden = true;
    const anzeige = el.querySelector('.wz-tuner-anzeige');
    if (anzeige) anzeige.hidden = false;
    starteTunerSchleife(el);
  } catch (fehler) {
    if (status) {
      status.textContent =
        fehler && fehler.name === 'NotAllowedError' ? t('wz_tuner_verweigert') : t('wz_tuner_kein_mikro');
    }
  }
}

// --- Referenzton-Drone ---
function toggleDrone(el, note) {
  const knopf = el.querySelector('.wz-drone-toggle');
  if (drone && zustand.droneNote === note) {
    drone.stop();
    drone = null;
    if (knopf) {
      knopf.classList.remove('chip-akzent');
      knopf.setAttribute('aria-pressed', 'false');
    }
    return;
  }
  zustand.droneNote = note;
  const freq = frequenzVon(note);
  if (!freq) return;
  if (drone) drone.setzeFrequenz(freq);
  else drone = referenzDrone(holeKontext(), holeAusgang(), freq);
  if (knopf) {
    knopf.classList.add('chip-akzent');
    knopf.setAttribute('aria-pressed', 'true');
    knopf.querySelector('.wz-drone-note').textContent = notenText(note);
  }
}

function stoppeDrone(el) {
  if (drone) {
    drone.stop();
    drone = null;
  }
  const knopf = el?.querySelector('.wz-drone-toggle');
  if (knopf) {
    knopf.classList.remove('chip-akzent');
    knopf.setAttribute('aria-pressed', 'false');
  }
}

// Kurzer Zupf-Referenzton (weich, 1,6 s) — wie im Stimmungs-Werkzeug.
function zupfe(note) {
  const freq = frequenzVon(note);
  if (!freq) return;
  const ctx = holeKontext();
  const ziel = holeAusgang();
  const jetzt = ctx.currentTime;
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  huelle.gain.setValueAtTime(0.0001, jetzt);
  huelle.gain.exponentialRampToValueAtTime(0.16, jetzt + 0.02);
  huelle.gain.exponentialRampToValueAtTime(0.0001, jetzt + 1.6);
  osc.connect(huelle).connect(ziel);
  osc.start(jetzt);
  osc.stop(jetzt + 1.7);
}

function saitenHtml(tuning) {
  // Tiefste Saite zuerst, gezeichnet von unten nach oben (wie beim Griffbrett).
  return [...tuning.saiten]
    .reverse()
    .map(
      (note) =>
        `<button type="button" class="chip chip-waehlbar wz-saite" data-note="${esc(note)}" aria-label="${esc(t('wz_saite_aria', { note: notenText(note) }))}">${esc(notenText(note))}</button>`
    )
    .join(' ');
}

// --- Preset aus der URL ---
function wendePresetAn(query) {
  if (!query) return;
  const tuning = query.get('tuning');
  if (tuning && TUNINGS.some((u) => u.id === tuning)) zustand.tuningId = tuning;
  const note = query.get('note');
  if (note && frequenzVon(note)) zustand.droneNote = note;
  else zustand.droneNote = aktivesTuning().saiten[0];
}

export function renderWerkzeugStimmgeraet(el, daten, query) {
  wendePresetAn(query);
  stoppeTuner();
  stoppeDrone(null);
  const tuning = aktivesTuning();

  const tuningKnoepfe = TUNINGS.map(
    (u) => `<button type="button" class="chip chip-waehlbar wz-tuning ${u.id === zustand.tuningId ? 'chip-akzent' : ''}" data-tuning="${esc(u.id)}" aria-pressed="${u.id === zustand.tuningId}">${esc(t('wz_tuning_' + u.id))}</button>`
  ).join(' ');

  const audioBereit = istBereit();

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-wave-square" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_stimmgeraet_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_stimmgeraet_untertitel'))}</p>
        </div>
      </section>

      <div class="wz-audio-tor" ${audioBereit ? 'hidden' : ''}>
        <p class="leise">${esc(t('wz_audio_hinweis'))}</p>
        <button type="button" class="knopf knopf-primaer wz-audio-aktivieren">
          <i class="fa-solid fa-volume-high" aria-hidden="true"></i> ${esc(t('wz_audio_aktivieren'))}
        </button>
      </div>

      <div class="wz-stimm-koerper" ${audioBereit ? '' : 'hidden'}>
        <section class="wz-tuner">
          <h2>${esc(t('wz_tuner_titel'))}</h2>
          <p class="wz-tuner-start-zeile">
            <button type="button" class="knopf knopf-primaer wz-tuner-start">
              <i class="fa-solid fa-microphone" aria-hidden="true"></i> ${esc(t('wz_tuner_mikro_start'))}
            </button>
          </p>
          <p class="wz-tuner-status leise" role="status" aria-live="polite"></p>
          <div class="wz-tuner-anzeige" hidden>
            <div class="wz-tuner-note" aria-live="polite">—</div>
            <div class="wz-tuner-skala" role="img" aria-label="${esc(t('wz_tuner_skala_aria'))}">
              <span class="wz-tuner-mitte" aria-hidden="true"></span>
              <span class="wz-tuner-nadel" style="left:50%" aria-hidden="true"></span>
            </div>
            <div class="wz-tuner-cents" aria-live="polite"></div>
            <div class="wz-tuner-richtung" aria-live="polite"></div>
          </div>
        </section>

        <section class="wz-tunings">
          <h2>${esc(t('wz_tunings_titel'))}</h2>
          <p class="chip-zeile">${tuningKnoepfe}</p>
          <p class="leise">${esc(t('wz_tunings_hinweis'))}</p>
          <p class="chip-zeile wz-saiten-zeile">${saitenHtml(tuning)}</p>
        </section>

        <section class="wz-drone">
          <h2>${esc(t('wz_drone_titel'))}</h2>
          <p class="leise">${esc(t('wz_drone_hinweis'))}</p>
          <p class="chip-zeile">
            <button type="button" class="chip chip-waehlbar wz-drone-toggle" aria-pressed="false">
              <i class="fa-solid fa-wave-square" aria-hidden="true"></i> ${esc(t('wz_drone_toggle'))} <span class="wz-drone-note">${esc(notenText(zustand.droneNote))}</span>
            </button>
          </p>
          <p class="leise wz-metro-fuss">${esc(t('wz_drone_gesundheit'))}</p>
        </section>
      </div>
    </article>`;

  verdrahte(el, daten);
}

function verdrahte(el, daten) {
  const koerper = el.querySelector('.wz-stimm-koerper');
  const tor = el.querySelector('.wz-audio-tor');
  el.querySelector('.wz-audio-aktivieren')?.addEventListener('click', async () => {
    await aktiviere();
    if (istBereit()) {
      if (tor) tor.hidden = true;
      if (koerper) koerper.hidden = false;
    }
  });

  el.querySelector('.wz-tuner-start')?.addEventListener('click', () => starteMikro(el));

  const verdrahteSaiten = () => {
    for (const saite of el.querySelectorAll('.wz-saite')) {
      saite.addEventListener('click', () => zupfe(saite.dataset.note));
    }
  };
  verdrahteSaiten();

  for (const knopf of el.querySelectorAll('.wz-tuning')) {
    knopf.addEventListener('click', () => {
      zustand.tuningId = knopf.dataset.tuning;
      zustand.droneNote = aktivesTuning().saiten[0];
      // In-place aktualisieren, damit ein laufender Mikro-Tuner nicht neu
      // angefragt/unterbrochen wird.
      for (const k of el.querySelectorAll('.wz-tuning')) {
        const an = k.dataset.tuning === zustand.tuningId;
        k.classList.toggle('chip-akzent', an);
        k.setAttribute('aria-pressed', String(an));
      }
      const zeile = el.querySelector('.wz-saiten-zeile');
      if (zeile) {
        zeile.innerHTML = saitenHtml(aktivesTuning());
        verdrahteSaiten();
      }
      const droneNoteEl = el.querySelector('.wz-drone-note');
      if (droneNoteEl) droneNoteEl.textContent = notenText(zustand.droneNote);
      if (drone) drone.setzeFrequenz(frequenzVon(zustand.droneNote));
      knopf.focus();
    });
  }

  el.querySelector('.wz-drone-toggle')?.addEventListener('click', () => toggleDrone(el, zustand.droneNote));
}
