// Pfad-Engine: vier gleichrangige Traversierungen über denselben Baustein-Pool
// plus Cross-Sport-Modifikator (Spez. 6). Alles reine Funktionen über
// Daten + Zustand → annotierte Stationslisten; kein DOM.
//
// Zwei-Ebenen-Logik (4.4): der Graph sortiert nur. Zugänglichkeit ist überall
// frei; nicht absolvierte Voraussetzungen werden als Hinweis mitgegeben.

import { deltaFuer, domaenenVon, einheitReferenzen, hatReflexionsaufgabe, hatUebungsteil, niedrigsteStufe, untergrundVon, witterungVon } from './daten.js';
import { fehlendeVoraussetzungen, topoSortiere } from './graph.js';
import { absolviertNachId, bausteinAbsolviert } from './fortschritt.js';
import { diagnose, kontinuitaet, teilStatus } from './zustand.js';

// Gleichrangige Bausteine: Domäne sekundär (Reihenfolge des Vokabulars),
// Pool-Reihenfolge tertiär — deterministisch.
function standardVergleicher(daten) {
  const domaenenOrdnung = daten.vokabulare.domaene || [];
  const domIdx = (b) => {
    const idx = domaenenOrdnung.indexOf(domaenenVon(b)[0]);
    return idx === -1 ? domaenenOrdnung.length : idx;
  };
  return (a, b) => domIdx(a) - domIdx(b) || daten.poolIndex.get(a.id) - daten.poolIndex.get(b.id);
}

// Reine Pool-Reihenfolge (Datei-/Erzählreihenfolge) — für Querschnittsthemen
// (Genre/Umgebung), die bewusst NICHT nach Domäne blockieren.
function poolVergleicher(daten) {
  return (a, b) => daten.poolIndex.get(a.id) - daten.poolIndex.get(b.id);
}

// Reine Trainer-Bausteine (technikübergreifendes Meta-Wissen, kompetenzstufe nur
// ["trainer"]) sind orthogonal zur Könnensstufe (Spez. 7.2, Frage 2) und erscheinen
// ausschließlich in der Trainer-Perspektive. Ein Baustein mit einer Könnensstufe
// UND 'trainer' bleibt normal sichtbar (niedrigsteStufe ist dann die Könnensstufe).
function istNurTrainer(daten, baustein) {
  return niedrigsteStufe(daten, baustein) === 'trainer';
}
function trainerSichtbar(daten, baustein) {
  return diagnose().trainer || !istNurTrainer(daten, baustein);
}

// Umgebungs-Bausteine (Outdoor, typ 'umgebungs_baustein') sind ein eigenes
// Querschnittsthema und aus dem Kompetenz- und Themenpfad gefiltert (Typ-Filter);
// erreichbar über die Umgebungs-Achse, den Individualpfad (Bereich-5-Ziele) und Deep-Link.
function umgebungsBaustein(baustein) {
  return baustein.typ === 'umgebungs_baustein';
}

// Kompetenzpfad (kann über Stufen kumulieren): Stufe primär, damit sich
// Stufen-Blöcke bilden (Beginner-Block, dann Fortgeschritten-Block), darin
// Domäne und Pool-Reihenfolge (Spez. 6.1 „innerhalb einer Stufe").
function kompetenzVergleicher(daten) {
  const standard = standardVergleicher(daten);
  const stufenIdx = (b) => {
    const idx = daten.koennensOrdnung.indexOf(niedrigsteStufe(daten, b));
    return idx === -1 ? daten.koennensOrdnung.length : idx;
  };
  return (a, b) => stufenIdx(a) - stufenIdx(b) || standard(a, b);
}

