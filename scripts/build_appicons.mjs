// Rastert die App-Icons aus assets/images/favicon/favicon.svg.
//
// WARUM: Der gelieferte Favicon-Satz enthielt für Apple-Touch und die beiden
// PWA-Grössen Dateien mit TRANSPARENTEM Hintergrund, deren untere Marken-Hälfte
// weiss ist. Auf einem hellen Grund — und genau darauf legen iOS und Android
// App-Icons regelmässig — blieb davon nur die rote Spitze sichtbar, also ein
// halbes Logo. Die SVG-Fassung desselben Satzes ist dagegen vollständig: ein
// schwarzes, abgerundetes Quadrat mit der ganzen Marke darin. Aus ihr entstehen
// hier alle Raster-Icons, damit der Satz zusammenpasst und auf jedem
// Hintergrund trägt.
//
// WARUM CHROMIUM: SVG rastern kann weder Node noch die Python-Standard-
// bibliothek. Der Browser liegt ohnehin für die Verifikation bereit. Das Skript
// ist deshalb ein einmaliges Werkzeug wie build_gitarrenprobe.mjs und laeuft
// NICHT in verify.yml.
//
// Aufruf (Server auf 127.0.0.1:8123 im Projektwurzelverzeichnis):
//   node scripts/build_appicons.mjs           # schreibt die PNGs
//   node scripts/build_appicons.mjs --check    # meldet nur Drift

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

function ladePlaywright() {
  for (const ort of [import.meta.url, '/opt/node22/lib/node_modules/']) {
    try {
      return createRequire(ort)('playwright');
    } catch { /* nächster Ort */ }
  }
  throw new Error('playwright nicht gefunden');
}
const { chromium } = ladePlaywright();

const QUELLE = 'assets/images/favicon/favicon.svg';
const ZIELE = [
  { datei: 'assets/images/favicon/apple-touch-icon.png', kante: 180 },
  { datei: 'assets/images/favicon/app-192.png', kante: 192 },
  { datei: 'assets/images/favicon/app-512.png', kante: 512 },
  { datei: 'assets/images/favicon/favicon-96.png', kante: 96 },
];
// favicon.ico im Wurzelverzeichnis: drei Groessen, jeweils als PNG im ICO-Rahmen
// (seit Windows Vista und in jedem Browser lesbar). Frueher stand hier der
// gelieferte Satz mit dem alten Marken-Rot — beim Farbwechsel blieb er als
// Einziger stehen, weil ihn kein Skript erzeugte. Jetzt kommt er aus derselben SVG.
const ICO_DATEI = 'favicon.ico';
const ICO_KANTEN = [48, 32, 16];

const PRUEFEN = process.argv.includes('--check');

if (!existsSync(QUELLE)) {
  console.error(`Quelle fehlt: ${QUELLE}`);
  process.exit(2);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const gebaut = [];
const icoBilder = [];
for (const { datei, kante } of [...ZIELE, ...ICO_KANTEN.map((k) => ({ datei: null, kante: k }))]) {
  // deviceScaleFactor 1 und exakte Viewport-Kante: So entspricht ein CSS-Pixel
  // genau einem Bildpunkt, ohne Zwischenskalierung.
  const seite = await browser.newPage({ viewport: { width: kante, height: kante }, deviceScaleFactor: 1 });
  // Erst eine echte HTML-Seite laden: Danach ist der Ursprung gesetzt und das
  // <img src="/…"> unten loest gegen den lokalen Server auf. Direkt auf die
  // SVG zu navigieren ergaebe ein SVG-Dokument, in das setContent nicht schreibt.
  await seite.goto('http://127.0.0.1:8123/index.html');
  await seite.setContent(
    `<style>html,body{margin:0;padding:0;width:${kante}px;height:${kante}px;overflow:hidden}`
    + `img{display:block;width:${kante}px;height:${kante}px}</style>`
    + `<img src="/${QUELLE}">`,
  );
  await seite.waitForTimeout(150);
  // omitBackground: Die Marke ist ein abgerundetes Quadrat — seine Ecken
  // muessen transparent bleiben. Mit dem weissen Seitenhintergrund darunter
  // saesse das Icon in einem weissen Kasten, und auf dem Startbildschirm
  // stuende eine Rundung in einer zweiten, eckigen Flaeche.
  const daten = await seite.screenshot({ omitBackground: true });
  if (datei) gebaut.push({ datei, daten });
  else icoBilder.push({ kante, daten });
  await seite.close();
}
await browser.close();

// ICO-Rahmen: ICONDIR (6 Byte) + je Bild ein Eintrag (16 Byte) + die PNG-Daten.
{
  const kopf = Buffer.alloc(6 + 16 * icoBilder.length);
  kopf.writeUInt16LE(0, 0); // reserviert
  kopf.writeUInt16LE(1, 2); // Typ 1 = Icon
  kopf.writeUInt16LE(icoBilder.length, 4);
  let versatz = kopf.length;
  icoBilder.forEach(({ kante, daten }, i) => {
    const e = 6 + 16 * i;
    kopf.writeUInt8(kante >= 256 ? 0 : kante, e);
    kopf.writeUInt8(kante >= 256 ? 0 : kante, e + 1);
    kopf.writeUInt8(0, e + 2); // keine Palette
    kopf.writeUInt8(0, e + 3);
    kopf.writeUInt16LE(1, e + 4); // Ebenen
    kopf.writeUInt16LE(32, e + 6); // Bit je Punkt
    kopf.writeUInt32LE(daten.length, e + 8);
    kopf.writeUInt32LE(versatz, e + 12);
    versatz += daten.length;
  });
  gebaut.push({ datei: ICO_DATEI, daten: Buffer.concat([kopf, ...icoBilder.map((b) => b.daten)]) });
}

const hash = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
let drift = 0;
for (const { datei, daten } of gebaut) {
  const alt = existsSync(datei) ? readFileSync(datei) : null;
  const gleich = alt && alt.equals(daten);
  if (PRUEFEN) {
    if (!gleich) {
      console.error(`DRIFT ${datei}: eingecheckt ${alt ? hash(alt) : '—'}, gebaut ${hash(daten)}`);
      drift++;
    }
    continue;
  }
  if (!gleich) writeFileSync(datei, daten);
  console.log(`${gleich ? 'unverändert' : 'geschrieben'} ${datei} (${(daten.length / 1024).toFixed(1)} KB)`);
}
if (PRUEFEN) {
  if (drift) { console.error(`${drift} Icon(s) weichen ab — build_appicons.mjs laufen lassen.`); process.exit(1); }
  console.log('OK — App-Icons stimmen mit der Quelle überein.');
}
