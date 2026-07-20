// Fortschritts-Projektionen (Spez. 8.1): der baustein-gebundene Abschluss-Status
// ist die invariante Datengrundlage; alles hier wird live darüber berechnet
// und nie gespeichert.

import { aufgabenTeile } from './daten.js';
import { teilStatus } from './zustand.js';

// „Absolviert" = Erklärteil erledigt und alle Aufgabenteile (Übung und/oder
// Reflexion), falls vorhanden, erledigt.
export function bausteinAbsolviert(baustein) {
  if (teilStatus(baustein.id, 'erklaerteil') !== 'erledigt') return false;
  return aufgabenTeile(baustein).every((teil) => teilStatus(baustein.id, teil) === 'erledigt');
}

export function absolviertNachId(daten) {
  return (id) => {
    const baustein = daten.bausteinVonId.get(id);
    return baustein ? bausteinAbsolviert(baustein) : false;
  };
}

// Projektion über eine beliebige Baustein-Menge (global, pfadbezogen, …).
// Übung und Reflexion werden als „Aufgabenteile" gemeinsam gezählt (pro Baustein
// liegt genau eines vor).
export function projektion(bausteine) {
  const p = {
    gesamt: bausteine.length,
    absolviert: 0,
    quote: 0,
    erklaertErledigt: 0,
    aufgabeGesamt: 0,
    aufgabeErledigt: 0,
  };
  for (const b of bausteine) {
    if (bausteinAbsolviert(b)) p.absolviert += 1;
    if (teilStatus(b.id, 'erklaerteil') === 'erledigt') p.erklaertErledigt += 1;
    for (const teil of aufgabenTeile(b)) {
      p.aufgabeGesamt += 1;
      if (teilStatus(b.id, teil) === 'erledigt') p.aufgabeErledigt += 1;
    }
  }
  p.quote = p.gesamt === 0 ? 0 : p.absolviert / p.gesamt;
  return p;
}

export function globaleProjektion(daten) {
  return projektion(daten.bausteine);
}