// Ziele normalisieren: erlaubt sind null, ein Einzelziel {dimension, faktor},
// ein Ziel mit Faktorliste sowie eine Liste von Zielen (Mehrfachauswahl).
// Ältere gespeicherte Einzelziele bleiben so ohne Migration gültig.
export function zielEintraege(ziel) {
  if (!ziel) return [];
  const liste = Array.isArray(ziel) ? ziel : [ziel];
  return liste.flatMap((eintrag) => {
    if (!eintrag || !eintrag.faktor) return [];
    const dimension = eintrag.dimension === 'vermittlungsziele' ? 'vermittlungsziele' : 'spielziele';
    const faktoren = Array.isArray(eintrag.faktor) ? eintrag.faktor : [eintrag.faktor];
    return faktoren.map((faktor) => ({ dimension, faktor }));
  });
}

function zielTreffer(baustein, eintraege) {
  return eintraege.filter((eintrag) => (baustein[eintrag.dimension] || []).includes(eintrag.faktor)).length;
}

// Individualpfad: Graph primär, Ziel-Nähe sekundär als Füllkriterium (6.2).
function zielVergleicher(daten, eintraege) {
  const standard = standardVergleicher(daten);
  return (a, b) => zielTreffer(b, eintraege) - zielTreffer(a, eintraege) || standard(a, b);
}

function baueStation(daten, baustein, mengenIds, herkunft) {
  const absolviert = absolviertNachId(daten);
  const fehlend = fehlendeVoraussetzungen(baustein, absolviert);
  const delta = deltaFuer(daten, baustein.id, herkunft);
  return {
    baustein,
    // Delta-Einblendung (4.2): ersetzt nur den Erklärteil dieser Station,
    // nie die Sequenz. Kein Delta für eine Herkunft ist kein Fehlerfall.
    delta,
    fehlendeVoraussetzungen: fehlend,
    ausserhalbMenge: fehlend.filter((id) => !mengenIds.has(id)),
    // Überspringen-Kandidat (6.5): Umsteiger-Herkunft aktiv, keine Anpassung
    // nötig, noch nicht absolviert — Vormarkierung bestätigt die Person selbst.
    skipKandidat: Boolean(herkunft) && !delta && !bausteinAbsolviert(baustein),
    status: {
      erklaerteil: teilStatus(baustein.id, 'erklaerteil'),
      uebungsteil: hatUebungsteil(baustein) ? teilStatus(baustein.id, 'uebungsteil') : null,
      reflexionsaufgabe: hatReflexionsaufgabe(baustein) ? teilStatus(baustein.id, 'reflexionsaufgabe') : null,
      absolviert: bausteinAbsolviert(baustein),
    },
  };
}

function zuStationen(daten, bausteine, vergleicher, herkunft) {
  const { reihenfolge } = topoSortiere(bausteine, vergleicher);
  const mengenIds = new Set(bausteine.map((b) => b.id));
  return reihenfolge.map((b) => baueStation(daten, b, mengenIds, herkunft || null));
}

// 6.1 Kompetenzpfad — zugleich Standard-Basispfad des Cross-Sport-Modifikators:
// nur hier ist der Modifikator initial verdrahtet (Delta, Skip, Kennzeichnung).
// Über Könnensstufen kumulativ: ein Fortgeschrittener sieht Beginner UND
// Fortgeschritten (aufbauend); jeder Baustein einmalig an seiner niedrigsten
// Stufe (Spez. 6.1). Trainer ist orthogonal und bleibt exakt.
export function kompetenzpfad(daten, stufe = diagnose().stufe) {
  const herkunft = diagnose().herkunft;
  const zielIndex = daten.koennensOrdnung.indexOf(stufe);
  const menge = daten.bausteine.filter((b) => {
    if (umgebungsBaustein(b)) return false; // Outdoor bleibt aus dem Stufen-Ladder
    const eigene = niedrigsteStufe(daten, b);
    if (zielIndex < 0) return eigene === stufe; // Trainer o. Ä.: exakt
    const eigenerIndex = daten.koennensOrdnung.indexOf(eigene);
    return eigenerIndex >= 0 && eigenerIndex <= zielIndex; // bis einschließlich Zielstufe
  });
  return {
    art: 'kompetenz',
    stufe,
    herkunft,
    stationen: zuStationen(daten, menge, kompetenzVergleicher(daten), herkunft),
  };
}

