// Werkzeug: Klick-Track & Metronom. Setzt auf den gemeinsamen Audio-Kern +
// Lookahead-Scheduler auf (kein eigener Timer). Kann als Metronom laufen, mit
// Count-in, Akzent auf die Eins, Unterteilungen und stufenweiser Tempo-Ramp;
// exportiert den Klick als WAV (OfflineAudioContext) für den DAW-Import.
//
// Einstellungen sind flüchtiger, gerätelokaler Modul-State (wie patterns.js) —
// die URL kann sie beim Öffnen vorbelegen (#/werkzeug/metronom?bpm=180&rampe=1).
// Zustand-Schema wird bewusst nicht angefasst; Persistenz kommt mit dem
// Song-Struktur-Baukasten (späterer PR).

import { t } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { aktiviere, holeKontext, holeAusgang, istBereit } from '../audio/kontext.js';
import { erzeugeScheduler } from '../audio/scheduler.js';
import { klick } from '../audio/stimmen.js';
import { rendereWav } from '../audio/wav.js';
import { holeWerkzeugDaten } from '../werkzeug-speicher.js';

// Unterteilungen: Pulse pro Viertel. 1=Viertel, 2=Achtel, 3=Triole, 4=Sechzehntel.
const UNTERTEILUNGEN = [1, 2, 3, 4];

const zustand = {
  bpm: 140,
  takt: 4, // Schläge pro Takt
  unterteilung: 1,
  akzent: true,
  countin: false,
  rampeAn: false,
  rampeZiel: 200,
  rampeStufe: 5, // + BPM
  rampeAlle: 2, // … alle N Takte
  exportTakte: 8,
};

let scheduler = null;
let laufTimer = []; // visuelle Marker (an die Audio-Zeit gekoppelt)

function reduziert() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// --- Reine Timing-Logik (auch vom WAV-Export genutzt) ---
// BPM für einen gegebenen Takt (0-basiert), Tempo-Ramp berücksichtigt.
// Tempo-Map aus dem Song-Struktur-Baukasten (Abschnitt → Takte/Tempo). Wenn
// aktiv, überschreibt sie Ramp/Konstant-Tempo und beendet nach dem letzten Takt.
let tempoMap = null; // { segmente:[{takte,bpm}], total }
function ladeTempoMap() {
  const g = holeWerkzeugDaten('klick_tempomap', null);
  if (g && Array.isArray(g.segmente) && g.segmente.length) {
    let total = 0;
    for (const s of g.segmente) total += s.takte;
    tempoMap = { segmente: g.segmente, total };
    if (g.bpm) zustand.bpm = g.bpm;
  } else {
    tempoMap = null;
  }
}
function bpmAusMap(takt) {
  let acc = 0;
  for (const s of tempoMap.segmente) {
    if (takt < acc + s.takte) return s.bpm;
    acc += s.takte;
  }
  return tempoMap.segmente[tempoMap.segmente.length - 1].bpm;
}

function bpmBeiTakt(takt) {
  if (tempoMap) return bpmAusMap(takt);
  if (!zustand.rampeAn) return zustand.bpm;
  const stufen = Math.floor(takt / Math.max(1, zustand.rampeAlle));
  const ziel = zustand.rampeZiel;
  const richtung = ziel >= zustand.bpm ? 1 : -1;
  const wert = zustand.bpm + richtung * stufen * zustand.rampeStufe;
  return richtung > 0 ? Math.min(ziel, wert) : Math.max(ziel, wert);
}

// Zerlegt einen Scheduler-Schritt in Takt/Schlag/Unterteilung + Rollen.
function schrittInfo(i) {
  const proTakt = zustand.takt * zustand.unterteilung;
  const takt = Math.floor(i / proTakt);
  const imTakt = i % proTakt;
  const schlag = Math.floor(imTakt / zustand.unterteilung); // 0-basiert
  const sub = imTakt % zustand.unterteilung;
  return { takt, schlag, sub, istSchlag: sub === 0, istEins: imTakt === 0 };
}

