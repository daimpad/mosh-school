// Erzeugt die One-Shots der Sample-Bank (js/audio/samples.js) aus den
// ElevenLabs-Rohdateien unter scripts/samples_quelle/.
//
// WARUM EIN GENERATOR: ElevenLabs liefert 2–4 s lange Stereo-MP3s mit
// unterschiedlichem Pegel, Stille vor dem Anschlag, Grummeln unter den Becken
// und dem Encoder-Vorlauf des MP3. Ausgeliefert wird daraus ein knapper,
// pegelgleicher Mono-Ausschnitt als 16-bit-WAV — verlustfrei, damit der
// Anschlag exakt auf der Zählzeit sitzt (ein MP3 bringt 20–50 ms Vorlauf mit,
// je nach Decoder unterschiedlich viel; im Groove wäre das ein hörbarer Schleppfehler).
//
// WARUM CHROMIUM: MP3 lässt sich weder mit Node- noch mit Python-Bordmitteln
// dekodieren; der Browser kann es (`decodeAudioData`). Wie
// build_gitarrenprobe.mjs läuft das Skript deshalb NICHT in verify.yml.
//
// TONHÖHE: Für Gitarre und Bass misst das Skript den Grundton der fertigen Datei
// (spektral, s. u.) und bricht ab, wenn er mehr als 10 Cent vom Wert in SAMPLES abweicht.
// Die App rechnet jede gespielte Note aus diesem Wert — ein falscher Grundton
// hieße: alles verstimmt, und zwar ohne Fehlermeldung.
//
// Aufruf:
//   python3 -m http.server 8123 &          # im Projektwurzelverzeichnis
//   node scripts/build_samples.mjs          # schreibt assets/sounds/samples/*.wav
//   node scripts/build_samples.mjs --check  # baut nur im Speicher, meldet Drift
//   node scripts/build_samples.mjs --messen # gibt nur die gemessenen Grundtöne aus
//   node scripts/build_samples.mjs --beispiele  # misst die Klangbeispiele
//        (js/audio/klangbeispiele.js) und gibt je Eintrag den Pegel aus, der
//        ihn auf seine Ziel-Lautheit bringt; mit --check bricht es bei mehr
//        als 1 dB Abweichung zum eingetragenen Wert ab.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

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
// --messen: nur Grundtöne ausgeben (im Fenster um den eingetragenen Wert),
// nichts prüfen und nichts schreiben — zum
// Eintragen neuer Werte in SAMPLES.
const MESSEN = process.argv.includes('--messen');
const ABTASTRATE = 44100;
const SPITZE = 0.9;
const ORDNER = 'assets/sounds/samples/';

