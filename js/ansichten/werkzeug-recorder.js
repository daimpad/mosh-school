// Werkzeug: Riff-Recorder (Ideen-Archiv). Ein-Tipp-Aufnahme über getUserMedia +
// MediaRecorder; Clips in einer lokalen Bibliothek (IndexedDB, js/audio/riff-db.js)
// mit Name, Tempo, Notiz und Datum. Zweck: Ideen festhalten, bevor sie verloren
// gehen. Kein geteilter AudioContext nötig — MediaRecorder arbeitet direkt auf dem
// Mikro-Stream, Wiedergabe über ein <audio>-Element.
//
// Export je Clip als Download (das aufgenommene Format, i. d. R. WebM/Opus).
// Mikro-Ablehnung wird sauber abgefangen.

import { t } from '../i18n.js';
import { esc, meilensteinLabel, zeigeMeilenstein } from '../oberflaeche.js';
import { feiereMeilenstein } from '../zustand.js';
import { speichereClip, alleClips, aktualisiereMeta, loescheClip } from '../audio/riff-db.js';

let aufnahmeLaeuft = false;
let mediaRecorder = null;
let strom = null;
let stuecke = [];
let tickTimer = null;
let startZeit = 0;
let clipURLs = [];
let letzterFehler = '';
const zustand = { tempo: 0 };

function mimeEndung(mime) {
  if (/webm/.test(mime)) return 'webm';
  if (/mp4/.test(mime)) return 'm4a';
  if (/ogg/.test(mime)) return 'ogg';
  return 'audio';
}
function waehleMime() {
  const kandidaten = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const m of kandidaten) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}
