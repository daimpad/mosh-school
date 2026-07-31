// Werkzeug: Stimmgerät + Drop-Tunings + eigene (mikrotonale) Stimmungen +
// Referenzton. Erstes Mikro-Werkzeug.
//
// Bausteine, alle auf dem gemeinsamen Audio-Kern:
//  1. Live-Tuner über das Mikro (Autokorrelation in js/audio/tonhoehe.js): Note +
//     Cent-Abweichung, geglättete Nadel; nicht-farbliche Signale (Zahl + Text).
//  2. Preset-Tunings (Standard/Drop/7-Saiter/Bass) — jede Saite ein antippbarer
//     Zielton.
//  3. Eigene Stimmung: Saite für Saite halbtonweise verschieben ODER mikrotonal
//     in Cent feinstimmen, benennen und speichern (Werkzeug-Speicher, eigener
//     Namespace). Gespeicherte Stimmungen erscheinen als eigene Presets.
//  4. Referenzton-Drone: gehaltener Oszillator auf wählbarer Note — zum Stimmen
//     nach Gehör und als Grundton-Drone für Gesangsübungen.
//
// Einstellungen (außer den gespeicherten eigenen Stimmungen) sind flüchtiger
// Modul-State; #/werkzeug/stimmgeraet?tuning=<id> bzw. ?note=<note> belegt vor.
// Mikro wird erst beim „Mikro starten" angefragt; Ablehnung wird abgefangen.

import { label, t } from '../i18n.js';
import { domaeneIcon, esc, registriereAufraeumen } from '../oberflaeche.js';
import { frequenzVon, nachArt } from './stimmungen.js';
import { aktiviere, holeKontext, holeAusgang, istBereit } from '../audio/kontext.js';
import { referenzDrone } from '../audio/stimmen.js';
import { holeMikro } from '../audio/mikro.js';
import { erkennePitch, frequenzTrifft } from '../audio/tonhoehe.js';
import { holeWerkzeugDaten, setzeWerkzeugDaten } from '../werkzeug-speicher.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

// Die Preset-Tunings kommen aus data/tunings.json — derselbe Pool, den die
// Stimmungs-Referenz (#/stimmungen) zeigt. Vorher stand hier eine zweite, von
// Hand gepflegte Liste mit eigenen IDs und eigenen Labels (`wz_tuning_*`); sie
// war beim Ausbau der Referenz auf 35 Stimmungen stehengeblieben und wich in der
// Schreibweise ab (A#2 statt Bb2). Gesetzt wird der Pool beim Rendern, weil die
// Daten erst dann vorliegen.
let poolTunings = [];

// Notnagel, falls die Datei fehlt (Offline-Erststart mit kaltem Cache): ohne ihn
// stünde das Werkzeug ganz ohne Saiten da. Bewusst genau eine Stimmung.
const NOTFALL = { id: 'e_standard', instrument: 'gitarre', art: 'standard', saiten: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] };

const STANDARD_ID = 'e_standard';

// Alt-IDs der früheren Eigenliste → Pool-IDs. Gespeicherte Lesezeichen und ältere
// ?tuning=…-Links sollen weiter das gemeinte Tuning treffen statt still auf
// E-Standard zurückzufallen.
const ALT_IDS = {
  standard_e: 'e_standard',
  sieben_standard: 'b_standard_7',
  sieben_drop_a: 'drop_a_7',
  bass_standard: 'bass_e_standard',
  bass_fuenf: 'bass_b_5',
};

const zustand = {
  tuningId: STANDARD_ID,
  droneNote: 'E2',
  instrument: 'gitarre', // Filter der Preset-Zeile; eigene Stimmungen stehen immer darunter
};

// Editor-Entwurf (flüchtig): Liste { note, cents }. Erst beim ersten Rendern aus
// dem aktiven Tuning geladen.
let entwurf = null;

let mikro = null; // { analyser, liesZeitsignal, stop }
// Läuft gerade ein Startversuch? Zwischen Klick und erteilter Freigabe liegt der
// Berechtigungsdialog — ohne diese Sperre erzeugte ein zweiter Klick einen
// zweiten Mikro-Strom, den niemand mehr stoppen konnte.
let mikroStartLaeuft = false;
let rafId = null;
let drone = null; // aktives Referenzton-Handle
let geglaetteteCents = 0;

// --- Notenrechnung (Halbton-Transponierung, mikrotonale Frequenz) ---
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIDI_MIN = 12; // C0
const MIDI_MAX = 96; // C7

