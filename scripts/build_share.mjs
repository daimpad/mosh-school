// Erzeugt das Vorschaubild fuer Messenger und Social (Open Graph / Twitter-Karte):
// assets/images/marke/share.png, 1200 x 630.
//
// WARUM ES DAS GIBT: Ohne og:image zeigt ein geteilter Link nur Titel und Text —
// in jedem Messenger eine graue Zeile statt einer Karte. Das Bild traegt die Marke
// (Zerre-Zeichen, Schriftzug, Subline) auf Schwarz und kippt nicht mit dem Thema:
// Wie ein Flyer ist es ein Blatt, kein Oberflaechenelement.
//
// WOHER DIE WERTE KOMMEN (nichts wird ein zweites Mal gepflegt):
//   - Schriftzug und Subline: data/labels/de.json (app_titel, hero_untertitel)
//   - Lila: --marke-farbe aus css/app.css (die Marken-Konstante, nicht --primaer)
//   - Tinte und Grund: --tinte und --hintergrund aus dem dunklen Themenblock von
//     css/app.css (das Bild kippt nicht mit dem Thema, es steht immer auf Schwarz)
//   - Schrift: dieselben lokalen Dateien wie die App (New Rocker, Roboto)
//   - Zeichen: dieselben Masken wie die App (assets/images/marke/bild-*.svg)
//   - Spiegelung der letzten drei Buchstaben: dieselbe Regel wie
//     wortmarkeSchriftzug() in js/genre-inszenierung.js ("RER" ist ein Palindrom,
//     die Spiegelung dreht nur die Glyphen)
//
// WARUM CHROMIUM: Schrift, Masken und Spiegelung rendert nur ein Browser
// zuverlaessig. Das Skript ist deshalb ein einmaliges Werkzeug wie
// build_appicons.mjs und laeuft NICHT in verify.yml.
//
// Das Bild steht bewusst NICHT in der SW-SHELL: Es wird nur von fremden Servern
// (Messenger, Crawler) geholt, nie von der App selbst.
//
// Aufruf (Server auf 127.0.0.1:8123 im Projektwurzelverzeichnis):
//   node scripts/build_share.mjs           # schreibt das PNG
//   node scripts/build_share.mjs --check   # meldet nur Drift

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

function ladePlaywright() {
  for (const ort of [import.meta.url, '/opt/node22/lib/node_modules/']) {
    try {
      return createRequire(ort)('playwright');
    } catch { /* naechster Ort */ }
  }
  throw new Error('playwright nicht gefunden');
}
const { chromium } = ladePlaywright();

const ZIEL = 'assets/images/marke/share.png';
const PRUEFEN = process.argv.includes('--check');
const BREITE = 1200;
const HOEHE = 630;
// Der Schriftzug fuellt diese Breite (Rand links und rechts je 90 px).
const WORT_BREITE = 1020;
const SPIEGEL_ENDE = 'RER';

