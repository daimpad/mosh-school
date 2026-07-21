// Lookahead-Scheduler (themenneutral, DOM-frei) — das Herz aller Timing-Werkzeuge.
//
// Muster „A Tale of Two Clocks" (Chris Wilson): ein grober setTimeout-Tick
// (~25 ms) blickt jeweils ein kleines Fenster (~100 ms) in die Zukunft und plant
// alle in diesem Fenster fälligen Schritte exakt gegen die Audio-Uhr
// (AudioContext.currentTime) ein. Naives setInterval driftet hörbar und ist für
// Klick/Loops unzulässig — hier trägt die präzise Audio-Uhr das Timing, der
// Timer weckt nur rechtzeitig zum Nachplanen.
//
// Schritt-basiert und tempo-agnostisch: `schrittDauer(i)` liefert die Dauer des
// i-ten Schritts in Sekunden. Konstant → Metronom; steigend → Tempo-Ramp; aus
// einer Tabelle → Tempo-Map (Song-Struktur). `null` beendet den Lauf. So bedient
// EIN Scheduler Metronom, Loops und Tempo-Maps.

const TICK_MS = 25; // wie oft der Timer aufwacht
const PLANUNG_S = 0.1; // wie weit im Voraus geplant wird

export function erzeugeScheduler(ctx) {
  let timer = null;
  let laufend = false;
  let schritt = 0;
  let naechsteZeit = 0;
  let konfig = null;

  function tick() {
    // Alle Schritte einplanen, deren Zeit ins Planungsfenster fällt.
    while (naechsteZeit < ctx.currentTime + PLANUNG_S) {
      const dauer = konfig.schrittDauer(schritt);
      if (dauer == null) {
        // Tempo-Map/Sequenz zu Ende: nach dem letzten Schritt sauber stoppen.
        const endeMs = Math.max(0, (naechsteZeit - ctx.currentTime) * 1000);
        laufend = false;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (konfig.beiEnde) window.setTimeout(konfig.beiEnde, endeMs);
        return;
      }
      konfig.beiSchritt(naechsteZeit, schritt);
      naechsteZeit += dauer;
      schritt += 1;
    }
    timer = window.setTimeout(tick, TICK_MS);
  }

  // Startet einen Lauf. konfig: { schrittDauer(i)->s|null, beiSchritt(zeit,i), beiEnde? }
  // vorlauf: kleiner Vorlauf in Sekunden, bevor der erste Schritt klingt.
  function starte(neueKonfig, vorlauf = 0.12) {
    stoppe();
    konfig = neueKonfig;
    schritt = 0;
    naechsteZeit = ctx.currentTime + vorlauf;
    laufend = true;
    tick();
  }

  function stoppe() {
    laufend = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    starte,
    stoppe,
    istLaufend: () => laufend,
  };
}
