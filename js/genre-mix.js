// Genre-Mix-Logik (Grenzgänger-Zweig): reine Funktionen über die
// Gefühlslandkarte-Daten (x=Energie/Tempo, y=Grundton, Gefühls-Tags). DOM-frei,
// themenneutral im Sinne der Engine — die Views (Landkarte + Generator) lesen
// hier, rendern selbst.
//
// Kernideen (aus der Übergabe):
//   • Distanz zweier Punkte  ≈  Spannung (weite, seltene Paare sind reizvoller).
//   • Gemeinsame/benachbarte Gefühls-Tags  ≈  Brücke (die verbindende Linie).
//   • „Häufige Fusionen" werden abgewertet, damit der Zufall ins Ungewohnte zieht.
//
// Nichts hier wertet oder sperrt inhaltlich — es ordnet Vorschläge. Der Hinweis
// „Tendenzen, keine Gesetze" (Datenfeld `hinweis`) trägt den ganzen Bereich.

// Häufige/naheliegende Fusionen (§8-Entscheidung, im PR benannt). Paare hier
// bekommen den Faktor GEWICHT_HAEUFIG < 1 — sie sind musikhistorisch etabliert
// oder sitzen ohnehin dicht beieinander, also weniger „Anstoß". Reihenfolge egal
// (als Set ungerichteter Paare geführt).
export const HAEUFIGE_FUSIONEN = [
  ['death_metal', 'thrash'],
  ['death_metal', 'black_metal'],
  ['crust', 'grindcore'],
  ['powerviolence', 'grindcore'],
  ['stoner', 'doom'],
  ['sludge', 'doom'],
  ['deathcore', 'metalcore'],
  ['hardcore', 'metalcore'],
  ['sludge', 'post_metal'],
  ['black_metal', 'post_metal'],
  ['mathcore', 'metalcore'],
  ['mathcore', 'grindcore'],
  ['screamo', 'hardcore'],
  ['screamo', 'post_metal'],
  ['noise_rock', 'sludge'],
];

// Score-Gewicht für ein häufiges Paar (senkt seine Ziehwahrscheinlichkeit).
export const GEWICHT_HAEUFIG = 0.4;

// Gefühls-Cluster: zwei Tags gelten als „benachbart", wenn sie einen Cluster
// teilen — so entsteht eine Brücke auch ohne wortgleiche Tags. Rein heuristisch;
// die Landkarte selbst bleibt die Quelle der Wahrheit.
const GEFUEHL_CLUSTER = {
  aggression: ['Wut', 'Zorn', 'Aggression', 'Frust', 'Bitterkeit', 'Aufbegehren', 'Aufbäumen', 'Trotz'],
  wucht: ['Wucht', 'Kraft', 'Bedrohung', 'Schwere', 'Überwältigung', 'Entladung', 'Ausbruch'],
  katharsis: ['Katharsis', 'Erlösung', 'Erhabenheit', 'Transzendenz', 'Entrückung', 'Empowerment', 'Sehnsucht'],
  finsternis: ['Kälte', 'Isolation', 'Düsternis', 'Morbidität', 'Weltschmerz', 'Trauer', 'Unbehagen', 'Verzweiflung', 'Zerbrechlichkeit'],
  trance: ['Trance', 'Groove', 'Wärme', 'Lässigkeit', 'Kontemplation', 'Weite', 'Hypnose'],
  chaos: ['Chaos', 'Absurdität', 'Schock', 'Dynamikwechsel', 'Adrenalin', 'Unmittelbarkeit', 'Anspannung', 'Kontrolle', 'Desorientierung'],
  gemeinschaft: ['Gemeinschaft', 'Empowerment', 'Erschöpfung', 'Dreck'],
};

// Cluster-Klartext für die Brücken-Anzeige.
export const CLUSTER_LABEL = {
  aggression: 'Aggression',
  wucht: 'Wucht & Schwere',
  katharsis: 'Katharsis',
  finsternis: 'Finsternis',
  trance: 'Trance & Groove',
  chaos: 'Chaos & Bruch',
  gemeinschaft: 'Erdung',
};

function clusterVon(tag) {
  for (const [k, tags] of Object.entries(GEFUEHL_CLUSTER)) if (tags.includes(tag)) return k;
  return null;
}