// 6.3 Themenpfad — Facetten nach Domäne, geordnet-explorativ. Reine Trainer-Domänen
// (Trainingsgestaltung) zählen nur in der Trainer-Perspektive mit — sonst 0-Facette.
export function themenDomaenen(daten) {
  return (daten.vokabulare.domaene || []).map((domaene) => ({
    domaene,
    anzahl: daten.bausteine.filter((b) => domaenenVon(b).includes(domaene) && trainerSichtbar(daten, b) && !umgebungsBaustein(b)).length,
  }));
}

export function themenpfad(daten, domaene) {
  const menge = daten.bausteine.filter((b) => domaenenVon(b).includes(domaene) && trainerSichtbar(daten, b) && !umgebungsBaustein(b));
  return {
    art: 'themen',
    domaene,
    stationen: zuStationen(daten, menge, standardVergleicher(daten), null),
  };
}

// Instrument-Landing (die vier Instrumente als eigenes Zuhause). Bündelt ALLE
// Bausteine eines Instruments (Technik + Ausrüstung, da Gear-Bausteine die
// Instrument-Domäne mittragen) und trennt sie in Technik (ohne `ausruestung`)
// und Ausrüstung (mit). Technik nach dem Kompetenz-Ladder geordnet, Ausrüstung
// pool-/erzählnah. Querschnitts-Domänen (theorie/koerper/mentales) bleiben außen
// vor — sie haben eigene Themen-Facetten.
export const INSTRUMENTE = ['gitarre', 'bass', 'schlagzeug', 'gesang'];

export function instrumentUebersicht(daten) {
  return INSTRUMENTE.map((domaene) => ({
    domaene,
    anzahl: daten.bausteine.filter((b) => domaenenVon(b).includes(domaene) && trainerSichtbar(daten, b) && !umgebungsBaustein(b)).length,
  }));
}

export function instrumentpfad(daten, domaene) {
  const sichtbar = (b) => trainerSichtbar(daten, b) && !umgebungsBaustein(b);
  const istGear = (b) => domaenenVon(b).includes('ausruestung');
  const amInstrument = daten.bausteine.filter((b) => domaenenVon(b).includes(domaene) && sichtbar(b));
  // Praxis = die Übungs-Bausteine des Instruments (die instrument-eigenen Inhalte
  // sind durchweg praktisch). Theorie = das Wissens-Fundament (Musiktheorie-
  // Domäne) — instrumentübergreifend, aber auf jeder Instrument-Seite als „Warum"
  // greifbar. Reflexions-Bausteine des Instruments zählen zur Theorie hinzu.
  const theorie = daten.bausteine.filter((b) => sichtbar(b) && (domaenenVon(b).includes('theorie') || (domaenenVon(b).includes(domaene) && !!b.reflexionsaufgabe)));
  const praxis = amInstrument.filter((b) => !istGear(b) && !b.reflexionsaufgabe);
  return {
    art: 'instrument',
    domaene,
    theorie: zuStationen(daten, theorie, kompetenzVergleicher(daten), diagnose().herkunft),
    praxis: zuStationen(daten, praxis, kompetenzVergleicher(daten), diagnose().herkunft),
    ausruestung: zuStationen(daten, amInstrument.filter(istGear), standardVergleicher(daten), null),
  };
}

// Band-Querschnitt: Bausteine, die MEHRERE Instrumente zugleich betreffen
// (Domäne enthält ≥2 der vier Instrumente) — Ensemble, Proberaum, Songwriting,
// Auftritt, „ganze Band". Das eigene Zuhause für Band-Themen.
function instrumentDomaenen(baustein) {
  return domaenenVon(baustein).filter((d) => INSTRUMENTE.includes(d));
}
export function bandAnzahl(daten) {
  return daten.bausteine.filter((b) => instrumentDomaenen(b).length >= 2 && trainerSichtbar(daten, b) && !umgebungsBaustein(b)).length;
}
export function bandpfad(daten) {
  const menge = daten.bausteine.filter((b) => instrumentDomaenen(b).length >= 2 && trainerSichtbar(daten, b) && !umgebungsBaustein(b));
  return { art: 'band', stationen: zuStationen(daten, menge, standardVergleicher(daten), null) };
}

