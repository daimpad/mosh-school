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
  // Genre-Groove-Bausteine öffnen den passenden Play-along-Beat vorbelegt.
  d_beat: [{ werkzeug: 'loops', params: { beat: 'd_beat' } }],
  blastbeat: [{ werkzeug: 'loops', params: { beat: 'blastbeat' } }],
  galopp_rhythmus: [{ werkzeug: 'loops', params: { beat: 'thrash_galopp' } }],
  metalcore_groove: [{ werkzeug: 'loops', params: { beat: 'metalcore_groove' } }],
  doom_feel: [{ werkzeug: 'loops', params: { beat: 'doom_feel' } }],
  // Tuning-/Ton-Bausteine öffnen das Stimmgerät; Tonzentrum-/Gesangs-Bausteine
  // die Referenzton-Drone vorbelegt.
  drop_tuning: [{ werkzeug: 'stimmgeraet', params: { tuning: 'drop_d' } }],
  duo_bv_tonzentrum: [{ werkzeug: 'stimmgeraet', params: { note: 'E2' } }],
  duo_gv_tonart_melodie: [{ werkzeug: 'stimmgeraet', params: { note: 'E2' } }],
  tonhoehe_clean: [{ werkzeug: 'stimmgeraet', params: { note: 'A2' } }],
  // Signalketten-/Sound-Bausteine öffnen den Pedalboard-Baukasten (und den
  // Amp-/Box-Baukasten als Fortsetzung der Signalkette Pedalboard → Amp → Box).
  pedalboard_grundlagen: [{ werkzeug: 'pedalboard' }, { werkzeug: 'ampbox' }],
  gitarren_sound_architektur: [{ werkzeug: 'pedalboard', params: { instrument: 'gitarre' } }, { werkzeug: 'ampbox', params: { instrument: 'gitarre' } }],
  bass_signalkette: [{ werkzeug: 'pedalboard', params: { instrument: 'bass' } }, { werkzeug: 'ampbox', params: { instrument: 'bass' } }],
  bass_ton_gear: [{ werkzeug: 'stimmgeraet', params: { tuning: 'bass_standard' } }, { werkzeug: 'pedalboard', params: { instrument: 'bass' } }, { werkzeug: 'ampbox', params: { instrument: 'bass' } }],
  // Amp-/Box-Bausteine öffnen den Physik-Baukasten vorbelegt.
  amp_grundlagen: [{ werkzeug: 'ampbox' }],
  box_grundlagen: [{ werkzeug: 'ampbox' }],
  // Songwriting-/Arrangement-Bausteine öffnen den Song-Struktur-Baukasten.
  song_arrangieren_ganz: [{ werkzeug: 'struktur' }],
  parts_verteilen: [{ werkzeug: 'struktur' }],
  uebergaenge_arrangieren: [{ werkzeug: 'struktur' }],
  // Ideen-Bausteine öffnen den Riff-Recorder.
  songidee_teilen: [{ werkzeug: 'recorder' }],
  riff_zu_part_entwickeln: [{ werkzeug: 'recorder' }],
  // Aufnahme-/Pre-Production-Bausteine öffnen den Skizzen-Mehrspur-Rekorder.
  tracking_reihenfolge: [{ werkzeug: 'mehrspur' }, { werkzeug: 'metronom' }],
  pre_production_plan: [{ werkzeug: 'mehrspur' }, { werkzeug: 'metronom' }],
  signal_aufnehmen: [{ werkzeug: 'mehrspur' }, { werkzeug: 'recorder' }],
};

// Genres, für die ein Play-along-Loop existiert (deckungsgleich mit STIL_ZU_BEAT
// in werkzeug-loops.js). Nur diese lösen die generische Loop-Regel aus.
const LOOP_STILE = new Set([
  'hardcore', 'crust', 'powerviolence', 'grindcore', 'black_metal', 'death_metal',
  'thrash', 'metalcore', 'djent', 'deathcore', 'doom', 'sludge', 'stoner_post',
]);

// Generische Regeln: liefern für einen Baustein passende Werkzeug-Links.
// Jede Regel bekommt den Baustein und gibt ein Link-Objekt oder null zurück.
const GENERISCHE_REGELN = [
  // Jede Übung mit dem Spielziel „timing_zum_klick" kann das Metronom öffnen.
  (b) => ((b.spielziele || []).includes('timing_zum_klick') ? { werkzeug: 'metronom', params: { bpm: '160' } } : null),
  // Bausteine mit einem Genre, für das es einen Loop gibt, öffnen ihn vorbelegt.
  (b) => {
    const stil = (b.stil || []).find((s) => LOOP_STILE.has(s));
    return stil ? { werkzeug: 'loops', params: { stil } } : null;
  },
];

// Verfügbare Werkzeuge (Route + i18n-Schlüssel für Beschriftung). Wächst mit den
// weiteren PRs (loops, stimmgeraet, struktur, riff-recorder, mehrspur).
const WERKZEUG_META = {
  metronom: { route: '#/werkzeug/metronom', labelKey: 'wz_metronom_titel' },
  loops: { route: '#/werkzeug/loops', labelKey: 'wz_loops_titel' },
  stimmgeraet: { route: '#/werkzeug/stimmgeraet', labelKey: 'wz_stimmgeraet_titel' },
  pedalboard: { route: '#/werkzeug/pedalboard', labelKey: 'wz_pedalboard_titel' },
  ampbox: { route: '#/werkzeug/ampbox', labelKey: 'wz_ampbox_titel' },
  struktur: { route: '#/werkzeug/struktur', labelKey: 'wz_struktur_titel' },
  recorder: { route: '#/werkzeug/recorder', labelKey: 'wz_recorder_titel' },
  mehrspur: { route: '#/werkzeug/mehrspur', labelKey: 'wz_mehrspur_titel' },
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
