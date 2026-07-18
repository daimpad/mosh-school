// Quittierungs-Aktionen: Statuswechsel plus Erkennung des Pfadabschluss-
// Meilensteins (Spez. 8.3.2). Der Status selbst bleibt baustein-gebunden;
// der Meilenstein ist reine Projektion über die Pfadmenge vorher/nachher.

import { aufgabenTeile } from './daten.js';
import { projektion } from './fortschritt.js';
import { sequenzFuer } from './pfade.js';
import { setzeTeilStatus, teilStatus } from './zustand.js';

function pfadQuote(daten, kontext) {
  const sequenz = sequenzFuer(daten, kontext);
  return {
    sequenz,
    quote: projektion(sequenz.stationen.map((s) => s.baustein)).quote,
  };
}

function meilensteinFuer(daten, kontext, quoteVorher) {
  const { sequenz, quote } = pfadQuote(daten, kontext);
  const zaehltAlsPfad = sequenz.art === 'kompetenz' || sequenz.art === 'individual';
  if (!zaehltAlsPfad || sequenz.stationen.length === 0) return null;
  if (quoteVorher < 1 && quote === 1) {
    return { art: sequenz.art, stufe: sequenz.stufe ?? null, ziel: sequenz.ziel ?? null };
  }
  return null;
}

// Einen Teil umschalten (offen ↔ erledigt). Liefert den neuen Status und,
// falls die Aktion den Pfad im aktuellen Kontext vollendet, den Meilenstein.
export function schalteTeil(daten, kontext, bausteinId, teil) {
  const vorher = pfadQuote(daten, kontext).quote;
  const neuerStatus = teilStatus(bausteinId, teil) === 'erledigt' ? 'offen' : 'erledigt';
  setzeTeilStatus(bausteinId, teil, neuerStatus);
  return { neuerStatus, meilenstein: meilensteinFuer(daten, kontext, vorher) };
}

// Ganzen Baustein als erledigt setzen (Vormarkieren/Überspringen, Spez. 6.5).
export function markiereAbsolviert(daten, kontext, baustein) {
  const vorher = pfadQuote(daten, kontext).quote;
  setzeTeilStatus(baustein.id, 'erklaerteil', 'erledigt');
  // Alle quittierbaren Aufgabenteile mitschließen — Übungsteil ODER Reflexionsaufgabe;
  // sonst bliebe ein reflexions-only Baustein trotz „Vormarkieren" offen (Spez. 3.5/6.5).
  for (const teil of aufgabenTeile(baustein)) setzeTeilStatus(baustein.id, teil, 'erledigt');
  return { meilenstein: meilensteinFuer(daten, kontext, vorher) };
}
