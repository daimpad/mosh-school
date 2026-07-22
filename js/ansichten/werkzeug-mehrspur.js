// Werkzeug: Skizzen-Mehrspur-Rekorder. Erst eine Leitspur (optional zum Klick),
// dann Overdubs gegen die Wiedergabe der vorhandenen Spuren. Je Spur Mute/Solo/
// Pegel. Blobs in IndexedDB (spuren-db.js), Export je Spur.
//
// Latenz-Warnung (dokumentiert): Monitoring-/Overdub-Latenz ist im Browser die
// eigentliche Hürde und geräteabhängig. Es gibt eine einstellbare Latenz-
// kompensation (Offset in ms), die Overdub-Spuren beim gemeinsamen Abspielen
// zeitlich gegen die Leitspur verschiebt — approximativ, KEIN DAW-genaues
// Sample-Alignment. Das ist ein Skizzen-Werkzeug für Ideen und Pre-Production.

import { t } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { aktiviere, holeKontext, holeAusgang } from '../audio/kontext.js';
import { erzeugeScheduler } from '../audio/scheduler.js';
import { klick } from '../audio/stimmen.js';
import { speichereSpur, alleSpuren, aktualisiereSpur, loescheSpur } from '../audio/spuren-db.js';

const zustand = { latenz: 0, klickAn: true, bpm: 140 };
let spuren = [];
let spurURLs = [];
let aufnahmeLaeuft = false;
let mediaRecorder = null;
let strom = null;
let stuecke = [];
let klickScheduler = null;
let monitorAudios = [];
let mixAudios = [];
let tickTimer = null;
let startZeit = 0;
let letzterFehler = '';

function mimeEndung(m) {
  if (/webm/.test(m)) return 'webm';
  if (/mp4/.test(m)) return 'm4a';
  if (/ogg/.test(m)) return 'ogg';
  return 'audio';
}
function waehleMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

// Hörbare Spuren nach Solo/Mute: gibt es Solo, zählen nur Solo-Spuren.
function hoerbare() {
  const soloAktiv = spuren.some((s) => s.solo);
  return spuren.filter((s) => (soloAktiv ? s.solo : !s.mute));
}

// --- Wiedergabe (Mix) ---
function stoppeMix() {
  for (const a of mixAudios) {
    try {
      a.pause();
    } catch {
      /* egal */
    }
  }
  mixAudios = [];
}
function spieleMix(el, liste) {
  stoppeMix();
  const offsetS = Math.abs(zustand.latenz) / 1000;
  liste.forEach((spur, i) => {
    const audio = new Audio(URL.createObjectURL(spur.blob));
    audio.volume = typeof spur.pegel === 'number' ? spur.pegel : 1;
    mixAudios.push(audio);
    // Latenzkompensation (approx): positive Latenz → Overdubs sind zu spät, also
    // die Leitspur (i=0) um |Offset| verzögern; negative → Overdubs verzögern.
    const istLeit = i === 0;
    const verzoegerung = zustand.latenz >= 0 ? (istLeit ? offsetS * 1000 : 0) : (istLeit ? 0 : offsetS * 1000);
    window.setTimeout(() => {
      audio.play().catch(() => {});
    }, verzoegerung);
  });
}

// --- Aufnahme (Overdub) ---
async function starteAufnahme(el) {
  letzterFehler = '';
  if (typeof MediaRecorder === 'undefined') {
    letzterFehler = t('wz_rec_kein_recorder');
    zeichneKopf(el);
    return;
  }
  try {
    await aktiviere(); // Kontext für den Klick (User-Geste)
    strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (fehler) {
    letzterFehler = fehler && fehler.name === 'NotAllowedError' ? t('wz_rec_verweigert') : t('wz_rec_kein_mikro');
    zeichneKopf(el);
    return;
  }
  // Vorhandene Spuren als Monitor mitlaufen lassen.
  monitorAudios = [];
  for (const spur of hoerbare()) {
    const audio = new Audio(URL.createObjectURL(spur.blob));
    audio.volume = typeof spur.pegel === 'number' ? spur.pegel : 1;
    monitorAudios.push(audio);
    audio.play().catch(() => {});
  }
  // Optionaler Klick.
  if (zustand.klickAn) starteKlick();

  stuecke = [];
  const mime = waehleMime();
  mediaRecorder = new MediaRecorder(strom, mime ? { mimeType: mime } : undefined);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size) stuecke.push(e.data);
  };
  mediaRecorder.onstop = async () => {
    const typ = (mediaRecorder && mediaRecorder.mimeType) || 'audio/webm';
    const blob = new Blob(stuecke, { type: typ });
    if (strom) strom.getTracks().forEach((s) => s.stop());
    strom = null;
    stoppeKlick();
    for (const a of monitorAudios) {
      try {
        a.pause();
      } catch {
        /* egal */
      }
    }
    monitorAudios = [];
    const n = spuren.length;
    const spur = {
      id: 's' + Date.now(),
      name: n === 0 ? t('wz_ms_leitspur') : t('wz_ms_spur', { n: n + 1 }),
      reihenfolge: n,
      mute: false,
      solo: false,
      pegel: 1,
      blob,
      mime: blob.type,
    };
    try {
      await speichereSpur(spur);
    } catch {
      letzterFehler = t('wz_rec_speicher_fehler');
    }
    await ladeUndRendere(el);
  };
  mediaRecorder.start();
  aufnahmeLaeuft = true;
  startZeit = performance.now();
  zeichneKopf(el);
  tickTimer = window.setInterval(() => {
    const dauer = el.querySelector('.wz-ms-dauer');
    if (dauer) {
      const s = Math.floor((performance.now() - startZeit) / 1000);
      dauer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }, 200);
}

