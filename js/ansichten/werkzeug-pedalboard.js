// Werkzeug: Pedalboard-Baukasten. Self-contained, KEIN Audio. Anfänger klicken
// Pedal-Typen aus dem Katalog zusammen, ordnen die Signalkette (per Drag ODER
// per Tastatur-Knöpfen) und lassen sich jedes Pedal erklären. Ein sanfter
// Reihenfolge-Check zeigt die übliche Position — als Lernhilfe, nicht als Verbot.
//
// Daten: data/pedale.json (generische Typen, keine Marken). Persistenz: die
// gebaute Kette je Instrument in localStorage (js/werkzeug-speicher.js), getrennt
// vom versionierten Zustand-Schema. Preset: #/werkzeug/pedalboard?instrument=bass
// &kette=tuner-distortion-noise_gate.

import { t, text } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { holeWerkzeugDaten, setzeWerkzeugDaten } from '../werkzeug-speicher.js';
import { pedalGrafik } from '../geraete-grafik.js';

const MINIMAL = { gitarre: ['tuner', 'distortion', 'noise_gate'], bass: ['tuner', 'kompressor', 'bass_overdrive'] };

const zustand = {
  instrument: 'gitarre',
  kette: { gitarre: [], bass: [] },
  ausgewaehlt: null,
  geladen: false,
};

function katalogFuer(daten, instrument) {
  return (daten.pedale?.pedale || []).filter((p) => p.instrument === instrument || p.instrument === 'beide');
}
function pedal(daten, id) {
  return (daten.pedale?.pedale || []).find((p) => p.id === id) || null;
}
function aktuelleKette() {
  return zustand.kette[zustand.instrument] || [];
}
function speichere() {
  setzeWerkzeugDaten('pedalboard', zustand.kette);
}

// Sanfter Reihenfolge-Check: benachbarte Paare, deren kanonische Position
// invertiert ist (das frühere Pedal „gehört" eigentlich später).
function reihenfolgeHinweise(daten) {
  const kette = aktuelleKette();
  const pos = (id) => pedal(daten, id)?.position ?? 99;
  const hinweise = [];
  for (let i = 0; i < kette.length - 1; i++) {
    if (pos(kette[i]) > pos(kette[i + 1])) {
      hinweise.push({ frueh: kette[i + 1], spaet: kette[i] });
    }
  }
  return hinweise;
}

// --- Kette verändern ---
function fuegeHinzu(id) {
  zustand.kette[zustand.instrument] = [...aktuelleKette(), id];
  zustand.ausgewaehlt = id;
  speichere();
}
function entferne(index) {
  const k = [...aktuelleKette()];
  k.splice(index, 1);
  zustand.kette[zustand.instrument] = k;
  speichere();
}
function verschiebe(index, richtung) {
  const k = [...aktuelleKette()];
  const ziel = index + richtung;
  if (ziel < 0 || ziel >= k.length) return;
  [k[index], k[ziel]] = [k[ziel], k[index]];
  zustand.kette[zustand.instrument] = k;
  speichere();
}

// --- Preset aus der URL ---
function wendePresetAn(query, daten) {
  if (!query) return;
  const inst = query.get('instrument');
  if (inst === 'gitarre' || inst === 'bass') zustand.instrument = inst;
  const kette = query.get('kette');
  if (kette) {
    const ids = kette.split('-').filter((id) => pedal(daten, id));
    if (ids.length) zustand.kette[zustand.instrument] = ids;
  }
}