// Genre-Achse (Stil): Querschnitt über Instrumente UND Stufen — sammelt alle
// Bausteine eines Genres (death_metal, black_metal, doom …) domänenübergreifend
// zu einem Thema. Reine Pool-/Erzählreihenfolge, kein Modifikator. Es erscheinen
// nur tatsächlich belegte Genres (leere Werte fallen weg).
function stilVon(baustein) {
  return Array.isArray(baustein.stil) ? baustein.stil : [];
}

export function stile(daten) {
  return (daten.vokabulare.stil || [])
    .map((stil) => ({ stil, anzahl: daten.bausteine.filter((b) => stilVon(b).includes(stil)).length }))
    .filter((e) => e.anzahl > 0);
}

export function stilpfad(daten, stil) {
  const menge = daten.bausteine.filter((b) => stilVon(b).includes(stil));
  return {
    art: 'stil',
    stil,
    stationen: zuStationen(daten, menge, poolVergleicher(daten), null),
  };
}

// Umgebungs-/Kontext-Achse (Querschnitt): witterung und untergrund werden zu
// Navigationsachsen, ohne Cross-Sport-Modifikator (kein Herkunftskonflikt →
// herkunft bleibt außen vor). `witterungen`/`untergruende` bieten nur die
// tatsächlich belegten Werte an (der Default/kein Thema fällt weg).
export function umgebungBausteine(daten) {
  return daten.bausteine.filter((b) => umgebungsBaustein(b));
}

export function witterungen(daten) {
  return (daten.vokabulare.witterung || [])
    .map((witterung) => ({ witterung, anzahl: daten.bausteine.filter((b) => witterungVon(b).includes(witterung)).length }))
    .filter((e) => e.anzahl > 0);
}

export function untergruende(daten) {
  return (daten.vokabulare.untergrund || [])
    .filter((u) => u !== 'halle')
    .map((untergrund) => ({ untergrund, anzahl: daten.bausteine.filter((b) => untergrundVon(b).includes(untergrund)).length }))
    .filter((e) => e.anzahl > 0);
}

export function umgebungspfad(daten, achse = null, wert = null) {
  let menge;
  if (achse === 'witterung') menge = daten.bausteine.filter((b) => witterungVon(b).includes(wert));
  else if (achse === 'untergrund') menge = daten.bausteine.filter((b) => untergrundVon(b).includes(wert));
  else menge = umgebungBausteine(daten);
  return {
    art: 'umgebung',
    achse,
    wert,
    stationen: zuStationen(daten, menge, poolVergleicher(daten), null),
  };
}

// 6.2 Individualpfad — filtert nach Zielfaktor(en), über Könnensstufen kumulativ
// wie der Kompetenzpfad: bei gesetzter Diagnose-Stufe erscheinen nur Bausteine
// bis einschließlich dieser Stufe (ein Beginner sieht die Beginner-Leiter eines
// Faktors, ein Fortgeschrittener Beginner + Fortgeschritten). Ohne bekannte Stufe
// wird nicht gefiltert (nie verbergen, Zwei-Ebenen-Logik). Voraussetzungen außerhalb
// der Menge bleiben Hinweis (ausserhalbMenge), werden nie aufgenommen.
export function individualpfad(daten, ziel = diagnose().ziel) {
  const eintraege = zielEintraege(ziel);
  if (eintraege.length === 0) return { art: 'individual', ziel: null, eintraege, stationen: [] };
  const zielIndex = daten.koennensOrdnung.indexOf(diagnose().stufe);
  const menge = daten.bausteine.filter((b) => {
    if (zielTreffer(b, eintraege) === 0) return false;
    const eigene = niedrigsteStufe(daten, b);
    // Trainer-Meta ist orthogonal zur Könnensstufe: nur in der Trainer-Perspektive,
    // dann aber stufen-unabhängig (nicht vom Könnensstufen-Filter kassiert).
    if (eigene === 'trainer') return diagnose().trainer;
    if (zielIndex < 0) return true; // Stufe unbekannt: nicht filtern
    const eigenerIndex = daten.koennensOrdnung.indexOf(eigene);
    return eigenerIndex >= 0 && eigenerIndex <= zielIndex; // bis einschließlich Diagnose-Stufe
  });
  return {
    art: 'individual',
    ziel,
    eintraege,
    stationen: zuStationen(daten, menge, zielVergleicher(daten, eintraege), null),
  };
}