function stoppeAufnahme(el) {
  if (mediaRecorder && aufnahmeLaeuft) mediaRecorder.stop();
  aufnahmeLaeuft = false;
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  zeichneKopf(el);
}

function starteKlick() {
  const ctx = holeKontext();
  const ziel = holeAusgang();
  klickScheduler = klickScheduler || erzeugeScheduler(ctx);
  const proTakt = 4;
  klickScheduler.starte({
    schrittDauer: () => 60 / zustand.bpm,
    beiSchritt: (zeit, i) => klick(ctx, ziel, zeit, { akzent: i % proTakt === 0 }),
  });
}
function stoppeKlick() {
  if (klickScheduler) klickScheduler.stoppe();
}

// --- Rendern ---
function zeichneKopf(el) {
  const knopf = el.querySelector('.wz-ms-knopf');
  const anzeige = el.querySelector('.wz-ms-anzeige');
  const fehler = el.querySelector('.wz-ms-fehler');
  if (knopf) {
    knopf.classList.toggle('aufnahme', aufnahmeLaeuft);
    knopf.setAttribute('aria-pressed', String(aufnahmeLaeuft));
    const leit = spuren.length === 0;
    knopf.querySelector('.wz-ms-knopf-text').textContent = aufnahmeLaeuft ? t('wz_rec_stop') : leit ? t('wz_ms_leit_aufnehmen') : t('wz_ms_overdub');
    const icon = knopf.querySelector('i');
    if (icon) icon.className = aufnahmeLaeuft ? 'fa-solid fa-stop' : 'fa-solid fa-microphone';
  }
  if (anzeige) anzeige.hidden = !aufnahmeLaeuft;
  if (fehler) fehler.textContent = letzterFehler;
}

function spurHtml(spur, url) {
  const endung = mimeEndung(spur.mime || '');
  return `<li class="wz-ms-spur" data-id="${esc(spur.id)}">
    <div class="wz-ms-spur-kopf">
      <input type="text" class="wz-ms-name" value="${esc(spur.name || '')}" aria-label="${esc(t('wz_rec_name'))}">
      <span class="wz-ms-schalter">
        <button type="button" class="wz-ms-mini wz-ms-mute ${spur.mute ? 'aktiv' : ''}" aria-pressed="${!!spur.mute}" aria-label="${esc(t('wz_ms_mute'))}">M</button>
        <button type="button" class="wz-ms-mini wz-ms-solo ${spur.solo ? 'aktiv' : ''}" aria-pressed="${!!spur.solo}" aria-label="${esc(t('wz_ms_solo'))}">S</button>
      </span>
    </div>
    <audio class="wz-ms-audio" controls preload="none" src="${url}"></audio>
    <div class="wz-ms-pegel-zeile">
      <label>${esc(t('wz_ms_pegel'))} <input type="range" class="wz-ms-pegel" min="0" max="100" value="${Math.round((spur.pegel ?? 1) * 100)}" aria-label="${esc(t('wz_ms_pegel'))}"></label>
      <a class="chip chip-waehlbar wz-ms-download" href="${url}" download="${esc((spur.name || 'spur').replace(/[^\w-]+/g, '_'))}.${endung}"><i class="fa-solid fa-download" aria-hidden="true"></i> ${esc(t('wz_rec_download'))}</a>
      <button type="button" class="chip chip-waehlbar wz-ms-loeschen"><i class="fa-solid fa-xmark" aria-hidden="true"></i> ${esc(t('wz_rec_loeschen'))}</button>
    </div>
  </li>`;
}

async function ladeUndRendere(el) {
  for (const u of spurURLs) URL.revokeObjectURL(u);
  spurURLs = [];
  try {
    spuren = await alleSpuren();
  } catch {
    spuren = [];
  }
  const liste = el.querySelector('.wz-ms-liste');
  if (liste) {
    if (!spuren.length) {
      liste.innerHTML = `<li class="wz-pb-leer leise">${esc(t('wz_ms_leer'))}</li>`;
    } else {
      liste.innerHTML = spuren
        .map((spur) => {
          const url = URL.createObjectURL(spur.blob);
          spurURLs.push(url);
          return spurHtml(spur, url);
        })
        .join('');
      verdrahteSpuren(el);
    }
  }
  zeichneKopf(el);
}

