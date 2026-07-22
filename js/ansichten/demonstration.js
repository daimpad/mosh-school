// Demonstrations-Ebene (Trainings-Loop §1): rendert das optionale Baustein-Feld
// `demonstration` als monochromes Raster/Tab und spielt es über den GEMEINSAMEN
// Audio-Kern der Werkzeuge (ein AudioContext, Lookahead-Scheduler — keine Drift,
// Synthese statt Samples). Play/Stop, Tempo, „langsam üben", Loop, Count-in.
// Ein Laufbalken (Playhead) über dem Raster ist das nicht-auditive Signal.
//
// Zustand ist flüchtiger Modul-State: es läuft höchstens EINE Demo (die der
// gerade offenen Baustein-Seite); ein erneutes Binden stoppt die vorherige.

import { t } from '../i18n.js';
import { esc, registriereAufraeumen } from '../oberflaeche.js';
import { aktiviere, holeAusgang, holeKontext, istBereit } from '../audio/kontext.js';
import { erzeugeScheduler } from '../audio/scheduler.js';
import { china, crash, hihat, hihatOffen, kick, klick, ride, saite, snare, tomHoch, tomTief } from '../audio/stimmen.js';
import { frequenzVon } from './stimmungen.js';

const DRUM_STIMME = {
  kick, snare, hihat_closed: hihat, hihat_open: hihatOffen,
  tom_hi: tomHoch, tom_lo: tomTief, crash, ride, china,
};
const GEDAEMPFT = new Set(['palm_mute', 'dead_note', 'chug']);

let laufSched = null;
let laufTimers = [];
let laufEl = null;

function taktSchlaege(demo) {
  const m = /^(\d+)/.exec(demo.taktart || '');
  return m ? Number(m[1]) : 4;
}

function frequenzFuerEvent(demo, ev) {
  const tuning = demo.tuning || [];
  const idx = demo.saiten_reihenfolge === '6_ist_tiefste' ? tuning.length - ev.saite : ev.saite - 1;
  const basis = frequenzVon(tuning[idx]);
  return basis ? basis * 2 ** ((ev.bund || 0) / 12) : null;
}

// --- Rendering ---

function rasterPattern(demo, stepsProBeat) {
  return demo.spuren
    .map((spur) => {
      const zellen = spur.schritte
        .map((an, i) => `<span class="demo-zelle${an ? ' an' : ''}${i % stepsProBeat === 0 ? ' takt' : ''}" data-col="${i}" aria-hidden="true"></span>`)
        .join('');
      const label = t('demo_instr_' + spur.instrument);
      return `<div class="demo-zeile"><span class="demo-zeilen-label">${esc(label)}</span>
        <div class="demo-zellen" style="grid-template-columns:repeat(${spur.schritte.length},1fr)">${zellen}</div></div>`;
    })
    .join('');
}

function rasterTab(demo, cols, stepsProBeat) {
  const evMap = new Map();
  for (const ev of demo.events) evMap.set(ev.saite + ':' + ev.schritt, ev);
  const tuning = demo.tuning || [];
  const zeilen = [];
  for (let saiteNr = 1; saiteNr <= tuning.length; saiteNr++) {
    const idx = demo.saiten_reihenfolge === '6_ist_tiefste' ? tuning.length - saiteNr : saiteNr - 1;
    const note = String(tuning[idx] || '').replace(/-?\d+$/, '');
    const zellen = [];
    for (let i = 0; i < cols; i++) {
      const ev = evMap.get(saiteNr + ':' + i);
      const tech = ev ? ` an technik-${ev.technik || 'normal'}` : '';
      zellen.push(`<span class="demo-zelle demo-tab-zelle${tech}${i % stepsProBeat === 0 ? ' takt' : ''}" data-col="${i}" aria-hidden="true">${ev ? esc(String(ev.bund)) : ''}</span>`);
    }
    zeilen.push(`<div class="demo-zeile"><span class="demo-zeilen-label demo-saite-label">${esc(note)}</span>
      <div class="demo-zellen" style="grid-template-columns:repeat(${cols},1fr)">${zellen.join('')}</div></div>`);
  }
  return zeilen.join('');
}