// Euklidische Distanz im Karten-Raum (0..10 je Achse). ≈ Spannung.
export function distanz(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function schluesselPaar(a, b) {
  return [a, b].sort().join('|');
}

const HAEUFIG_SET = new Set(HAEUFIGE_FUSIONEN.map(([a, b]) => schluesselPaar(a, b)));

export function istHaeufig(a, b) {
  return HAEUFIG_SET.has(schluesselPaar(a.genre, b.genre));
}

// Score = Distanz · (häufig ? 0.4 : 1). Höher = reizvoller (fern & selten).
export function score(a, b) {
  return distanz(a, b) * (istHaeufig(a, b) ? GEWICHT_HAEUFIG : 1);
}

// Gemeinsame Gefühlslinie: erst wortgleiche Tags, sonst geteilte Cluster.
// Rückgabe { geteilt:[tags], bruecke:[clusterLabels], linie:string|null }.
export function gemeinsamesGefuehl(a, b) {
  const bt = new Set(b.tags || []);
  const geteilt = (a.tags || []).filter((t) => bt.has(t));
  if (geteilt.length) {
    return { geteilt, bruecke: [], linie: geteilt.join(' / ') };
  }
  const cluster = new Set();
  for (const ta of a.tags || []) {
    const ca = clusterVon(ta);
    if (!ca) continue;
    for (const tb of b.tags || []) if (clusterVon(tb) === ca) cluster.add(ca);
  }
  const bruecke = [...cluster].map((c) => CLUSTER_LABEL[c] || c);
  return { geteilt: [], bruecke, linie: bruecke.length ? bruecke.join(' / ') : null };
}

// Energie-/Grundton-Merkmal in Worte (für den Kreativ-Prompt). Gibt einen
// i18n-Schlüssel zurück — die View löst ihn via t() auf.
export function tempoSchluessel(genre) {
  if (genre.x >= 8) return 'wz_gm_tempo_rasend';
  if (genre.x >= 5) return 'wz_gm_tempo_treibend';
  return 'wz_gm_tempo_schleppend';
}
export function atmoSchluessel(genre) {
  if (genre.y >= 6) return 'wz_gm_atmo_licht';
  if (genre.y >= 4) return 'wz_gm_atmo_ambivalent';
  return 'wz_gm_atmo_finster';
}

// Gewichtete Ziehung eines Paars nach `score` (seltene, ferne Paare häufiger).
// `rnd` erlaubt deterministische Tests; Default Math.random. Gibt {a,b} zurück.
export function ziehePaarGewichtet(genres, rnd = Math.random) {
  const paare = [];
  let summe = 0;
  for (let i = 0; i < genres.length; i++) {
    for (let j = i + 1; j < genres.length; j++) {
      const s = score(genres[i], genres[j]);
      paare.push({ a: genres[i], b: genres[j], s });
      summe += s;
    }
  }
  if (!paare.length) return null;
  let ziel = rnd() * summe;
  for (const p of paare) {
    ziel -= p.s;
    if (ziel <= 0) return { a: p.a, b: p.b };
  }
  return { a: paare[paare.length - 1].a, b: paare[paare.length - 1].b };
}

// Gezielt: zu einem Ziel-Tag ein Paar, dessen Genres das Gefühl tragen und
// zugleich Spannung halten (weit auseinander). Bewertung: Tag-Nähe beider Genres
// (wortgleich 2, Cluster 1) plus etwas Distanz-Bonus.
export function paarFuerTag(genres, zielTag, rnd = Math.random) {
  const zielCluster = clusterVon(zielTag);
  const naehe = (g) => {
    if ((g.tags || []).includes(zielTag)) return 2;
    if (zielCluster && (g.tags || []).some((t) => clusterVon(t) === zielCluster)) return 1;
    return 0;
  };
  const treffer = genres.filter((g) => naehe(g) > 0);
  const basis = treffer.length >= 2 ? treffer : genres;
  const kandidaten = [];
  for (let i = 0; i < basis.length; i++) {
    for (let j = i + 1; j < basis.length; j++) {
      const a = basis[i];
      const b = basis[j];
      const wert = naehe(a) + naehe(b) + distanz(a, b) * 0.25 + rnd() * 0.5;
      kandidaten.push({ a, b, wert });
    }
  }
  if (!kandidaten.length) return null;
  kandidaten.sort((x, y) => y.wert - x.wert);
  return { a: kandidaten[0].a, b: kandidaten[0].b };
}

// Optionaler dritter Genre (Trio-Modus, §8): der Punkt, der die Spannung zum
// bestehenden Paar maximiert (fern von beiden), aber nicht identisch ist.
export function drittesGenre(genres, a, b) {
  let bestes = null;
  let max = -1;
  for (const g of genres) {
    if (g.genre === a.genre || g.genre === b.genre) continue;
    const w = distanz(g, a) + distanz(g, b);
    if (w > max) {
      max = w;
      bestes = g;
    }
  }
  return bestes;
}

// Alle einzigartigen Gefühls-Tags über die Landkarte (für die Gezielt-Auswahl).
export function alleTags(genres) {
  const set = new Set();
  for (const g of genres) for (const t of g.tags || []) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
}
