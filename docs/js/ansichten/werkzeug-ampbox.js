// Werkzeug: Amp- & Box-Physik-Baukasten. Self-contained, KEIN Audio. Man stellt
// ein Rig zusammen (Amp-Typ + Box) und bekommt die zwei sicherheitsrelevanten
// Fakten geprüft: Impedanz-Zusammenpassen und Belastbarkeit — fakten-, nicht
// meinungsbasiert. Keine Marken, nur Typen und Zahlen.
//
// Warn-Deutlichkeit (Entscheidung): informieren mit physikalischer Begründung;
// Röhren-Impedanz-Mismatch deutlich als Schadensgefahr hervorheben, ohne
// bevormundend zu sperren. Nicht-farbliche Signale (Icon + „Ernst/Hinweis/Passt").
//
// Daten: data/ampbox.json. Einstellungen: flüchtiger Modul-State; Preset
// #/werkzeug/ampbox?instrument=bass.

import { t, text } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { ampGrafik, boxGrafik } from '../geraete-grafik.js';

const IMPEDANZEN = [4, 8, 16];

const zustand = {
  instrument: 'gitarre',
  bauart: 'roehre',
  format: 'topteil',
  ampWatt: 50,
  ampImpedanz: 8,
  bauform: 'geschlossen',
  bestueckung: '4x12',
  boxImpedanz: 8,
  boxWatt: 100,
  zweiBoxen: false,
  box2Impedanz: 8,
  schaltung: 'parallel',
};

function d(daten) {
  return daten.ampbox || {};
}
function bauart(daten) {
  return (d(daten).bauarten || []).find((b) => b.id === zustand.bauart) || {};
}
function bestueckungen(daten) {
  return (d(daten).bestueckung || {})[zustand.instrument] || [];
}
function berechneGesamtImpedanz() {
  if (!zustand.zweiBoxen) return zustand.boxImpedanz;
  const z1 = zustand.boxImpedanz;
  const z2 = zustand.box2Impedanz;
  if (zustand.schaltung === 'serie') return z1 + z2;
  return Math.round(((z1 * z2) / (z1 + z2)) * 10) / 10; // parallel
}

// --- Prüf-Logik (fakten-basiert) ---
function impedanzHinweis(daten) {
  const regel = bauart(daten).impedanz_regel || 'min';
  const eff = berechneGesamtImpedanz();
  if (regel === 'frei') {
    return { stufe: 'info', text: t('wz_ab_imp_frei') };
  }
  if (regel === 'match') {
    if (eff === zustand.ampImpedanz) return { stufe: 'ok', text: t('wz_ab_imp_match_ok', { ohm: eff }) };
    return { stufe: 'ernst', text: t('wz_ab_imp_match_warn', { amp: zustand.ampImpedanz, box: eff }) };
  }
  // min (Transistor)
  if (eff >= zustand.ampImpedanz) return { stufe: 'ok', text: t('wz_ab_imp_min_ok', { amp: zustand.ampImpedanz, box: eff }) };
  return { stufe: 'warn', text: t('wz_ab_imp_min_warn', { amp: zustand.ampImpedanz, box: eff }) };
}

function belastbarkeitHinweis() {
  if (zustand.boxWatt >= zustand.ampWatt) return { stufe: 'ok', text: t('wz_ab_last_ok', { box: zustand.boxWatt, amp: zustand.ampWatt }) };
  return { stufe: 'warn', text: t('wz_ab_last_warn', { box: zustand.boxWatt, amp: zustand.ampWatt }) };
}

const STUFE_ICON = { ok: 'fa-check', info: null, warn: 'fa-triangle-exclamation', ernst: 'fa-triangle-exclamation' };
function hinweisKarte(h) {
  const icon = STUFE_ICON[h.stufe] ? `<i class="fa-solid ${STUFE_ICON[h.stufe]}" aria-hidden="true"></i> ` : '';
  return `<div class="wz-ab-hinweis stufe-${h.stufe}">
    <span class="wz-ab-hinweis-marke">${icon}${esc(t('wz_ab_stufe_' + h.stufe))}</span>
    <span class="wz-ab-hinweis-text">${esc(h.text)}</span>
  </div>`;
}

// --- Bausteine der Oberfläche ---
function chipGruppe(klasse, dataAttr, optionen, aktiv) {
  return optionen
    .map(
      (o) => `<button type="button" class="chip chip-waehlbar ${klasse} ${o.id === aktiv ? 'chip-akzent' : ''}" data-${dataAttr}="${esc(o.id)}" aria-pressed="${o.id === aktiv}">${esc(text(o.name))}</button>`
    )
    .join(' ');
}
function impedanzChips(klasse, dataAttr, aktiv) {
  return IMPEDANZEN.map(
    (z) => `<button type="button" class="chip chip-waehlbar ${klasse} ${z === aktiv ? 'chip-akzent' : ''}" data-${dataAttr}="${z}" aria-pressed="${z === aktiv}">${z} Ω</button>`
  ).join(' ');
}

