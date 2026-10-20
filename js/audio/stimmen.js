// Klang-Stimmen (themenneutral, DOM-frei). Jede Stimme plant sich zu einem
// Zeitpunkt `zeit` (Audio-Uhr) an ein übergebenes Ziel (Master-Gain online, oder
// destination beim WAV-Export via OfflineAudioContext) — darum bekommt jede
// Stimme `ctx` UND `ziel` herein und hängt nichts fest verdrahtet an
// `destination`.
//
// Schlagzeug und Saiten spielen seit v236 die Sample-Bank (samples.js); die
// synthetische Fassung darunter bleibt der Rückfall, solange die Bank nicht
// geladen ist. Klick und Referenzton sind bewusst reine Synthese (s. samples.js).
//
// Jede Stimme gibt die Liste ihrer Klangquellen zurück — wer abbrechen muss
// (Pattern-Werkzeug), ruft darauf stop() auf, ohne zu wissen, ob ein Sample oder
// die Synthese gespielt hat.

import { holeRauschen } from './kontext.js';
import { SAMPLES, hatSample, spieleSample, waehleTon } from './samples.js';

// Spielt die Probe `name`, sonst die Synthese. Liefert die Quellen als Liste.
function mitRueckfall(ctx, ziel, zeit, name, synth) {
  const quelle = spieleSample(ctx, ziel, zeit, name);
  if (quelle) return [quelle];
  return [].concat(synth(ctx, ziel, zeit) || []);
}

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
  return [osc];
}

// Gesprochenes Einzählen: „Eins“ bis „Vier“ auf die Zählzeiten des
// Einzähltakts. Der Vokal soll auf dem Schlag liegen, deshalb startet die
// Probe um ihren `vorlauf` früher. Über vier hinaus (ungerade Takte) und ohne
// geladene Bank zählt der Klick — gezählt wird immer, nur nicht immer gesprochen.
// `dauer` kappt das Wort vor dem nächsten Schlag (bei schnellem Tempo).
export function zaehlwort(ctx, ziel, zeit, zahl, { dauer = null } = {}) {
  const name = `zaehl_${zahl}`;
  if (zahl >= 1 && zahl <= 4 && hatSample(name)) {
    const vorlauf = SAMPLES[name].vorlauf || 0;
    const start = Math.max(ctx.currentTime, zeit - vorlauf);
    return [spieleSample(ctx, ziel, start, name, { dauer: dauer ? dauer + (zeit - start) : null })];
  }
  return klick(ctx, ziel, zeit, { akzent: zahl === 1 });
}

// Kick: fallender Sinus (Ton → Bauch).
function kickSynth(ctx, ziel, zeit) {
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

function snareSynth(ctx, ziel, zeit) {
  const rauschen = rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 1400, dauer: 0.19, pegel: 0.5 });
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 190;
  huelle.gain.setValueAtTime(0.3, zeit);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.12);
  osc.connect(huelle).connect(ziel);
  osc.start(zeit);
  osc.stop(zeit + 0.14);
  return [rauschen, osc];
}

function hihatSynth(ctx, ziel, zeit) {
  return rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 8000, dauer: 0.05, pegel: 0.22 });
}

// Offene Hi-Hat: gleiche Rausch-Basis, deutlich längere Abklingzeit.
function hihatOffenSynth(ctx, ziel, zeit) {
  return rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 7000, dauer: 0.34, pegel: 0.18 });
}

function crashSynth(ctx, ziel, zeit) {
  return rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 5200, dauer: 0.45, pegel: 0.3 });
}

// China: trashiger, härter/länger als das Crash — der Metal-Akzent.
function chinaSynth(ctx, ziel, zeit) {
  return rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 4200, dauer: 0.52, pegel: 0.32 });
}

// Ride: Rausch-Wolke plus kurzer Glocken-Ping (Ping-Charakter statt Wash).
function rideSynth(ctx, ziel, zeit) {
  const rauschen = rauschStimme(ctx, ziel, zeit, { typ: 'highpass', frequenz: 9000, dauer: 0.3, pegel: 0.11 });
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 820;
  huelle.gain.setValueAtTime(0.09, zeit);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.26);
  osc.connect(huelle).connect(ziel);
  osc.start(zeit);
  osc.stop(zeit + 0.28);
  return [rauschen, osc];
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
  return osc;
}

export const kick = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'kick', kickSynth);
// Snare mit Betonung: -1 spielt die Ghost Note, +1 den Rimshot — die
// Klangfarbe eines leisen oder harten Schlags ist eine andere, nicht nur der
// Pegel (den regelt weiterhin der Aufrufer). Fehlt die Probe, die normale.
export function snare(ctx, ziel, zeit, { betonung = 0 } = {}) {
  const art = betonung < 0 ? 'snare_ghost' : betonung > 0 ? 'snare_rand' : null;
  if (art && hatSample(art)) return [spieleSample(ctx, ziel, zeit, art)];
  return mitRueckfall(ctx, ziel, zeit, 'snare', snareSynth);
}
export const hihat = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'hihat', hihatSynth);
export const hihatOffen = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'hihat_offen', hihatOffenSynth);
export const crash = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'crash', crashSynth);
export const china = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'china', chinaSynth);
export const ride = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'ride', rideSynth);
export const tomHoch = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'tom_hoch', (c, z, t) => tom(c, z, t, 240, 150));
export const tomTief = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'tom_tief', (c, z, t) => tom(c, z, t, 160, 95));
// Seit dem Ausbau der Bank: Klänge, die es vorher gar nicht gab. Ihr Rückfall
// ist die nächstverwandte Synthese, nicht Stille.
export const tomMitte = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'tom_mitte', (c, z, t) => tom(c, z, t, 200, 120));
export const rideGlocke = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'ride_glocke', rideSynth);
export const splash = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'splash', crashSynth);
export const stack = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'stack', chinaSynth);
export const hihatPedal = (ctx, ziel, zeit) => mitRueckfall(ctx, ziel, zeit, 'hihat_pedal', hihatSynth);

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