// Nimmt # UND b: der Pool schreibt die tiefen Stimmungen als Eb2/Ab2/Bb2, das
// Halbton-Verschieben des Editors lieferte für solche Noten vorher gar nichts
// zurück (Regex kannte nur #) — der Knopf tat still nichts.
function zuMidi(note) {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
  if (!m) return null;
  const versetzung = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (parseInt(m[3], 10) + 1) * 12 + SEMI[m[1]] + versetzung;
}
function vonMidi(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const okt = Math.floor(midi / 12) - 1;
  return NAMEN[pc] + okt;
}
function transponiere(note, halbtoene) {
  const m = zuMidi(note);
  if (m == null) return note;
  return vonMidi(Math.max(MIDI_MIN, Math.min(MIDI_MAX, m + halbtoene)));
}

// --- Werkzeug-Speicher: eigene Stimmungen ---
function ladeEigene() {
  const d = holeWerkzeugDaten('stimmgeraet', { eigene: [] });
  return Array.isArray(d?.eigene) ? d.eigene : [];
}
function speichereEigene(liste) {
  setzeWerkzeugDaten('stimmgeraet', { eigene: liste });
}

// Alle wählbaren Tunings: Pool-Stimmungen + gespeicherte eigene.
function alleTunings() {
  const pool = poolTunings.length ? poolTunings : [NOTFALL];
  return [...pool, ...ladeEigene().map((e) => ({ ...e, eigen: true }))];
}
function aktivesTuning() {
  const liste = alleTunings();
  return liste.find((u) => u.id === zustand.tuningId) || liste.find((u) => u.id === STANDARD_ID) || liste[0];
}
function tuningName(u) {
  return u.eigen ? u.name : label('stimmung', u.id);
}

// Saiten sind entweder Noten-Strings (Preset) oder { note, cents } (eigen).
function saiteNote(s) {
  return typeof s === 'string' ? s : s.note;
}
function saiteCents(s) {
  return typeof s === 'string' ? 0 : s.cents || 0;
}
function saiteFrequenz(s) {
  const basis = frequenzVon(saiteNote(s));
  if (!basis) return null;
  return basis * 2 ** (saiteCents(s) / 1200);
}
function notenText(note) {
  return note.replace('#', '♯').replace('b', '♭');
}
function centsText(c) {
  return `${c > 0 ? '+' : ''}${c} ¢`;
}
function saiteLabel(s) {
  const c = saiteCents(s);
  return notenText(saiteNote(s)) + (c ? ` ${centsText(c)}` : '');
}

// --- Live-Tuner ---
function starteTunerSchleife(el) {
  const anzeige = el.querySelector('.wz-tuner-note');
  const centsFeld = el.querySelector('.wz-tuner-cents');
  const nadel = el.querySelector('.wz-tuner-nadel');
  const richtung = el.querySelector('.wz-tuner-richtung');

  // Die drei Felder oben werden pro Animationsframe neu beschrieben (~60/s).
  // Als aria-live-Regionen war das fuer Screenreader eine Dauersalve, in der
  // nichts mehr zu verstehen war. Sie sind jetzt reine Sichtanzeige; angesagt
  // wird ueber die vorhandene role="status"-Zeile, und zwar nur, wenn sich der
  // Ton oder das Passt-Ergebnis tatsaechlich aendert — gedrosselt auf 1/s.
  let letzteAnsage = '';
  let ansageZeit = 0;
  const melde = (text) => {
    const jetzt = performance.now();
    if (text === letzteAnsage || jetzt - ansageZeit < 1000) return;
    letzteAnsage = text;
    ansageZeit = jetzt;
    const statusEl = el.querySelector('.wz-tuner-status');
    if (statusEl) statusEl.textContent = text;
  };

  // Die Autokorrelation kostet je Durchgang rund 4 Mio. Multiplikationen (Puffer
  // 4096, ~1160 Offsets). Pro Animationsframe waren das ~240 Mio./s — auf dem
  // Handy blockiert das spuerbar den Hauptthread. Ein Stimmgeraet braucht diese
  // Rate nicht: die Anzeige wird ohnehin geglaettet, und 30/s sind vom Auge
  // nicht von 60/s zu unterscheiden. Das halbiert die Last, ohne am Verfahren
  // oder am Fenster zu drehen (das grosse Fenster traegt die tiefen Tunings).
  const ANALYSE_ABSTAND_MS = 33;
  let letzteAnalyse = 0;

  const tick = () => {
    if (!mikro) return;
    const jetzt = performance.now();
    if (jetzt - letzteAnalyse < ANALYSE_ABSTAND_MS) {
      rafId = window.requestAnimationFrame(tick);
      return;
    }
    letzteAnalyse = jetzt;
    const buf = mikro.liesZeitsignal();
    const ctx = holeKontext();
    const freq = erkennePitch(buf, ctx.sampleRate);
    const treffer = freq ? frequenzTrifft(freq) : null;
    if (treffer) {
      geglaetteteCents += (treffer.cents - geglaetteteCents) * 0.25; // glätten
      const c = Math.round(geglaetteteCents);
      if (anzeige) anzeige.textContent = `${notenText(treffer.note)}${treffer.oktave}`;
      if (centsFeld) centsFeld.textContent = (c > 0 ? '+' : '') + c + ' ¢';
      if (nadel) nadel.style.left = `${Math.max(0, Math.min(100, 50 + geglaetteteCents))}%`;
      const wort = Math.abs(c) <= 5 ? t('wz_tuner_passt') : c < 0 ? t('wz_tuner_tief') : t('wz_tuner_hoch');
      if (richtung) {
        richtung.textContent = wort;
        richtung.classList.toggle('passt', Math.abs(c) <= 5);
      }
      melde(`${notenText(treffer.note)}${treffer.oktave} — ${wort}`);
    } else {
      if (anzeige) anzeige.textContent = '—';
      if (centsFeld) centsFeld.textContent = '';
      if (richtung) {
        richtung.textContent = t('wz_tuner_still');
        richtung.classList.remove('passt');
      }
      melde(t('wz_tuner_still'));
    }
    rafId = window.requestAnimationFrame(tick);
  };
  rafId = window.requestAnimationFrame(tick);
}