// name = Schlüssel in SAMPLES (js/audio/samples.js); dauer = ausgelieferte Länge;
// hochpass = Eckfrequenz gegen Grummeln (Becken tragen in den Rohdateien ein
// tieffrequentes Rauschen mit, das unter einer Kick nur Matsch wäre).
const PROBEN = [
  { name: 'kick', dauer: 0.5, hochpass: 30 },
  { name: 'snare', dauer: 0.45, hochpass: 80 },
  { name: 'hihat', dauer: 0.15, hochpass: 300 },
  { name: 'hihat_offen', dauer: 0.6, hochpass: 300 },
  { name: 'crash', dauer: 1.6, hochpass: 200 },
  { name: 'china', dauer: 1.2, hochpass: 200 },
  { name: 'ride', dauer: 1.2, hochpass: 200 },
  { name: 'tom_hoch', dauer: 1.0, hochpass: 50 },
  { name: 'tom_tief', dauer: 1.1, hochpass: 40 },
  { name: 'gitarre_zerre_e2', dauer: 1.2, hochpass: 60 },
  { name: 'gitarre_zerre_b2', dauer: 1.2, hochpass: 60 },
  { name: 'gitarre_zerre_fis3', dauer: 1.2, hochpass: 80 },
  { name: 'gitarre_zerre_f4', dauer: 1.2, hochpass: 120 },
  { name: 'gitarre_zerre_a4', dauer: 1.2, hochpass: 120 },
  { name: 'bass_e1', dauer: 1.4, hochpass: 25 },
  { name: 'bass_e2', dauer: 1.4, hochpass: 30 },
  { name: 'kick_2', dauer: 0.5, hochpass: 30 },
  { name: 'kick_3', dauer: 0.5, hochpass: 30 },
  { name: 'snare_2', dauer: 0.45, hochpass: 80 },
  { name: 'snare_3', dauer: 0.45, hochpass: 80 },
  { name: 'hihat_2', dauer: 0.15, hochpass: 300 },
  { name: 'hihat_3', dauer: 0.15, hochpass: 300 },
  { name: 'hihat_4', dauer: 0.15, hochpass: 300 },
  { name: 'snare_ghost', dauer: 0.4, hochpass: 80 },
  { name: 'snare_rand', dauer: 0.45, hochpass: 80 },
  { name: 'ride_glocke', dauer: 1.2, hochpass: 200 },
  { name: 'splash', dauer: 0.9, hochpass: 200 },
  { name: 'tom_mitte', dauer: 1.0, hochpass: 45 },
  { name: 'hihat_pedal', dauer: 0.2, hochpass: 300 },
  { name: 'stack', dauer: 0.6, hochpass: 200 },
  { name: 'gitarre_zerre_a1', dauer: 1.0, hochpass: 30 },
  { name: 'gitarre_zerre_b1', dauer: 1.0, hochpass: 35 },
  { name: 'gitarre_zerre_a2', dauer: 1.0, hochpass: 60 },
  { name: 'gitarre_zerre_d3', dauer: 1.0, hochpass: 70 },
  { name: 'gitarre_zerre_b3', dauer: 1.0, hochpass: 100 },
  { name: 'gitarre_zerre_d4', dauer: 1.0, hochpass: 120 },
  { name: 'gitarre_zerre_b4', dauer: 1.0, hochpass: 150 },
  { name: 'gitarre_zerre_dis5', dauer: 1.0, hochpass: 200 },
  { name: 'gitarre_chug_e2', dauer: 0.4, hochpass: 50 },
  { name: 'gitarre_chug_a2', dauer: 0.4, hochpass: 60 },
  { name: 'gitarre_tot', dauer: 0.3, hochpass: 80 },
  { name: 'gitarre_clean_e2', dauer: 1.4, hochpass: 50 },
  { name: 'gitarre_clean_a2', dauer: 1.4, hochpass: 60 },
  { name: 'gitarre_clean_d3', dauer: 1.4, hochpass: 80 },
  { name: 'gitarre_clean_g3', dauer: 1.4, hochpass: 100 },
  { name: 'gitarre_clean_b3', dauer: 1.4, hochpass: 120 },
  { name: 'gitarre_clean_d4', dauer: 1.4, hochpass: 140 },
  { name: 'gitarre_clean_fis4', dauer: 1.4, hochpass: 180 },
  { name: 'gitarre_clean_b4', dauer: 1.4, hochpass: 240 },
  { name: 'gitarre_clean_e5', dauer: 1.4, hochpass: 320 },
  { name: 'bass_d2', dauer: 1.2, hochpass: 30 },
  { name: 'bass_ais2', dauer: 1.2, hochpass: 35 },
  { name: 'bass_d3', dauer: 1.2, hochpass: 50 },
  { name: 'bass_gedaempft_cis2', dauer: 0.5, hochpass: 30 },
  // Zählwörter fürs Einzählen: aus EINER Aufnahme („Eins, zwei, drei, vier“,
  // gleichmäßig gesprochen) geschnitten — einzeln erzeugte Wörter klängen nach
  // vier verschiedenen Tagen. `ab` = Sekunde, ab der der Anschlag gesucht wird.
  { name: 'zaehl_1', ab: 0, dauer: 0.55, hochpass: 80 },
  { name: 'zaehl_2', ab: 0.745, dauer: 0.55, hochpass: 80 },
  { name: 'zaehl_3', ab: 1.505, dauer: 0.55, hochpass: 80 },
  { name: 'zaehl_4', ab: 2.245, dauer: 0.55, hochpass: 80 },
];

const quelleVon = (name) => `scripts/samples_quelle/${name.replace(/_/g, '-')}.mp3`;