function steuerung(demo) {
  const maxTempo = Math.max(demo.bpm, 120);
  const presets = [50, 75, 100]
    .map((p) => `<button type="button" class="knopf knopf-leise demo-preset" data-tempo="${Math.round((demo.bpm * p) / 100)}">${p}%</button>`)
    .join('');
  return `
    <div class="demo-controls">
      <button type="button" class="knopf knopf-primaer demo-play" aria-pressed="false">
        <i class="fa-solid fa-play" aria-hidden="true"></i> <span class="demo-play-text">${esc(t('demo_play'))}</span>
      </button>
      <label class="demo-tempo-label">${esc(t('demo_tempo'))}: <span class="demo-tempo-wert">${demo.bpm}</span>&nbsp;BPM
        <input type="range" class="demo-tempo" min="40" max="${maxTempo}" value="${demo.bpm}" step="1" aria-label="${esc(t('demo_tempo'))}">
      </label>
      <div class="demo-presets" role="group" aria-label="${esc(t('demo_langsam'))}"><span class="leise demo-presets-titel">${esc(t('demo_langsam'))}:</span> ${presets}</div>
      <label class="demo-toggle"><input type="checkbox" class="demo-loop" ${demo.loop ? 'checked' : ''}> ${esc(t('demo_loop'))}</label>
      <label class="demo-toggle"><input type="checkbox" class="demo-countin"> ${esc(t('demo_countin'))}</label>
    </div>`;
}

export function demonstrationHtml(demo) {
  if (!demo) return '';
  if (demo.typ === 'hoerbeispiel') {
    return `
      <section class="demo demo-hoerbeispiel">
        <h2><i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(t('demo_titel'))}</h2>
        <p class="leise">${esc(demo.hinweis || t('demo_hoerbeispiel_text'))}</p>
        <a class="knopf knopf-sekundaer" href="#/songs/${esc(demo.verweis_genre)}">${esc(t('demo_hoerbeispiel_link'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </section>`;
  }
  if (demo.typ !== 'pattern' && demo.typ !== 'tab') return '';
  const beats = taktSchlaege(demo);
  const stepsProBeat = Math.max(1, Math.round(demo.aufloesung / beats));
  const cols = demo.aufloesung * (demo.takte || 1);
  const raster = demo.typ === 'tab' ? rasterTab(demo, cols, stepsProBeat) : rasterPattern(demo, stepsProBeat);
  return `
    <section class="demo" data-demo-typ="${esc(demo.typ)}">
      <h2><i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(t('demo_titel'))}</h2>
      <div class="demo-raster demo-raster-${esc(demo.typ)}">${raster}</div>
      ${steuerung(demo)}
    </section>`;
}

// --- Wiedergabe ---

function setzePlayZustand(sektion, laeuft) {
  const knopf = sektion.querySelector('.demo-play');
  if (!knopf) return;
  knopf.setAttribute('aria-pressed', String(laeuft));
  knopf.classList.toggle('laeuft', laeuft);
  const text = knopf.querySelector('.demo-play-text');
  const icon = knopf.querySelector('i');
  if (text) text.textContent = laeuft ? t('demo_stop') : t('demo_play');
  if (icon) icon.className = laeuft ? 'fa-solid fa-stop' : 'fa-solid fa-play';
}

export function stoppeDemo() {
  if (laufSched) laufSched.stoppe();
  laufTimers.forEach((id) => clearTimeout(id));
  laufTimers = [];
  if (laufEl) {
    for (const z of laufEl.querySelectorAll('.demo-zelle.playhead')) z.classList.remove('playhead');
    setzePlayZustand(laufEl, false);
  }
  laufSched = null;
  laufEl = null;
}

