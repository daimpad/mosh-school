// Audio-Kern (themenneutral, DOM-frei): lädt eine Klangprobe von einer URL und
// dekodiert sie zu einem AudioBuffer.
//
// Genutzt von zwei Stellen: dem Zerr-Labor, dessen ganze Aussage am
// Ausgangssignal hängt (wie formt eine Kennlinie ein ECHTES Instrument? Ein
// Sägezahn hat keine Saitenresonanz und kein Plektrum-Geräusch), und der
// Sample-Bank der Stimmen (samples.js). AudioBuffer sind nicht an einen Kontext
// gebunden — eine geladene Probe klingt live und im OfflineAudioContext gleich.
//
// Dieses Modul bleibt bewusst schmal:
// - Kein Sampler, keine Tonhöhen-Zuordnung, keine Velocity-Schichten. Das
//   entscheidet der Aufrufer (die Tonhöhen-Zuordnung steht in samples.js).
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
