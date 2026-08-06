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

// Nicht-gefunden-Karte für unbekannte Slugs. Vorher stand dieselbe Karte an
// sechs Stellen leicht verschieden im Code — und an zwei weiteren fehlte sie
// ganz: #/pfad/stil/<unsinn> und #/pfad/themen/<unsinn> bauten stattdessen eine
// vollwertige Seite mit dem rohen Slug als Überschrift. Ein vertippter oder
// veralteter geteilter Link sah damit aus wie echter Inhalt.
export function nichtGefundenHtml(zurueckHref = '#/', zurueckText = '') {
  // Mit H1: Jede Seite braucht eine Ueberschrift — ohne sie steht ein
  // Screenreader-Nutzer auf einer Seite ohne Titel und die Dokumentstruktur
  // bricht ab. Die Nicht-gefunden-Karte war die einzige Ansicht ohne.
  return `
    <div class="karte leer-zustand">
      <i class="fa-solid fa-compass" aria-hidden="true"></i>
      <h1 class="nicht-gefunden-titel">${esc(t('nicht_gefunden_titel'))}</h1>
      <p class="leise">${esc(t('nicht_gefunden'))}</p>
      <div class="knopf-zeile leer-aktion">
        <a class="knopf knopf-sekundaer" href="${esc(zurueckHref)}">${esc(zurueckText || t('zurueck'))}</a>
      </div>
    </div>`;
}

// Häufiger Ausweg aus einem Leer-Zustand: „Kapitel entdecken" führt in den
// Themenpfad, „Suche" ins Suchfeld. Gibt fertiges Knopf-HTML für leerHtml zurück.
export function entdeckenAktion() {
  return `
    <a class="knopf knopf-primaer" href="#/pfad/themen">${esc(t('kapitel_entdecken'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
    <a class="knopf knopf-leise" href="#/suche">${esc(t('nav_suche'))}</a>`;
}

// Die beiden Zweige hinter ZERRER — Lernangebot und Kollektiv. Sie stehen an
// zwei Stellen (Startseiten-Hero, Fußzeile) und kommen deshalb aus EINER Quelle;
// vorher trug die Fußzeile ihren eigenen, hart geschriebenen Claim, der beim
// nächsten Wording-Wechsel stehengeblieben wäre.
//
// Nur noch der Startseiten-Hero rendert die beiden Zweige aus. Die Fußzeile trug
// sie früher als ruhige Textzeilen; dort steht jetzt ein kurzer Claim
// (`marke_footer_claim`), weil die Links der beiden Bereiche ohnehin in den
// Spalten daneben stehen. Der frühere `chips`-Schalter ist damit entfallen — ein
// Parameter, der nur noch einen Wert kennt, verschleiert mehr, als er erlaubt.
const MARKEN_ZWEIGE = [
  { schluessel: 'schule', ziel: '#/lernen', icon: 'fa-book-open' },
  { schluessel: 'kollektiv', ziel: '#/kollektiv', icon: 'fa-people-group' },
];

