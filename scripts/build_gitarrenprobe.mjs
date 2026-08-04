// Erzeugt die web-tauglichen Gitarren-Klangproben für das Zerr-Labor aus dem
// CC0-Rohbestand unter assets/sounds/solotones/.
//
// WARUM EIN GENERATOR: Der Rohbestand sind 24-bit/48-kHz-FLACs mit über 30 s
// Ausklang, gut 1,3 MB je Ton. Ausgeliefert wird daraus ein knapper Ausschnitt
// als 16-bit-Mono-WAV — klein genug zum Nachladen, verlustfrei genug für ein
// Werkzeug, dessen ganzer Zweck starkes Klippen ist. Lossy-Codecs scheiden hier
// aus: Ihre Artefakte sitzen genau in dem Bereich, den die Kennlinie danach
// anhebt.
//
// WARUM CHROMIUM: FLAC lässt sich weder mit Node-Bordmitteln noch mit Python-
// stdlib dekodieren, und eine Fremdbibliothek wäre eine Laufzeit-Abhängigkeit
// mehr. Der Browser kann es von Haus aus (`decodeAudioData`), Playwright und
// Chromium liegen ohnehin für die Verifikation bereit. Das Skript ist deshalb
// ein einmaliges Werkzeug wie build_svg*.py und läuft NICHT in verify.yml.
//
// Aufruf:
//   node scripts/build_gitarrenprobe.mjs           # schreibt assets/sounds/*.wav
//   node scripts/build_gitarrenprobe.mjs --check    # baut nur im Speicher, meldet Drift
//
// Voraussetzung: laufender Server auf 127.0.0.1:8123 im Projektwurzelverzeichnis
// (`python3 -m http.server 8123`), weil decodeAudioData ein fetch() braucht.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright liegt in dieser Umgebung global, nicht im Projekt (das Projekt hat
// bewusst keine npm-Abhängigkeiten). Erst lokal versuchen, dann global.
function ladePlaywright() {
  for (const ort of [import.meta.url, '/opt/node22/lib/node_modules/']) {
    try {
      return createRequire(ort)('playwright');
    } catch { /* nächster Ort */ }
  }
  throw new Error('playwright nicht gefunden — npm i -D playwright oder global installieren');
}
const { chromium } = ladePlaywright();

const BASIS = 'http://127.0.0.1:8123';
const PRUEFEN = process.argv.includes('--check');

// Ausgewählt wird die tiefe Leersaite E2 (82,4 Hz) in zwei Anschlagsstärken.
// E2 ist der tiefste Ton einer normal gestimmten Gitarre — das synthetische
// Riff daneben liegt auf E1 und damit unterhalb dessen, was eine Gitarre
// überhaupt hergibt.
const PROBEN = [
  { quelle: 'assets/sounds/solotones/E2_s1_01.flac', ziel: 'assets/sounds/gitarre-e2-hart.wav' },
  { quelle: 'assets/sounds/solotones/E2_s1_soft_01.flac', ziel: 'assets/sounds/gitarre-e2-weich.wav' },
];

const ABTASTRATE = 44100;
const DAUER = 1.8;      // s — trägt die längste Note des Riffs samt Ausklang
const SPITZE = 0.9;     // beide Proben auf denselben Spitzenwert

