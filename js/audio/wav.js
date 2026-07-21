// WAV-Render (themenneutral, DOM-frei): rendert eine geplante Klangfolge über
// einen OfflineAudioContext in einen WAV-Blob — nützlich, um einen Klick-Track
// zu exportieren und in eine DAW zu importieren (DAW-tauglicher als WebM/Opus).
//
// Der Aufrufer bekommt einen Offline-Kontext und ein Ziel und plant dort dieselben
// Stimmen wie live ein (die Stimmen nehmen `ctx`+`ziel` entgegen). So klingt der
// Export identisch zum Live-Metronom.

// Plant `planeIn(ctx, ziel)` über `dauer` Sekunden und liefert einen WAV-Blob.
export async function rendereWav(dauer, planeIn, { sampleRate = 44100 } = {}) {
  const laenge = Math.ceil(dauer * sampleRate);
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, laenge, sampleRate);
  planeIn(ctx, ctx.destination);
  const puffer = await ctx.startRendering();
  return kodiereWav(puffer);
}

// AudioBuffer (Kanal 0) → 16-bit-PCM-WAV-Blob (RIFF/WAVE, mono).
function kodiereWav(puffer) {
  const daten = puffer.getChannelData(0);
  const n = daten.length;
  const bytesProSample = 2;
  const puffergroesse = 44 + n * bytesProSample;
  const ab = new ArrayBuffer(puffergroesse);
  const sicht = new DataView(ab);

  const schreibeText = (offset, text) => {
    for (let i = 0; i < text.length; i++) sicht.setUint8(offset + i, text.charCodeAt(i));
  };

  const rate = puffer.sampleRate;
  schreibeText(0, 'RIFF');
  sicht.setUint32(4, 36 + n * bytesProSample, true);
  schreibeText(8, 'WAVE');
  schreibeText(12, 'fmt ');
  sicht.setUint32(16, 16, true); // fmt-Chunk-Länge
  sicht.setUint16(20, 1, true); // PCM
  sicht.setUint16(22, 1, true); // mono
  sicht.setUint32(24, rate, true);
  sicht.setUint32(28, rate * bytesProSample, true); // Byte-Rate
  sicht.setUint16(32, bytesProSample, true); // Block-Align
  sicht.setUint16(34, 16, true); // Bits pro Sample
  schreibeText(36, 'data');
  sicht.setUint32(40, n * bytesProSample, true);

  // Float [-1,1] → 16-bit-PCM.
  let offset = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, daten[i]));
    sicht.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesProSample;
  }
  return new Blob([ab], { type: 'audio/wav' });
}