async function baue() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const seite = await browser.newPage();
  await seite.goto(`${BASIS}/index.html`);
  const SAMPLES = await seite.evaluate(async () => (await import('/js/audio/samples.js')).SAMPLES);
  const ergebnis = [];
  for (const probe of PROBEN) {
    const eintrag = SAMPLES[probe.name];
    if (!eintrag) throw new Error(`${probe.name}: fehlt in SAMPLES (js/audio/samples.js)`);
    const quelle = quelleVon(eintrag.quelle || probe.name);
    if (!existsSync(quelle)) throw new Error(`${probe.name}: Rohdatei ${quelle} fehlt`);
    const { b64, f0 } = await seite.evaluate(async ([pfad, rate, dauer, hochpass, spitze, tonal, soll, abSek]) => {
      const roh = await (await fetch(`/${pfad}`)).arrayBuffer();
      const dek = await new OfflineAudioContext(1, rate, rate).decodeAudioData(roh);
      // Kanal 0 statt Summe: Die Stereo-Spuren der Rohdateien sind nicht
      // phasengleich, summiert entstünde ein Kammfilter.
      const d = dek.getChannelData(0).subarray(Math.round(abSek * rate));
      let spitzeRoh = 0;
      for (let i = 0; i < d.length; i++) spitzeRoh = Math.max(spitzeRoh, Math.abs(d[i]));
      // Anschlag: erster Wert über 2 % der Spitze, 2 ms davor beginnen.
      let start = 0;
      while (start < d.length && Math.abs(d[start]) < spitzeRoh * 0.02) start++;
      start = Math.max(0, start - Math.round(rate * 0.002));
      const n = Math.round(rate * dauer);
      // Hochpass über einen Offline-Kontext (zweipolig, wie live).
      const off = new OfflineAudioContext(1, n, rate);
      const b = off.createBuffer(1, n, rate);
      b.getChannelData(0).set(d.subarray(start, start + n));
      const q = off.createBufferSource();
      q.buffer = b;
      const hp = off.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = hochpass;
      q.connect(hp).connect(off.destination);
      q.start(0);
      const aus = (await off.startRendering()).getChannelData(0);
      let s = 0;
      for (let i = 0; i < n; i++) s = Math.max(s, Math.abs(aus[i]));
      const f = s > 0 ? spitze / s : 1;
      // 1 ms Anlauf gegen Knacken, Ausblendung über das letzte Viertel.
      const an = Math.round(rate * 0.001);
      const ab = Math.round(n * 0.25);
      const i16 = new Int16Array(n);
      const fertig = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let v = aus[i] * f;
        if (i < an) v *= i / an;
        if (i > n - ab) v *= ((n - i) / ab) ** 2;
        v = Math.max(-1, Math.min(1, v));
        fertig[i] = v;
        i16[i] = Math.round(v < 0 ? v * 0x8000 : v * 0x7fff);
      }
      // Grundton spektral: Harmonic Product Spectrum (Produkt der Beträge bei
      // f, 2f, 3f, 4f) findet den Grundton auch dann, wenn er selbst schwach ist
      // (tiefe Basssaite) oder die Zerre die Wellenform verbiegt — dort greift
      // eine Autokorrelation (YIN) regelmäßig eine Oktave daneben. Verfeinert
      // wird über die Lage der ersten sechs Obertöne (parabolisch interpoliert).
      let f0 = null;
      if (tonal) {
        const N = 32768;
        const re = new Float32Array(N), im = new Float32Array(N);
        const s0 = Math.round(rate * 0.04);
        for (let i = 0; i < N; i++) re[i] = (fertig[s0 + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
        for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
        for (let len = 2; len <= N; len <<= 1) { const w = -2 * Math.PI / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(w * k), sn = Math.sin(w * k); const a = i + k, b2 = a + len / 2; const vr = re[b2] * c - im[b2] * sn, vi = re[b2] * sn + im[b2] * c; re[b2] = re[a] - vr; im[b2] = im[a] - vi; re[a] += vr; im[a] += vi; } }
        const mag = new Float32Array(N / 2);
        for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
        const hz = rate / N;
        const betrag = (f) => { const k = Math.round(f / hz); return Math.max(mag[k - 1] || 0, mag[k] || 0, mag[k + 1] || 0); };
        // Gesucht wird eine Quarte um den Sollwert herum, nicht über den ganzen
        // Bereich: HPS greift bei verzerrten Tönen gern eine Oktave TIEFER
        // (bei einem Powerchord ist die Unteroktave des Grundtons tatsächlich
        // die gemeinsame Periode von Grundton und Quinte). Eine Oktave liegt
        // so außerhalb des Fensters; geprüft wird dann, ob der Ton innerhalb
        // von ±10 Cent sitzt. Ohne Sollwert (--messen) über den ganzen Bereich.
        const [von, bis] = soll ? [soll / 1.335, soll * 1.335] : [28, 700];
        let best = 0, bestF = 0;
        for (let f = von; f <= bis; f += hz / 2) {
          let p = 0;
          for (let h = 1; h <= 4; h++) p += Math.log(betrag(f * h) + 1e-9);
          if (p > best || !bestF) { best = p; bestF = f; }
        }
        const schaetz = [];
        for (let h = 1; h <= 6; h++) {
          let k = Math.round(bestF * h / hz), m = k;
          for (let d = -3; d <= 3; d++) if (mag[k + d] > mag[m]) m = k + d;
          const a = mag[m - 1], b2 = mag[m], c = mag[m + 1];
          const versatz = (a - c) / (2 * (a - 2 * b2 + c) || 1);
          if (b2 > 0) schaetz.push((m + versatz) * hz / h);
        }
        schaetz.sort((x, y) => x - y);
        f0 = schaetz[Math.floor(schaetz.length / 2)];
      }
      let bin = '';
      const bytes = new Uint8Array(i16.buffer);
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { b64: btoa(bin), f0 };
    }, [quelle, ABTASTRATE, probe.dauer, probe.hochpass, SPITZE, !!eintrag.grundton, eintrag.grundton || 0, probe.ab || 0]);
    if (MESSEN) {
      if (eintrag.grundton) console.log(`  ${probe.name}: ${f0?.toFixed(2)} Hz`);
      continue;
    }
    if (eintrag.grundton) {
      const cent = f0 ? 1200 * Math.log2(f0 / eintrag.grundton) : Infinity;
      if (!(Math.abs(cent) <= 10)) {
        throw new Error(`${probe.name}: gemessen ${f0?.toFixed(2)} Hz, SAMPLES sagt ${eintrag.grundton} Hz (${cent.toFixed(0)} Cent)`);
      }
      console.log(`  ${probe.name}: Grundton ${f0.toFixed(2)} Hz (${cent >= 0 ? '+' : ''}${cent.toFixed(1)} Cent gegen SAMPLES)`);
    }
    ergebnis.push({ ziel: ORDNER + eintrag.datei, daten: wavKopf(Buffer.from(b64, 'base64')) });
  }
  // Jede Probe in SAMPLES braucht einen Eintrag hier — sonst lädt die App eine
  // Datei, die niemand mehr erzeugt.
  const fehlend = Object.keys(SAMPLES).filter((n) => !PROBEN.some((p) => p.name === n));
  if (fehlend.length) throw new Error(`In SAMPLES, aber nicht in PROBEN: ${fehlend.join(', ')}`);
  await browser.close();
  return ergebnis;
}

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