const css = readFileSync('css/app.css', 'utf8');
const marke = /--marke-farbe:\s*(#[0-9a-fA-F]{6})\s*;/.exec(css)?.[1];
if (!marke) {
  console.error('--marke-farbe nicht in css/app.css gefunden (umbenannt?)');
  process.exit(2);
}
// Token aus dem dunklen Themenblock. Es gibt mehrere Bloecke dieser Art (die
// spaeteren ueberschreiben die frueheren), der LETZTE gewinnt.
function tokenDunkel(name) {
  const bloecke = [...css.matchAll(/:root\[data-theme='dunkel'\]\s*\{([^}]*)\}/g)].reverse();
  for (const block of bloecke) {
    const treffer = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block[1]);
    if (treffer) return treffer[1];
  }
  console.error(`${name} nicht im dunklen Themenblock von css/app.css gefunden (umbenannt?)`);
  process.exit(2);
}
const TINTE = tokenDunkel('--tinte');
const GRUND = tokenDunkel('--hintergrund');
const ui = JSON.parse(readFileSync('data/labels/de.json', 'utf8')).ui;
const titel = ui.app_titel;
const subline = ui.hero_untertitel;
if (!titel || !subline) {
  console.error('app_titel/hero_untertitel fehlen in data/labels/de.json');
  process.exit(2);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const endetSpiegel = titel.toUpperCase().endsWith(SPIEGEL_ENDE);
const wortHtml = endetSpiegel
  ? `${esc(titel.slice(0, -SPIEGEL_ENDE.length))}<span class="spiegel">${esc(titel.slice(-SPIEGEL_ENDE.length))}</span>`
  : esc(titel);

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'New Rocker'; font-weight: 400; src: url('/assets/fonts/new-rocker-latin-400-normal.woff2') format('woff2'); }
@font-face { font-family: 'Roboto'; font-weight: 700; src: url('/assets/fonts/roboto-latin-700-normal.woff2') format('woff2'); }
html, body { margin: 0; padding: 0; width: ${BREITE}px; height: ${HOEHE}px; overflow: hidden; background: ${GRUND}; }
body { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.zeichen { position: relative; width: 210px; aspect-ratio: 132.85 / 120.79; margin-bottom: 20px; }
.zeichen i { position: absolute; inset: 0; -webkit-mask-position: center; mask-position: center;
  -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; }
.tinte { background: ${TINTE}; -webkit-mask-image: url('/assets/images/marke/bild-tinte.svg'); mask-image: url('/assets/images/marke/bild-tinte.svg'); }
.farbe { background: ${marke}; -webkit-mask-image: url('/assets/images/marke/bild-rot.svg'); mask-image: url('/assets/images/marke/bild-rot.svg'); }
.wort { font: 400 200px/1 'New Rocker', 'Special Elite', cursive; color: ${TINTE}; letter-spacing: 0.02em; white-space: nowrap; }
.spiegel { display: inline-block; transform: scaleX(-1); }
.unter { margin-top: 26px; font: 700 34px/1 'Roboto', system-ui, sans-serif; letter-spacing: 0.46em; text-indent: 0.46em;
  text-transform: uppercase; color: ${TINTE}; opacity: 0.78; }
.balken { position: absolute; left: 0; right: 0; bottom: 0; height: 16px; background: ${marke}; }
</style>
<div class="zeichen"><i class="tinte"></i><i class="farbe"></i></div>
<div class="wort" id="wort">${wortHtml}</div>
<div class="unter">${esc(subline)}</div>
<div class="balken"></div>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const seite = await browser.newPage({ viewport: { width: BREITE, height: HOEHE }, deviceScaleFactor: 1 });
// Erst eine echte Seite laden: Danach ist der Ursprung gesetzt und die /assets/…-
// Adressen oben loesen gegen den lokalen Server auf.
await seite.goto('http://127.0.0.1:8123/index.html');
await seite.setContent(html);
await seite.evaluate(async () => {
  await document.fonts.ready;
  // CSS-mask-image laedt erst beim ersten Malen — ein Screenshot nach festem
  // Timeout kaeme auf einer langsamen Maschine ohne Zerre-Zeichen zustande, und
  // --check verglich dann das PNG mit einem anderen Lauf. Die Masken werden hier
  // ausdruecklich vorgeladen; ein Fehler bricht das Skript ab, statt ein Bild ohne
  // Zeichen zu liefern.
  await Promise.all(['bild-tinte', 'bild-rot'].map((n) => new Promise((ok, fehl) => {
    const bild = new Image();
    bild.onload = ok;
    bild.onerror = () => fehl(new Error(`Maske ${n}.svg nicht ladbar`));
    bild.src = `/assets/images/marke/${n}.svg`;
  })));
});
// Schriftzug auf die Zielbreite bringen: bei 200 px messen und linear skalieren —
// dieselbe Technik wie passeMarkeGroesseAn() im Hero. Ein fester Wert traefe die
// Breite nur ungefaehr.
await seite.evaluate((ziel) => {
  const w = document.getElementById('wort');
  const natur = w.getBoundingClientRect().width;
  w.style.fontSize = (200 * ziel / natur).toFixed(2) + 'px';
}, WORT_BREITE);
// Zwei Frames abwarten: erst dann sind Masken und die angepasste Schriftgroesse gemalt.
await seite.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
const daten = await seite.screenshot();
await browser.close();

const hash = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);
const alt = existsSync(ZIEL) ? readFileSync(ZIEL) : null;
const gleich = alt && alt.equals(daten);
if (PRUEFEN) {
  if (!gleich) {
    console.error(`DRIFT ${ZIEL}: eingecheckt ${alt ? hash(alt) : '—'}, gebaut ${hash(daten)} — build_share.mjs laufen lassen.`);
    process.exit(1);
  }
  console.log('OK — Vorschaubild stimmt mit der Quelle überein.');
} else {
  if (!gleich) writeFileSync(ZIEL, daten);
  console.log(`${gleich ? 'unverändert' : 'geschrieben'} ${ZIEL} (${(daten.length / 1024).toFixed(1)} KB)`);
}