function spieleStep(ctx, ziel, zeit, demo, step) {
  if (demo.typ === 'pattern') {
    for (const spur of demo.spuren) {
      if (spur.schritte[step]) DRUM_STIMME[spur.instrument]?.(ctx, ziel, zeit);
    }
  } else {
    for (const ev of demo.events) {
      if (ev.schritt !== step) continue;
      const frequenz = frequenzFuerEvent(demo, ev);
      saite(ctx, ziel, zeit, { frequenz, gedaempft: GEDAEMPFT.has(ev.technik) });
    }
  }
}

function starteDemo(sektion, demo, cfg) {
  const ctx = holeKontext();
  const ziel = holeAusgang();
  const sched = erzeugeScheduler(ctx);
  const beats = taktSchlaege(demo);
  const stepsProBeat = Math.max(1, Math.round(demo.aufloesung / beats));
  const gesamt = demo.aufloesung * (demo.takte || 1);
  const countinSteps = cfg.countin ? demo.aufloesung : 0;
  const timers = [];

  const markiere = (col, zeit) => {
    const ms = Math.max(0, (zeit - ctx.currentTime) * 1000);
    timers.push(window.setTimeout(() => {
      for (const z of sektion.querySelectorAll('.demo-zelle.playhead')) z.classList.remove('playhead');
      for (const z of sektion.querySelectorAll(`.demo-zelle[data-col="${col}"]`)) z.classList.add('playhead');
    }, ms));
  };

  laufSched = sched;
  laufTimers = timers;
  laufEl = sektion;
  sched.starte({
    schrittDauer: (i) => {
      if (!cfg.loop && i >= countinSteps + gesamt) return null;
      return 60 / cfg.bpm / stepsProBeat;
    },
    beiSchritt: (zeit, i) => {
      if (i < countinSteps) {
        if (i % stepsProBeat === 0) klick(ctx, ziel, zeit, { akzent: i === 0 });
        return;
      }
      const step = (i - countinSteps) % gesamt;
      spieleStep(ctx, ziel, zeit, demo, step);
      markiere(step, zeit);
    },
    beiEnde: () => stoppeDemo(),
  });
  setzePlayZustand(sektion, true);
}

export function bindeDemonstration(el, demo) {
  stoppeDemo(); // eine evtl. laufende Demo der vorigen Seite beenden
  if (!demo || (demo.typ !== 'pattern' && demo.typ !== 'tab')) return;
  const sektion = el.querySelector('.demo');
  if (!sektion) return;
  // Beim Verlassen der Baustein-Seite eine laufende Demo stoppen (nicht nur beim
  // Öffnen des nächsten Bausteins mit Demo).
  registriereAufraeumen(stoppeDemo);

  const cfg = { bpm: demo.bpm, loop: sektion.querySelector('.demo-loop')?.checked ?? demo.loop, countin: false };
  const tempoInput = sektion.querySelector('.demo-tempo');
  const tempoWert = sektion.querySelector('.demo-tempo-wert');
  const setzeTempo = (bpm) => {
    cfg.bpm = Math.max(40, Math.min(Number(tempoInput.max), bpm));
    if (tempoInput) tempoInput.value = cfg.bpm;
    if (tempoWert) tempoWert.textContent = cfg.bpm;
  };

  sektion.querySelector('.demo-play')?.addEventListener('click', async () => {
    if (laufSched && laufEl === sektion) {
      stoppeDemo();
      return;
    }
    await aktiviere(); // Play-Klick IST die User-Geste (Autoplay-Policy)
    if (!istBereit()) return;
    cfg.loop = sektion.querySelector('.demo-loop')?.checked ?? demo.loop;
    cfg.countin = sektion.querySelector('.demo-countin')?.checked ?? false;
    starteDemo(sektion, demo, cfg);
  });

  tempoInput?.addEventListener('input', () => setzeTempo(Number(tempoInput.value)));
  for (const knopf of sektion.querySelectorAll('.demo-preset')) {
    knopf.addEventListener('click', () => setzeTempo(Number(knopf.dataset.tempo)));
  }
  sektion.querySelector('.demo-loop')?.addEventListener('change', (e) => {
    cfg.loop = e.target.checked;
  });
}