export function markenZeilenHtml({ klasse = '' } = {}) {
  const zeilen = MARKEN_ZWEIGE.map((z) => {
    const name = t(`marke_${z.schluessel}_name`);
    const kurz = t(`marke_${z.schluessel}_kurz`);
    const kopf = `<a class="chip chip-marke" href="${z.ziel}"><i class="fa-solid ${z.icon}" aria-hidden="true"></i> ${esc(name)}</a>`;
    return `<span class="marken-zeile">${kopf}<span class="marken-kurz">${esc(kurz)}</span></span>`;
  }).join('');
  return `<span class="marken-zweige marken-zweige-chips${klasse ? ' ' + klasse : ''}">${zeilen}</span>`;
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

// Fokus über ein Neu-Zeichnen retten. Der Router macht das für In-Place-Renders
// derselben Route selbst; Werkzeug-Ansichten, die sich SELBST neu zeichnen
// (`renderWerkzeugX(el, daten, null)` statt neuRendern()), gehen an ihm vorbei —
// dort landete der Fokus nach jedem Chip-Klick auf <body>, und Tastaturnutzer
// mussten sich jedes Mal neu durch die Seite tabben. `halteFokus` merkt das
// aktive Element an seinen data-*-Attributen bzw. seiner id, zeichnet neu und
// setzt den Fokus auf das gleichwertige Element der neuen Ausgabe.
export function halteFokus(el, zeichneNeu) {
  const aktiv = document.activeElement;
  let wahl = null;
  if (aktiv && el.contains(aktiv) && aktiv.attributes) {
    const daten = [...aktiv.attributes]
      .filter((a) => a.name.startsWith('data-'))
      .map((a) => `[${a.name}="${CSS.escape(a.value)}"]`)
      .join('');
    if (daten) wahl = aktiv.tagName.toLowerCase() + daten;
    else if (aktiv.id) wahl = '#' + CSS.escape(aktiv.id);
    else if (aktiv.className) wahl = aktiv.tagName.toLowerCase() + '.' + CSS.escape(String(aktiv.className).split(/\s+/)[0]);
  }
  zeichneNeu();
  if (!wahl) return;
  try {
    el.querySelector(wahl)?.focus({ preventScroll: true });
  } catch {
    /* ungültiger Selektor — dann eben kein Zurücksetzen */
  }
}

// Screenreader-Ansage über die globale Live-Region (#ansage in index.html).
// Die Region existierte von Anfang an, aber NIEMAND hat je hineingeschrieben —
// sie war totes Markup. Genutzt für Ergebnisse, die nur optisch erscheinen
// (Auswahl im Gear-Explorer, Prüfergebnis im Amp/Box-Rechner, fehlgeschlagene
// Aktionen). Der Text wird kurz geleert, damit zweimal dieselbe Ansage auch
// zweimal vorgelesen wird — sonst schluckt der Screenreader die Wiederholung.
export function sage(nachricht) {
  const region = document.getElementById('ansage');
  if (!region) return;
  region.textContent = '';
  window.setTimeout(() => {
    region.textContent = String(nachricht ?? '');
  }, 60);
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
  if (meta) meta.setAttribute('content', dunkel ? '#0b0b0c' : '#ffffff');
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
    // Flying-V-Silhouette: schmaler Hals von der Kopfplatte, unten der V-Korpus
    // (zwei gespreizte Flügel mit Kerbe zur Mitte). Ein Polygon, currentColor.
    '<svg class="dom-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="10.7,2.4 13.3,2.4 13.3,11.5 20.5,20.6 12,15.4 3.5,20.6 10.7,11.5"/></svg>',
  bass:
    '<svg class="dom-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="19" rx="1.4"/><line x1="10.6" y1="2.5" x2="10.6" y2="21.5"/><line x1="13.4" y1="2.5" x2="13.4" y2="21.5"/></svg>',
  schlagzeug:
    '<svg class="dom-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><ellipse cx="12" cy="14" rx="8" ry="3.2"/><path d="M4 14v3c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2v-3"/><line x1="6" y1="10.5" x2="15" y2="3.8"/><line x1="18" y1="10.5" x2="9" y2="3.8"/></svg>',
  gesang:
    '<svg class="dom-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="9" y1="21.2" x2="15" y2="21.2"/></svg>',
};

export function domaeneIcon(domaene) {
  if (INSTRUMENT_SVG[domaene]) return INSTRUMENT_SVG[domaene];
  const fa = { koerper: 'fa-heart-pulse', mentales: 'fa-brain', theorie: 'fa-book-open', ausruestung: 'fa-toolbox', kontext: 'fa-people-group' }[domaene];
  return fa ? `<i class="fa-solid ${fa}" aria-hidden="true"></i>` : '';
}

// Hue je Domäne — die zweite Hälfte der visuellen Identität neben dem Icon:
// Sie färbt Augenbraue, Verlauf, Medaille und Motiv. Die Zuordnung steht hier
// und NUR hier, damit dieselbe Kachel auf Startseite, Lernen-Hub, Instrument-
// Picker und Geräte-Landing dieselbe Farbe trägt. (Sie lag vorher doppelt in
// heim.js und pfad.js, während hub.js und die Landing-Heros pauschal pf-blau
// nahmen — im Lernen-Hub sahen dadurch alle vier Instrumente gleich aus.)
const DOMAENE_HUE = {
  gitarre: 'pf-magenta',
  bass: 'pf-indigo',
  schlagzeug: 'pf-sky',
  gesang: 'pf-teal',
};

export function domaeneHue(domaene, ersatz = 'pf-blau') {
  return DOMAENE_HUE[domaene] || ersatz;
}
