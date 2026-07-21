// Mikrofon-Anbindung (themenneutral): holt einen Analyser aus dem geteilten
// AudioContext für die Live-Tonhöhen-Erkennung. Fragt `getUserMedia` erst beim
// Öffnen eines Mikro-Werkzeugs an; eine Ablehnung wird als Fehler geworfen und
// von der View sauber abgefangen. HTTPS ist über die PWA gegeben.
//
// Bewusst KEIN Routing des Mikros an den Ausgang (kein Monitoring) — sonst
// entstünde eine Rückkopplung. Der Analyser hängt nur am Quellzweig.

import { holeKontext } from './kontext.js';

// Öffnet das Mikro und liefert { analyser, stop() }. Wirft bei Ablehnung/kein
// Gerät. fftSize groß (4096), damit tiefe Drop-Tunings ins Fenster passen.
export async function holeMikro({ fftSize = 4096 } = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('kein-mikro');
  }
  const strom = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = holeKontext();
  const quelle = ctx.createMediaStreamSource(strom);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  quelle.connect(analyser); // NICHT an destination — kein Monitoring, keine Rückkopplung
  const puffer = new Float32Array(analyser.fftSize);

  return {
    analyser,
    // Füllt den Puffer mit dem aktuellen Zeitsignal und gibt ihn zurück.
    liesZeitsignal() {
      analyser.getFloatTimeDomainData(puffer);
      return puffer;
    },
    stop() {
      try {
        quelle.disconnect();
      } catch {
        /* egal */
      }
      for (const spur of strom.getTracks()) spur.stop();
    },
  };
}
