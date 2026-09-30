// Prueft den Offline-Rueckfall des Service Workers gegen die echten statischen Seiten.
//
// WARUM: Offline leitet sw.js eine Tier-2-Adresse (/baustein/<id>/, /pfad/…) auf die
// Hash-Route der App um (hashRouteFuer). Diese Abbildung ist eine zweite,
// handgepflegte Kopie der Pfadstruktur aus scripts/build_seiten.py. Kommt eine neue
// statische Seitenart dazu und wird sie dort vergessen, faellt das nirgends auf:
// Offline-Nutzer landen auf der Startseite statt am Ziel. (So war es bei
// kollektiv/ — die Seite gab es laengst, die Abbildung kannte sie nicht.)
//
// WIE: sw.js wird als klassisches Skript in einer vm-Huelle geladen (ohne Netz, ohne
// Browser), hashRouteFuer() wird fuer JEDE Adresse der sitemap.xml aufgerufen. Die
// Hash-Routen der App spiegeln die Pfade 1:1 (`baustein/<id>/` → `#/baustein/<id>`),
// erwartet wird also `#/` + Pfad ohne Schraegstrich am Ende.
//
// Aufruf: node scripts/pruefe_sw_routen.mjs

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const quelle = readFileSync('sw.js', 'utf8');
const huelle = vm.createContext({
  self: {
    addEventListener() {},
    registration: { scope: 'https://zerrer.org/' },
    skipWaiting() {},
    clients: { claim() {} },
  },
  URL,
  Request: class {},
  Response: class {},
  caches: {},
  fetch() {},
  console,
});
vm.runInContext(quelle, huelle, { filename: 'sw.js' });

const abbilden = huelle.hashRouteFuer;
if (typeof abbilden !== 'function') {
  console.error('FEHLER: hashRouteFuer() in sw.js nicht gefunden (umbenannt?) — diese Pruefung muss nachgezogen werden.');
  process.exit(2);
}

const sitemap = readFileSync('sitemap.xml', 'utf8');
const pfade = [...sitemap.matchAll(/<loc>https:\/\/zerrer\.org\/([^<]*)<\/loc>/g)]
  .map((m) => m[1])
  .filter((p) => p); // die Wurzel selbst braucht keine Umleitung
if (pfade.length < 10) {
  console.error(`FEHLER: nur ${pfade.length} Adressen in sitemap.xml gelesen — Format geaendert?`);
  process.exit(2);
}

let fehler = 0;
for (const rel of pfade) {
  const soll = '#/' + rel.replace(/\/+$/, '');
  const ist = abbilden(rel);
  if (ist !== soll) {
    if (fehler < 15) console.error(`FEHLER: ${rel} → "${ist}", erwartet "${soll}"`);
    fehler++;
  }
}
if (fehler) {
  console.error(`\n${fehler} von ${pfade.length} Adressen werden offline falsch umgeleitet — hashRouteFuer() in sw.js nachziehen.`);
  process.exit(1);
}
console.log(`OK — ${pfade.length} statische Seiten werden offline auf ihre Hash-Route umgeleitet.`);