// Plant einen Klick für Schritt i an Ziel/Zeit ein (Live wie Export identisch).
function planeKlick(ctx, ziel, zeit, i, countinTakte) {
  const { takt, istSchlag, istEins } = schrittInfo(i);
  const imCountin = i < countinTakte * zustand.takt * zustand.unterteilung;
  if (imCountin) {
    // Count-in: nur die Schläge, jeder betont — deutliches „vorzählen".
    if (istSchlag) klick(ctx, ziel, zeit, { akzent: true });
    return;
  }
  const akzent = istEins && zustand.akzent;
  klick(ctx, ziel, zeit, { akzent, leise: !istSchlag });
}

// schrittDauer(i): Sekunden je Schritt aus dem BPM des zugehörigen Takts.
function schrittDauer(i, countinTakte) {
  const proTakt = zustand.takt * zustand.unterteilung;
  const taktNr = Math.floor(i / proTakt);
  // Count-in läuft im Start-BPM (nicht in der Ramp).
  const bpm = taktNr < countinTakte ? zustand.bpm : bpmBeiTakt(taktNr - countinTakte);
  return 60 / bpm / zustand.unterteilung;
}

// --- Visuelle Marker (an Audio-Zeit gekoppelt, wie im Pattern-Werkzeug) ---
function stoppeMarker() {
  laufTimer.forEach((id) => clearTimeout(id));
  laufTimer = [];
}

function markiere(el, ctx, zeit, i, countinTakte) {
  if (reduziert()) return;
  const { schlag, istSchlag, istEins } = schrittInfo(i);
  if (!istSchlag) return; // nur Schläge visualisieren, nicht jede Unterteilung
  const imCountin = i < countinTakte * zustand.takt * zustand.unterteilung;
  const verzoegerung = Math.max(0, (zeit - ctx.currentTime) * 1000);
  laufTimer.push(
    window.setTimeout(() => {
      const punkt = el.querySelector('.wz-beat-punkt');
      const zahl = el.querySelector('.wz-beat-zahl');
      const status = el.querySelector('.wz-metro-status');
      if (punkt) {
        punkt.classList.remove('an', 'eins');
        void punkt.offsetWidth; // Reflow, damit die Animation neu triggert
        punkt.classList.add('an');
        if (istEins) punkt.classList.add('eins');
      }
      if (zahl) zahl.textContent = imCountin ? t('wz_countin_kurz') : String(schlag + 1);
      if (status && istEins && !imCountin) {
        status.textContent = t('wz_status_laeuft', { bpm: Math.round(letztesBpm) });
      }
    }, verzoegerung)
  );
}

// Aktuelles Live-BPM (für die Statuszeile bei Ramp) — vom Scheduler je Takt gesetzt.
let letztesBpm = zustand.bpm;

// --- Start/Stop ---
function starte(el) {
  const ctx = holeKontext();
  const ziel = holeAusgang();
  scheduler = scheduler || erzeugeScheduler(ctx);
  stoppeMarker();
  const countinTakte = zustand.countin ? 1 : 0;
  scheduler.starte({
    schrittDauer: (i) => {
      const proTakt = zustand.takt * zustand.unterteilung;
      const taktNr = Math.floor(i / proTakt);
      const songTakt = taktNr - countinTakte;
      // Mit Tempo-Map endet der Klick nach dem letzten Song-Takt.
      if (tempoMap && songTakt >= tempoMap.total) return null;
      letztesBpm = taktNr < countinTakte ? zustand.bpm : bpmBeiTakt(songTakt);
      return schrittDauer(i, countinTakte);
    },
    beiSchritt: (zeit, i) => {
      planeKlick(ctx, ziel, zeit, i, countinTakte);
      markiere(el, ctx, zeit, i, countinTakte);
    },
  });
  setzeLaufZustand(el, true);
}

