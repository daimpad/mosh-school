// Verlinkungs-Konvention Baustein → Werkzeug (themenneutral, DOM-frei).
//
// Der Kernnutzen der Werkzeuge entsteht, wenn ein Baustein sie VORBELEGT öffnet:
// eine Timing-Übung startet das Metronom mit passendem Tempo, ein Tuning-Baustein
// öffnet das Stimmgerät, ein Gesangs-Baustein den Referenzton.
//
// KONVENTION (in CLAUDE.md dokumentiert):
//   Route-Form:  #/werkzeug/<name>?<preset>
//   Preset:      einfache Query-Parameter, die die Werkzeug-View beim Laden liest
//                (z. B. bpm, rampe, stil, note). Unbekannte Parameter ignoriert
//                die View — Vorbelegung ist immer optional.
//
// Zwei Ebenen, spezifisch schlägt generisch:
//   1. ID_REGELN     — explizite Zuordnung für einzelne Bausteine.
//   2. GENERISCH      — Regeln über spielziele/stil/domaene, die viele Bausteine
//                       auf einmal anbinden (z. B. jede Timing-Übung → Metronom).
//
// Neue Anbindungen NUR hier ergänzen — die Werkzeuge selbst bleiben unabhängig
// und kennen die Bausteine nicht.

// Explizite Baustein-ID → Werkzeug(e). params werden zu Query-Parametern.
const ID_REGELN = {
  metronom_prinzip: [{ werkzeug: 'metronom' }],
  mentale_temposteigerung: [{ werkzeug: 'metronom', params: { rampe: '1' } }],
  pre_production_plan: [{ werkzeug: 'metronom' }],
  tracking_reihenfolge: [{ werkzeug: 'metronom' }],
};

// Generische Regeln: liefern für einen Baustein passende Werkzeug-Links.
// Jede Regel bekommt den Baustein und gibt ein Link-Objekt oder null zurück.
const GENERISCHE_REGELN = [
  // Jede Übung mit dem Spielziel „timing_zum_klick" kann das Metronom öffnen.
  (b) => ((b.spielziele || []).includes('timing_zum_klick') ? { werkzeug: 'metronom', params: { bpm: '160' } } : null),
];

// Verfügbare Werkzeuge (Route + i18n-Schlüssel für Beschriftung). Wächst mit den
// weiteren PRs (loops, stimmgeraet, struktur, riff-recorder, mehrspur).
const WERKZEUG_META = {
  metronom: { route: '#/werkzeug/metronom', labelKey: 'wz_metronom_titel' },
};

// Baut eine Route mit Query-Preset: #/werkzeug/metronom?bpm=160&rampe=1
export function werkzeugRoute(werkzeug, params) {
  const basis = WERKZEUG_META[werkzeug]?.route || `#/werkzeug/${werkzeug}`;
  const query = new URLSearchParams(params || {}).toString();
  return query ? `${basis}?${query}` : basis;
}

// Liefert die Werkzeug-Links für einen Baustein, dedupliziert (ID-Regel schlägt
// generische Regel für dasselbe Werkzeug). Form: [{ werkzeug, route, labelKey }].
export function werkzeugeFuer(baustein) {
  if (!baustein) return [];
  const roh = [];
  for (const eintrag of ID_REGELN[baustein.id] || []) roh.push(eintrag);
  for (const regel of GENERISCHE_REGELN) {
    const treffer = regel(baustein);
    if (treffer) roh.push(treffer);
  }
  const gesehen = new Set();
  const links = [];
  for (const { werkzeug, params } of roh) {
    if (gesehen.has(werkzeug)) continue; // erstes (spezifischstes) Vorkommen gewinnt
    gesehen.add(werkzeug);
    const meta = WERKZEUG_META[werkzeug];
    if (!meta) continue;
    links.push({ werkzeug, route: werkzeugRoute(werkzeug, params), labelKey: meta.labelKey });
  }
  return links;
}
