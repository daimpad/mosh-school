// Mikrofon-Anbindung (themenneutral): holt einen Analyser aus dem geteilten
// AudioContext für die Live-Tonhöhen-Erkennung. Fragt `getUserMedia` erst beim
// Öffnen eines Mikro-Werkzeugs an; eine Ablehnung wird als Fehler geworfen und
// von der View sauber abgefangen. HTTPS ist über die PWA gegeben.
//
// Bewusst KEIN Routing des Mikros an den Ausgang (kein Monitoring) — sonst
// entstünde eine Rückkopplung. Der Analyser hängt nur am Quellzweig.

import { holeKontext } from './kontext.js';

// Öffnet das Mikro und liefert { analyser, stop() }. Wirft bei Ablehnung/kein
// Gerät.
//
// fftSize 8192 (170 ms bei 48 kHz), nicht 4096: Für die tiefste Saite im
// Stimmungs-Pool (A0, 27,5 Hz) ist eine Periode gut 1700 Samples lang, und eine
// stabile Autokorrelation braucht mehrere davon. Gemessen lag A0 mit 4096
// Samples um bis zu 17 Cent daneben — für ein Stimmgerät unbrauchbar, das
// „stimmt" bei ±5 Cent zieht —, mit 8192 unter 3 Cent. Die Kosten dafür trägt
// nicht die Fenstergröße, sondern die Suchstrategie: erkennePitch() sucht grob
// auf einem dezimierten Signal vor (js/audio/tonhoehe.js), deshalb ist die
// Analyse mit dem doppelt so langen Fenster trotzdem schneller als vorher.
export async function holeMikro({ fftSize = 8192 } = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('kein-mikro');
  }
  const strom = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  // Ab hier ist das Mikro AN. Scheitert der Aufbau danach (ungültiger/geschlossener
  // Kontext, z. B. nach einer iOS-Unterbrechung), muss der Strom wieder freigegeben
  // werden — sonst wirft die Funktion, die View sieht nur den Fehler, und das
  // Aufnahme-Symbol des Browsers leuchtet weiter, bis der Tab geschlossen wird.
  let quelle;
  let analyser;
  let puffer;
  try {
    const ctx = holeKontext();
    quelle = ctx.createMediaStreamSource(strom);
    analyser = ctx.createAnalyser();
    analyser.fftSize = fftSize;
    quelle.connect(analyser); // NICHT an destination — kein Monitoring, keine Rückkopplung
    puffer = new Float32Array(analyser.fftSize);
  } catch (fehler) {
    for (const spur of strom.getTracks()) spur.stop();
    throw fehler;
  }

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