// Abbruchmarke gegen das Wettrennen mit dem Routenwechsel: holeMikro() wartet
// auf die Freigabe, waehrenddessen sind `mikro` und `rafId` noch null — der
// Aufraeumhaken lief also ins Leere und wurde danach verworfen. Anschliessend
// setzte starteMikro trotzdem `mikro` und startete die rAF-Analyseschleife:
// Mikro und Autokorrelation liefen fuer den Rest der Sitzung weiter, obwohl das
// Stimmgeraet laengst verlassen war.
let mikroAbbruch = false;

function stoppeTuner() {
  mikroAbbruch = true;
  if (rafId) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (mikro) {
    mikro.stop();
    mikro = null;
  }
}

async function starteMikro(el) {
  const status = el.querySelector('.wz-tuner-status');
  // Doppelklick-Sperre: Zwischen Klick und erteilter Freigabe vergehen leicht
  // ein paar Sekunden (Berechtigungsdialog). Ein zweiter Klick startete einen
  // ZWEITEN Strom; `mikro` zeigte danach nur noch auf den letzten, der erste
  // blieb offen — das Aufnahme-Symbol des Browsers erlosch nie.
  if (mikro || mikroStartLaeuft) return;
  mikroStartLaeuft = true;
  mikroAbbruch = false;
  try {
    await aktiviere();
    const strom = await holeMikro();
    if (mikroAbbruch) {
      strom.stop();
      return;
    }
    mikro = strom;
    if (status) status.textContent = t('wz_tuner_laeuft');
    const tor = el.querySelector('.wz-tuner-start-zeile');
    if (tor) tor.hidden = true;
    const anzeige = el.querySelector('.wz-tuner-anzeige');
    if (anzeige) anzeige.hidden = false;
    starteTunerSchleife(el);
  } catch (fehler) {
    if (status) {
      status.textContent =
        fehler && fehler.name === 'NotAllowedError' ? t('wz_tuner_verweigert') : t('wz_tuner_kein_mikro');
    }
  } finally {
    mikroStartLaeuft = false;
  }
}

// --- Referenzton-Drone ---
function toggleDrone(el, note) {
  const knopf = el.querySelector('.wz-drone-toggle');
  if (drone && zustand.droneNote === note) {
    drone.stop();
    drone = null;
    if (knopf) {
      knopf.classList.remove('chip-akzent');
      knopf.setAttribute('aria-pressed', 'false');
    }
    return;
  }
  zustand.droneNote = note;
  const freq = frequenzVon(note);
  if (!freq) return;
  if (drone) drone.setzeFrequenz(freq);
  else drone = referenzDrone(holeKontext(), holeAusgang(), freq);
  if (knopf) {
    knopf.classList.add('chip-akzent');
    knopf.setAttribute('aria-pressed', 'true');
    knopf.querySelector('.wz-drone-note').textContent = notenText(note);
  }
}

