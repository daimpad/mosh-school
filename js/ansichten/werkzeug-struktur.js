// Werkzeug: Song-Struktur-Baukasten. Self-contained, KEIN Audio. Abschnitts-
// Blöcke (Intro, Vers, Refrain, Breakdown, Bridge, Solo, Outro) anordnen; je Block
// Takte, Wiederholungen, Intensität, optionales Tempo, Notiz und Übergangstyp.
// Timeline + Gesamtlänge + Intensitätskurve. Persistenz in localStorage
// (werkzeug-speicher.js) getrennt vom Zustand-Schema. Export als JSON/Text.
//
// Anschluss an den Klick-Track: die Struktur erzeugt eine Tempo-Map
// (Abschnitt → Takte/Tempo), die im Werkzeug-Speicher abgelegt wird; das Metronom
// lädt und spielt sie über #/werkzeug/metronom?tempomap=1.

import { t } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { holeWerkzeugDaten, setzeWerkzeugDaten } from '../werkzeug-speicher.js';

const BLOCK_TYPEN = ['intro', 'vers', 'refrain', 'breakdown', 'bridge', 'solo', 'outro'];
const UEBERGAENGE = ['direkt', 'break', 'fill', 'anschwellen', 'ritardando', 'tempowechsel'];
const MAX_INTENS = 5;

const zustand = {
  bpm: 120,
  bloecke: [],
  geladen: false,
};

function neuerBlock(typ) {
  return { typ, takte: 8, wdh: 1, intensitaet: 3, bpm: 0, notiz: '', uebergang: 'direkt' };
}
function speichere() {
  setzeWerkzeugDaten('struktur', { bpm: zustand.bpm, bloecke: zustand.bloecke });
  // Tempo-Map für den Klick-Track ablegen: je Block (mal Wiederholungen) ein
  // Segment {takte, bpm}. bpm 0 → globales Tempo.
  const segmente = zustand.bloecke
    .filter((b) => b.takte > 0 && b.wdh > 0)
    .map((b) => ({ takte: b.takte * b.wdh, bpm: b.bpm > 0 ? b.bpm : zustand.bpm }));
  setzeWerkzeugDaten('klick_tempomap', { bpm: zustand.bpm, segmente });
}