// 6.4 Trainingspfad — steuert Übungsteile über kuratierte Einheiten an. Einheiten
// tragen eine Könnensstufe und werden über Stufen kumulativ gefiltert (wie der
// Kompetenzpfad): ein Beginner sieht Beginner-Einheiten, ein Fortgeschrittener
// Beginner + Fortgeschritten. Ohne bekannte Stufe wird nicht gefiltert (nie verbergen).
// Jede Einheit wird zur geordneten, aufgelösten Referenzliste (Phase + Hinweis + Baustein).
export function trainingsuebersicht(daten) {
  const zaehler = kontinuitaet().jeEinheit;
  const zielIndex = daten.koennensOrdnung.indexOf(diagnose().stufe);
  return daten.einheiten
    .filter((einheit) => {
      if (zielIndex < 0 || !einheit.kompetenzstufe) return true;
      const eigenerIndex = daten.koennensOrdnung.indexOf(einheit.kompetenzstufe);
      return eigenerIndex >= 0 && eigenerIndex <= zielIndex;
    })
    .map((einheit) => {
      const referenzen = einheitReferenzen(einheit)
        .map((ref) => ({ ...ref, baustein: daten.bausteinVonId.get(ref.baustein) }))
        .filter((ref) => ref.baustein);
      return {
        einheit,
        referenzen,
        bausteine: referenzen.map((ref) => ref.baustein),
        absolviertZaehler: zaehler[einheit.id] || 0,
      };
    });
}

// Kontext-Strings der Ansichten: 'kompetenz', 'kompetenz:trainer',
// 'themen:<domaene>', 'individual'.
export function sequenzFuer(daten, kontext) {
  const [art, parameter] = String(kontext || 'kompetenz').split(':');
  if (art === 'themen') return themenpfad(daten, parameter);
  if (art === 'stil') return stilpfad(daten, parameter);
  if (art === 'umgebung') return umgebungspfad(daten);
  if (art === 'witterung') return umgebungspfad(daten, 'witterung', parameter);
  if (art === 'untergrund') return umgebungspfad(daten, 'untergrund', parameter);
  if (art === 'individual') return individualpfad(daten);
  return kompetenzpfad(daten, parameter || diagnose().stufe);
}

// Station für die Baustein-Ansicht, inkl. Nachbarn im gewählten Pfadkontext.
// Liegt der Baustein außerhalb der Sequenz (z. B. Deep-Link), entsteht eine
// Einzelstation ohne Navigation — zugänglich bleibt er immer.
export function stationImKontext(daten, bausteinId, kontext) {
  const sequenz = sequenzFuer(daten, kontext);
  const index = sequenz.stationen.findIndex((s) => s.baustein.id === bausteinId);
  if (index >= 0) {
    return {
      sequenz,
      station: sequenz.stationen[index],
      index,
      vorherige: sequenz.stationen[index - 1] || null,
      naechste: sequenz.stationen[index + 1] || null,
    };
  }
  const baustein = daten.bausteinVonId.get(bausteinId);
  if (!baustein) return null;
  const herkunft = sequenz.art === 'kompetenz' ? diagnose().herkunft : null;
  return {
    sequenz,
    station: baueStation(daten, baustein, new Set(), herkunft),
    index: -1,
    vorherige: null,
    naechste: null,
  };
}