async function baue() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const seite = await browser.newPage();
  await seite.goto(`${BASIS}/index.html`);
  const ergebnis = [];
  for (const probe of PROBEN) {
    const b64 = await seite.evaluate(async ([pfad, rate, dauer, spitze]) => {
      const roh = await (await fetch(`/${pfad}`)).arrayBuffer();
      // Dekodieren in der Zielrate: ein einziger Resampling-Schritt statt zwei.
      const off = new OfflineAudioContext(1, Math.ceil(rate * dauer), rate);
      const ab = await off.decodeAudioData(roh);
      // NUR EIN KANAL, kein Summieren: Die beiden Spuren tragen dieselbe
      // Aufnahme um wenige Samples versetzt (Kreuzkorrelation: 3–13 Samples).
      // Summiert ergäbe das einen Kammfilter — eine Kerbe im Spektrum, die in
      // der Aufnahme nicht drin ist und nach der Kennlinie erst recht auffiele.
      const d = ab.getChannelData(0);
      // Anschlag suchen: erster Wert über 0,1 % des Spitzenwerts.
      let spitzeRoh = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > spitzeRoh) spitzeRoh = a; }
      let start = 0;
      while (start < d.length && Math.abs(d[start]) < spitzeRoh * 0.001) start++;
      const n = Math.round(rate * dauer);
      const aus = new Float32Array(n);
      for (let i = 0; i < n; i++) aus[i] = d[start + i] || 0;
      // Normieren auf denselben Spitzenwert: Der Unterschied zwischen hart und
      // weich soll in der Klangfarbe liegen, nicht im Pegel — den setzt das
      // Riff selbst, sonst wären Anschlagsstärke und Lautstärke verkoppelt.
      let s = 0;
      for (let i = 0; i < n; i++) { const a = Math.abs(aus[i]); if (a > s) s = a; }
      const f = s > 0 ? spitze / s : 1;
      // 1 ms Anlauf gegen einen Knacks am Schnitt, 60 ms Ausblendung am Ende.
      const an = Math.round(rate * 0.001);
      const ab2 = Math.round(rate * 0.06);
      const i16 = new Int16Array(n);
      for (let i = 0; i < n; i++) {
        let v = aus[i] * f;
        if (i < an) v *= i / an;
        if (i > n - ab2) v *= (n - i) / ab2;
        v = Math.max(-1, Math.min(1, v));
        i16[i] = Math.round(v < 0 ? v * 0x8000 : v * 0x7fff);
      }
      let bin = '';
      const bytes = new Uint8Array(i16.buffer);
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(bin);
    }, [probe.quelle, ABTASTRATE, DAUER, SPITZE]);
    ergebnis.push({ ...probe, daten: wavKopf(Buffer.from(b64, 'base64')) });
  }
  await browser.close();
  return ergebnis;
}

// 16-bit-Mono-WAV: kleinster gemeinsamer Nenner, den jeder Browser ohne Codec
// dekodiert.
function wavKopf(pcm) {
  const kopf = Buffer.alloc(44);
  kopf.write('RIFF', 0);
  kopf.writeUInt32LE(36 + pcm.length, 4);
  kopf.write('WAVE', 8);
  kopf.write('fmt ', 12);
  kopf.writeUInt32LE(16, 16);
  kopf.writeUInt16LE(1, 20);            // PCM
  kopf.writeUInt16LE(1, 22);            // Mono
  kopf.writeUInt32LE(ABTASTRATE, 24);
  kopf.writeUInt32LE(ABTASTRATE * 2, 28);
  kopf.writeUInt16LE(2, 32);
  kopf.writeUInt16LE(16, 34);
  kopf.write('data', 36);
  kopf.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([kopf, pcm]);
}

const hash = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

const gebaut = await baue();
let drift = 0;
for (const { ziel, daten } of gebaut) {
  const alt = existsSync(ziel) ? readFileSync(ziel) : null;
  const gleich = alt && alt.equals(daten);
  if (PRUEFEN) {
    if (!gleich) {
      console.error(`DRIFT ${ziel}: eingecheckt ${alt ? hash(alt) : '—'}, gebaut ${hash(daten)}`);
      drift++;
    }
    continue;
  }
  if (!gleich) writeFileSync(ziel, daten);
  console.log(`${gleich ? 'unverändert' : 'geschrieben'} ${ziel} (${(daten.length / 1024).toFixed(0)} KB, ${hash(daten)})`);
}
if (PRUEFEN) {
  if (drift) { console.error(`${drift} Datei(en) weichen ab — build_gitarrenprobe.mjs laufen lassen.`); process.exit(1); }
  console.log('OK — Klangproben stimmen mit den Quellen überein.');
}