function wendePresetAn(query) {
  if (!query) return;
  const inst = query.get('instrument');
  if (inst === 'gitarre' || inst === 'bass') {
    zustand.instrument = inst;
    zustand.bestueckung = inst === 'bass' ? '8x10' : '4x12';
  }
}

export function renderWerkzeugAmpbox(el, daten, query) {
  wendePresetAn(query);
  const db = d(daten);
  // Bestückung an das Instrument anpassen, falls unpassend.
  if (!bestueckungen(daten).some((b) => b.id === zustand.bestueckung)) {
    zustand.bestueckung = bestueckungen(daten)[0]?.id || '';
  }

  const ba = bauart(daten);
  const format = (db.formate || []).find((f) => f.id === zustand.format) || {};
  const bauform = (db.bauformen || []).find((f) => f.id === zustand.bauform) || {};
  const best = bestueckungen(daten).find((b) => b.id === zustand.bestueckung) || {};
  const fakten = db.fakten || {};
  const signalstufen = db.signalstufen || [];

  const impH = impedanzHinweis(daten);
  const lastH = belastbarkeitHinweis();
  const gesamt = berechneGesamtImpedanz();

  const instrumentKnoepfe = ['gitarre', 'bass']
    .map((inst) => `<button type="button" class="chip chip-waehlbar wz-ab-instrument ${inst === zustand.instrument ? 'chip-akzent' : ''}" data-instrument="${inst}" aria-pressed="${inst === zustand.instrument}">${esc(t('wz_ab_inst_' + inst))}</button>`)
    .join(' ');

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-volume-high" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_ampbox_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_ampbox_untertitel'))}</p>
        </div>
      </section>

      <p class="chip-zeile">${instrumentKnoepfe}</p>

      <div class="wz-ab-rig" aria-hidden="true">
        <span class="wz-ab-rig-amp">${ampGrafik(zustand.bauart, zustand.format)}</span>
        <span class="wz-ab-rig-pfeil"><i class="fa-solid fa-arrow-right"></i></span>
        <span class="wz-ab-rig-box">${boxGrafik(zustand.bestueckung)}${zustand.zweiBoxen ? boxGrafik(zustand.bestueckung) : ''}</span>
      </div>

      <section class="wz-ab-block">
        <h2>${esc(t('wz_ab_amp'))}</h2>
        <p class="wz-feld-titel">${esc(t('wz_ab_bauart'))}</p>
        <p class="chip-zeile">${chipGruppe('wz-ab-bauart', 'bauart', db.bauarten || [], zustand.bauart)}</p>
        <p class="leise wz-ab-erkl">${esc(text(ba.erklaerung))}</p>
        <p class="wz-feld-titel">${esc(t('wz_ab_format'))}</p>
        <p class="chip-zeile">${chipGruppe('wz-ab-format', 'format', db.formate || [], zustand.format)}</p>
        <p class="leise wz-ab-erkl">${esc(text(format.erklaerung))}</p>
        <div class="wz-feld-reihe">
          <label>${esc(t('wz_ab_amp_watt'))}<input type="number" class="wz-ab-amp-watt" min="1" max="1000" step="1" value="${zustand.ampWatt}"></label>
          <span class="wz-ab-imp-feld"><span class="wz-feld-titel">${esc(zustand.bauart === 'transistor' ? t('wz_ab_amp_min_imp') : t('wz_ab_amp_imp'))}</span> ${impedanzChips('wz-ab-amp-imp', 'ampimp', zustand.ampImpedanz)}</span>
        </div>
      </section>

      <section class="wz-ab-block">
        <h2>${esc(t('wz_ab_box'))}</h2>
        <p class="wz-feld-titel">${esc(t('wz_ab_bestueckung'))}</p>
        <p class="chip-zeile">${chipGruppe('wz-ab-best', 'best', bestueckungen(daten), zustand.bestueckung)}</p>
        <p class="leise wz-ab-erkl">${esc(text(best.erklaerung))}</p>
        <p class="wz-feld-titel">${esc(t('wz_ab_bauform'))}</p>
        <p class="chip-zeile">${chipGruppe('wz-ab-bauform', 'bauform', db.bauformen || [], zustand.bauform)}</p>
        <p class="leise wz-ab-erkl">${esc(text(bauform.erklaerung))}</p>
        <div class="wz-feld-reihe">
          <label>${esc(t('wz_ab_box_watt'))}<input type="number" class="wz-ab-box-watt" min="1" max="2000" step="1" value="${zustand.boxWatt}"></label>
          <span class="wz-ab-imp-feld"><span class="wz-feld-titel">${esc(t('wz_ab_box_imp'))}</span> ${impedanzChips('wz-ab-box-imp', 'boximp', zustand.boxImpedanz)}</span>
        </div>
      </section>

      <section class="wz-ab-block">
        <h2>${esc(t('wz_ab_zwei'))}</h2>
        <p class="chip-zeile">
          <button type="button" class="chip chip-waehlbar wz-ab-zwei-toggle ${zustand.zweiBoxen ? 'chip-akzent' : ''}" aria-pressed="${zustand.zweiBoxen}">${esc(t('wz_ab_zwei_toggle'))}</button>
        </p>
        <div class="wz-ab-zwei-koerper" ${zustand.zweiBoxen ? '' : 'hidden'}>
          <div class="wz-feld-reihe">
            <span class="wz-ab-imp-feld"><span class="wz-feld-titel">${esc(t('wz_ab_box2_imp'))}</span> ${impedanzChips('wz-ab-box2-imp', 'box2imp', zustand.box2Impedanz)}</span>
            <span class="wz-ab-imp-feld"><span class="wz-feld-titel">${esc(t('wz_ab_schaltung'))}</span>
              <button type="button" class="chip chip-waehlbar wz-ab-schaltung ${zustand.schaltung === 'parallel' ? 'chip-akzent' : ''}" data-schaltung="parallel" aria-pressed="${zustand.schaltung === 'parallel'}">${esc(t('wz_ab_parallel'))}</button>
              <button type="button" class="chip chip-waehlbar wz-ab-schaltung ${zustand.schaltung === 'serie' ? 'chip-akzent' : ''}" data-schaltung="serie" aria-pressed="${zustand.schaltung === 'serie'}">${esc(t('wz_ab_serie'))}</button>
            </span>
          </div>
          <p class="wz-ab-gesamt">${esc(t('wz_ab_gesamt', { ohm: gesamt }))}</p>
          <p class="leise">${esc(t('wz_ab_serie_parallel_fakt'))}</p>
        </div>
      </section>

      <section class="wz-ab-block wz-ab-pruef">
        <h2>${esc(t('wz_ab_pruef'))}</h2>
        ${hinweisKarte(impH)}
        ${hinweisKarte(lastH)}
      </section>

      <section class="wz-ab-block">
        <h2>${esc(t('wz_ab_signal'))}</h2>
        <p class="wz-ab-signalfluss" aria-hidden="true">${esc(t('wz_ab_signalfluss'))}</p>
        <dl class="wz-ab-fakten">
          ${signalstufen.map((s) => `<dt>${esc(text(s.name))}</dt><dd>${esc(text(s.erklaerung))}</dd>`).join('')}
          <dt>${esc(t('wz_ab_fakt_watt'))}</dt><dd>${esc(text(fakten.watt_lautstaerke))}</dd>
          <dt>${esc(t('wz_ab_fakt_empf'))}</dt><dd>${esc(text(fakten.empfindlichkeit))}</dd>
          ${zustand.instrument === 'bass' ? `<dt>${esc(t('wz_ab_fakt_bass'))}</dt><dd>${esc(text(fakten.bass_headroom))}</dd>` : ''}
        </dl>
      </section>

      <p class="leise wz-metro-fuss">${esc(t('wz_ab_fuss'))}</p>
    </article>`;

  verdrahte(el, daten);
}

function verdrahte(el, daten) {
  const neu = () => renderWerkzeugAmpbox(el, daten, null);
  const chip = (sel, feld, cast = (v) => v) => {
    for (const knopf of el.querySelectorAll(sel)) {
      knopf.addEventListener('click', () => {
        zustand[feld] = cast(knopf.dataset[Object.keys(knopf.dataset)[0]]);
        neu();
      });
    }
  };
  chip('.wz-ab-instrument', 'instrument');
  chip('.wz-ab-bauart', 'bauart');
  chip('.wz-ab-format', 'format');
  chip('.wz-ab-best', 'bestueckung');
  chip('.wz-ab-bauform', 'bauform');
  chip('.wz-ab-schaltung', 'schaltung');
  for (const knopf of el.querySelectorAll('.wz-ab-amp-imp')) knopf.addEventListener('click', () => { zustand.ampImpedanz = Number(knopf.dataset.ampimp); neu(); });
  for (const knopf of el.querySelectorAll('.wz-ab-box-imp')) knopf.addEventListener('click', () => { zustand.boxImpedanz = Number(knopf.dataset.boximp); neu(); });
  for (const knopf of el.querySelectorAll('.wz-ab-box2-imp')) knopf.addEventListener('click', () => { zustand.box2Impedanz = Number(knopf.dataset.box2imp); neu(); });

  el.querySelector('.wz-ab-amp-watt')?.addEventListener('change', (e) => { zustand.ampWatt = Math.max(1, Math.min(1000, Math.round(Number(e.target.value) || zustand.ampWatt))); neu(); });
  el.querySelector('.wz-ab-box-watt')?.addEventListener('change', (e) => { zustand.boxWatt = Math.max(1, Math.min(2000, Math.round(Number(e.target.value) || zustand.boxWatt))); neu(); });
  el.querySelector('.wz-ab-zwei-toggle')?.addEventListener('click', () => { zustand.zweiBoxen = !zustand.zweiBoxen; neu(); });
}
