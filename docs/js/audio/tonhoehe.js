// Tonhöhen-Erkennung (themenneutral, DOM-frei): Grundfrequenz aus einem Zeit-
// signal per Autokorrelation. Von Hand, keine Bibliothek. Robust genug für tiefe
// Drop-Tunings (großes Fenster nötig — der Aufrufer liefert einen langen Puffer).
//
// erkennePitch(buf, sampleRate) → Hz | null. `null` bei zu leisem/rauschigem
// Signal. Danach frequenzTrifft() → { note, oktave, cents } für die Anzeige.

// Autokorrelation mit RMS-Gate und parabolischer Interpolation am Peak.
export function erkennePitch(buf, sampleRate, { minFreq = 40, maxFreq = 1200 } = {}) {
  const n = buf.length;
  // 1) RMS-Gate: zu leise → kein verlässlicher Ton.
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return null;

  const minOffset = Math.floor(sampleRate / maxFreq);
  const maxOffset = Math.min(n - 1, Math.ceil(sampleRate / minFreq));

  // 2) Normierte Autokorrelation über den ganzen Offset-Bereich sammeln.
  const akf = new Float32Array(maxOffset + 2);
  let maxKorr = 0;
  for (let offset = minOffset; offset <= maxOffset; offset++) {
    let korr = 0;
    for (let i = 0; i < n - offset; i++) korr += buf[i] * buf[i + offset];
    korr /= n - offset;
    akf[offset] = korr;
    if (korr > maxKorr) maxKorr = korr;
  }
  if (maxKorr < 0.0001) return null;

  // 3) ERSTEN lokalen Peak oberhalb einer Schwelle nehmen — die kürzeste Periode
  //    ist der Grundton. Das vermeidet den Suboktav-Fehler (doppelte Periode ist
  //    fast gleich stark und würde als globales Maximum die halbe Frequenz liefern).
  const schwelle = 0.9 * maxKorr;
  let besterOffset = -1;
  for (let offset = minOffset + 1; offset < maxOffset; offset++) {
    if (akf[offset] >= schwelle && akf[offset] >= akf[offset - 1] && akf[offset] >= akf[offset + 1]) {
      besterOffset = offset;
      break;
    }
  }
  if (besterOffset < 0) return null;

  // 4) Parabolische Interpolation um den Peak für Sub-Sample-Genauigkeit.
  const o = besterOffset;
  let feinOffset = o;
  const y0 = akf[o - 1];
  const y1 = akf[o];
  const y2 = akf[o + 1];
  const nenner = y0 - 2 * y1 + y2;
  if (nenner !== 0) feinOffset = o + (0.5 * (y0 - y2)) / nenner;

  const freq = sampleRate / feinOffset;
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