function datumText(ms) {
  try {
    return new Date(ms).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

// --- Aufnahme ---
async function starteAufnahme(el) {
  letzterFehler = '';
  if (typeof MediaRecorder === 'undefined') {
    letzterFehler = t('wz_rec_kein_recorder');
    zeichneKopf(el);
    return;
  }
  try {
    strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (fehler) {
    letzterFehler = fehler && fehler.name === 'NotAllowedError' ? t('wz_rec_verweigert') : t('wz_rec_kein_mikro');
    zeichneKopf(el);
    return;
  }
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
    const anzahl = (await alleClips().catch(() => [])).length;
    const clip = {
      id: 'r' + Date.now(),
      name: t('wz_rec_default', { n: anzahl + 1 }),
      tempo: zustand.tempo || 0,
      notiz: '',
      datum: Date.now(),
      blob,
      mime: blob.type,
    };
    let gespeichert = false;
    try {
      await speichereClip(clip);
      gespeichert = true;
    } catch {
      letzterFehler = t('wz_rec_speicher_fehler');
    }
    await ladeUndRendere(el);
    // Meilenstein „erstes eigenes Riff" (§5) — nach dem Rendern feiern, damit die
    // Überlagerung nicht gleich wieder übermalt wird.
    if (gespeichert && feiereMeilenstein('erstes_riff')) {
      zeigeMeilenstein({ text: meilensteinLabel('erstes_riff') });
    }
  };
  mediaRecorder.start();
  aufnahmeLaeuft = true;
  startZeit = performance.now();
  zeichneKopf(el);
  tickTimer = window.setInterval(() => {
    const dauer = el.querySelector('.wz-rec-dauer');
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

// --- Rendern ---
function zeichneKopf(el) {
  const knopf = el.querySelector('.wz-rec-knopf');
  const anzeige = el.querySelector('.wz-rec-anzeige');
  const fehler = el.querySelector('.wz-rec-fehler');
  if (knopf) {
    knopf.classList.toggle('aufnahme', aufnahmeLaeuft);
    knopf.setAttribute('aria-pressed', String(aufnahmeLaeuft));
    knopf.querySelector('.wz-rec-knopf-text').textContent = aufnahmeLaeuft ? t('wz_rec_stop') : t('wz_rec_start');
    const icon = knopf.querySelector('i');
    if (icon) icon.className = aufnahmeLaeuft ? 'fa-solid fa-stop' : 'fa-solid fa-microphone';
  }
  if (anzeige) anzeige.hidden = !aufnahmeLaeuft;
  if (fehler) fehler.textContent = letzterFehler;
}

function clipHtml(clip, url) {
  const endung = mimeEndung(clip.mime || '');
  return `<li class="wz-rec-clip" data-id="${esc(clip.id)}">
    <div class="wz-rec-clip-kopf">
      <input type="text" class="wz-rec-name" value="${esc(clip.name || '')}" aria-label="${esc(t('wz_rec_name'))}">
      <span class="wz-rec-datum leise">${esc(datumText(clip.datum))}</span>
    </div>
    <audio class="wz-rec-audio" controls preload="none" src="${url}"></audio>
    <div class="wz-feld-reihe wz-rec-meta">
      <label>${esc(t('wz_rec_tempo'))}<input type="number" class="wz-rec-tempo" min="0" max="400" value="${clip.tempo || 0}"></label>
      <label class="wz-rec-notiz-feld">${esc(t('wz_rec_notiz'))}<input type="text" class="wz-rec-notiz" value="${esc(clip.notiz || '')}" placeholder="${esc(t('wz_rec_notiz_ph'))}"></label>
    </div>
    <p class="chip-zeile">
      <a class="chip chip-waehlbar wz-rec-download" href="${url}" download="${esc((clip.name || 'riff').replace(/[^\w-]+/g, '_'))}.${endung}"><i class="fa-solid fa-download" aria-hidden="true"></i> ${esc(t('wz_rec_download'))}</a>
      <button type="button" class="chip chip-waehlbar wz-rec-loeschen"><i class="fa-solid fa-xmark" aria-hidden="true"></i> ${esc(t('wz_rec_loeschen'))}</button>
    </p>
  </li>`;
}

async function ladeUndRendere(el) {
  // Alte Objekt-URLs freigeben, bevor neue erzeugt werden.
  for (const u of clipURLs) URL.revokeObjectURL(u);
  clipURLs = [];
  const liste = el.querySelector('.wz-rec-liste');
  if (!liste) return;
  let clips;
  try {
    clips = await alleClips();
  } catch {
    liste.innerHTML = `<li class="wz-pb-leer leise">${esc(t('wz_rec_db_fehler'))}</li>`;
    return;
  }
  if (!clips.length) {
    liste.innerHTML = `<li class="wz-pb-leer leise">${esc(t('wz_rec_leer'))}</li>`;
    return;
  }
  liste.innerHTML = clips
    .map((clip) => {
      const url = URL.createObjectURL(clip.blob);
      clipURLs.push(url);
      return clipHtml(clip, url);
    })
    .join('');
  verdrahteClips(el);
}

export function renderWerkzeugRecorder(el) {
  aufnahmeLaeuft = false;
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-microphone" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_recorder_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_recorder_untertitel'))}</p>
        </div>
      </section>

      <div class="wz-rec-panel">
        <div class="wz-feld-reihe">
          <label>${esc(t('wz_rec_tempo_neu'))}<input type="number" class="wz-rec-tempo-neu" min="0" max="400" value="${zustand.tempo}" placeholder="0"></label>
        </div>
        <p class="wz-rec-knopf-zeile">
          <button type="button" class="knopf knopf-primaer wz-rec-knopf" aria-pressed="false">
            <i class="fa-solid fa-microphone" aria-hidden="true"></i> <span class="wz-rec-knopf-text">${esc(t('wz_rec_start'))}</span>
          </button>
          <span class="wz-rec-anzeige" hidden><span class="wz-rec-punkt" aria-hidden="true"></span> ${esc(t('wz_rec_laeuft'))} <span class="wz-rec-dauer">0:00</span></span>
        </p>
        <p class="wz-rec-fehler leise" role="alert"></p>
      </div>

      <h2 class="wz-pb-h">${esc(t('wz_rec_bibliothek'))}</h2>
      <ol class="wz-rec-liste"><li class="wz-pb-leer leise">${esc(t('wz_rec_lade'))}</li></ol>

      <p class="leise wz-metro-fuss">${esc(t('wz_rec_fuss'))}</p>
    </article>`;

  el.querySelector('.wz-rec-knopf')?.addEventListener('click', () => {
    if (aufnahmeLaeuft) stoppeAufnahme(el);
    else starteAufnahme(el);
  });
  el.querySelector('.wz-rec-tempo-neu')?.addEventListener('change', (e) => {
    zustand.tempo = Math.max(0, Math.min(400, Math.round(Number(e.target.value) || 0)));
    e.target.value = String(zustand.tempo);
  });
  ladeUndRendere(el);
}

function verdrahteClips(el) {
  for (const clipEl of el.querySelectorAll('.wz-rec-clip')) {
    const id = clipEl.dataset.id;
    clipEl.querySelector('.wz-rec-name')?.addEventListener('change', (e) => aktualisiereMeta(id, { name: e.target.value }));
    clipEl.querySelector('.wz-rec-notiz')?.addEventListener('change', (e) => aktualisiereMeta(id, { notiz: e.target.value }));
    clipEl.querySelector('.wz-rec-tempo')?.addEventListener('change', (e) => aktualisiereMeta(id, { tempo: Math.max(0, Math.round(Number(e.target.value) || 0)) }));
    clipEl.querySelector('.wz-rec-loeschen')?.addEventListener('click', async () => {
      await loescheClip(id).catch(() => {});
      await ladeUndRendere(el);
    });
  }
}
