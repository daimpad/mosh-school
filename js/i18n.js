// Mehrsprachigkeit: sprachneutrale Identität (IDs) bleibt in den Inhaltsdaten,
// alle sichtbaren Beschriftungen kommen aus data/labels/<sprache>.json.
// Quellsprache de ist immer geladen; leere Werte anderer Sprachen fallen auf de zurück.

export const QUELLSPRACHE = 'de';

let aktiveSprache = QUELLSPRACHE;
const geladen = {};

async function ladeLabels(sprache) {
  if (geladen[sprache]) return geladen[sprache];
  const antwort = await fetch(`data/labels/${sprache}.json`);
  if (!antwort.ok) throw new Error(`Labels für "${sprache}" nicht ladbar (${antwort.status})`);
  geladen[sprache] = await antwort.json();
  return geladen[sprache];
}

export async function initI18n(sprache) {
  await ladeLabels(QUELLSPRACHE);
  aktiveSprache = sprache || QUELLSPRACHE;
  if (aktiveSprache !== QUELLSPRACHE) {
    try {
      await ladeLabels(aktiveSprache);
    } catch {
      aktiveSprache = QUELLSPRACHE;
    }
  }
  if (typeof document !== 'undefined') document.documentElement.lang = aktiveSprache;
}

export function sprache() {
  return aktiveSprache;
}

export async function setzeSprache(neu) {
  await ladeLabels(neu);
  aktiveSprache = neu;
  if (typeof document !== 'undefined') document.documentElement.lang = neu;
}

function holePfad(wurzel, pfad) {
  let wert = wurzel;
  for (const teil of pfad) {
    if (wert == null) return undefined;
    wert = wert[teil];
  }
  return wert;
}

// Nachschlagen mit Fallback-Kette: aktive Sprache → Quellsprache → letzter Pfadteil (ID).
function schlageNach(pfad) {
  const aktiv = holePfad(geladen[aktiveSprache], pfad);
  if (typeof aktiv === 'string' && aktiv !== '') return aktiv;
  const quelle = holePfad(geladen[QUELLSPRACHE], pfad);
  if (typeof quelle === 'string' && quelle !== '') return quelle;
  return String(pfad[pfad.length - 1]);
}

// UI-Text: t('onboarding_schritt', {a: 1, b: 4})
export function t(schluessel, ersetzungen) {
  let wert = schlageNach(['ui', schluessel]);
  if (ersetzungen) {
    for (const [k, v] of Object.entries(ersetzungen)) {
      wert = wert.replaceAll(`{${k}}`, String(v));
    }
  }
  return wert;
}

const LABEL_PFADE = {
  baustein: (id) => ['bausteine', id],
  fehlerbild: (id) => ['fehlerbilder', id],
  grafik: (id) => ['grafiken', id],
  einheit: (id) => ['trainingseinheiten', id],
  spielziel_bereich: (id) => ['spielziele', 'bereiche', id],
  spielziel_faktor: (id) => ['spielziele', 'faktoren', id],
  vermittlungsziel_bereich: (id) => ['vermittlungsziele', 'bereiche', id],
  vermittlungsziel_faktor: (id) => ['vermittlungsziele', 'faktoren', id],
};

// Sichtbares Label zu einer sprachneutralen ID.
// Gruppen: baustein, grafik, einheit, spielziel_*, vermittlungsziel_* oder ein Vokabularname
// (domaene, kompetenzstufe, baustein_typ, transfer_herkunft, untergrund, witterung, abschluss_status).
export function label(gruppe, id) {
  const bau = LABEL_PFADE[gruppe];
  return schlageNach(bau ? bau(id) : ['vokabeln', gruppe, id]);
}

// Inhaltstexte liegen als { de: …, en: …, … } vor (Strings oder Objekte, z. B. Übungsteile).
export function text(proSprache) {
  if (proSprache == null) return null;
  const aktiv = proSprache[aktiveSprache];
  if (aktiv !== undefined && aktiv !== '' && aktiv !== null) return aktiv;
  return proSprache[QUELLSPRACHE] ?? null;
}
