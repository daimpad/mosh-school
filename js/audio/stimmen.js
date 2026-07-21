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

export function crash(ctx, ziel, zeit) {
  rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 5200, dauer: 0.45, pegel: 0.3 });
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