// Gezupfte Saite (Gitarre/Bass) — synthetischer Rückfall: zwei leicht
// verstimmte Sägezähne durch ein sich schließendes Tiefpassfilter mit schneller
// Zupf-Hüllkurve, leicht gesättigt. `gedaempft` macht den Ton kürzer und dunkler.
function saiteSynth(ctx, ziel, zeit, { frequenz, gedaempft, pegel, dauer: soll }) {
  const dauer = Math.min(soll ?? Infinity, gedaempft ? 0.14 : 0.55);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(gedaempft ? 1500 : 3200, zeit);
  filter.frequency.exponentialRampToValueAtTime(gedaempft ? 520 : 900, zeit + dauer);
  const shaper = ctx.createWaveShaper();
  shaper.curve = SAETTIGUNG;
  const huelle = ctx.createGain();
  huelle.gain.setValueAtTime(0.0001, zeit);
  huelle.gain.exponentialRampToValueAtTime((gedaempft ? 0.5 : 0.58) * pegel, zeit + 0.004);
  huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer);
  filter.connect(shaper).connect(huelle).connect(ziel);
  const quellen = [];
  for (const detune of [-4, 4]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = frequenz;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(zeit);
    osc.stop(zeit + dauer + 0.05);
    quellen.push(osc);
  }
  return quellen;
}

// Wie lange ein offener Ton klingt, wenn der Aufrufer nichts sagt — so lang
// wie die Synthese vorher. Die Proben selbst klingen länger aus; in einem Riff
// liefen die Töne sonst ineinander.
const OFFEN_DAUER = 0.6;
// Abgedämpfter Ton (Palm Mute, Dead Note): kurz und dunkel.
const GEDAEMPFT = { dauer: 0.16, tiefpass: { gitarre: 1800, bass: 900, gitarre_clean: 1400 } };

// Gezupfte Saite. Spielt die Sample-Bank (nächster Grundton, umgestimmt über die
// Abspielrate), sonst die Synthese.
//   instrument: 'gitarre' (Standard) oder 'bass'
//   klang:      'zerre' (Standard) oder 'clean' — nur Gitarre
//   gedaempft:  Palm Mute
//   tot:        Dead Note (Anschlag ohne Ton; Bass: kurzer gedämpfter Ton)
//   dauer:      Tonlänge in Sekunden (Standard: OFFEN_DAUER bzw. kurz bei gedaempft)
//   pegel:      Faktor, z. B. damit ein Akkord nicht lauter ist als ein Einzelton
export function saite(ctx, ziel, zeit, { frequenz, gedaempft = false, tot = false, instrument = 'gitarre', klang = 'zerre', dauer = null, pegel = 1 } = {}) {
  if (!frequenz || !Number.isFinite(frequenz)) return [];
  const gruppe = instrument === 'bass' ? 'bass' : klang === 'clean' ? 'gitarre_clean' : 'gitarre';
  // Dead Note: ein Anschlag ohne Ton. Die Probe hat keine Tonhöhe, die
  // umgestimmt werden müsste — sie klingt immer gleich.
  if (tot && gruppe === 'gitarre' && hatSample('gitarre_tot')) {
    return [spieleSample(ctx, ziel, zeit, 'gitarre_tot', { pegel })];
  }
  // Abgedämpft: eigene Proben (Chug, gedämpfter Bass), wenn geladen — ein
  // abgeschnittener offener Ton klingt nach Gate, nicht nach Handballen. Davon
  // gibt es je nur eine Probe; liegt sie mehr als 5 Halbtöne weg, spielt der
  // offene Ton mit Tiefpass (die Bank deckt jeden Ton innerhalb von 5 ab).
  const gedaempftGruppe = { gitarre: 'gitarre_chug', bass: 'bass_gedaempft' }[gruppe];
  const chug = (gedaempft || tot) && gedaempftGruppe ? waehleTon(gedaempftGruppe, frequenz, 5) : null;
  const ton = chug || waehleTon(gruppe, frequenz);
  if (ton) {
    const quelle = spieleSample(ctx, ziel, zeit, ton.name, {
      pegel,
      rate: ton.rate,
      dauer: gedaempft || tot ? Math.min(dauer ?? Infinity, tot ? GEDAEMPFT.dauer / 2 : GEDAEMPFT.dauer) : (dauer ?? OFFEN_DAUER),
      tiefpass: (gedaempft || tot) && !chug ? GEDAEMPFT.tiefpass[gruppe] : null,
    });
    if (quelle) return [quelle];
  }
  return saiteSynth(ctx, ziel, zeit, { frequenz, gedaempft: gedaempft || tot, pegel, dauer });
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