function stoppeDrone(el) {
  if (drone) {
    drone.stop();
    drone = null;
  }
  const knopf = el?.querySelector('.wz-drone-toggle');
  if (knopf) {
    knopf.classList.remove('chip-akzent');
    knopf.setAttribute('aria-pressed', 'false');
  }
}

// Kurzer Zupf-Referenzton (weich, 1,6 s) — wie im Stimmungs-Werkzeug.
// Nimmt eine Frequenz (Hz), damit auch mikrotonale Zieltöne klingen.
function zupfeFrequenz(freq) {
  if (!freq) return;
  const ctx = holeKontext();
  const ziel = holeAusgang();
  const jetzt = ctx.currentTime;
  const osc = ctx.createOscillator();
  const huelle = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  huelle.gain.setValueAtTime(0.0001, jetzt);
  huelle.gain.exponentialRampToValueAtTime(0.16, jetzt + 0.02);
  huelle.gain.exponentialRampToValueAtTime(0.0001, jetzt + 1.6);
  osc.connect(huelle).connect(ziel);
  osc.start(jetzt);
  osc.stop(jetzt + 1.7);
}

function saitenHtml(tuning) {
  // Tiefste Saite zuerst, gezeichnet von unten nach oben (wie beim Griffbrett).
  return [...tuning.saiten]
    .reverse()
    .map(
      (s, i) =>
        `<button type="button" class="chip chip-waehlbar wz-saite" data-saite="${tuning.saiten.length - 1 - i}" aria-label="${esc(t('wz_saite_aria', { note: saiteLabel(s) }))}">${esc(saiteLabel(s))}</button>`
    )
    .join(' ');
}

function tuningChip(u) {
  const aktiv = u.id === zustand.tuningId;
  return `<button type="button" class="chip chip-waehlbar wz-tuning ${aktiv ? 'chip-akzent' : ''}" data-tuning="${esc(u.id)}" aria-pressed="${aktiv}">${esc(tuningName(u))}</button>`;
}

// Preset-Zeile: nach Instrument gefiltert und nach Art (Standard/Drop/Offen)
// gruppiert. 35 Stimmungen in einer einzigen Zeile wären nicht mehr zu treffen.
// Eigene Stimmungen hängen als letzte Gruppe an — sie tragen keine Art.
function tuningKnoepfeHtml() {
  const alle = alleTunings();
  const gruppen = nachArt(alle.filter((u) => !u.eigen && u.instrument === zustand.instrument)).map((g) => ({
    titel: label('stimmungsart', g.art),
    eintraege: g.eintraege,
  }));
  const eigene = alle.filter((u) => u.eigen);
  if (eigene.length) gruppen.push({ titel: t('wz_tuning_eigene'), eintraege: eigene });
  return gruppen
    .map(
      (g) => `
      <p class="stimm-art-titel leise">${esc(g.titel)}</p>
      <p class="chip-zeile">${g.eintraege.map(tuningChip).join(' ')}</p>`,
    )
    .join('');
}

function instrumentKnoepfeHtml() {
  return ['gitarre', 'bass']
    .map((inst) => {
      const aktiv = zustand.instrument === inst;
      return `<button type="button" class="chip chip-waehlbar wz-tuning-instrument ${aktiv ? 'chip-akzent' : ''}" data-tuning-instrument="${inst}" aria-pressed="${aktiv}">${domaeneIcon(inst)} ${esc(label('domaene', inst))}</button>`;
    })
    .join(' ');
}

// --- Eigene-Stimmung-Editor ---
function entwurfAusTuning(tuning) {
  return tuning.saiten.map((s) => ({ note: saiteNote(s), cents: saiteCents(s) }));
}

