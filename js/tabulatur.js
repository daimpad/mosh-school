// Tabulatur-Parser: ASCII-Tabs → spielbare Ereignisse. Themenneutral und
// DOM-frei, damit die Ansicht nur noch zeichnet und der Parser prüfbar bleibt.
//
// WARUM ASCII UND KEIN EIGENES FORMAT
// ASCII-Tabs sind das Format, in dem Tabulaturen seit dreissig Jahren durchs
// Netz gehen. Wer eine Zeile aus einem Forum kopiert, soll sie einfügen können,
// statt sie in eine Maske zu übertragen. Ein eigenes Format wäre sauberer und
// würde nicht benutzt.
//
// WAS BEWUSST NICHT UNTERSTÜTZT WIRD
// Bindungen (h/p), Slides (/ \) und Bendings (b) werden als Ton erkannt, aber
// nicht als Spielweise nachgebildet — der Audio-Kern kann sie nicht, und ein
// stillschweigend falsch klingender Slide wäre schlechter als ein einfacher
// Anschlag. Sie erscheinen deshalb als Hinweis, nicht als Fehler.
//
// Eine Spalte = ein Schritt. Das ist die Leseweise, die ASCII-Tabs selbst
// nahelegen (Zeichenraster = Zeitraster) — genauer wird es nur mit
// Notenwerten, und die stehen in einem ASCII-Tab nicht drin.

// Zeile eines Tabs: optionaler Saitenname, dann Rasterzeichen. Mindestens vier
// Rasterzeichen, sonst hält der Parser jede Textzeile mit Bindestrich für Tab.
const TAB_ZEILE = /^\s*([A-Ga-g][#b]?)?\s*\|?([-0-9xX|hHpPbB/\\~ ]{4,})$/;
const GEDAEMPFT = new Set(['x', 'X']);

// Zeichen, die eine Spielweise meinen, die der Audio-Kern nicht nachbildet.
const UNGESPIELT = { h: 'hammer_on', p: 'pull_off', b: 'bending', '/': 'slide_hoch', '\\': 'slide_runter', '~': 'vibrato' };

// Zusammenhängende Rasterzeilen bilden einen Block (ein „System"). Ein langer
// Tab besteht aus mehreren Blöcken untereinander, die zeitlich HINTEREINANDER
// gehören — sie werden deshalb spaltenweise aneinandergehängt.
function bloecke(text) {
  const gefunden = [];
  let laufend = [];
  for (const z of String(text || '').split(/\r?\n/)) {
    const m = TAB_ZEILE.exec(z);
    if (m) {
      laufend.push({ name: m[1] || null, inhalt: m[2] });
    } else {
      if (laufend.length) gefunden.push(laufend);
      laufend = [];
    }
  }
  if (laufend.length) gefunden.push(laufend);
  // Innerhalb eines Blocks haben echte Saitenzeilen dieselbe Länge. Eine
  // Trennlinie aus Bindestrichen direkt über dem Tab ist von einer leeren Saite
  // sonst nicht zu unterscheiden — und würde die Saitennummerierung um eins
  // verschieben, also jeden Ton eine Saite zu tief spielen. Die häufigste
  // Zeilenlänge gewinnt.
  const gefiltert = gefunden.map((b) => {
    const haeufigkeit = new Map();
    for (const z of b) haeufigkeit.set(z.inhalt.length, (haeufigkeit.get(z.inhalt.length) || 0) + 1);
    const modal = [...haeufigkeit.entries()].sort((a, c) => c[1] - a[1] || c[0] - a[0])[0][0];
    return b.filter((z) => z.inhalt.length === modal);
  });
  // Ein Block zählt nur, wenn IRGENDEINE seiner Zeilen einen Ton trägt. Damit
  // fallen reine Trennlinien heraus — die leeren Saiten INNERHALB eines echten
  // Blocks bleiben aber erhalten. Genau daran hing ein Fehler: Werden leere
  // Zeilen einzeln verworfen, wird aus einem Sechssaiter ein Zweisaiter, und
  // jeder Ton landet auf der falschen Saite (und damit auf der falschen Höhe).
  return gefiltert.filter((b) => b.length && b.some((z) => /[0-9xX]/.test(z.inhalt)));
}

export function parseTabulatur(text) {
  const gefunden = bloecke(text);
  if (!gefunden.length) return { saiten: 0, spalten: 0, events: [], namen: [], hinweise: [], leer: true };

  // Saitenzahl bestimmt der erste Block; Blöcke mit abweichender Zeilenzahl
  // werden übersprungen statt verbogen (sie meinen etwas anderes).
  const saitenZahl = gefunden[0].length;
  const passende = gefunden.filter((b) => b.length === saitenZahl);
  const saitenZeilen = Array.from({ length: saitenZahl }, (_, i) => ({
    name: gefunden[0][i].name,
    inhalt: passende.map((b) => b[i].inhalt).join(''),
  }));

  const events = [];
  const hinweise = new Set();
  let spalten = 0;

  saitenZeilen.forEach((zeile, index) => {
    const saiteNr = index + 1; // 1 = oberste Zeile = höchste Saite
    const s = zeile.inhalt;
    let spalte = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '|' || c === ' ') continue; // Taktstriche zählen nicht als Zeit
      if (c >= '0' && c <= '9') {
        // Mehrstellige Bünde: 12 ist ein Ton, nicht 1 und 2. Greedy lesen und
        // die verbrauchten Zeichen als EINE Spalte zählen — sonst verschiebt
        // sich alles dahinter, und zwar nur in den Zeilen mit hohen Bünden.
        let ziffern = c;
        while (i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '9' && ziffern.length < 2) {
          ziffern += s[++i];
        }
        events.push({ schritt: spalte, saite: saiteNr, bund: Number(ziffern), technik: 'normal' });
      } else if (GEDAEMPFT.has(c)) {
        events.push({ schritt: spalte, saite: saiteNr, bund: 0, technik: 'dead_note' });
      } else if (UNGESPIELT[c.toLowerCase()]) {
        hinweise.add(UNGESPIELT[c.toLowerCase()]);
      }
      spalte += 1;
    }
    spalten = Math.max(spalten, spalte);
  });

  return {
    saiten: saitenZeilen.length,
    spalten,
    events,
    namen: saitenZeilen.map((z) => z.name),
    hinweise: [...hinweise],
    leer: false,
  };
}

// Notenname je Saite: bevorzugt die gewählte Stimmung, sonst die Namen aus dem
// Tab selbst. Zeile 1 ist die HÖCHSTE Saite — die Stimmung kommt tiefste
// zuerst, muss also gedreht werden. Genau hier lag beim Stimmgerät schon
// einmal ein Ton auf der falschen Saite.
export function saitenNoten(tab, stimmung) {
  const anzahl = tab.saiten;
  if (Array.isArray(stimmung) && stimmung.length === anzahl) {
    return [...stimmung].reverse();
  }
  return tab.namen.map((n, i) => (n ? `${n}${anzahl - i <= 2 ? 3 : 2}` : null));
}
