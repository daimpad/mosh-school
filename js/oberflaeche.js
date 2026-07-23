// Kleine Oberflächen-Helfer, die alle Ansichten teilen: Escaping, Absätze,
// Fortschrittsbalken, Status-Punkte, Überlagerungen und das Neu-Rendern-Signal.

import { label, t } from './i18n.js';

export function esc(wert) {
  return String(wert ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Nur echte externe Ziele (http/https/mailto) als Absprung zulassen — nie javascript:/data:.
export function externesZiel(ziel) {
  return /^(https?:|mailto:)/i.test(String(ziel ?? '').trim()) ? ziel : null;
}

// Erklärtexte trennen Absätze mit Leerzeilen.
export function absaetze(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((absatz) => `<p>${esc(absatz.trim())}</p>`)
    .join('');
}

export function balkenHtml(projektion, beschriftung = '') {
  const prozent = Math.round(projektion.quote * 100);
  const textZeile = beschriftung || t('bausteine_erledigt', { a: projektion.absolviert, b: projektion.gesamt });
  return `
    <div class="fortschritt-zeile">
      <div class="balken" role="progressbar" aria-valuenow="${prozent}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(textZeile)}">
        <div class="balken-fuellung" style="width:${prozent}%"></div>
      </div>
      <span class="leise">${esc(textZeile)}</span>
    </div>`;
}

// Fortschritts-Ring (SVG-Donut) für Kennzahlen, bei denen der Anteil im
// Vordergrund steht (Profil-Gesamt, Kompetenz-Karte). Rein darstellend über
// stroke-dasharray; die Zugänglichkeit trägt role=progressbar + aria-Werte.
export function ringHtml(projektion, { groesse = 76, staerke = 8, beschriftung = '' } = {}) {
  const prozent = Math.round(projektion.quote * 100);
  const r = (groesse - staerke) / 2;
  const umfang = 2 * Math.PI * r;
  const gefuellt = (prozent / 100) * umfang;
  const mitte = groesse / 2;
  const textZeile = beschriftung || t('bausteine_erledigt', { a: projektion.absolviert, b: projektion.gesamt });
  return `
    <div class="ring" role="progressbar" aria-valuenow="${prozent}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(textZeile)}">
      <svg width="${groesse}" height="${groesse}" viewBox="0 0 ${groesse} ${groesse}" aria-hidden="true">
        <circle class="ring-spur" cx="${mitte}" cy="${mitte}" r="${r}" fill="none" stroke-width="${staerke}"></circle>
        <circle class="ring-wert" cx="${mitte}" cy="${mitte}" r="${r}" fill="none" stroke-width="${staerke}" stroke-linecap="round"
          stroke-dasharray="${gefuellt.toFixed(2)} ${(umfang - gefuellt).toFixed(2)}"></circle>
      </svg>
      <span class="ring-text">${prozent}<span class="ring-prozent">%</span></span>
    </div>`;
}

// Leerer Zustand mit ruhigem Icon statt nacktem Satz. Die Zwei-Ebenen-Logik
// sperrt nie — das sind echte Leermengen (z. B. ein Faktor ohne Beleg auf der
// Stufe), kein Fehlerfall. `aktionHtml` ist optionales, bereits gebautes HTML
// (ein CTA-Knopf/-Link), damit ein Leer-Zustand nicht in eine Sackgasse führt,
// sondern einen Ausweg anbietet.
export function leerHtml(nachricht, icon = 'fa-compass', aktionHtml = '') {
  return `
    <div class="karte leer-zustand">
      <i class="fa-solid ${icon}" aria-hidden="true"></i>
      <p class="leise">${esc(nachricht)}</p>
      ${aktionHtml ? `<div class="knopf-zeile leer-aktion">${aktionHtml}</div>` : ''}
    </div>`;
}

// Häufiger Ausweg aus einem Leer-Zustand: „Kapitel entdecken" führt in den
// Themenpfad, „Suche" ins Suchfeld. Gibt fertiges Knopf-HTML für leerHtml zurück.
export function entdeckenAktion() {
  return `
    <a class="knopf knopf-primaer" href="#/pfad/themen">${esc(t('kapitel_entdecken'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
    <a class="knopf knopf-leise" href="#/suche">${esc(t('nav_suche'))}</a>`;
}

// Marken-Hero im Layout des OG-Bilds (Speeder links, Text rechts, Akzentleiste
// unten). Groß auf Startseite + Willkommen; die obersten Landingpages nutzen die
// kleine Variante heroKlein(icon, titel, untertitel). Alle Farben aus Tokens —
// hell/dunkel kippen automatisch mit.
// extra ist optionales Inline-HTML unter dem Hero-Text (Startseite: die Einstiegs-CTAs).
// Ohne extra bleibt der Hero rein darstellend (Willkommensseite).
export function markeHeroGross(extra = '') {
  return `
    <section class="marke-hero">
      <img class="marke-hero-bild" src="assets/images/speeder.svg" alt="" width="96" height="96">
      <div class="marke-hero-text">
        <h1>${esc(t('app_titel'))}</h1>
        <p class="marke-hero-untertitel">${esc(t('hero_untertitel'))}</p>
        <p class="marke-hero-themen">${esc(t('hero_themen'))}</p>
        ${extra}
      </div>
    </section>`;
}

// hue (z. B. 'pf-teal') färbt Icon-Medaille + eine leichte Tönung des Hero passend
// zur Startseiten-Kachel des Pfades; meta ist optionales Inline-HTML (z. B. ein
// Stufen-Chip) neben dem Titel. Ohne hue bleibt der Hero neutral-blau wie bisher.
export function heroKlein(icon, titel, untertitel = '', hue = '', meta = '') {
  const klassen = `marke-hero klein${hue ? ` hue ${hue}` : ''}`;
  return `
    <section class="${klassen}">
      <span class="marke-hero-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
      <div class="marke-hero-text">
        <h1>${esc(titel)}${meta}</h1>
        ${untertitel ? `<p class="marke-hero-untertitel">${esc(untertitel)}</p>` : ''}
      </div>
    </section>`;
}

export function statusPunktHtml(station) {
  const { erklaerteil, uebungsteil, reflexionsaufgabe, absolviert } = station.status;
  let klasse = 'offen';
  let beschriftung = t('status_offen');
  let glyph = '';
  if (absolviert) {
    klasse = 'voll';
    beschriftung = t('status_absolviert');
    glyph = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
  } else if (erklaerteil === 'erledigt' || uebungsteil === 'erledigt' || reflexionsaufgabe === 'erledigt') {
    klasse = 'teil';
    beschriftung = t('status_teilweise');
    glyph = '<i class="fa-solid fa-minus" aria-hidden="true"></i>';
  }
  // Form/Icon zusätzlich zur Ampelfarbe — nicht allein über Farbe unterscheidbar (Farbfehlsicht).
  return `<span class="status-punkt status-${klasse}" role="img" aria-label="${esc(beschriftung)}" title="${esc(beschriftung)}">${glyph}</span>`;
}

let vorherigerFokus = null;

function fokussierbare(wurzel) {
  return [...wurzel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
}

// Tastatur im Dialog: Esc schließt, Tab bleibt im Dialog gefangen (Fokusfalle).
function dialogTasten(ereignis) {
  const dialog = document.querySelector('#dialog-wurzel .ueberlagerung');
  if (!dialog) return;
  if (ereignis.key === 'Escape') { schliesseUeberlagerung(); return; }
  if (ereignis.key !== 'Tab') return;
  const ziele = fokussierbare(dialog);
  if (ziele.length === 0) { ereignis.preventDefault(); return; }
  const erst = ziele[0];
  const letzt = ziele[ziele.length - 1];
  if (ereignis.shiftKey && document.activeElement === erst) { letzt.focus(); ereignis.preventDefault(); }
  else if (!ereignis.shiftKey && document.activeElement === letzt) { erst.focus(); ereignis.preventDefault(); }
}

export function zeigeUeberlagerung(innenHtml) {
  const wurzel = document.getElementById('dialog-wurzel');
  vorherigerFokus = document.activeElement;
  wurzel.innerHTML = `<div class="ueberlagerung" role="dialog" aria-modal="true" tabindex="-1">${innenHtml}</div>`;
  const dialog = wurzel.querySelector('.ueberlagerung');
  const titel = dialog.querySelector('h1, h2, h3');
  if (titel) { titel.id = titel.id || 'dialog-titel'; dialog.setAttribute('aria-labelledby', titel.id); }
  document.addEventListener('keydown', dialogTasten, true);
  (dialog.querySelector('[data-schliessen]') || dialog).focus();
}

export function schliesseUeberlagerung() {
  const wurzel = document.getElementById('dialog-wurzel');
  document.removeEventListener('keydown', dialogTasten, true);
  if (wurzel) wurzel.innerHTML = '';
  if (vorherigerFokus && typeof vorherigerFokus.focus === 'function') vorherigerFokus.focus();
  vorherigerFokus = null;
}

// In eine aria-live-Region ansagen (Screenreader-Rückmeldung, visuell versteckt).
export function melde(mitteilung) {
  const region = document.getElementById('ansage');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = String(mitteilung ?? ''); });
}

// Sequenzabschluss-Gratifikation (Spez. 8.3): würdigend, aber zurückhaltend.
// Beschriftung eines Trainings-Loop-Meilensteins (§5) aus seiner ID. Dynamische
// IDs (grundlagen_<instrument>, spielziel_<wert>) lösen ihr Label über die
// Vokabeln auf; statische über direkte UI-Schlüssel.
export function meilensteinLabel(id) {
  if (id.startsWith('grundlagen_')) {
    return t('meilenstein_grundlagen', { instrument: label('domaene', id.slice('grundlagen_'.length)) });
  }
  if (id.startsWith('spielziel_')) {
    return t('meilenstein_spielziel', { ziel: label('spielziel_faktor', id.slice('spielziel_'.length)) });
  }
  return t('meilenstein_' + id);
}

// Text einer Meilenstein-Feier: neue Trainings-Loop-Meilensteine reichen einen
// fertigen Text herein; die alten Pfad-Meilensteine tragen art/stufe.
function meilensteinTextZeile(meilenstein) {
  if (meilenstein.text) return meilenstein.text;
  return meilenstein.art === 'kompetenz'
    ? t('meilenstein_kompetenz', { pfad: `${t('pfad_kompetenz')} (${label('kompetenzstufe', meilenstein.stufe)})` })
    : t('meilenstein_individual');
}

function zeigeMeilensteinKarte(textZeile, aufSchliessen) {
  zeigeUeberlagerung(`
    <div class="meilenstein-karte">
      <p class="meilenstein-zeichen" aria-hidden="true"><i class="fa-solid fa-medal"></i></p>
      <h2>${esc(t('meilenstein_titel'))}</h2>
      <p>${esc(textZeile)}</p>
      <p class="leise">${esc(t('meilenstein_weiter'))}</p>
      <button class="knopf knopf-primaer" data-schliessen>${esc(t('weiter'))}</button>
    </div>`);
  document.querySelector('#dialog-wurzel [data-schliessen]').addEventListener('click', () => {
    schliesseUeberlagerung();
    aufSchliessen();
  });
}

export function zeigeMeilenstein(meilenstein) {
  zeigeMeilensteinKarte(meilensteinTextZeile(meilenstein), neuRendern);
}

// Mehrere gleichzeitig erreichte Meilensteine nacheinander feiern (statt nur den
// ersten zu zeigen und die übrigen still zu verbuchen). Schließt eine Feier, folgt
// die nächste; nach der letzten wird neu gerendert.
export function zeigeMeilensteine(meilensteine) {
  const rest = Array.isArray(meilensteine) ? meilensteine.slice() : [meilensteine];
  const weiter = () => {
    if (!rest.length) {
      neuRendern();
      return;
    }
    zeigeMeilensteinKarte(meilensteinTextZeile(rest.shift()), weiter);
  };
  weiter();
}

// Ansichten stoßen ein Neu-Rendern an, ohne app.js zu importieren (kein Zyklus).
export function neuRendern() {
  window.dispatchEvent(new CustomEvent('app:rendern'));
}

// Ansichts-Aufräumen (Ressourcen-Teardown beim Ansichtswechsel). Views mit
// laufenden Ressourcen (Audio-Scheduler, Mikrofon-Streams, Timer, Objekt-URLs)
// registrieren hier eine Stop-Funktion; der Router führt sie beim Verlassen der
// Route aus, BEVOR die nächste Ansicht rendert. So läuft nichts weiter, nachdem
// man weggeklickt hat (u. a. bleibt kein Mikrofon offen). Die Haken werden nach
// dem Ausführen geleert — jede Ansicht registriert bei ihrem Rendern neu.
let aufraeumHaken = [];
export function registriereAufraeumen(fn) {
  if (typeof fn === 'function') aufraeumHaken.push(fn);
}
export function fuehreAufraeumenAus() {
  const haken = aufraeumHaken;
  aufraeumHaken = [];
  for (const fn of haken) {
    try {
      fn();
    } catch {
      // Ein fehlschlagendes Aufräumen darf den Ansichtswechsel nicht blockieren.
    }
  }
}

// Thema (hell/dunkel/auto) auf das Wurzelelement anwenden. 'auto' entfernt die
// Markierung und folgt dem OS (prefers-color-scheme); hell/dunkel erzwingen.
// Hält die Browser-Leiste (theme-color) am effektiven Modus. Das Boot-Skript in
// index.html macht dasselbe vor dem ersten Anstrich (kein Flackern); dies hier
// ist der Laufzeit-Weg beim Umschalten im Profil.
export function wendeThemaAn(thema) {
  const wurzel = document.documentElement;
  if (thema === 'hell' || thema === 'dunkel') wurzel.dataset.theme = thema;
  else delete wurzel.dataset.theme;
  const dunkel =
    thema === 'dunkel' ||
    (thema !== 'hell' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dunkel ? '#0b0b0c' : '#dcd8cd');
  // Optionale Mithörer (z. B. der Feedback-Kommentator) folgen dem Thema.
  window.dispatchEvent(new CustomEvent('app:thema', { detail: thema }));
}

// Abstrakte Baustein-Grafiken (data/grafiken.json, generiert via
// scripts/build_grafiken.py): Registry wird beim Boot gesetzt. Die SVGs nutzen
// currentColor und wirken deshalb NUR inline — nie als <img src> einbinden.
let GRAFIKEN = {};
export function setzeGrafiken(map) {
  GRAFIKEN = map || {};
}

// Lehrgrafiken (data/lehrgrafiken.json, Tranche 4): breite Erklär-Schemata
// (Beat-Raster, Griffbilder, Anschlagsmuster) für die Baustein-Ansicht.
// Textfrei/i18n-neutral — die Legende liefert label('lehrgrafik', id).
let LEHRGRAFIKEN = {};
export function setzeLehrgrafiken(map) {
  LEHRGRAFIKEN = map || {};
}

export function lehrgrafik(bausteinId) {
  const svg = LEHRGRAFIKEN[bausteinId];
  return svg ? svg.replace('<svg ', '<svg class="lehrgrafik-svg" ') : '';
}

export function bausteinIcon(bausteinId, klasse = '') {
  const grafik = GRAFIKEN[bausteinId];
  if (grafik) return grafik.replace('<svg ', `<svg class="grafik-icon ${klasse}" `);
  // Kein generiertes Motiv (z. B. noch unbebilderter Baustein): schlicht kein
  // Icon — kein Fehlerfall.
  return '';
}

// Instrument-Icons als Inline-SVG (die FA-Subset-Schrift kennt kein Gitarre/Drum/
// Mikro-Glyph, und ohne fonttools lässt sich das Subset nicht erweitern). currentColor
// erbt die Medaillen-Hue. Fällt für Nicht-Instrument-Domänen auf ein FA-Icon zurück.
const INSTRUMENT_SVG = {
  gitarre:
    '<svg class="dom-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 7c2-3 12-3 14 0 2 2.6-1.5 12-7 15C6.5 19 3 9.6 5 7Z"/></svg>',
  bass:
    '<svg class="dom-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="19" rx="1.4"/><line x1="10.6" y1="2.5" x2="10.6" y2="21.5"/><line x1="13.4" y1="2.5" x2="13.4" y2="21.5"/></svg>',
  schlagzeug:
    '<svg class="dom-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><ellipse cx="12" cy="14" rx="8" ry="3.2"/><path d="M4 14v3c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2v-3"/><line x1="6" y1="10.5" x2="15" y2="3.8"/><line x1="18" y1="10.5" x2="9" y2="3.8"/></svg>',
  gesang:
    '<svg class="dom-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="9" y1="21.2" x2="15" y2="21.2"/></svg>',
};

export function domaeneIcon(domaene) {
  if (INSTRUMENT_SVG[domaene]) return INSTRUMENT_SVG[domaene];
  const fa = { koerper: 'fa-heart-pulse', mentales: 'fa-brain', theorie: 'fa-book-open', ausruestung: 'fa-toolbox' }[domaene];
  return fa ? `<i class="fa-solid ${fa}" aria-hidden="true"></i>` : '';
}