// Ziel-Lautheit der Klangbeispiele (lautestes 50-ms-Fenster nach Pegel).
// Flächen (Raumton, Publikum) leiser als eine Stimme, Rückkopplungen leiser
// als alles andere — die sind schon bei gleichem Messwert unangenehm.
const BEISPIEL_LAUTHEIT = { raumton_club: 0.07, publikum_club: 0.16, moshpit: 0.16, pa_feedback: 0.12, gitarre_feedback: 0.14, einatmen: 0.08, amp_brummen: 0.08, publikum_chant: 0.16, proberaum_tuer: 0.12 };
const BEISPIEL_STANDARD = 0.22;

async function messeBeispiele() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const seite = await browser.newPage();
  await seite.goto(`${BASIS}/index.html`);
  const werte = await seite.evaluate(async () => {
    const { BEISPIELE } = await import('/js/audio/klangbeispiele.js');
    const aus = {};
    for (const [name, b] of Object.entries(BEISPIELE)) {
      const roh = await (await fetch('/assets/sounds/beispiele/' + b.datei)).arrayBuffer();
      const dek = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(roh);
      const d = dek.getChannelData(0).subarray(Math.round(b.ab * 44100), Math.round((b.ab + b.dauer) * 44100));
      let spitze = 0, laut = 0;
      for (const v of d) spitze = Math.max(spitze, Math.abs(v));
      for (let i = 0; i + 2205 <= d.length; i += 441) { let q = 0; for (let j = i; j < i + 2205; j++) q += d[j] * d[j]; laut = Math.max(laut, Math.sqrt(q / 2205)); }
      aus[name] = { spitze, laut, pegel: b.pegel, ende: dek.duration };
    }
    return aus;
  });
  await browser.close();
  let fehler = 0;
  for (const [name, w] of Object.entries(werte)) {
    const ziel = BEISPIEL_LAUTHEIT[name] ?? BEISPIEL_STANDARD;
    const soll = +Math.min(0.9 / w.spitze, ziel / w.laut).toFixed(2);
    const db = 20 * Math.log10(w.pegel / soll);
    console.log(`  ${name}: pegel ${soll}${Math.abs(db) > 1 ? `  (eingetragen ${w.pegel}, ${db.toFixed(1)} dB daneben)` : ''}`);
    if (PRUEFEN && Math.abs(db) > 1) fehler++;
  }
  if (fehler) { console.error(`${fehler} Klangbeispiel(e) mit falschem Pegel`); process.exit(1); }
  process.exit(0);
}
if (process.argv.includes('--beispiele')) await messeBeispiele();

const gebaut = await baue();
if (MESSEN) process.exit(0);
let drift = 0;
let summe = 0;
for (const { ziel, daten } of gebaut) {
  summe += daten.length;
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
  console.log(`${gleich ? 'unverändert' : 'geschrieben'} ${ziel} (${(daten.length / 1024).toFixed(0)} KB)`);
}
console.log(`Summe: ${(summe / 1024).toFixed(0)} KB in ${gebaut.length} Dateien`);
if (PRUEFEN) {
  if (drift) { console.error(`${drift} Datei(en) weichen ab — build_samples.mjs laufen lassen.`); process.exit(1); }
  console.log('OK — Samples stimmen mit den Quellen überein.');
}
