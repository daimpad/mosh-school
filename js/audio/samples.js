// Audio-Kern (themenneutral, DOM-frei): die Sample-Bank für Schlagzeug, Gitarre
// und Bass.
//
// Bis dahin war der Kern reine Synthese — Kick als fallender Sinus, Snare und
// Becken als gefiltertes Rauschen, Saiten als Sägezahn. Das trägt ein Metronom,
// klingt in einem Drum-Groove oder einem Riff aber nach Spielzeug. Seitdem
// spielen die Stimmen in stimmen.js echte One-Shots, die mit ElevenLabs (Sound
// Effects v2) erzeugt und von scripts/build_samples.mjs aufbereitet wurden;
// Herkunft und Auswahl stehen in assets/sounds/samples/HERKUNFT.txt.
//
// Drei Regeln:
// - SYNTHESE BLEIBT DER RÜCKFALL. Bis die Bank geladen ist, offline ohne Cache
//   oder wenn eine Datei fehlt, spielt jede Stimme ihre synthetische Fassung.
//   Kein Werkzeug darf stumm bleiben, weil ein Sample nicht da ist.
// - EIN PUFFER, ZWEI KONTEXTE. AudioBuffer sind nicht an einen Kontext gebunden:
//   Derselbe dekodierte Puffer spielt live und im OfflineAudioContext (WAV-
//   Export) identisch — die Regel aus stimmen.js gilt weiter.
// - TONHÖHE ÜBER DIE ABSPIELRATE. Gitarre und Bass liegen in wenigen Grundtönen
//   vor; jeder Ton wird vom nächstgelegenen aus über playbackRate erreicht. Der
//   Grundton ist GEMESSEN (build_samples.mjs prüft ihn auf ±10 Cent nach), nicht
//   angenommen — ElevenLabs trifft eine verlangte Tonhöhe nicht verlässlich.
//   Das Stimmgerät und der Referenzton bleiben deshalb synthetisch: Dort zählt
//   jeder Cent, und der kommt aus einem Oszillator genauer als aus einer Probe.

import { ladeKlangprobe } from './klangprobe.js';

const ORDNER = 'assets/sounds/samples/';

// pegel: Mischpegel. Eingemessen gegen die synthetische Fassung derselben
// Stimme (lautestes 50-ms-Fenster gleich laut), damit Kick, Becken und Saiten
// untereinander so stehen wie vorher und ein Wechsel Sample ↔ Rückfall nicht
// springt. Alle Dateien sind auf denselben Spitzenwert normiert; der Pegel
// gleicht aus, was die Normierung nicht kann (ein Becken ist bei gleicher
// Spitze viel lauter als eine Kick).
// grundton: gemessene Tonhöhe in Hz (nur Gitarre/Bass).
export const SAMPLES = {
  kick: { datei: 'kick.wav', pegel: 0.93 },
  snare: { datei: 'snare.wav', pegel: 0.73 },
  hihat: { datei: 'hihat.wav', pegel: 0.18 },
  hihat_offen: { datei: 'hihat-offen.wav', pegel: 0.26 },
  crash: { datei: 'crash.wav', pegel: 0.56 },
  china: { datei: 'china.wav', pegel: 0.44 },
  ride: { datei: 'ride.wav', pegel: 0.26 },
  tom_hoch: { datei: 'tom-hoch.wav', pegel: 0.49 },
  tom_tief: { datei: 'tom-tief.wav', pegel: 0.79 },
  gitarre_zerre_e2: { datei: 'gitarre-zerre-e2.wav', pegel: 0.78, gruppe: 'gitarre', grundton: 82.5 },
  gitarre_zerre_b2: { datei: 'gitarre-zerre-b2.wav', pegel: 0.59, gruppe: 'gitarre', grundton: 123.8 },
  gitarre_zerre_fis3: { datei: 'gitarre-zerre-fis3.wav', pegel: 0.72, gruppe: 'gitarre', grundton: 186.2 },
  gitarre_zerre_f4: { datei: 'gitarre-zerre-f4.wav', pegel: 1.25, gruppe: 'gitarre', grundton: 349.9 },
  gitarre_zerre_a4: { datei: 'gitarre-zerre-a4.wav', pegel: 1.0, gruppe: 'gitarre', grundton: 436.9 },
  gitarre_chug_e2: { datei: 'gitarre-chug-e2.wav', pegel: 0.35, gruppe: 'gitarre_chug', grundton: 83.0 },
  gitarre_chug_b2: { datei: 'gitarre-chug-b2.wav', pegel: 0.34, gruppe: 'gitarre_chug', grundton: 123.7 },
  gitarre_clean_a3: { datei: 'gitarre-clean-a3.wav', pegel: 0.75, gruppe: 'gitarre_clean', grundton: 220.1 },
  bass_e1: { datei: 'bass-e1.wav', pegel: 0.75, gruppe: 'bass', grundton: 41.3 },
  bass_b1: { datei: 'bass-b1.wav', pegel: 0.77, gruppe: 'bass', grundton: 62.0 },
  bass_e2: { datei: 'bass-e2.wav', pegel: 0.84, gruppe: 'bass', grundton: 82.3 },
};

