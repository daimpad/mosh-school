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

// Gesamt-Schrittzahl eines Rasters: bei `gruppierung` (ungerade/verkettete Metren)
// deren Summe, sonst die Musterlänge (Pattern) bzw. aufloesung*takte (Tab).
function gesamtSchritte(demo) {
  if (Array.isArray(demo.gruppierung) && demo.gruppierung.length) {
    return demo.gruppierung.reduce((a, b) => a + b, 0);
  }
  if (demo.typ === 'pattern') return (demo.spuren?.[0]?.schritte || []).length;
  return demo.aufloesung * (demo.takte || 1);
}

// Spalten, die einen Taktstrich/Akzent tragen: bei `gruppierung` die Gruppen-
// anfänge (0, g0, g0+g1, …), sonst jeder stepsProBeat-te Schritt.
function taktMarken(demo, stepsProBeat) {
  const set = new Set();
  if (Array.isArray(demo.gruppierung) && demo.gruppierung.length) {
    let acc = 0;
    for (const g of demo.gruppierung) {
      set.add(acc);
      acc += g;
    }
  } else {
    const gesamt = gesamtSchritte(demo);
    for (let i = 0; i < gesamt; i += Math.max(1, stepsProBeat)) set.add(i);
  }
  return set;
}

// „<n>_ist_tiefste" heisst: die HOECHSTE Saitennummer ist die tiefste Saite.
// Vorher wurde nur auf die Zeichenkette '6_ist_tiefste' geprueft — der Bass
// deklariert '4_ist_tiefste', fiel damit durch und wurde umgekehrt gelesen:
// galopp_bass (Tuning C1-G1-C2-F2, alle Events auf Saite 4) klang auf F2 statt
// C1 und stand in der Tabulatur auf der falschen Zeile.
function hoechsteNrIstTief(demo) {
  return /^\d+_ist_tiefste$/.test(demo.saiten_reihenfolge || '');
}

function frequenzFuerEvent(demo, ev) {
  const tuning = demo.tuning || [];
  const idx = hoechsteNrIstTief(demo) ? tuning.length - ev.saite : ev.saite - 1;
  const basis = frequenzVon(tuning[idx]);
  return basis ? basis * 2 ** ((ev.bund || 0) / 12) : null;
}

// --- Rendering ---

function rasterPattern(demo, marken) {
  return demo.spuren
    .map((spur) => {
      const label = t('demo_instr_' + spur.instrument);
      // Die farbige Zelle bleibt fuer Hilfstechnik unsichtbar (sie sagt nichts),
      // daneben steht der Inhalt als Text. Vorher war das ganze Raster
      // aria-hidden — Screenreader bekamen weder Rhythmus noch Bundzahlen.
      const zellen = spur.schritte
        .map((an, i) => `<span class="demo-zelle${an ? ' an' : ''}${marken.has(i) ? ' takt' : ''}" data-col="${i}" aria-hidden="true"></span>`
          + `<span class="nur-sr">${esc(t('demo_zelle_sr', { n: i + 1, was: an ? label : t('pattern_pause') }))}</span>`)
        .join('');
      return `<div class="demo-zeile"><span class="demo-zeilen-label">${esc(label)}</span>
        <div class="demo-zellen" style="grid-template-columns:repeat(${spur.schritte.length},1fr)">${zellen}</div></div>`;
    })
    .join('');
}

function rasterTab(demo, cols, marken) {
  const evMap = new Map();
  for (const ev of demo.events) evMap.set(ev.saite + ':' + ev.schritt, ev);
  const tuning = demo.tuning || [];
  const zeilen = [];
  for (let saiteNr = 1; saiteNr <= tuning.length; saiteNr++) {
    const idx = hoechsteNrIstTief(demo) ? tuning.length - saiteNr : saiteNr - 1;
    const note = String(tuning[idx] || '').replace(/-?\d+$/, '');
    const zellen = [];
    for (let i = 0; i < cols; i++) {
      const ev = evMap.get(saiteNr + ':' + i);
      const tech = ev ? ` an technik-${ev.technik || 'normal'}` : '';
      zellen.push(
        `<span class="demo-zelle demo-tab-zelle${tech}${marken.has(i) ? ' takt' : ''}" data-col="${i}" aria-hidden="true">${ev ? esc(String(ev.bund)) : ''}</span>`
          + `<span class="nur-sr">${esc(t('demo_zelle_sr', { n: i + 1, was: ev ? t('demo_bund', { n: ev.bund }) : t('pattern_pause') }))}</span>`
      );
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

// `verweis_genre` traegt einen Wert aus dem `stil`-Vokabular (death_metal),
// die Songs-Routen nutzen aber den Dateinamen-Slug (death-metal). Ohne die
// Umschrift landete der Knopf auf einem Slug, den es nicht gibt — und weil die
// Songs-Ansicht bisher still auf das erste Genre zurueckfiel, sah man Hardcore
// statt Death Metal, ohne dass irgendetwas nach Fehler aussah.
function songSlugVon(stil) {
  return String(stil || '').replaceAll('_', '-');
}

export function demonstrationHtml(demo) {
  if (!demo) return '';
  if (demo.typ === 'hoerbeispiel') {
    return `
      <section class="demo demo-hoerbeispiel">
        <h2><i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(t('demo_titel'))}</h2>
        <p class="leise">${esc(demo.hinweis || t('demo_hoerbeispiel_text'))}</p>
        <a class="knopf knopf-sekundaer" href="#/songs/${esc(songSlugVon(demo.verweis_genre))}">${esc(t('demo_hoerbeispiel_link'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </section>`;
  }
  if (demo.typ !== 'pattern' && demo.typ !== 'tab') return '';
  const beats = taktSchlaege(demo);
  const stepsProBeat = Math.max(1, Math.round(demo.aufloesung / beats));
  const marken = taktMarken(demo, stepsProBeat);
  const cols = gesamtSchritte(demo);
  const raster = demo.typ === 'tab' ? rasterTab(demo, cols, marken) : rasterPattern(demo, marken);
  return `
    <section class="demo" data-demo-typ="${esc(demo.typ)}">
      <h2><i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(t('demo_titel'))}</h2>
      <div class="demo-raster demo-raster-${esc(demo.typ)}" role="group" aria-label="${esc(t('demo_raster_aria'))}">${raster}</div>
      ${demo.hinweis ? `<p class="leise demo-hinweis">${esc(demo.hinweis)}</p>` : ''}
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
  const gesamt = gesamtSchritte(demo);
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
      // Nur an einer Rundengrenze beenden. Ohne die Modulo-Bedingung riss das
      // Abwaehlen des Loop-Hakens die Wiedergabe mitten im Takt ab; mit ihr
      // spielt die laufende Runde zu Ende. Fuer „Loop von Anfang an aus" aendert
      // sich nichts, weil i == countinSteps + gesamt selbst eine Grenze ist.
      if (!cfg.loop && i >= countinSteps + gesamt && (i - countinSteps) % gesamt === 0) return null;
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
