// Boxensimulation: synthetisierte Impulsantworten für den ConvolverNode.
// Themenneutral und DOM-frei wie der übrige Audio-Kern.
//
// WARUM SYNTHESE STATT GEMESSENER IMPULSANTWORTEN
// Gemessene Cabinet-IRs wären klanglich näher am Original, bringen aber zwei
// Probleme, die dieses Projekt nicht haben will: Sie sind Binärdateien fremder
// Herkunft (Lizenz muss je Datei belegt werden, sonst ist das Repo nicht mehr
// sauber weiterverwendbar), und sie bilden ein KONKRETES Modell ab — genau das,
// was `data/zerrtypen.json` bewusst vermeidet („alle Typen sind funktional
// benannt, Modelle stehen nur in brand-alert.json"). Hier gilt dieselbe Regel:
// eine Box ist eine Bauart, kein Produkt.
//
// Die Impulsantwort entsteht deshalb aus einem beschriebenen Modell in
// data/boxen.json. Sie ist ausdrücklich KEINE Messung und wird in der Ansicht
// auch so benannt.
//
// WARUM ÜBERHAUPT FALTUNG UND NICHT NUR FILTER
// Wäre die Impulsantwort nur die Antwort einer Biquad-Kette, könnte man die
// Filter genauso gut direkt in den Signalweg hängen — die Faltung brächte
// nichts. Den Unterschied macht, was eine Filterkette NICHT kann:
//   1. Kammfilter durch den Mikrofonabstand (zwei Laufzeiten überlagern sich),
//   2. abklingende Reflexionen im Gehäuse (kurzer, gefärbter Rauschschwanz).
// Beides steckt hier in der Zeitachse der Impulsantwort. Genau daran hört man
// den Unterschied zwischen „bandbegrenzt" und „klingt nach Box".

const SCHALL_M_PRO_S = 343;

