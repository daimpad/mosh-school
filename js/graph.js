// Voraussetzungsgraph: bestimmt die Default-Reihenfolge, nie die Zugänglichkeit
// (Zwei-Ebenen-Logik, Spez. 4.4). Kanten zählen nur innerhalb der übergebenen Menge.

// Stabile topologische Sortierung (Kahn). `vergleicher` ordnet gleichrangig
// bereite Bausteine (z. B. Domäne, Ziel-Nähe, Pool-Reihenfolge).
// Zyklische Reste werden angehängt und benannt, statt zu blockieren.
export function topoSortiere(bausteine, vergleicher) {
  const vonId = new Map(bausteine.map((b) => [b.id, b]));
  const offeneKanten = new Map(bausteine.map((b) => [b.id, 0]));
  const abhaengige = new Map(bausteine.map((b) => [b.id, []]));

  for (const b of bausteine) {
    for (const voraussetzung of b.voraussetzungen || []) {
      if (!vonId.has(voraussetzung)) continue;
      offeneKanten.set(b.id, offeneKanten.get(b.id) + 1);
      abhaengige.get(voraussetzung).push(b.id);
    }
  }

  const bereit = bausteine.filter((b) => offeneKanten.get(b.id) === 0);
  const reihenfolge = [];
  while (bereit.length > 0) {
    bereit.sort(vergleicher);
    const naechster = bereit.shift();
    reihenfolge.push(naechster);
    for (const folgeId of abhaengige.get(naechster.id)) {
      const rest = offeneKanten.get(folgeId) - 1;
      offeneKanten.set(folgeId, rest);
      if (rest === 0) bereit.push(vonId.get(folgeId));
    }
  }

  const zyklisch = bausteine.filter((b) => !reihenfolge.includes(b));
  if (zyklisch.length > 0) {
    zyklisch.sort(vergleicher);
    reihenfolge.push(...zyklisch);
  }
  return { reihenfolge, zyklisch: zyklisch.map((b) => b.id) };
}

// Weiche Empfehlung: welche Voraussetzungen sind noch nicht absolviert?
export function fehlendeVoraussetzungen(baustein, istAbsolviert) {
  return (baustein.voraussetzungen || []).filter((id) => !istAbsolviert(id));
}
