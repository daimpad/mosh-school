// Datenschicht: lädt die statischen Inhaltsdateien, baut Indizes und prüft die
// Daten leicht auf Konsistenz (Warnungen, keine Abbrüche — hilft beim Inhaltsausbau).
// Die Inhaltsdatei bleibt unangetastet; alles Abgeleitete lebt hier.

import { topoSortiere } from './graph.js';

async function holeJson(pfad) {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(`${pfad}: HTTP ${antwort.status}`);
  return antwort.json();
}

// Inhaltsdateien werden zu EINEM gemeinsamen Pool gemischt (Spez. 3.1).
// Reihenfolge = Reihenfolge hier; die erste Datei mit vokabulare ist die
// kanonische Vokabular-Quelle (weitere Blöcke tragen keins).
const INHALTSDATEIEN = [
  // Die erste Datei trägt das kanonische `vokabulare`; weitere Dateien mischen
  // sich in denselben Pool (der Pool mischt sich selbst). Reihenfolge = Erzähl-
  // reihenfolge (poolVergleicher), darum Gitarre zuerst, dann Bass/Drums/Gesang.
  'data/bausteine.einsteiger-gitarre.json',
  'data/bausteine.fortgeschritten-gitarre.json',
  'data/bausteine.experte-gitarre.json',
  'data/bausteine.einsteiger-bass.json',
  'data/bausteine.fortgeschritten-bass.json',
  'data/bausteine.experte-bass.json',
  'data/bausteine.einsteiger-schlagzeug.json',
  'data/bausteine.fortgeschritten-schlagzeug.json',
  'data/bausteine.experte-schlagzeug.json',
  'data/bausteine.einsteiger-gesang.json',
  'data/bausteine.fortgeschritten-gesang.json',
  'data/bausteine.experte-gesang.json',
  'data/bausteine.einsteiger-theorie.json',
  'data/bausteine.fortgeschritten-theorie.json',
  'data/bausteine.experte-theorie.json',
  'data/bausteine.stil-doom.json',
  'data/bausteine.stil-hardcore.json',
  'data/bausteine.stil-punk-extrem.json',
  'data/bausteine.stil-sludge.json',
  'data/bausteine.stil-einsteiger.json',
];

export async function ladeDaten() {
  const [einheiten, fehlerbilder, regeln, appInfo, turnierregeln, ...inhaltDateien] = await Promise.all([
    holeJson('data/trainingseinheiten.json'),
    holeJson('data/fehlerbilder.json'),
    holeJson('data/regeln.json'),
    holeJson('data/app-info.json'),
    holeJson('data/turnierregeln.json'),
    ...INHALTSDATEIEN.map(holeJson),
  ]);
  return baueIndizes(inhaltDateien, einheiten, fehlerbilder, regeln, appInfo, turnierregeln);
}

export function hatUebungsteil(baustein) {
  return baustein.uebungsteil != null;
}

// Reflexionsaufgabe (Taktik-Domäne): eigenständiger Aufgabenteil, Geschwister
// des Übungsteils — ersetzt ihn, wo keine Bewegung automatisiert wird.
export function hatReflexionsaufgabe(baustein) {
  return baustein.reflexionsaufgabe != null;
}

// Alle quittierbaren Aufgabenteile eines Bausteins (Übung und/oder Reflexion).
export function aufgabenTeile(baustein) {
  const teile = [];
  if (hatUebungsteil(baustein)) teile.push('uebungsteil');
  if (hatReflexionsaufgabe(baustein)) teile.push('reflexionsaufgabe');
  return teile;
}

export function domaenenVon(baustein) {
  return Array.isArray(baustein.domaene) ? baustein.domaene : [baustein.domaene];
}

// Spielform (optionale Metadaten-Dimension, orthogonal zur Domäne): fehlendes
// Feld = 'einzel'. Alle Alt-Bausteine gelten damit ohne Änderung als Einzel.
export function spielformVon(baustein) {
  return baustein.spielform || 'einzel';
}

// Untergrund (Modifikator-Dimension, koordinierte Erweiterung: als LISTE geführt).
// Fehlendes Feld = Halle (Default); ein Alt-String 'halle' liest sich als ['halle'].
export function untergrundVon(baustein) {
  const u = baustein.untergrund;
  if (u == null) return ['halle'];
  return Array.isArray(u) ? u : [u];
}

// Witterung (nur outdoor, sonst leere Liste) — Navigationsachse wie Spielform.
export function witterungVon(baustein) {
  return Array.isArray(baustein.witterung) ? baustein.witterung : [];
}