function editorRowsHtml() {
  // Tiefste Saite unten (wie das Griffbrett) — Anzeige von hoch nach tief.
  return entwurf
    .map((s, i) => `
      <div class="wz-eigen-saite" data-index="${i}">
        <button type="button" class="chip chip-waehlbar wz-eigen-zupf" data-index="${i}" aria-label="${esc(t('wz_eigen_zupf', { note: saiteLabel(s) }))}">
          <i class="fa-solid fa-volume-high" aria-hidden="true"></i> <span class="wz-eigen-label">${esc(saiteLabel(s))}</span>
        </button>
        <span class="wz-eigen-halbton">
          <button type="button" class="chip wz-eigen-runter" data-index="${i}" aria-label="${esc(t('wz_eigen_runter'))}"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
          <button type="button" class="chip wz-eigen-hoch" data-index="${i}" aria-label="${esc(t('wz_eigen_hoch'))}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
        </span>
        <label class="wz-eigen-cents-feld">${esc(t('wz_eigen_cents'))}
          <input type="range" class="wz-eigen-cents" data-index="${i}" min="-50" max="50" step="1" value="${s.cents}" aria-label="${esc(t('wz_eigen_cents_aria', { note: notenText(s.note) }))}">
          <span class="wz-eigen-cents-wert">${esc(centsText(s.cents))}</span>
        </label>
      </div>`)
    .reverse()
    .join('');
}

function eigenListeHtml() {
  const eigene = ladeEigene();
  if (eigene.length === 0) return `<p class="leise wz-eigen-keine">${esc(t('wz_eigen_keine'))}</p>`;
  return eigene
    .map(
      (e) => `
      <span class="wz-eigen-eintrag">
        <button type="button" class="chip chip-waehlbar wz-eigen-laden" data-id="${esc(e.id)}">
          <i class="fa-solid fa-sliders" aria-hidden="true"></i> ${esc(e.name)}
        </button>
        <button type="button" class="chip wz-eigen-loeschen" data-id="${esc(e.id)}" aria-label="${esc(t('wz_eigen_loeschen', { name: e.name }))}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
      </span>`
    )
    .join(' ');
}

// --- Preset aus der URL ---
function wendePresetAn(query) {
  if (!query) return;
  const roh = query.get('tuning');
  const tuning = ALT_IDS[roh] || roh;
  if (tuning && alleTunings().some((u) => u.id === tuning)) zustand.tuningId = tuning;
  const note = query.get('note');
  if (note && frequenzVon(note)) zustand.droneNote = note;
  else zustand.droneNote = saiteNote(aktivesTuning().saiten[0]);
}

// Instrument-Filter dem aktiven Tuning nachziehen — sonst zeigt die Zeile nach
// einem ?tuning=bass_drop_d-Deeplink Gitarren-Chips, und der aktive ist nicht dabei.
function synchronisiereInstrument() {
  const inst = aktivesTuning()?.instrument;
  if (inst === 'gitarre' || inst === 'bass') zustand.instrument = inst;
}

