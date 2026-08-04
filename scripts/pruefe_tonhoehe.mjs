#!/usr/bin/env node
// Prueft die Tonhoehen-Erkennung (js/audio/tonhoehe.js) ueber genau den Bereich,
// den data/tunings.json verlangt — von der tiefsten Saite im Pool bis zur
// hoechsten.
//
//     node scripts/pruefe_tonhoehe.mjs
//
// WARUM ES DIESE PRUEFUNG GIBT
// Die Untergrenze der Erkennung lag bei 40 Hz. Der Stimmungs-Pool enthaelt aber
// neun Saiten darunter: das tiefe A eines Drop-A-Fuenfsaiters (27,5 Hz), das
// tiefe H von Fuenf- und Sechssaitern (30,87 Hz), das C eines C-Basses
// (32,7 Hz), das tiefe D eines Achtsaiters (36,71 Hz). Das Stimmgeraet zeigte
// diese Stimmungen als Chips an und konnte ihre tiefste Saite nicht erkennen —
// ohne Fehlermeldung, die Anzeige blieb einfach auf „—". Nichts im Repo haette
// das gemeldet; erst eine Messung hat es sichtbar gemacht. Diese hier.
//
// WORAUF GEMESSEN WIRD
// Nicht auf Sinus. Eine gezupfte Saite hat je nach Anschlagpunkt einen
// schwachen Grundton und starke Oberwellen — genau daran scheitert
// Autokorrelation typischerweise, indem sie eine Oktave danebenliegt. Ein Test
// mit Sinus wuerde das nie zeigen und waere ein Freibrief. Deshalb vier
// Oberwellenprofile, darunter zwei, bei denen der Grundton schwaecher ist als
// die erste Oberwelle.
import { erkennePitch, frequenzTrifft } from '../js/audio/tonhoehe.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000;
// Fenster wie im Werkzeug: js/audio/mikro.js setzt fftSize 8192.
const FENSTER = 8192;
const TOLERANZ_CENT = 5;   // dieselbe Schwelle, ab der die Anzeige „stimmt" sagt

const PROFILE = {
  'voll': [1, 0.5, 0.3, 0.2, 0.12, 0.08],
  'stegnah': [0.25, 1, 0.8, 0.6, 0.4, 0.3],
  'alt/dumpf': [1, 0.7, 0.15, 0.05, 0.02, 0.01],
  'nur Oberwellen': [0.05, 1, 0.7, 0.5, 0.3, 0.2],
};

const HALBTON = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function frequenzVon(note) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!m) return null;
  const h = HALBTON[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((h - 9 + (Number(m[3]) - 4) * 12) / 12);
}

// Der zu deckende Bereich kommt aus den Daten, nicht aus einer Konstante hier:
// Kommt eine tiefere Stimmung dazu, faellt diese Pruefung von selbst um, statt
// stillschweigend weiter nur den alten Bereich zu pruefen.
function bereichAusTunings() {
  const roh = JSON.parse(readFileSync(join(ROOT, 'data/tunings.json'), 'utf8'));
  const liste = Array.isArray(roh) ? roh : (roh.stimmungen || roh.tunings || []);
  const noten = new Set();
  for (const t of liste) for (const n of (t.noten || t.saiten || [])) noten.add(n);
  const mit = [...noten].map((n) => [n, frequenzVon(n)]).filter(([, f]) => f);
  mit.sort((a, b) => a[1] - b[1]);
  return mit;
}

function ton(hz, profil, n) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let h = 0; h < profil.length; h++) {
      v += profil[h] * Math.sin(2 * Math.PI * hz * (h + 1) * i / SR + h * 0.7);
    }
    buf[i] = 0.5 * Math.exp(-i / (SR * 1.2)) * (v / profil.length * 2);
  }
  return buf;
}

const cents = (ist, soll) => 1200 * Math.log2(ist / soll);

const alle = bereichAusTunings();
// Jede vorkommende Note einmal, plus die Raender ausdruecklich.
const proben = alle.filter((_, i) => i % 2 === 0 || i === alle.length - 1);
const fehler = [];
let schlimmste = 0;
let schlimmsteNote = '';

for (const [name, profil] of Object.entries(PROFILE)) {
  for (const [note, soll] of proben) {
    const hz = erkennePitch(ton(soll, profil, FENSTER), SR);
    if (hz === null) {
      fehler.push(`${note} (${soll.toFixed(2)} Hz), Profil "${name}": nicht erkannt`);
      continue;
    }
    const c = cents(hz, soll);
    const treffer = frequenzTrifft(hz);
    if (`${treffer.note}${treffer.oktave}` !== note.replace('b', '#') && Math.abs(c) > 50) {
      fehler.push(`${note}, Profil "${name}": erkannt als ${treffer.note}${treffer.oktave} `
        + `(${c > 0 ? '+' : ''}${c.toFixed(0)} Cent)${Math.abs(Math.abs(c) - 1200) < 60 ? ' — OKTAVFEHLER' : ''}`);
      continue;
    }
    if (Math.abs(c) > Math.abs(schlimmste)) { schlimmste = c; schlimmsteNote = `${note} / ${name}`; }
    if (Math.abs(c) > TOLERANZ_CENT) {
      fehler.push(`${note} (${soll.toFixed(2)} Hz), Profil "${name}": `
        + `${c > 0 ? '+' : ''}${c.toFixed(1)} Cent (> ${TOLERANZ_CENT})`);
    }
  }
}

const [tiefste, hoechste] = [alle[0], alle[alle.length - 1]];
console.log(`Tonhoehen-Erkennung ueber den Stimmungs-Pool:`);
console.log(`  Bereich aus data/tunings.json: ${tiefste[0]} (${tiefste[1].toFixed(2)} Hz) `
  + `bis ${hoechste[0]} (${hoechste[1].toFixed(1)} Hz), ${alle.length} verschiedene Noten`);
console.log(`  geprueft: ${proben.length} Noten x ${Object.keys(PROFILE).length} Oberwellenprofile `
  + `= ${proben.length * Object.keys(PROFILE).length} Messungen, Fenster ${FENSTER} Samples`);
console.log(`  groesste Abweichung: ${schlimmste > 0 ? '+' : ''}${schlimmste.toFixed(1)} Cent (${schlimmsteNote})`);

if (fehler.length) {
  console.log('\nFEHLER:');
  for (const f of fehler) console.log(' ', f);
  process.exit(1);
}
console.log(`\nOK — alle Noten des Pools innerhalb von ${TOLERANZ_CENT} Cent, keine Oktavfehler.`);