function gesamtTakte() {
  return zustand.bloecke.reduce((s, b) => s + b.takte * b.wdh, 0);
}
// Grobe Dauer in Sekunden (4/4 angenommen): Summe der Blockdauern mit ihrem Tempo.
function gesamtSekunden() {
  return zustand.bloecke.reduce((s, b) => {
    const bpm = b.bpm > 0 ? b.bpm : zustand.bpm;
    return s + (b.takte * b.wdh * 4 * 60) / bpm;
  }, 0);
}
function zeitText(sek) {
  const m = Math.floor(sek / 60);
  const s = Math.round(sek % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// --- Ableitungen (Timeline, Gesamt, Kurve) live neu zeichnen ---
function timelineHtml() {
  const ganz = gesamtTakte() || 1;
  return zustand.bloecke
    .map((b) => {
      const anteil = ((b.takte * b.wdh) / ganz) * 100;
      return `<span class="wz-st-seg intens-${b.intensitaet}" style="flex:0 0 ${anteil.toFixed(2)}%" title="${esc(t('block_' + b.typ))} · ${b.takte * b.wdh} ${esc(t('wz_st_takte_kurz'))}">${esc(t('block_' + b.typ))}</span>`;
    })
    .join('');
}
function kurveHtml() {
  const n = zustand.bloecke.length;
  if (n < 2) return '';
  const punkte = zustand.bloecke
    .map((b, i) => {
      const x = (i / (n - 1)) * 236 + 2;
      const y = 40 - ((b.intensitaet - 1) / (MAX_INTENS - 1)) * 36 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `<svg class="wz-st-kurve-svg" viewBox="0 0 240 42" preserveAspectRatio="none" aria-hidden="true"><polyline points="${punkte}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}
function aktualisiereAbleitungen(el) {
  const tl = el.querySelector('.wz-st-timeline');
  if (tl) tl.innerHTML = timelineHtml();
  const total = el.querySelector('.wz-st-total');
  if (total) total.textContent = t('wz_st_total', { takte: gesamtTakte(), zeit: zeitText(gesamtSekunden()) });
  const kurve = el.querySelector('.wz-st-kurve');
  if (kurve) kurve.innerHTML = kurveHtml();
}

// --- Export ---
function exportiere(el) {
  const daten = { bpm: zustand.bpm, bloecke: zustand.bloecke };
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'song-struktur.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function textZusammenfassung() {
  return zustand.bloecke
    .map((b) => `${t('block_' + b.typ)} ×${b.wdh} (${b.takte} ${t('wz_st_takte_kurz')})${b.notiz ? ' — ' + b.notiz : ''}`)
    .join('  →  ');
}

function wendePresetAn(query) {
  if (!query) return;
}

export function renderWerkzeugStruktur(el, daten, query) {
  if (!zustand.geladen) {
    const g = holeWerkzeugDaten('struktur', null);
    if (g && typeof g === 'object') {
      if (Number.isFinite(g.bpm)) zustand.bpm = g.bpm;
      if (Array.isArray(g.bloecke)) zustand.bloecke = g.bloecke.map((b) => ({ ...neuerBlock(b.typ || 'vers'), ...b }));
    }
    zustand.geladen = true;
  }
  wendePresetAn(query);

  const katalog = BLOCK_TYPEN.map(
    (typ) => `<button type="button" class="chip chip-waehlbar wz-st-add" data-typ="${typ}">+ ${esc(t('block_' + typ))}</button>`
  ).join(' ');

  const bloeckeHtml = zustand.bloecke.length
    ? zustand.bloecke
        .map((b, i) => {
          const uebOpt = UEBERGAENGE.map((u) => `<option value="${u}" ${u === b.uebergang ? 'selected' : ''}>${esc(t('ueberg_' + u))}</option>`).join('');
          const intensChips = Array.from({ length: MAX_INTENS }, (_, k) => k + 1)
            .map((n) => `<button type="button" class="wz-st-intens-knopf ${n === b.intensitaet ? 'aktiv' : ''}" data-intens="${i}:${n}" aria-label="${esc(t('wz_st_intens', { n }))}" aria-pressed="${n === b.intensitaet}">${n}</button>`)
            .join('');
          return `<li class="wz-st-block intens-${b.intensitaet}" data-index="${i}">
            <div class="wz-st-block-kopf">
              <span class="wz-st-block-typ">${esc(t('block_' + b.typ))}</span>
              <span class="wz-st-block-knoepfe">
                <button type="button" class="wz-pb-mini" data-hoch="${i}" aria-label="${esc(t('wz_st_hoch'))}" ${i === 0 ? 'disabled' : ''}><span aria-hidden="true">↑</span></button>
                <button type="button" class="wz-pb-mini" data-runter="${i}" aria-label="${esc(t('wz_st_runter'))}" ${i === zustand.bloecke.length - 1 ? 'disabled' : ''}><span aria-hidden="true">↓</span></button>
                <button type="button" class="wz-pb-mini" data-entferne="${i}" aria-label="${esc(t('wz_st_entferne'))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
              </span>
            </div>
            <div class="wz-st-felder">
              <label>${esc(t('wz_st_takte'))}<input type="number" class="wz-st-f" data-feld="takte:${i}" min="1" max="128" value="${b.takte}"></label>
              <label>${esc(t('wz_st_wdh'))}<input type="number" class="wz-st-f" data-feld="wdh:${i}" min="1" max="16" value="${b.wdh}"></label>
              <label>${esc(t('wz_st_bpm_block'))}<input type="number" class="wz-st-f" data-feld="bpm:${i}" min="0" max="300" value="${b.bpm}" placeholder="${zustand.bpm}"></label>
              <span class="wz-st-intens"><span class="wz-feld-titel">${esc(t('wz_st_intensitaet'))}</span> <span class="wz-st-intens-gruppe" role="group">${intensChips}</span></span>
              <label class="wz-st-ueb">${esc(t('wz_st_uebergang'))}<select class="wz-st-f" data-feld="uebergang:${i}">${uebOpt}</select></label>
              <label class="wz-st-notiz-feld">${esc(t('wz_st_notiz'))}<input type="text" class="wz-st-f" data-feld="notiz:${i}" value="${esc(b.notiz)}" placeholder="${esc(t('wz_st_notiz_ph'))}"></label>
            </div>
          </li>`;
        })
        .join('')
    : `<li class="wz-pb-leer leise">${esc(t('wz_st_leer'))}</li>`;

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-list-check" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_struktur_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_struktur_untertitel'))}</p>
        </div>
      </section>

      <div class="wz-feld-reihe">
        <label>${esc(t('wz_st_bpm'))}<input type="number" class="wz-st-bpm" min="40" max="300" value="${zustand.bpm}"></label>
        <span class="wz-st-total leise" role="status" aria-live="polite">${esc(t('wz_st_total', { takte: gesamtTakte(), zeit: zeitText(gesamtSekunden()) }))}</span>
      </div>

      <div class="wz-st-timeline" aria-label="${esc(t('wz_st_timeline'))}">${timelineHtml()}</div>
      <div class="wz-st-kurve" aria-hidden="true">${kurveHtml()}</div>

      <h2 class="wz-pb-h">${esc(t('wz_st_bloecke'))}</h2>
      <p class="chip-zeile">${katalog}</p>
      <ol class="wz-st-liste">${bloeckeHtml}</ol>

      <details class="wz-export">
        <summary>${esc(t('wz_st_export'))}</summary>
        <p class="chip-zeile">
          <a class="chip chip-waehlbar" href="#/werkzeug/metronom?tempomap=1"><i class="fa-solid fa-stopwatch" aria-hidden="true"></i> ${esc(t('wz_st_zum_klick'))}</a>
          <button type="button" class="chip chip-waehlbar wz-st-json"><i class="fa-solid fa-download" aria-hidden="true"></i> ${esc(t('wz_st_json'))}</button>
        </p>
        <p class="leise">${esc(t('wz_st_zusammenfassung'))}</p>
        <p class="wz-st-text">${esc(textZusammenfassung())}</p>
      </details>

      <p class="leise wz-metro-fuss">${esc(t('wz_st_fuss'))}</p>
    </article>`;

  verdrahte(el, daten);
}

function verdrahte(el, daten) {
  const neu = () => renderWerkzeugStruktur(el, daten, null);

  el.querySelector('.wz-st-bpm')?.addEventListener('change', (e) => {
    zustand.bpm = Math.max(40, Math.min(300, Math.round(Number(e.target.value) || zustand.bpm)));
    e.target.value = String(zustand.bpm);
    speichere();
    aktualisiereAbleitungen(el);
  });

  for (const knopf of el.querySelectorAll('.wz-st-add')) {
    knopf.addEventListener('click', () => {
      zustand.bloecke.push(neuerBlock(knopf.dataset.typ));
      speichere();
      neu();
    });
  }
  for (const knopf of el.querySelectorAll('[data-hoch]')) {
    knopf.addEventListener('click', () => {
      const i = Number(knopf.dataset.hoch);
      [zustand.bloecke[i - 1], zustand.bloecke[i]] = [zustand.bloecke[i], zustand.bloecke[i - 1]];
      speichere();
      neu();
    });
  }
  for (const knopf of el.querySelectorAll('[data-runter]')) {
    knopf.addEventListener('click', () => {
      const i = Number(knopf.dataset.runter);
      [zustand.bloecke[i + 1], zustand.bloecke[i]] = [zustand.bloecke[i], zustand.bloecke[i + 1]];
      speichere();
      neu();
    });
  }
  for (const knopf of el.querySelectorAll('[data-entferne]')) {
    knopf.addEventListener('click', () => {
      zustand.bloecke.splice(Number(knopf.dataset.entferne), 1);
      speichere();
      neu();
    });
  }
  for (const knopf of el.querySelectorAll('.wz-st-intens-knopf')) {
    knopf.addEventListener('click', () => {
      const [i, n] = knopf.dataset.intens.split(':').map(Number);
      zustand.bloecke[i].intensitaet = n;
      speichere();
      neu(); // Intensität färbt Block + Timeline + Kurve → voll neu
    });
  }
  // Feld-Edits: Modell + Speicher aktualisieren, Ableitungen live nachziehen,
  // OHNE Neu-Render (sonst verliert das Textfeld den Fokus).
  for (const feld of el.querySelectorAll('.wz-st-f')) {
    const ereignis = feld.tagName === 'SELECT' ? 'change' : 'input';
    feld.addEventListener(ereignis, () => {
      const [name, idxStr] = feld.dataset.feld.split(':');
      const i = Number(idxStr);
      const b = zustand.bloecke[i];
      if (!b) return;
      if (name === 'notiz' || name === 'uebergang') b[name] = feld.value;
      else b[name] = Math.max(0, Math.round(Number(feld.value) || 0));
      speichere();
      aktualisiereAbleitungen(el);
    });
  }
  el.querySelector('.wz-st-json')?.addEventListener('click', () => exportiere(el));
}