function stoppe(el) {
  if (scheduler) scheduler.stoppe();
  stoppeMarker();
  setzeLaufZustand(el, false);
  const punkt = el.querySelector('.wz-beat-punkt');
  if (punkt) punkt.classList.remove('an', 'eins');
}

function setzeLaufZustand(el, laeuft) {
  const start = el.querySelector('.wz-metro-start');
  const status = el.querySelector('.wz-metro-status');
  if (start) {
    start.setAttribute('aria-pressed', String(laeuft));
    start.classList.toggle('chip-akzent', laeuft);
    start.querySelector('.wz-start-text').textContent = laeuft ? t('wz_stopp') : t('wz_start');
    const icon = start.querySelector('i');
    if (icon) icon.className = laeuft ? 'fa-solid fa-stop' : 'fa-solid fa-play';
  }
  if (status && !laeuft) status.textContent = t('wz_status_gestoppt');
}

// --- WAV-Export ---
async function exportiereWav(el) {
  const knopf = el.querySelector('.wz-metro-export');
  if (knopf) {
    knopf.disabled = true;
    knopf.textContent = t('wz_wav_rendert');
  }
  try {
    const countinTakte = zustand.countin ? 1 : 0;
    const gesamtTakte = countinTakte + zustand.exportTakte;
    const schritte = gesamtTakte * zustand.takt * zustand.unterteilung;
    // Gesamtdauer aus den Schrittdauern summieren (Ramp berücksichtigt).
    let dauer = 0;
    for (let i = 0; i < schritte; i++) dauer += schrittDauer(i, countinTakte);
    dauer += 0.3; // etwas Ausklang
    const blob = await rendereWav(dauer, (ctx, ziel) => {
      let zeit = 0.05;
      for (let i = 0; i < schritte; i++) {
        planeKlick(ctx, ziel, zeit, i, countinTakte);
        zeit += schrittDauer(i, countinTakte);
      }
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `klicktrack-${zustand.bpm}bpm-${zustand.takt}-4.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (fehler) {
    const status = el.querySelector('.wz-metro-status');
    if (status) status.textContent = t('wz_wav_fehler');
  } finally {
    if (knopf) {
      knopf.disabled = false;
      knopf.innerHTML = `<i class="fa-solid fa-download" aria-hidden="true"></i> ${esc(t('wz_wav_export'))}`;
    }
  }
}

// --- Preset aus der URL übernehmen (Verlinkungs-Konvention) ---
function wendePresetAn(query) {
  if (!query) return;
  const zahl = (name, min, max) => {
    const v = Number(query.get(name));
    return Number.isFinite(v) && v >= min && v <= max ? v : null;
  };
  const bpm = zahl('bpm', 30, 300);
  if (bpm) zustand.bpm = Math.round(bpm);
  const takt = zahl('takt', 1, 12);
  if (takt) zustand.takt = Math.round(takt);
  if (query.get('rampe') === '1' || query.get('rampe') === 'true') zustand.rampeAn = true;
  // Tempo-Map aus dem Song-Struktur-Baukasten laden (oder abschalten).
  if (query.get('tempomap') === '1') ladeTempoMap();
  else tempoMap = null;
}

// --- Rendern ---
export function renderWerkzeugMetronom(el, daten, query) {
  wendePresetAn(query);
  if (scheduler) scheduler.stoppe();
  stoppeMarker();

  const unterteilungKnoepfe = UNTERTEILUNGEN.map(
    (u) => `<button type="button" class="chip chip-waehlbar wz-unterteilung ${u === zustand.unterteilung ? 'chip-akzent' : ''}" data-unterteilung="${u}" aria-pressed="${u === zustand.unterteilung}">${esc(t('wz_unterteilung_' + u))}</button>`
  ).join(' ');

  const audioBereit = istBereit();

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-stopwatch" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_metronom_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_metronom_untertitel'))}</p>
        </div>
      </section>

      <div class="wz-audio-tor" ${audioBereit ? 'hidden' : ''}>
        <p class="leise">${esc(t('wz_audio_hinweis'))}</p>
        <button type="button" class="knopf knopf-primaer wz-audio-aktivieren">
          <i class="fa-solid fa-volume-high" aria-hidden="true"></i> ${esc(t('wz_audio_aktivieren'))}
        </button>
      </div>

      <div class="wz-metro-koerper" ${audioBereit ? '' : 'hidden'}>
        ${tempoMap ? `<p class="wz-metro-map"><i class="fa-solid fa-list-check" aria-hidden="true"></i> ${esc(t('wz_metro_map', { takte: tempoMap.total }))}</p>` : ''}
        <div class="wz-beat-anzeige" role="img" aria-label="${esc(t('wz_beat_aria'))}">
          <span class="wz-beat-punkt" aria-hidden="true"></span>
          <span class="wz-beat-zahl" aria-hidden="true">${zustand.takt}</span>
        </div>
        <p class="wz-metro-status leise" role="status" aria-live="polite">${esc(t('wz_status_gestoppt'))}</p>

        <div class="wz-feld">
          <label class="wz-bpm-feld">${esc(t('wz_bpm'))}
            <span class="wz-bpm-zeile">
              <input type="range" class="wz-bpm-regler" min="40" max="260" step="1" value="${zustand.bpm}" aria-label="${esc(t('wz_bpm'))}">
              <input type="number" class="wz-bpm-zahl" min="40" max="260" step="1" value="${zustand.bpm}" aria-label="${esc(t('wz_bpm'))}">
            </span>
          </label>
        </div>

        <div class="wz-feld wz-feld-reihe">
          <label>${esc(t('wz_takt'))}
            <input type="number" class="wz-takt" min="1" max="12" step="1" value="${zustand.takt}">
          </label>
          <span class="wz-unterteilung-gruppe" role="group" aria-label="${esc(t('wz_unterteilung'))}">
            <span class="wz-feld-titel">${esc(t('wz_unterteilung'))}</span>
            ${unterteilungKnoepfe}
          </span>
        </div>

        <div class="wz-feld wz-feld-reihe">
          <button type="button" class="chip chip-waehlbar wz-akzent ${zustand.akzent ? 'chip-akzent' : ''}" aria-pressed="${zustand.akzent}">
            <i class="fa-solid fa-angles-up" aria-hidden="true"></i> ${esc(t('wz_akzent'))}
          </button>
          <button type="button" class="chip chip-waehlbar wz-countin ${zustand.countin ? 'chip-akzent' : ''}" aria-pressed="${zustand.countin}">
            <i class="fa-solid fa-hourglass-start" aria-hidden="true"></i> ${esc(t('wz_countin'))}
          </button>
        </div>

        <details class="wz-rampe" ${zustand.rampeAn ? 'open' : ''}>
          <summary>${esc(t('wz_rampe'))}</summary>
          <div class="wz-feld">
            <button type="button" class="chip chip-waehlbar wz-rampe-an ${zustand.rampeAn ? 'chip-akzent' : ''}" aria-pressed="${zustand.rampeAn}">
              ${esc(t('wz_rampe_an'))}
            </button>
          </div>
          <div class="wz-feld wz-feld-reihe">
            <label>${esc(t('wz_rampe_ziel'))}
              <input type="number" class="wz-rampe-ziel" min="40" max="300" step="1" value="${zustand.rampeZiel}">
            </label>
            <label>${esc(t('wz_rampe_stufe'))}
              <input type="number" class="wz-rampe-stufe" min="1" max="40" step="1" value="${zustand.rampeStufe}">
            </label>
            <label>${esc(t('wz_rampe_alle'))}
              <input type="number" class="wz-rampe-alle" min="1" max="16" step="1" value="${zustand.rampeAlle}">
            </label>
          </div>
        </details>

        <p class="wz-metro-knoepfe">
          <button type="button" class="knopf knopf-primaer wz-metro-start" aria-pressed="false">
            <i class="fa-solid fa-play" aria-hidden="true"></i> <span class="wz-start-text">${esc(t('wz_start'))}</span>
          </button>
        </p>

        <details class="wz-export">
          <summary>${esc(t('wz_wav_titel'))}</summary>
          <p class="leise">${esc(t('wz_wav_hinweis'))}</p>
          <div class="wz-feld wz-feld-reihe">
            <label>${esc(t('wz_takte'))}
              <input type="number" class="wz-export-takte" min="1" max="64" step="1" value="${zustand.exportTakte}">
            </label>
            <button type="button" class="chip chip-waehlbar wz-metro-export">
              <i class="fa-solid fa-download" aria-hidden="true"></i> ${esc(t('wz_wav_export'))}
            </button>
          </div>
        </details>

        <p class="leise wz-metro-fuss">${esc(t('wz_metronom_fuss'))}</p>
      </div>
    </article>`;

  verdrahte(el, daten);
}

function verdrahte(el, daten) {
  const koerper = el.querySelector('.wz-metro-koerper');
  const tor = el.querySelector('.wz-audio-tor');

  el.querySelector('.wz-audio-aktivieren')?.addEventListener('click', async () => {
    await aktiviere();
    if (istBereit()) {
      if (tor) tor.hidden = true;
      if (koerper) koerper.hidden = false;
    }
  });

  // BPM: Regler und Zahlenfeld gekoppelt.
  const regler = el.querySelector('.wz-bpm-regler');
  const zahl = el.querySelector('.wz-bpm-zahl');
  const setzeBpm = (v) => {
    const n = Math.max(40, Math.min(260, Math.round(Number(v) || zustand.bpm)));
    zustand.bpm = n;
    if (regler) regler.value = String(n);
    if (zahl) zahl.value = String(n);
  };
  regler?.addEventListener('input', () => setzeBpm(regler.value));
  zahl?.addEventListener('change', () => setzeBpm(zahl.value));

  el.querySelector('.wz-takt')?.addEventListener('change', (e) => {
    zustand.takt = Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 4)));
    e.target.value = String(zustand.takt);
  });

  for (const knopf of el.querySelectorAll('.wz-unterteilung')) {
    knopf.addEventListener('click', () => {
      zustand.unterteilung = Number(knopf.dataset.unterteilung);
      for (const k of el.querySelectorAll('.wz-unterteilung')) {
        const an = Number(k.dataset.unterteilung) === zustand.unterteilung;
        k.classList.toggle('chip-akzent', an);
        k.setAttribute('aria-pressed', String(an));
      }
    });
  }

  const umschalter = (sel, feld) => {
    const knopf = el.querySelector(sel);
    knopf?.addEventListener('click', () => {
      zustand[feld] = !zustand[feld];
      knopf.classList.toggle('chip-akzent', zustand[feld]);
      knopf.setAttribute('aria-pressed', String(zustand[feld]));
    });
  };
  umschalter('.wz-akzent', 'akzent');
  umschalter('.wz-countin', 'countin');
  umschalter('.wz-rampe-an', 'rampeAn');

  const zahlFeld = (sel, feld, min, max) => {
    el.querySelector(sel)?.addEventListener('change', (e) => {
      zustand[feld] = Math.max(min, Math.min(max, Math.round(Number(e.target.value) || zustand[feld])));
      e.target.value = String(zustand[feld]);
    });
  };
  zahlFeld('.wz-rampe-ziel', 'rampeZiel', 40, 300);
  zahlFeld('.wz-rampe-stufe', 'rampeStufe', 1, 40);
  zahlFeld('.wz-rampe-alle', 'rampeAlle', 1, 16);
  zahlFeld('.wz-export-takte', 'exportTakte', 1, 64);

  const start = el.querySelector('.wz-metro-start');
  start?.addEventListener('click', () => {
    if (scheduler && scheduler.istLaufend()) stoppe(el);
    else starte(el);
  });

  el.querySelector('.wz-metro-export')?.addEventListener('click', () => exportiereWav(el));
}