// Trainingseinheit (Spez. 3.4): geordnete Referenzliste auf Übungsteile, gegliedert
// in drei Phasen. `einheitReferenzen` flacht die Phasen in EINE geordnete Liste
// {baustein, hinweis, phase} ab — die Reihenfolge, in der die Sitzung sie durchläuft.
// Jede Referenz zeigt auf einen Baustein mit Übungsteil (die ID identifiziert ihn
// eindeutig, da ein Baustein höchstens einen Übungsteil trägt).
export const EINHEIT_PHASEN = ['erwaermung', 'hauptteil', 'ausklang'];
export function einheitReferenzen(einheit) {
  const phasen = einheit.phasen || {};
  return EINHEIT_PHASEN.flatMap((phase) =>
    (phasen[phase] || []).map((ref) => ({ baustein: ref.baustein, hinweis: ref.hinweis || null, phase })),
  );
}

// Ein mehrfach zugeordneter Baustein gehört in den Kompetenzpfad seiner
// niedrigsten Könnensstufe; rein trainer-getaggte in die Trainer-Sicht (Spez. 6.1).
export function niedrigsteStufe(daten, baustein) {
  const stufen = baustein.kompetenzstufe || [];
  for (const stufe of daten.koennensOrdnung) {
    if (stufen.includes(stufe)) return stufe;
  }
  return stufen.includes('trainer') ? 'trainer' : null;
}

export function deltaFuer(daten, basisId, herkunft) {
  if (!herkunft) return null;
  return daten.deltaVonSchluessel.get(`${basisId}::${herkunft}`) || null;
}

// Fehlerbilder eines Basisbausteins (Trainer-Layer, Spez. 5). Eigene Entitäten,
// aber nie eigene Station — sie werden in-situ in der Baustein-Ansicht gezeigt,
// nur in der Trainer-Perspektive. Liefert immer ein Array (leer = kein Fehlerfall).
export function fehlerbilderFuer(daten, basisId) {
  return daten.fehlerbildVonBasis.get(basisId) || [];
}

