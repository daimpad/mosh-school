// Audio-Kern (themenneutral, DOM-frei): lädt eine Klangprobe von einer URL und
// dekodiert sie zu einem AudioBuffer.
//
// Der Kern ist ansonsten synthese-only, und das bleibt die Regel — eine Stimme,
// die live und im OfflineAudioContext identisch klingen soll, baut man nicht aus
// einer Datei. Für ein Werkzeug, dessen ganze Aussage am Ausgangssignal hängt
// (Zerr-Labor: wie formt eine Kennlinie ein ECHTES Instrument?), reicht Synthese
// aber nicht: Ein Sägezahn hat keine Saitenresonanz und kein Plektrum-Geräusch,
// also klingt jede Kennlinie darauf gleich plausibel.
//
// Deshalb dieses eine Modul — bewusst schmal:
// - Kein Sampler, keine Tonhöhen-Zuordnung, keine Velocity-Schichten. Das
//   aufrufende Werkzeug entscheidet, was es mit dem Puffer anstellt.
// - Ein Cache je URL, damit ein Neustart der Kette nicht neu lädt.
// - Fehler werden NICHT geschluckt: Wer offline ist, soll das Werkzeug auf die
//   synthetische Quelle zurückfallen lassen können, statt stumm dazustehen.

const speicher = new Map();   // url → Promise<AudioBuffer>

// Lädt und dekodiert einmal je URL. Wiederholte Aufrufe liefern denselben
// Puffer; ein fehlgeschlagener Versuch wird vergessen, damit ein späterer
// Versuch (wieder online) erneut lädt.
export function ladeKlangprobe(ctx, url) {
  const vorhanden = speicher.get(url);
  if (vorhanden) return vorhanden;
  const lauf = fetch(url)
    .then((antwort) => {
      if (!antwort.ok) throw new Error(`Klangprobe ${url}: HTTP ${antwort.status}`);
      return antwort.arrayBuffer();
    })
    // decodeAudioData rechnet dabei auf die Abtastrate des Kontexts um.
    .then((roh) => ctx.decodeAudioData(roh))
    .catch((fehler) => {
      speicher.delete(url);
      throw fehler;
    });
  speicher.set(url, lauf);
  return lauf;
}