export function renderWerkzeugPedalboard(el, daten, query) {
  // Persistierte Ketten einmalig laden (nicht bei jedem Re-Render überschreiben).
  if (!zustand.geladen) {
    const gespeichert = holeWerkzeugDaten('pedalboard', null);
    if (gespeichert && typeof gespeichert === 'object') {
      zustand.kette.gitarre = Array.isArray(gespeichert.gitarre) ? gespeichert.gitarre : [];
      zustand.kette.bass = Array.isArray(gespeichert.bass) ? gespeichert.bass : [];
    }
    zustand.geladen = true;
  }
  // Preset gilt bei jedem Routen-Eintritt mit Parametern; interne Re-Renders
  // rufen mit query=null (dann no-op) — so überschreibt ein Klick nichts.
  wendePresetAn(query, daten);

  const katalog = katalogFuer(daten, zustand.instrument);
  const kette = aktuelleKette();
  const hinweise = reihenfolgeHinweise(daten);

  const instrumentKnoepfe = ['gitarre', 'bass']
    .map(
      (inst) => `<button type="button" class="chip chip-waehlbar wz-pb-instrument ${inst === zustand.instrument ? 'chip-akzent' : ''}" data-instrument="${inst}" aria-pressed="${inst === zustand.instrument}">${esc(t('wz_pb_inst_' + inst))}</button>`
    )
    .join(' ');

  const katalogHtml = katalog
    .map(
      (p) => `<button type="button" class="chip chip-waehlbar wz-pb-katalog" data-pedal="${esc(p.id)}">
        <span class="wz-pb-glyph">${pedalGrafik(p)}</span> ${esc(text(p.name))}
      </button>`
    )
    .join(' ');

  const ketteHtml = kette.length
    ? kette
        .map((id, i) => {
          const p = pedal(daten, id);
          const name = p ? text(p.name) : id;
          const gewaehlt = id === zustand.ausgewaehlt;
          return `<li class="wz-pb-glied${gewaehlt ? ' gewaehlt' : ''}" draggable="true" data-index="${i}" data-pedal="${esc(id)}">
            <button type="button" class="wz-pb-glied-name" data-waehle="${i}" aria-pressed="${gewaehlt}">
              <span class="wz-pb-glyph">${pedalGrafik(p)}</span> <span>${esc(name)}</span>
            </button>
            <span class="wz-pb-glied-knoepfe">
              <button type="button" class="wz-pb-mini" data-hoch="${i}" aria-label="${esc(t('wz_pb_hoch', { name }))}" ${i === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
              <button type="button" class="wz-pb-mini" data-runter="${i}" aria-label="${esc(t('wz_pb_runter', { name }))}" ${i === kette.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
              <button type="button" class="wz-pb-mini" data-entferne="${i}" aria-label="${esc(t('wz_pb_entferne', { name }))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </span>
          </li>`;
        })
        .join('')
    : `<li class="wz-pb-leer leise">${esc(t('wz_pb_leer'))}</li>`;

  const gewaehltesPedal = zustand.ausgewaehlt ? pedal(daten, zustand.ausgewaehlt) : null;
  const erklaerHtml = gewaehltesPedal
    ? `<div class="wz-pb-erklaerung karte">
         <h3><span class="wz-pb-glyph-gross">${pedalGrafik(gewaehltesPedal)}</span> ${esc(text(gewaehltesPedal.name))}</h3>
         <p>${esc(text(gewaehltesPedal.erklaerung))}</p>
         <p class="leise"><strong>${esc(t('wz_pb_tipp'))}:</strong> ${esc(text(gewaehltesPedal.tipp))}</p>
       </div>`
    : `<p class="leise wz-pb-erklaerung-leer">${esc(t('wz_pb_waehle_hinweis'))}</p>`;

  const hinweisHtml = kette.length
    ? hinweise.length
      ? `<div class="wz-pb-check">
           <p class="wz-pb-check-titel">${esc(t('wz_pb_check_titel'))}</p>
           <ul>${hinweise
             .map((h) => `<li>${esc(t('wz_pb_check_zeile', { frueh: text(pedal(daten, h.frueh).name), spaet: text(pedal(daten, h.spaet).name) }))}</li>`)
             .join('')}</ul>
         </div>`
      : `<p class="wz-pb-check-ok leise"><i class="fa-solid fa-check" aria-hidden="true"></i> ${esc(t('wz_pb_check_ok'))}</p>`
    : '';

  const teilen = kette.join('-');

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-layer-group" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_pedalboard_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_pedalboard_untertitel'))}</p>
        </div>
      </section>

      <p class="chip-zeile">${instrumentKnoepfe}</p>
      <p class="chip-zeile">
        <button type="button" class="chip chip-waehlbar wz-pb-minimal"><i class="fa-solid fa-bolt" aria-hidden="true"></i> ${esc(t('wz_pb_minimal'))}</button>
        <button type="button" class="chip chip-waehlbar wz-pb-leeren"><i class="fa-solid fa-xmark" aria-hidden="true"></i> ${esc(t('wz_pb_leeren'))}</button>
      </p>

      <h2 class="wz-pb-h">${esc(t('wz_pb_katalog'))}</h2>
      <p class="chip-zeile wz-pb-katalog-zeile">${katalogHtml}</p>

      <h2 class="wz-pb-h">${esc(t('wz_pb_kette'))}</h2>
      <div class="wz-pb-kette-rahmen">
        <span class="wz-pb-anschluss">${esc(t('wz_pb_instrument_ende'))}</span>
        <ol class="wz-pb-kette" aria-label="${esc(t('wz_pb_kette'))}">${ketteHtml}</ol>
        <span class="wz-pb-anschluss">${esc(t('wz_pb_amp_ende'))}</span>
      </div>
      ${hinweisHtml}

      ${erklaerHtml}

      <details class="wz-export">
        <summary>${esc(t('wz_pb_teilen'))}</summary>
        <p class="leise">${esc(t('wz_pb_teilen_hinweis'))}</p>
        <p class="wz-feld-reihe">
          <input type="text" class="wz-pb-teilen-feld" readonly value="${esc(teilen)}" aria-label="${esc(t('wz_pb_teilen'))}">
          <button type="button" class="chip chip-waehlbar wz-pb-kopieren">${esc(t('wz_pb_kopieren'))}</button>
        </p>
      </details>

      <p class="leise wz-metro-fuss">${esc(t('wz_pb_fuss'))}</p>
    </article>`;

  verdrahte(el, daten);
}

function verdrahte(el, daten) {
  const neu = () => renderWerkzeugPedalboard(el, daten, null);

  for (const knopf of el.querySelectorAll('.wz-pb-instrument')) {
    knopf.addEventListener('click', () => {
      zustand.instrument = knopf.dataset.instrument;
      zustand.ausgewaehlt = null;
      neu();
    });
  }
  for (const knopf of el.querySelectorAll('.wz-pb-katalog')) {
    knopf.addEventListener('click', () => {
      fuegeHinzu(knopf.dataset.pedal);
      neu();
    });
  }
  el.querySelector('.wz-pb-minimal')?.addEventListener('click', () => {
    zustand.kette[zustand.instrument] = [...MINIMAL[zustand.instrument]];
    zustand.ausgewaehlt = null;
    speichere();
    neu();
  });
  el.querySelector('.wz-pb-leeren')?.addEventListener('click', () => {
    zustand.kette[zustand.instrument] = [];
    zustand.ausgewaehlt = null;
    speichere();
    neu();
  });
  for (const knopf of el.querySelectorAll('[data-waehle]')) {
    knopf.addEventListener('click', () => {
      const i = Number(knopf.dataset.waehle);
      zustand.ausgewaehlt = aktuelleKette()[i];
      neu();
    });
  }
  for (const knopf of el.querySelectorAll('[data-hoch]')) {
    knopf.addEventListener('click', () => {
      verschiebe(Number(knopf.dataset.hoch), -1);
      neu();
    });
  }
  for (const knopf of el.querySelectorAll('[data-runter]')) {
    knopf.addEventListener('click', () => {
      verschiebe(Number(knopf.dataset.runter), +1);
      neu();
    });
  }
  for (const knopf of el.querySelectorAll('[data-entferne]')) {
    knopf.addEventListener('click', () => {
      const i = Number(knopf.dataset.entferne);
      if (aktuelleKette()[i] === zustand.ausgewaehlt) zustand.ausgewaehlt = null;
      entferne(i);
      neu();
    });
  }

  // Drag-Reorder (Zeiger) — ergänzt die tastaturbedienbaren Hoch/Runter-Knöpfe.
  let ziehIndex = null;
  for (const glied of el.querySelectorAll('.wz-pb-glied')) {
    glied.addEventListener('dragstart', () => {
      ziehIndex = Number(glied.dataset.index);
      glied.classList.add('zieht');
    });
    glied.addEventListener('dragend', () => glied.classList.remove('zieht'));
    glied.addEventListener('dragover', (e) => e.preventDefault());
    glied.addEventListener('drop', (e) => {
      e.preventDefault();
      const zielIndex = Number(glied.dataset.index);
      if (ziehIndex === null || ziehIndex === zielIndex) return;
      const k = [...aktuelleKette()];
      const [bewegt] = k.splice(ziehIndex, 1);
      k.splice(zielIndex, 0, bewegt);
      zustand.kette[zustand.instrument] = k;
      speichere();
      ziehIndex = null;
      neu();
    });
  }

  const kopieren = el.querySelector('.wz-pb-kopieren');
  kopieren?.addEventListener('click', async () => {
    const feld = el.querySelector('.wz-pb-teilen-feld');
    if (!feld) return;
    try {
      await navigator.clipboard.writeText(feld.value);
      kopieren.classList.add('chip-akzent');
    } catch {
      feld.select(); // Fallback: markieren, damit manuell kopiert werden kann
    }
  });
}