const puffer = new Map();   // name → AudioBuffer
let ladung = null;

// Lädt alle Proben einmal (nebenläufig). Fehler einzelner Dateien werden
// geschluckt — dann bleibt für genau diese Stimme die Synthese. Ein zweiter
// Aufruf nach einem Fehlschlag (wieder online) versucht es erneut.
export function ladeSamples(ctx) {
  if (ladung) return ladung;
  ladung = Promise.all(
    Object.entries(SAMPLES).map(([name, s]) =>
      ladeKlangprobe(ctx, ORDNER + s.datei)
        .then((b) => puffer.set(name, b))
        .catch(() => {})
    )
  ).then(() => {
    if (puffer.size < Object.keys(SAMPLES).length) ladung = null;
    return puffer.size;
  });
  return ladung;
}

export function hatSample(name) {
  return puffer.has(name);
}

// Spielt eine Probe zum Zeitpunkt `zeit` an `ziel`. Gibt die Quelle zurück
// (zum Abbrechen) — oder null, wenn die Probe nicht geladen ist; dann spielt
// der Aufrufer seine Synthese.
//   pegel: Faktor auf den Mischpegel der Probe
//   rate:  Abspielrate (Tonhöhe)
//   dauer: Ton nach dieser Zeit kurz ausblenden (abgestoppter Ton); ohne Angabe
//          klingt die Probe natürlich aus
//   tiefpass: Eckfrequenz eines Tiefpasses (abgedämpfter Ton)
export function spieleSample(ctx, ziel, zeit, name, { pegel = 1, rate = 1, dauer = null, tiefpass = null } = {}) {
  const b = puffer.get(name);
  if (!b) return null;
  const quelle = ctx.createBufferSource();
  quelle.buffer = b;
  quelle.playbackRate.value = rate;
  const huelle = ctx.createGain();
  const p = (SAMPLES[name]?.pegel ?? 1) * pegel;
  huelle.gain.setValueAtTime(p, zeit);
  let kette = quelle;
  if (tiefpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = tiefpass;
    kette = kette.connect(filter);
  }
  kette.connect(huelle).connect(ziel);
  quelle.start(zeit);
  // stop() erst nach start() — umgekehrt wirft die Web-Audio-API.
  if (dauer != null && dauer < b.duration / rate) {
    huelle.gain.setValueAtTime(p, zeit + dauer);
    huelle.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer + 0.06);
    quelle.stop(zeit + dauer + 0.08);
  }
  return quelle;
}

// Grundtöne je Gruppe, aufsteigend — für die Suche nach dem nächsten.
const GRUPPEN = {};
for (const [name, s] of Object.entries(SAMPLES)) {
  if (!s.gruppe) continue;
  (GRUPPEN[s.gruppe] ||= []).push({ name, grundton: s.grundton });
}
for (const liste of Object.values(GRUPPEN)) liste.sort((a, b) => a.grundton - b.grundton);

// Wählt in einer Gruppe die Probe, deren Grundton der gewünschten Frequenz am
// nächsten liegt (im Tonabstand, nicht in Hz), und liefert Name + Abspielrate.
// Nur geladene Proben zählen. null, wenn die Gruppe nichts geladen hat.
export function waehleTon(gruppe, frequenz) {
  let bestes = null;
  for (const k of GRUPPEN[gruppe] || []) {
    if (!puffer.has(k.name)) continue;
    const abstand = Math.abs(Math.log2(frequenz / k.grundton));
    if (!bestes || abstand < bestes.abstand) bestes = { name: k.name, rate: frequenz / k.grundton, abstand };
  }
  return bestes;
}