export function baueIndizes(inhaltRoh, einheitenRoh, fehlerbilderRoh, regelnRoh, appInfoRoh, turnierregelnRoh) {
  const warnungen = [];
  // Ein Objekt oder eine Liste von Inhaltsdateien; letztere werden gemischt.
  const dateien = Array.isArray(inhaltRoh) ? inhaltRoh : [inhaltRoh];
  const vokabulare = dateien.find((d) => d.vokabulare)?.vokabulare || {};
  const bausteine = dateien.flatMap((d) => d.bausteine || []);
  const deltas = dateien.flatMap((d) => d.delta_bausteine || []);
  const einheiten = einheitenRoh?.trainingseinheiten || [];
  const fehlerbilder = fehlerbilderRoh?.fehlerbild_bausteine || [];
  // Regeln: eigener Referenzbereich, NICHT im Baustein-Pool (kein Fortschritt,
  // keine Voraussetzungen, keine Deltas). Nur statischer Inhalt + Quellenangabe.
  const regeln = { meta: regelnRoh?._meta || {}, abschnitte: regelnRoh?.abschnitte || [] };
  // App-Info: statischer Referenzbereich (Reiter „Über"/„Mitmachen" + Sprachanzeige),
  // ebenfalls NICHT im Baustein-Pool — kein Fortschritt, keine Gamification.
  const appInfo = {
    meta: appInfoRoh?._meta || {},
    ueber: appInfoRoh?.ueber || null,
    mitmachen: appInfoRoh?.mitmachen || null,
    rechtliches: appInfoRoh?.rechtliches || null,
    sprachen: appInfoRoh?.sprachen || { funktion_aktiv: false, aktuell: 'de', liste: [] },
  };
  // Turnier-Regularium: eigener Referenzbereich (wie Regeln), NICHT im Baustein-Pool.
  // Je Turnierstufe explizite Werte (nicht rein kumulativ); Varianten (Doppel/Junior)
  // hängen als Modifikator an bestimmten Stufen. Kein Fortschritt, keine Gamification.
  const turnierregeln = {
    meta: turnierregelnRoh?._meta || {},
    stufen: turnierregelnRoh?.stufen || [],
    kategorien: turnierregelnRoh?.kategorien || [],
    anforderungen: turnierregelnRoh?.anforderungen || [],
    varianten: turnierregelnRoh?.varianten || [],
  };

  const daten = {
    meta: dateien[0]?._meta || {},
    einheitenMeta: einheitenRoh?._meta || {},
    vokabulare,
    bausteine,
    deltas,
    einheiten,
    fehlerbilder,
    regeln,
    appInfo,
    turnierregeln,
    bausteinVonId: new Map(bausteine.map((b) => [b.id, b])),
    einheitVonId: new Map(einheiten.map((e) => [e.id, e])),
    deltaVonSchluessel: new Map(),
    fehlerbildVonBasis: new Map(),
    poolIndex: new Map(bausteine.map((b, i) => [b.id, i])),
    koennensOrdnung: (vokabulare.kompetenzstufe || []).filter((s) => s !== 'trainer'),
    herkuenfte: [],
    spielzielBereichVonFaktor: new Map(),
    vermittlungszielBereichVonFaktor: new Map(),
    warnungen,
  };

  // Fehlerbilder je Basisbaustein bündeln (mehrere pro Baustein erlaubt).
  for (const fb of fehlerbilder) {
    if (!daten.fehlerbildVonBasis.has(fb.basis_baustein)) daten.fehlerbildVonBasis.set(fb.basis_baustein, []);
    daten.fehlerbildVonBasis.get(fb.basis_baustein).push(fb);
  }

  for (const [bereich, faktoren] of Object.entries(vokabulare.spielziele || {})) {
    if (bereich.startsWith('_')) continue;
    for (const f of faktoren) daten.spielzielBereichVonFaktor.set(f, bereich);
  }
  for (const [bereich, faktoren] of Object.entries(vokabulare.vermittlungsziele || {})) {
    if (bereich.startsWith('_')) continue;
    for (const f of faktoren) daten.vermittlungszielBereichVonFaktor.set(f, bereich);
  }

  // Ersetzungsrelation indizieren; Herkunftsliste für das Onboarding aus dem
  // Delta-Bestand ableiten (Spez. 7.3 — bleibt automatisch synchron zum Ausbaustand).
  for (const delta of deltas) {
    const schluessel = `${delta.basis_baustein}::${delta.ersetzt_bei_herkunft}`;
    if (daten.deltaVonSchluessel.has(schluessel)) {
      warnungen.push(`Delta ${delta.id}: doppelte Ersetzung für ${schluessel}`);
    }
    daten.deltaVonSchluessel.set(schluessel, delta);
    if (delta.ersetzt_bei_herkunft && !daten.herkuenfte.includes(delta.ersetzt_bei_herkunft)) {
      daten.herkuenfte.push(delta.ersetzt_bei_herkunft);
    }
  }

  pruefeDaten(daten);
  return daten;
}

