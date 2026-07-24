// Audio-Kern (themenneutral, DOM-frei): EIN AudioContext für alle Werkzeuge.
//
// Warum zentral: mehrere AudioContexts pro Seite sind teuer und limitiert, und
// die Autoplay-Policy verlangt, dass Audio erst nach einer User-Geste startet.
// Darum kapselt dieses Modul den einen Kontext, seinen Master-Gain und den
// geteilten Rausch-Puffer — jedes Werkzeug holt sich denselben Kern.
//
// Nutzung: beim ersten Antippen `aktiviere()` (aus einem Klick-Handler heraus)
// aufrufen; danach liefert `holeKontext()` einen laufenden Kontext. `istBereit()`
// sagt, ob schon aktiviert wurde (für den „Audio aktivieren"-Schritt der Views).

let kontext = null;
let masterGain = null;
let rauschPuffer = null;

// Erzeugt den Kontext beim ersten Bedarf. NICHT von selbst resume()n — das
// übernimmt `aktiviere()` aus einer echten User-Geste (Autoplay-Policy).
export function holeKontext() {
  if (!kontext) {
    kontext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = kontext.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(kontext.destination);
  }
  return kontext;
}

// Der gemeinsame Ausgang: alle Stimmen hängen sich hier ein, nicht direkt an
// destination — so lässt sich global pegeln/stummschalten.
export function holeAusgang() {
  holeKontext();
  return masterGain;
}

// Aus einem Klick/Tap heraus aufrufen: erzeugt (falls nötig) den Kontext und
// resume()t ihn. Gibt ein Promise auf den laufenden Kontext zurück.
export async function aktiviere() {
  const ctx = holeKontext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* manche Browser lehnen resume() ausserhalb einer Geste ab — dann bleibt
         der Kontext suspended und die View zeigt weiter „Audio aktivieren". */
    }
  }
  return ctx;
}

// true, sobald der Kontext existiert und läuft — steuert den Aktivierungs-Schritt.
export function istBereit() {
  return !!kontext && kontext.state === 'running';
}

// Eine Sekunde weißes Rauschen, einmal erzeugt — Basis für Snare/Hi-Hat/Klick.
// An einen Ziel-Kontext gebunden (auch OfflineAudioContext beim WAV-Export).
export function holeRauschen(ctx) {
  if (ctx === kontext && rauschPuffer) return rauschPuffer;
  const puffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const daten = puffer.getChannelData(0);
  for (let i = 0; i < daten.length; i++) daten[i] = Math.random() * 2 - 1;
  if (ctx === kontext) rauschPuffer = puffer;
  return puffer;
}