export function renderWerkzeugStimmgeraet(el, daten, query) {
  poolTunings = daten?.tunings?.stimmungen || [];
  wendePresetAn(query);
  synchronisiereInstrument();
  stoppeTuner();
  stoppeDrone(null);
  const tuning = aktivesTuning();
  if (!entwurf) entwurf = entwurfAusTuning(tuning);

  const audioBereit = istBereit();

  el.innerHTML = `
    <article class="wz-werkzeug">
      ${landingHeroHtml('fa-wave-square', t('wz_stimmgeraet_titel'), t('wz_stimmgeraet_untertitel'), 'pf-teal', 'werkzeug:stimmgeraet', t('kicker_werkzeug'))}
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>

      <div class="wz-audio-tor" ${audioBereit ? 'hidden' : ''}>
        <p class="leise">${esc(t('wz_audio_hinweis'))}</p>
        <button type="button" class="knopf knopf-primaer wz-audio-aktivieren">
          <i class="fa-solid fa-volume-high" aria-hidden="true"></i> ${esc(t('wz_audio_aktivieren'))}
        </button>
      </div>

      <div class="wz-stimm-koerper" ${audioBereit ? '' : 'hidden'}>
        <section class="wz-tuner">
          <h2>${esc(t('wz_tuner_titel'))}</h2>
          <p class="wz-tuner-start-zeile">
            <button type="button" class="knopf knopf-primaer wz-tuner-start">
              <i class="fa-solid fa-microphone" aria-hidden="true"></i> ${esc(t('wz_tuner_mikro_start'))}
            </button>
          </p>
          <p class="wz-tuner-status leise" role="status" aria-live="polite"></p>
          <div class="wz-tuner-anzeige" hidden>
            <div class="wz-tuner-note">—</div>
            <div class="wz-tuner-skala" role="img" aria-label="${esc(t('wz_tuner_skala_aria'))}">
              <span class="wz-tuner-mitte" aria-hidden="true"></span>
              <span class="wz-tuner-nadel" style="left:50%" aria-hidden="true"></span>
            </div>
            <div class="wz-tuner-cents"></div>
            <div class="wz-tuner-richtung"></div>
          </div>
        </section>

        <section class="wz-tunings">
          <h2>${esc(t('wz_tunings_titel'))}</h2>
          <p class="chip-zeile wz-tuning-instrumente">${instrumentKnoepfeHtml()}</p>
          <div class="wz-tuning-zeile">${tuningKnoepfeHtml()}</div>
          <p class="leise">${esc(t('wz_tunings_hinweis'))}</p>
          <p><a class="chip" href="#/stimmungen"><i class="fa-solid fa-sliders" aria-hidden="true"></i> ${esc(t('nav_stimmungen'))}</a></p>
          <p class="chip-zeile wz-saiten-zeile">${saitenHtml(tuning)}</p>
        </section>

        <section class="wz-eigen">
          <h2>${esc(t('wz_eigen_titel'))}</h2>
          <p class="leise">${esc(t('wz_eigen_hinweis'))}</p>
          <div class="wz-eigen-saiten">${editorRowsHtml()}</div>
          <p class="chip-zeile wz-eigen-struktur">
            <button type="button" class="chip chip-waehlbar wz-eigen-uebernehmen"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i> ${esc(t('wz_eigen_uebernehmen'))}</button>
            <button type="button" class="chip chip-waehlbar wz-eigen-saite-weg"><i class="fa-solid fa-minus" aria-hidden="true"></i> ${esc(t('wz_eigen_saite_weg'))}</button>
            <button type="button" class="chip chip-waehlbar wz-eigen-saite-hinzu"><i class="fa-solid fa-plus" aria-hidden="true"></i> ${esc(t('wz_eigen_saite_hinzu'))}</button>
          </p>
          <p class="wz-eigen-speicherzeile">
            <label class="wz-eigen-name-feld">${esc(t('wz_eigen_name'))}
              <input type="text" class="wz-eigen-name" maxlength="40" placeholder="${esc(t('wz_eigen_name_platzhalter'))}">
            </label>
            <button type="button" class="knopf knopf-primaer wz-eigen-speichern">
              <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> ${esc(t('wz_eigen_speichern'))}
            </button>
          </p>
          <p class="wz-eigen-status leise" role="status" aria-live="polite"></p>
          <h3 class="wz-eigen-liste-titel">${esc(t('wz_eigen_gespeichert'))}</h3>
          <p class="chip-zeile wz-eigen-liste">${eigenListeHtml()}</p>
        </section>

        <section class="wz-drone">
          <h2>${esc(t('wz_drone_titel'))}</h2>
          <p class="leise">${esc(t('wz_drone_hinweis'))}</p>
          <p class="chip-zeile">
            <button type="button" class="chip chip-waehlbar wz-drone-toggle" aria-pressed="false">
              <i class="fa-solid fa-wave-square" aria-hidden="true"></i> ${esc(t('wz_drone_toggle'))} <span class="wz-drone-note">${esc(notenText(zustand.droneNote))}</span>
            </button>
          </p>
          <p class="leise wz-metro-fuss">${esc(t('wz_drone_gesundheit'))}</p>
        </section>
      </div>
    </article>`;

  verdrahte(el);
  // Beim Verlassen der Route Mikrofon + Referenzton stoppen (Mikro bliebe sonst offen).
  registriereAufraeumen(() => {
    stoppeTuner();
    stoppeDrone(null);
  });
}

// Aktualisiert Tuning-Chips + Saiten-Zeile in-place (ohne Mikro-Neustart).
function aktualisiereTuningAnzeige(el) {
  const instrumente = el.querySelector('.wz-tuning-instrumente');
  if (instrumente) {
    instrumente.innerHTML = instrumentKnoepfeHtml();
    verdrahteInstrumentChips(el);
  }
  const zeile = el.querySelector('.wz-tuning-zeile');
  if (zeile) {
    zeile.innerHTML = tuningKnoepfeHtml();
    verdrahteTuningChips(el);
  }
  const saiten = el.querySelector('.wz-saiten-zeile');
  if (saiten) {
    saiten.innerHTML = saitenHtml(aktivesTuning());
    verdrahteSaiten(el);
  }
}

// Grenzen des Entwurfs (3..8 Saiten) sichtbar machen. Vorher stiegen die beiden
// Knoepfe an der Grenze nur still aus (`if (… >= 8) return;`) — ein Klick, der
// nichts tut und nichts sagt, ist von einem kaputten Knopf nicht zu unterscheiden.
const EIGEN_MIN_SAITEN = 3;
const EIGEN_MAX_SAITEN = 8;