function pruefeDaten(daten) {
  const w = daten.warnungen;
  const voka = daten.vokabulare;
  const deltaIds = new Set(daten.deltas.map((d) => d.id));
  const inVokabular = (liste, wert) => !Array.isArray(liste) || liste.includes(wert);

  // Kollisionen über gemischte Inhaltsdateien hinweg früh melden.
  const gesehen = new Set();
  for (const b of daten.bausteine) {
    if (gesehen.has(b.id)) w.push(`${b.id}: doppelte Baustein-id über Inhaltsdateien`);
    gesehen.add(b.id);
  }

  for (const b of daten.bausteine) {
    for (const d of domaenenVon(b)) {
      if (!inVokabular(voka.domaene, d)) w.push(`${b.id}: unbekannte Domäne "${d}"`);
    }
    if (!b.kompetenzstufe?.length) w.push(`${b.id}: keine Kompetenzstufe`);
    for (const s of b.kompetenzstufe || []) {
      if (!inVokabular(voka.kompetenzstufe, s)) w.push(`${b.id}: unbekannte Stufe "${s}"`);
    }
    if (!inVokabular(voka.baustein_typ, b.typ)) w.push(`${b.id}: unbekannter Typ "${b.typ}"`);
    if (b.spielform != null && !inVokabular(voka.spielform, b.spielform)) w.push(`${b.id}: unbekannte Spielform "${b.spielform}"`);
    for (const v of b.voraussetzungen || []) {
      if (!daten.bausteinVonId.has(v)) w.push(`${b.id}: Voraussetzung "${v}" existiert nicht`);
    }
    for (const z of b.spielziele || []) {
      if (!daten.spielzielBereichVonFaktor.has(z)) w.push(`${b.id}: unbekanntes Spielziel "${z}"`);
    }
    for (const z of b.vermittlungsziele || []) {
      if (!daten.vermittlungszielBereichVonFaktor.has(z)) w.push(`${b.id}: unbekanntes Vermittlungsziel "${z}"`);
    }
    const kuerzel = b.transfer_herkunft || [];
    if (new Set(kuerzel).size !== kuerzel.length) w.push(`${b.id}: Transfer-Kürzel doppelt`);
    for (const k of kuerzel) {
      if (!inVokabular(voka.transfer_herkunft, k)) w.push(`${b.id}: unbekanntes Transfer-Kürzel "${k}"`);
    }
    for (const grund of untergrundVon(b)) {
      if (!inVokabular(voka.untergrund, grund)) w.push(`${b.id}: unbekannter Untergrund "${grund}"`);
    }
    for (const wetter of b.witterung || []) {
      if (!inVokabular(voka.witterung, wetter)) w.push(`${b.id}: unbekannte Witterung "${wetter}"`);
    }
    if (b.typ === 'micro' && domaenenVon(b).includes('technik') && !hatUebungsteil(b)) {
      w.push(`${b.id}: Technik-Baustein ohne Übungsteil`);
    }
    if (hatReflexionsaufgabe(b) && typeof b.reflexionsaufgabe.de !== 'string') {
      w.push(`${b.id}: reflexionsaufgabe.de fehlt oder ist kein Text`);
    }
    if (hatUebungsteil(b) && hatReflexionsaufgabe(b)) {
      w.push(`${b.id}: trägt Übungsteil UND Reflexionsaufgabe (höchstens eines erlaubt, Spez. 3.5)`);
    }
  }

  for (const d of daten.deltas) {
    if (!daten.bausteinVonId.has(d.basis_baustein)) w.push(`${d.id}: Basisbaustein "${d.basis_baustein}" existiert nicht`);
    if (!inVokabular(voka.transfer_herkunft, d.ersetzt_bei_herkunft)) w.push(`${d.id}: unbekannte Herkunft "${d.ersetzt_bei_herkunft}"`);
    if (d.eigener_uebungsteil) w.push(`${d.id}: Delta mit eigenem Übungsteil verletzt die Delta-Übungsregel (Spez. 5)`);
    for (const verweis of d.delta_buendelung || []) {
      if (!deltaIds.has(verweis)) w.push(`${d.id}: Bündelungs-Verweis "${verweis}" existiert nicht`);
    }
  }

  for (const e of daten.einheiten) {
    for (const ref of einheitReferenzen(e)) {
      const b = daten.bausteinVonId.get(ref.baustein);
      if (!b) w.push(`${e.id}: referenzierter Baustein "${ref.baustein}" existiert nicht`);
      else if (!hatUebungsteil(b)) w.push(`${e.id}: Baustein "${ref.baustein}" hat keinen Übungsteil`);
    }
  }

  // Fehlerbilder (Trainer-Layer): eigene Entität mit Relation zum Basisbaustein,
  // drei benannte Erklärfelder, kein eigener Übungsteil (Spez. 5).
  const bausteinIds = new Set(daten.bausteine.map((b) => b.id));
  for (const fb of daten.fehlerbilder) {
    if (bausteinIds.has(fb.id)) w.push(`${fb.id}: Fehlerbild-id kollidiert mit einem Basisbaustein`);
    if (fb.typ !== 'fehlerbild') w.push(`${fb.id}: Typ "${fb.typ}" statt "fehlerbild"`);
    if (!daten.bausteinVonId.has(fb.basis_baustein)) w.push(`${fb.id}: Basisbaustein "${fb.basis_baustein}" existiert nicht`);
    if (!(fb.kompetenzstufe || []).includes('trainer')) w.push(`${fb.id}: Fehlerbild ohne Trainer-Stufe`);
    if (hatUebungsteil(fb)) w.push(`${fb.id}: Fehlerbild mit eigenem Übungsteil verletzt die Trainer-Layer-Regel (Spez. 5)`);
    const inhalt = fb.erklaerteil?.de;
    for (const feld of ['symptom', 'ursache', 'korrektur']) {
      if (!inhalt || typeof inhalt[feld] !== 'string' || inhalt[feld].trim() === '') {
        w.push(`${fb.id}: Erklärfeld "${feld}" fehlt oder ist leer`);
      }
    }
    for (const z of fb.vermittlungsziele || []) {
      if (!daten.vermittlungszielBereichVonFaktor.has(z)) w.push(`${fb.id}: unbekanntes Vermittlungsziel "${z}"`);
    }
    for (const k of fb.transfer_herkunft || []) {
      if (!inVokabular(voka.transfer_herkunft, k)) w.push(`${fb.id}: unbekanntes Transfer-Kürzel "${k}"`);
    }
  }

  // Regeln (Referenz-Reiter): eigener statischer Bereich, NICHT im Baustein-Pool.
  // `querverweis` ist reine Dokumentation (kein Graph, kein Pflicht-Link, analog
  // zu voraussetzungen_querverweis) — nicht auflösbare Verweise nur melden.
  for (const abschnitt of daten.regeln.abschnitte) {
    for (const regel of abschnitt.regeln || []) {
      if (!regel.inhalt?.de) w.push(`Regel in Abschnitt "${abschnitt.id}": inhalt.de fehlt`);
      for (const id of regel.querverweis || []) {
        if (!daten.bausteinVonId.has(id)) w.push(`Regel (${abschnitt.id}): querverweis "${id}" existiert nicht`);
      }
    }
  }

  // Turnier-Regularium (Referenz-Reiter): eigener statischer Bereich, NICHT im
  // Baustein-Pool. Werte sind je Turnierstufe explizit; Varianten hängen als
  // Modifikator an Stufen. Nur leichte Struktur-/Konsistenz-Warnungen.
  const tr = daten.turnierregeln;
  const stufenIds = new Set(tr.stufen.map((s) => s.id));
  const katIds = new Set(tr.kategorien.map((k) => k.id));
  for (const a of tr.anforderungen) {
    if (!katIds.has(a.kategorie)) w.push(`Turnier-Anforderung "${a.id}": unbekannte Kategorie "${a.kategorie}"`);
    const werte = a.werte || {};
    if (Object.keys(werte).length === 0) w.push(`Turnier-Anforderung "${a.id}": keine Stufen-Werte`);
    for (const [stufe, wert] of Object.entries(werte)) {
      if (!stufenIds.has(stufe)) w.push(`Turnier-Anforderung "${a.id}": unbekannte Stufe "${stufe}"`);
      if (!['pflicht', 'empfehlung'].includes(wert.stufe)) w.push(`Turnier-Anforderung "${a.id}" (${stufe}): ungültige Pflichtstufe "${wert.stufe}"`);
      if (!wert.text?.de) w.push(`Turnier-Anforderung "${a.id}" (${stufe}): text.de fehlt`);
    }
  }
  // Varianten: beide Richtungen konsistent (Stufe listet Variante, Variante trägt Abweichungen).
  for (const v of tr.varianten) {
    for (const s of v.stufen || []) {
      if (!stufenIds.has(s)) w.push(`Turnier-Variante "${v.id}": unbekannte Stufe "${s}"`);
      if (!(v.abweichungen?.[s] || []).length) w.push(`Turnier-Variante "${v.id}": keine Abweichungen für "${s}"`);
      const stufe = tr.stufen.find((x) => x.id === s);
      if (stufe && !(stufe.varianten || []).includes(v.id)) w.push(`Turnier-Variante "${v.id}": Stufe "${s}" listet sie nicht`);
    }
  }
  // Rückrichtung: jede in einer Stufe gelistete Variante existiert auch.
  const variantenIds = new Set(tr.varianten.map((v) => v.id));
  for (const s of tr.stufen) {
    for (const vid of s.varianten || []) {
      if (!variantenIds.has(vid)) w.push(`Turnier-Stufe "${s.id}": unbekannte Variante "${vid}"`);
    }
  }

  // App-Info (Reiter Über/Mitmachen + Sprachanzeige): reine Darstellung, kein
  // Lerninhalt. Nur leichte Struktur-Warnungen — die [eckigen] Platzhalter sind
  // bewusst gewollt (der Betreiber füllt sie) und lösen keine Warnung aus.
  const ai = daten.appInfo;
  if (!ai.ueber) w.push('app-info: Abschnitt "ueber" fehlt');
  if (!ai.mitmachen) w.push('app-info: Abschnitt "mitmachen" fehlt');
  else if (!(ai.mitmachen.moeglichkeiten || []).every((m) => m.cta_label && m.cta_ziel)) {
    w.push('app-info: eine Mitmach-Möglichkeit ohne cta_label/cta_ziel');
  }
  if (!(ai.sprachen?.liste || []).length) w.push('app-info: Sprachliste leer');

  const { zyklisch } = topoSortiere(daten.bausteine, (a, b) => daten.poolIndex.get(a.id) - daten.poolIndex.get(b.id));
  if (zyklisch.length > 0) w.push(`Voraussetzungszyklus: ${zyklisch.join(', ')}`);
}