// --- deterministisches Rauschen -------------------------------------------
// Dieselbe Box muss über Reloads hinweg identisch klingen; ein Math.random()
// würde den Reflexionsschwanz bei jedem Aufruf neu würfeln und die Box bei
// jedem Wechsel anders färben. Fester Seed je Box-ID (FNV-1a wie anderswo).
function saatVon(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

function rauschQuelle(saat) {
  let z = saat >>> 0;
  return () => {
    // xorshift32 — klein, deterministisch, für Rauschen völlig ausreichend.
    z ^= z << 13; z >>>= 0;
    z ^= z >>> 17;
    z ^= z << 5; z >>>= 0;
    return (z / 0xffffffff) * 2 - 1;
  };
}

// --- Biquads (RBJ-Kochbuch), als reine Sample-Rechnung ---------------------
// Bewusst von Hand statt über BiquadFilterNode: Die Impulsantwort wird EINMAL
// als Zahlenfeld gebaut; ein Node-Graph dafür bräuchte einen
// OfflineAudioContext und wäre nicht in Python nachrechenbar
// (scripts/pruefe_boxen.py spiegelt genau diese Formeln).
function biquad(art, f0, sr, q, verstaerkungDb = 0) {
  const w0 = (2 * Math.PI * f0) / sr;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (art === 'lowpass') {
    b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0;
    a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
  } else if (art === 'highpass') {
    b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0;
    a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
  } else { // peaking
    const A = 10 ** (verstaerkungDb / 40);
    b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A;
    a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function filtere(daten, koeff) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < daten.length; i++) {
    const x = daten[i];
    const y = koeff.b0 * x + koeff.b1 * x1 + koeff.b2 * x2 - koeff.a1 * y1 - koeff.a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    daten[i] = y;
  }
  return daten;
}

// Rohe Impulsantwort als Float-Array — ohne AudioContext, damit
// scripts/pruefe_boxen.py dieselbe Rechnung nachvollziehen kann.
export function impulsantwortDaten(box, sampleRate) {
  const laenge = Math.max(64, Math.round((box.dauer_ms / 1000) * sampleRate));
  const d = new Float64Array(laenge);

  // 1. Direktschall
  d[0] = 1;

  // 2. Mikrofonabstand: derselbe Impuls ein zweites Mal, um die Laufzeit
  //    versetzt. Die Überlagerung erzeugt den Kammfilter — bei 5 cm liegt die
  //    erste Auslöschung bei rund 3,4 kHz, mitten im Präsenzbereich.
  const versatz = Math.round((box.mikro_abstand_cm / 100 / SCHALL_M_PRO_S) * sampleRate);
  if (versatz > 0 && versatz < laenge) d[versatz] += box.mikro_pegel ?? 0.6;

  // 3. Gehäuse-Reflexionen: kurzer, exponentiell abklingender Rauschschwanz.
  //    Eine geschlossene Box klingt trockener (kleiner Pegel, kurze Zeit), eine
  //    offene atmet mehr.
  const rnd = rauschQuelle(saatVon(box.id));
  const tau = Math.max(1, (box.reflexion_ms / 1000) * sampleRate);
  for (let i = 1; i < laenge; i++) {
    d[i] += rnd() * box.reflexion_pegel * Math.exp(-i / tau);
  }

  // 4. Bandbegrenzung. Der steile Höhenabfall ist DAS Merkmal eines
  //    Lautsprechers: zwei kaskadierte Tiefpässe (24 dB/Okt.) statt eines
  //    einzelnen — mit nur einem klingt es gefiltert, nicht nach Box.
  filtere(d, biquad('highpass', box.hochpass_hz, sampleRate, 0.7));
  filtere(d, biquad('lowpass', box.tiefpass_hz, sampleRate, 0.7));
  filtere(d, biquad('lowpass', box.tiefpass_hz, sampleRate, 0.7));
  if (box.praesenz_db) {
    filtere(d, biquad('peaking', box.praesenz_hz, sampleRate, box.praesenz_guete ?? 1.2, box.praesenz_db));
  }

  // 5. Auf Spitzenwert normieren. Ohne das schwankt die Lautstärke beim
  //    Box-Wechsel um mehrere dB, und man vergleicht Pegel statt Klang.
  let spitze = 0;
  for (let i = 0; i < laenge; i++) spitze = Math.max(spitze, Math.abs(d[i]));
  if (spitze > 0) for (let i = 0; i < laenge; i++) d[i] /= spitze;
  return d;
}

// AudioBuffer für den ConvolverNode. Mono genügt: die Boxensimulation ist eine
// Klangfarbe, kein Raum — eine Stereo-IR täuschte eine Breite vor, die eine
// einzeln mikrofonierte Box nicht hat.
export function impulsantwort(ctx, box) {
  const daten = impulsantwortDaten(box, ctx.sampleRate);
  const puffer = ctx.createBuffer(1, daten.length, ctx.sampleRate);
  const kanal = puffer.getChannelData(0);
  for (let i = 0; i < daten.length; i++) kanal[i] = daten[i];
  return puffer;
}

// Fertige Kette Eingang → Convolver → Ausgangs-Gain. Der Aufrufer verbindet
// eingang/ausgang selbst und ruft trenne() beim Abbau (wie zerre.js).
export function baueBox(ctx, box) {
  const eingang = ctx.createGain();
  const ausgang = ctx.createGain();
  const faltung = ctx.createConvolver();
  faltung.normalize = false; // wir normieren selbst (siehe oben)
  faltung.buffer = impulsantwort(ctx, box);
  // Die Faltung senkt den Pegel spürbar (Bandbegrenzung nimmt Energie weg);
  // ohne Ausgleich wirkt jede Box leiser als „ohne Box" und man vergleicht
  // wieder Lautstärke statt Klang.
  ausgang.gain.value = box.ausgleich ?? 2.2;
  eingang.connect(faltung);
  faltung.connect(ausgang);
  return {
    eingang,
    ausgang,
    trenne() {
      eingang.disconnect();
      faltung.disconnect();
      ausgang.disconnect();
    },
  };
}
