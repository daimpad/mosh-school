// Synthetisierte Klang-Stimmen (themenneutral, DOM-frei). Kein Sample-Gewicht,
// voll offline. Jede Stimme plant sich zu einem Zeitpunkt `zeit` (Audio-Uhr) an
// ein übergebenes Ziel (Master-Gain online, oder destination beim WAV-Export via
// OfflineAudioContext) — darum bekommt jede Stimme `ctx` UND `ziel` herein und
// hängt nichts fest verdrahtet an `destination`.

import { holeRauschen } from './kontext.js';

// Klick fürs Metronom: kurzer Sinus-Ping. Akzent (die Eins) höher + lauter,
// damit die Betonung auch nicht-farblich (hörbar) klar ist.
export function klick(ctx, ziel, zeit, { akzent = false, leise = false } = {}) {
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = akzent ? 1600 : leise ? 760 : 1000;
  const pegel = akzent ? 0.5 : leise ? 0.14 : 0.32;
  huelle.gain.setValueAtTime(0.0001, zeit);
  huelle.gain.exponentialRampToValueAtTime(pegel, zeit + 0.001);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.04);
  osc.connect(huelle).connect(ziel);
  osc.start(zeit);
  osc.stop(zeit + 0.05);
  return osc;
}

// Kick: fallender Sinus (Ton → Bauch). Für Play-along-Loops (PR 2).
export function kick(ctx, ziel, zeit) {
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(125, zeit);
  osc.frequency.exponentialRampToValueAtTime(46, zeit + 0.11);
  huelle.gain.setValueAtTime(0.9, zeit);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.16);
  osc.connect(huelle).connect(ziel);
  osc.start(zeit);
  osc.stop(zeit + 0.18);
  return osc;
}

// Gefilterte Rausch-Stimme — Basis für Snare/Hi-Hat/Crash.
function rauschStimme(ctx, ziel, zeit, { typ, frequenz, guete, dauer, pegel }) {
  const quelle = ctx.createBufferSource();
  quelle.buffer = holeRauschen(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = typ;
  filter.frequency.value = frequenz;
  if (guete) filter.Q.value = guete;
  const huelle = ctx.createGain();
  huelle.gain.setValueAtTime(pegel, zeit);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer);
  quelle.connect(filter).connect(huelle).connect(ziel);
  quelle.start(zeit);
  quelle.stop(zeit + dauer + 0.02);
  return quelle;
}

export function snare(ctx, ziel, zeit) {
  rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 1400, dauer: 0.19, pegel: 0.5 });
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 190;
  huelle.gain.setValueAtTime(0.3, zeit);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.12);
  osc.connect(huelle).connect(ziel);
  osc.start(zeit);
  osc.stop(zeit + 0.14);
}

export function hihat(ctx, ziel, zeit) {
  rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 8000, dauer: 0.05, pegel: 0.22 });
}

// Offene Hi-Hat: gleiche Rausch-Basis, deutlich längere Abklingzeit.
export function hihatOffen(ctx, ziel, zeit) {
  rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 7000, dauer: 0.34, pegel: 0.18 });
}

export function crash(ctx, ziel, zeit) {
  rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 5200, dauer: 0.45, pegel: 0.3 });
}

// China: trashiger, härter/länger als das Crash — der Metal-Akzent.
export function china(ctx, ziel, zeit) {
  rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 4200, dauer: 0.52, pegel: 0.32 });
}

// Ride: Rausch-Wolke plus kurzer Glocken-Ping (Ping-Charakter statt Wash).
export function ride(ctx, ziel, zeit) {
  rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 9000, dauer: 0.3, pegel: 0.11 });
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 820;
  huelle.gain.setValueAtTime(0.09, zeit);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.26);
  osc.connect(huelle).connect(ziel);
  osc.start(zeit);
  osc.stop(zeit + 0.28);
}

// Tom: fallender Sinus (wie Kick, aber höher gestimmt und kürzer). hoch/tief über
// die Start-/Zielfrequenz.
function tom(ctx, ziel, zeit, start, ende) {
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(start, zeit);
  osc.frequency.exponentialRampToValueAtTime(ende, zeit + 0.18);
  huelle.gain.setValueAtTime(0.7, zeit);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.24);
  osc.connect(huelle).connect(ziel);
  osc.start(zeit);
  osc.stop(zeit + 0.26);
}
export function tomHoch(ctx, ziel, zeit) { tom(ctx, ziel, zeit, 240, 150); }
export function tomTief(ctx, ziel, zeit) { tom(ctx, ziel, zeit, 160, 95); }

// Weiche Sättigungskurve (tanh) für etwas Charakter/„Zerre" an der Saite.
const SAETTIGUNG = (() => {
  const n = 256;
  const kurve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    kurve[i] = Math.tanh(x * 2);
  }
  return kurve;
})();

// Gezupfte Saite (Gitarre/Bass): zwei leicht verstimmte Sägezähne durch ein sich
// schließendes Tiefpassfilter mit schneller Zupf-Hüllkurve, leicht gesättigt.
// `gedaempft` (palm mute / dead note) macht Ton kürzer und dunkler.
export function saite(ctx, ziel, zeit, { frequenz, gedaempft = false } = {}) {
  if (!frequenz || !Number.isFinite(frequenz)) return;
  const dauer = gedaempft ? 0.14 : 0.55;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(gedaempft ? 1500 : 3200, zeit);
  filter.frequency.exponentialRampToValueAtTime(gedaempft ? 520 : 900, zeit + dauer);
  const shaper = ctx.createWaveShaper();
  shaper.curve = SAETTIGUNG;
  const huelle = ctx.createGain();
  huelle.gain.setValueAtTime(0.0001, zeit);
  huelle.gain.exponentialRampToValueAtTime(gedaempft ? 0.5 : 0.58, zeit + 0.004);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer);
  filter.connect(shaper).connect(huelle).connect(ziel);
  for (const detune of [-4, 4]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = frequenz;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(zeit);
    osc.stop(zeit + dauer + 0.05);
  }
}

// Gehaltener Referenzton (Drone): weicher Sägezahn mit sanfter Ein-/Ausblende.
// Zum Stimmen nach Gehör und als Grundton-Drone für Gesangsübungen. Gibt ein
// Handle mit stop() zurück (rampt aus, statt hart abzuschneiden).
export function referenzDrone(ctx, ziel, frequenz) {
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = frequenz;
  const jetzt = ctx.currentTime;
  huelle.gain.setValueAtTime(0.0001, jetzt);
  huelle.gain.exponentialRampToValueAtTime(0.12, jetzt + 0.05);
  osc.connect(huelle).connect(ziel);
  osc.start(jetzt);
  let gestoppt = false;
  return {
    setzeFrequenz(f) {
      osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.02);
    },
    stop() {
      if (gestoppt) return;
      gestoppt = true;
      const t = ctx.currentTime;
      huelle.gain.cancelScheduledValues(t);
      huelle.gain.setValueAtTime(huelle.gain.value, t);
      huelle.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.stop(t + 0.1);
    },
  };
}