export function renderWerkzeugMehrspur(el) {
  aufnahmeLaeuft = false;
  stoppeMix();
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-sliders" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_mehrspur_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_mehrspur_untertitel'))}</p>
        </div>
      </section>

      <div class="wz-rec-panel">
        <div class="wz-feld-reihe">
          <button type="button" class="chip chip-waehlbar wz-ms-klick ${zustand.klickAn ? 'chip-akzent' : ''}" aria-pressed="${zustand.klickAn}"><i class="fa-solid fa-stopwatch" aria-hidden="true"></i> ${esc(t('wz_ms_klick'))}</button>
          <label>${esc(t('wz_bpm'))}<input type="number" class="wz-ms-bpm" min="40" max="300" value="${zustand.bpm}"></label>
          <label>${esc(t('wz_ms_latenz'))}<input type="number" class="wz-ms-latenz" min="-300" max="300" step="5" value="${zustand.latenz}"></label>
        </div>
        <p class="wz-rec-knopf-zeile">
          <button type="button" class="knopf knopf-primaer wz-ms-knopf" aria-pressed="false">
            <i class="fa-solid fa-microphone" aria-hidden="true"></i> <span class="wz-ms-knopf-text">${esc(t('wz_ms_leit_aufnehmen'))}</span>
          </button>
          <button type="button" class="chip chip-waehlbar wz-ms-play"><i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(t('wz_ms_play'))}</button>
          <button type="button" class="chip chip-waehlbar wz-ms-stop"><i class="fa-solid fa-stop" aria-hidden="true"></i> ${esc(t('wz_ms_stop'))}</button>
          <span class="wz-rec-anzeige wz-ms-anzeige" hidden><span class="wz-rec-punkt" aria-hidden="true"></span> ${esc(t('wz_rec_laeuft'))} <span class="wz-ms-dauer">0:00</span></span>
        </p>
        <p class="wz-ms-fehler wz-rec-fehler leise" role="alert"></p>
        <p class="leise">${esc(t('wz_ms_latenz_hinweis'))}</p>
      </div>

      <h2 class="wz-pb-h">${esc(t('wz_ms_spuren'))}</h2>
      <ol class="wz-ms-liste"><li class="wz-pb-leer leise">${esc(t('wz_rec_lade'))}</li></ol>

      <p class="leise wz-metro-fuss">${esc(t('wz_ms_fuss'))}</p>
    </article>`;

  el.querySelector('.wz-ms-knopf')?.addEventListener('click', () => {
    if (aufnahmeLaeuft) stoppeAufnahme(el);
    else starteAufnahme(el);
  });
  el.querySelector('.wz-ms-play')?.addEventListener('click', () => spieleMix(el, hoerbare()));
  el.querySelector('.wz-ms-stop')?.addEventListener('click', () => stoppeMix());
  el.querySelector('.wz-ms-klick')?.addEventListener('click', (e) => {
    zustand.klickAn = !zustand.klickAn;
    e.currentTarget.classList.toggle('chip-akzent', zustand.klickAn);
    e.currentTarget.setAttribute('aria-pressed', String(zustand.klickAn));
  });
  el.querySelector('.wz-ms-bpm')?.addEventListener('change', (e) => {
    zustand.bpm = Math.max(40, Math.min(300, Math.round(Number(e.target.value) || zustand.bpm)));
    e.target.value = String(zustand.bpm);
  });
  el.querySelector('.wz-ms-latenz')?.addEventListener('change', (e) => {
    zustand.latenz = Math.max(-300, Math.min(300, Math.round(Number(e.target.value) || 0)));
    e.target.value = String(zustand.latenz);
  });
  ladeUndRendere(el);
}

function verdrahteSpuren(el) {
  for (const spurEl of el.querySelectorAll('.wz-ms-spur')) {
    const id = spurEl.dataset.id;
    const spur = spuren.find((s) => s.id === id);
    spurEl.querySelector('.wz-ms-name')?.addEventListener('change', (e) => aktualisiereSpur(id, { name: e.target.value }));
    spurEl.querySelector('.wz-ms-mute')?.addEventListener('click', async (e) => {
      const an = !(spur.mute);
      spur.mute = an;
      e.currentTarget.classList.toggle('aktiv', an);
      e.currentTarget.setAttribute('aria-pressed', String(an));
      await aktualisiereSpur(id, { mute: an });
    });
    spurEl.querySelector('.wz-ms-solo')?.addEventListener('click', async (e) => {
      const an = !(spur.solo);
      spur.solo = an;
      e.currentTarget.classList.toggle('aktiv', an);
      e.currentTarget.setAttribute('aria-pressed', String(an));
      await aktualisiereSpur(id, { solo: an });
    });
    spurEl.querySelector('.wz-ms-pegel')?.addEventListener('input', (e) => {
      spur.pegel = Number(e.target.value) / 100;
      const audio = spurEl.querySelector('.wz-ms-audio');
      if (audio) audio.volume = spur.pegel;
    });
    spurEl.querySelector('.wz-ms-pegel')?.addEventListener('change', (e) => aktualisiereSpur(id, { pegel: Number(e.target.value) / 100 }));
    spurEl.querySelector('.wz-ms-loeschen')?.addEventListener('click', async () => {
      await loescheSpur(id).catch(() => {});
      await ladeUndRendere(el);
    });
  }
}
