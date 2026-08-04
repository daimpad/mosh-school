// Tonhöhen-Erkennung (themenneutral, DOM-frei): Grundfrequenz aus einem Zeit-
// signal per Autokorrelation. Von Hand, keine Bibliothek.
//
// erkennePitch(buf, sampleRate) → Hz | null. `null` bei zu leisem/rauschigem
// Signal. Danach frequenzTrifft() → { note, oktave, cents } für die Anzeige.
//
// WARUM DIE UNTERGRENZE BEI 25 Hz LIEGT
// Sie lag bei 40 Hz — und damit ÜBER neun Saiten, die data/tunings.json selbst
// anbietet: das tiefe A eines Drop-A-Fünfsaiters (27,5 Hz), das tiefe H von
// Fünf- und Sechssaitern (30,87 Hz), das C eines C-Basses (32,7 Hz), das tiefe
// D eines Achtsaiters (36,71 Hz). Das Stimmgerät liest denselben Pool wie die
// Stimmungs-Referenz, zeigte diese Stimmungen als Chips an und konnte ihre
// tiefste Saite nicht erkennen — ohne Fehlermeldung, es blieb einfach bei „—".
//
// WARUM ZWEISTUFIG
// Für 27,5 Hz braucht es ein langes Fenster: Eine Periode sind bei 48 kHz gut
// 1700 Samples, und für eine stabile Autokorrelation braucht man mehrere davon.
// Gemessen: Mit 4096 Samples liegt A0 um bis zu 17 Cent daneben (für ein
// Stimmgerät unbrauchbar — „stimmt" heißt hier ±5 Cent), mit 8192 unter 3 Cent.
// Die volle Autokorrelation über 8192 Samples kostet aber 22 ms; der Tuner
// analysiert alle 33 ms, das wäre zwei Drittel eines Kerns.
//
// Deshalb: grob auf einem um Faktor 4 dezimierten Signal suchen (12 kHz reichen
// für alles bis 1200 Hz mit Reserve), dann NUR um den gefundenen Versatz herum
// bei voller Abtastrate nachschärfen. Das ist schneller als die alte Fassung
// UND deckt den ganzen Bereich ab.

const DEZIMIERUNG = 4;

// Mittelung über je `faktor` Samples — halbiert die Rate und wirkt zugleich als
// grober Tiefpass gegen Aliasing. Ein sauberer FIR wäre schöner, aber wir suchen
// hier nur den ungefähren Versatz; die Genauigkeit macht der zweite Durchgang.
function dezimiere(buf, faktor) {
  const m = Math.floor(buf.length / faktor);
  const out = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    let s = 0;
    for (let k = 0; k < faktor; k++) s += buf[i * faktor + k];
    out[i] = s / faktor;
  }
  return out;
}

// Normierte Autokorrelation über einen Versatzbereich; liefert den ERSTEN
// lokalen Peak oberhalb der Schwelle. Die kürzeste Periode ist der Grundton —
// das globale Maximum wäre bei doppelter Periode fast gleich stark und ergäbe
// die halbe Frequenz (klassischer Suboktav-Fehler).
function ersterPeak(buf, vonOffset, bisOffset) {
  const n = buf.length;
  const akf = new Float32Array(bisOffset + 2);
  let maxKorr = 0;
  for (let offset = vonOffset; offset <= bisOffset; offset++) {
    let korr = 0;
    for (let i = 0; i < n - offset; i++) korr += buf[i] * buf[i + offset];
    korr /= n - offset;
    akf[offset] = korr;
    if (korr > maxKorr) maxKorr = korr;
  }
  if (maxKorr < 0.0001) return null;

  const schwelle = 0.9 * maxKorr;
  for (let offset = vonOffset + 1; offset < bisOffset; offset++) {
    if (akf[offset] >= schwelle && akf[offset] >= akf[offset - 1] && akf[offset] >= akf[offset + 1]) {
      // Parabolische Interpolation um den Peak für Sub-Sample-Genauigkeit.
      const y0 = akf[offset - 1];
      const y1 = akf[offset];
      const y2 = akf[offset + 1];
      const nenner = y0 - 2 * y1 + y2;
      return nenner !== 0 ? offset + (0.5 * (y0 - y2)) / nenner : offset;
    }
  }
  return null;
}

export function erkennePitch(buf, sampleRate, { minFreq = 25, maxFreq = 1200 } = {}) {
  const n = buf.length;
  // RMS-Gate: zu leise → kein verlässlicher Ton.
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return null;

  // 1) Grobsuche auf dem dezimierten Signal über den ganzen Bereich.
  const grobRate = sampleRate / DEZIMIERUNG;
  const grob = dezimiere(buf, DEZIMIERUNG);
  const grobVon = Math.max(2, Math.floor(grobRate / maxFreq));
  const grobBis = Math.min(grob.length - 2, Math.ceil(grobRate / minFreq));
  if (grobBis <= grobVon + 1) return null;
  const grobOffset = ersterPeak(grob, grobVon, grobBis);
  if (grobOffset === null) return null;

  // 2) Feinsuche bei voller Abtastrate, nur im Fenster um den groben Versatz.
  //    Die Grobsuche kann um ein dezimiertes Sample danebenliegen, das sind
  //    DEZIMIERUNG volle Samples — mit Reserve das Doppelte absuchen.
  const mitte = grobOffset * DEZIMIERUNG;
  const spanne = DEZIMIERUNG * 2 + 2;
  const feinVon = Math.max(2, Math.floor(mitte - spanne));
  const feinBis = Math.min(n - 2, Math.ceil(mitte + spanne));
  const feinOffset = feinBis > feinVon + 1 ? ersterPeak(buf, feinVon, feinBis) : null;

  // Findet die Feinsuche keinen Peak (etwa weil das Fenster genau zwischen zwei
  // Flanken liegt), gilt das Grobergebnis — lieber etwas ungenauer als gar nichts.
  const versatz = feinOffset !== null ? feinOffset : mitte;
  const freq = sampleRate / versatz;
  if (freq < minFreq || freq > maxFreq) return null;
  return freq;
}

const NOTEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Frequenz → nächste Note (wissenschaftlich, A4 = 440) + Cent-Abweichung.
export function frequenzTrifft(freq) {
  if (!freq || freq <= 0) return null;
  const midiExakt = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiExakt);
  const cents = Math.round((midiExakt - midi) * 100);
  const note = NOTEN[((midi % 12) + 12) % 12];
  const oktave = Math.floor(midi / 12) - 1;
  return { note, oktave, cents, midi };
}