function aktualisiereEditorGrenzen(el) {
  const hinzu = el.querySelector('.wz-eigen-saite-hinzu');
  const weg = el.querySelector('.wz-eigen-saite-weg');
  if (hinzu) hinzu.disabled = entwurf.length >= EIGEN_MAX_SAITEN;
  if (weg) weg.disabled = entwurf.length <= EIGEN_MIN_SAITEN;
}

function zeichneEditor(el) {
  const feld = el.querySelector('.wz-eigen-saiten');
  if (feld) {
    feld.innerHTML = editorRowsHtml();
    verdrahteEditor(el);
  }
  aktualisiereEditorGrenzen(el);
}

function zeichneEigenListe(el) {
  const liste = el.querySelector('.wz-eigen-liste');
  if (liste) {
    liste.innerHTML = eigenListeHtml();
    verdrahteEigenListe(el);
  }
}

function verdrahteSaiten(el) {
  const tuning = aktivesTuning();
  for (const saite of el.querySelectorAll('.wz-saite')) {
    saite.addEventListener('click', () => {
      const idx = Number(saite.dataset.saite);
      zupfeFrequenz(saiteFrequenz(tuning.saiten[idx]));
    });
  }
}

// Instrument-Filter: wechselt nur die angezeigte Auswahl, nicht das aktive
// Tuning — sonst spränge der Zielton beim bloßen Blättern weg.
function verdrahteInstrumentChips(el) {
  for (const knopf of el.querySelectorAll('.wz-tuning-instrument')) {
    knopf.addEventListener('click', () => {
      zustand.instrument = knopf.dataset.tuningInstrument;
      aktualisiereTuningAnzeige(el);
      el.querySelector(`.wz-tuning-instrument[data-tuning-instrument="${CSS.escape(zustand.instrument)}"]`)?.focus();
    });
  }
}

function verdrahteTuningChips(el) {
  for (const knopf of el.querySelectorAll('.wz-tuning')) {
    knopf.addEventListener('click', () => {
      zustand.tuningId = knopf.dataset.tuning;
      zustand.droneNote = saiteNote(aktivesTuning().saiten[0]);
      aktualisiereTuningAnzeige(el);
      const droneNoteEl = el.querySelector('.wz-drone-note');
      if (droneNoteEl) droneNoteEl.textContent = notenText(zustand.droneNote);
      if (drone) drone.setzeFrequenz(frequenzVon(zustand.droneNote));
      el.querySelector(`.wz-tuning[data-tuning="${CSS.escape(zustand.tuningId)}"]`)?.focus();
    });
  }
}

function verdrahteEditor(el) {
  const setzeLabel = (i) => {
    const row = el.querySelector(`.wz-eigen-saite[data-index="${i}"]`);
    if (!row) return;
    const s = entwurf[i];
    row.querySelector('.wz-eigen-label').textContent = saiteLabel(s);
    row.querySelector('.wz-eigen-cents-wert').textContent = centsText(s.cents);
  };
  for (const knopf of el.querySelectorAll('.wz-eigen-zupf')) {
    knopf.addEventListener('click', () => zupfeFrequenz(saiteFrequenz(entwurf[Number(knopf.dataset.index)])));
  }
  for (const knopf of el.querySelectorAll('.wz-eigen-runter')) {
    knopf.addEventListener('click', () => {
      const i = Number(knopf.dataset.index);
      entwurf[i].note = transponiere(entwurf[i].note, -1);
      setzeLabel(i);
      zupfeFrequenz(saiteFrequenz(entwurf[i]));
    });
  }
  for (const knopf of el.querySelectorAll('.wz-eigen-hoch')) {
    knopf.addEventListener('click', () => {
      const i = Number(knopf.dataset.index);
      entwurf[i].note = transponiere(entwurf[i].note, 1);
      setzeLabel(i);
      zupfeFrequenz(saiteFrequenz(entwurf[i]));
    });
  }
  for (const regler of el.querySelectorAll('.wz-eigen-cents')) {
    regler.addEventListener('input', () => {
      const i = Number(regler.dataset.index);
      entwurf[i].cents = Number(regler.value);
      setzeLabel(i);
    });
    regler.addEventListener('change', () => zupfeFrequenz(saiteFrequenz(entwurf[Number(regler.dataset.index)])));
  }
}

function verdrahteEigenListe(el) {
  const status = el.querySelector('.wz-eigen-status');
  for (const knopf of el.querySelectorAll('.wz-eigen-laden')) {
    knopf.addEventListener('click', () => {
      const tuning = alleTunings().find((u) => u.id === knopf.dataset.id);
      if (!tuning) return;
      zustand.tuningId = tuning.id;
      zustand.droneNote = saiteNote(tuning.saiten[0]);
      entwurf = entwurfAusTuning(tuning);
      aktualisiereTuningAnzeige(el);
      zeichneEditor(el);
      const droneNoteEl = el.querySelector('.wz-drone-note');
      if (droneNoteEl) droneNoteEl.textContent = notenText(zustand.droneNote);
      if (status) status.textContent = t('wz_eigen_geladen', { name: tuning.name });
    });
  }
  for (const knopf of el.querySelectorAll('.wz-eigen-loeschen')) {
    knopf.addEventListener('click', () => {
      const id = knopf.dataset.id;
      speichereEigene(ladeEigene().filter((e) => e.id !== id));
      if (zustand.tuningId === id) {
        zustand.tuningId = STANDARD_ID;
        zustand.droneNote = saiteNote(aktivesTuning().saiten[0]);
      }
      aktualisiereTuningAnzeige(el);
      zeichneEigenListe(el);
      const droneNoteEl = el.querySelector('.wz-drone-note');
      if (droneNoteEl) droneNoteEl.textContent = notenText(zustand.droneNote);
    });
  }
}

function verdrahte(el) {
  const koerper = el.querySelector('.wz-stimm-koerper');
  const tor = el.querySelector('.wz-audio-tor');
  el.querySelector('.wz-audio-aktivieren')?.addEventListener('click', async () => {
    await aktiviere();
    if (istBereit()) {
      if (tor) tor.hidden = true;
      if (koerper) koerper.hidden = false;
    }
  });

  el.querySelector('.wz-tuner-start')?.addEventListener('click', () => starteMikro(el));

  verdrahteSaiten(el);
  verdrahteInstrumentChips(el);
  verdrahteTuningChips(el);
  verdrahteEditor(el);
  verdrahteEigenListe(el);
  aktualisiereEditorGrenzen(el);

  // Editor-Struktur: Saite anhängen/entfernen, aus aktueller Stimmung übernehmen.
  el.querySelector('.wz-eigen-saite-hinzu')?.addEventListener('click', () => {
    if (entwurf.length >= EIGEN_MAX_SAITEN) return;
    const tiefste = entwurf[0] || { note: 'E2', cents: 0 };
    entwurf.unshift({ note: transponiere(tiefste.note, -5), cents: 0 });
    zeichneEditor(el);
  });
  el.querySelector('.wz-eigen-saite-weg')?.addEventListener('click', () => {
    if (entwurf.length <= EIGEN_MIN_SAITEN) return;
    entwurf.shift();
    zeichneEditor(el);
  });
  el.querySelector('.wz-eigen-uebernehmen')?.addEventListener('click', () => {
    entwurf = entwurfAusTuning(aktivesTuning());
    zeichneEditor(el);
  });

  // Speichern der eigenen Stimmung.
  el.querySelector('.wz-eigen-speichern')?.addEventListener('click', () => {
    const nameFeld = el.querySelector('.wz-eigen-name');
    const status = el.querySelector('.wz-eigen-status');
    const name = (nameFeld?.value || '').trim();
    if (!name) {
      if (status) status.textContent = t('wz_eigen_name_fehlt');
      nameFeld?.focus();
      return;
    }
    const id = 'eigen_' + Date.now();
    const eintrag = {
      id,
      name,
      instrument: entwurf.length <= 4 ? 'bass' : 'gitarre',
      saiten: entwurf.map((s) => ({ note: s.note, cents: s.cents })),
    };
    speichereEigene([...ladeEigene(), eintrag]);
    zustand.tuningId = id;
    zustand.droneNote = saiteNote(eintrag.saiten[0]);
    aktualisiereTuningAnzeige(el);
    zeichneEigenListe(el);
    if (nameFeld) nameFeld.value = '';
    const droneNoteEl = el.querySelector('.wz-drone-note');
    if (droneNoteEl) droneNoteEl.textContent = notenText(zustand.droneNote);
    if (status) status.textContent = t('wz_eigen_gespeichert_ok', { name });
  });

  el.querySelector('.wz-drone-toggle')?.addEventListener('click', () => toggleDrone(el, zustand.droneNote));
}
