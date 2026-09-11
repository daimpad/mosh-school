// Shows-Editor (#/shows/login): Bild und Text einer Show im Browser pflegen und
// als EIN Commit auf einen Arbeitszweig schreiben. Das Mini-CMS zur Shows-Seite.
//
// WAS DAS IST UND WAS NICHT: Die Passwortabfrage davor ist ein Sichtschutz wie
// bei #/intern — die App ist rein clientseitig, das Passwort steht im
// ausgelieferten Quelltext. Geschrieben wird nicht, weil jemand das Passwort
// kennt, sondern weil ein GitHub-Token im Browser liegt. DER TOKEN IST DER
// SCHLÜSSEL; das Passwort hält nur Zufallsbesucher vom Formular fern.
//
// WARUM EIN ZWEIG STATT main: Der Editor schreibt nach `shows/editor`, nicht
// direkt auf `main`. Damit läuft die CI (validate.py, build_seiten --check …),
// BEVOR etwas live geht — und netcup zieht erst, wenn gemergt wurde. Der Preis
// ist ein Klick auf github.com je Stapel; dafür kann ein Tippfehler die Seite
// nicht umwerfen.
//
// WARUM DER EDITOR shows.json VOM SERVER LIEST statt aus `daten`: Zwischen dem
// Seitenaufruf und dem Speichern kann gemergt worden sein. Wer den beim Laden
// geholten Stand zurückschreibt, macht die Änderung dazwischen rückgängig —
// lautlos, weil JSON-Ersetzen keinen Konflikt erzeugt.
//
// DIE PRÜFUNGEN HIER SPIEGELN scripts/validate.py. Sie ersetzen es nicht (die
// CI bleibt die Wahrheit), aber sie sollen verhindern, dass man einen Zweig
// anlegt, der garantiert rot wird. Läuft eine Regel dort auseinander, gehört
// sie hier nachgezogen.

import { label, t } from '../i18n.js';
import { esc, registriereAufraeumen } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';
import { holeWerkzeugDaten, setzeWerkzeugDaten } from '../werkzeug-speicher.js';
import { blobZuBase64, githubClient } from '../github.js';
import { bindeBildausfall, detailHtml, kachelHtml } from './shows.js';

const SPEICHER = 'shows-editor';
const PASSWORT = 'verzerrer';

// Ziel-Repository. Es steht ohnehin schon offen in der Fußzeile jeder Seite —
// hier ist es kein Geheimnis, sondern die Adresse, auf die der Token passen muss.
const OWNER = 'daimpad';
const REPO = 'mosh-school';
const BASIS = 'main';
const ZWEIG = 'shows/editor';
const DATEI = 'data/shows.json';
const BILDORDNER = 'images/shows/';

// Dieselben Zahlen wie SHOWS_* in scripts/validate.py und images/shows/README.md.
const KANTE = 1400;                    // längste Kante nach dem Verkleinern
const WARN_BYTES = 250 * 1024;
const MAX_BYTES = 400 * 1024;
// Absteigend probiert, bis das Bild unter WARN_BYTES liegt. Ein Flyer ist
// Strichgrafik mit Flächen — da kostet Qualität 0,6 kaum Sichtbares, während
// ein Foto bei demselben Wert schon matschte.
const QUALITAETEN = [0.82, 0.72, 0.62, 0.54, 0.46];

const ID_MUSTER = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// `login` ist die Editor-Route selbst — eine Show mit dieser ID wäre unerreichbar.
const GESPERRTE_IDS = new Set(['login']);

// ---------------------------------------------------------------------------
// Zustand: bewusst Modul-State, nicht zustand.js. Ein halb ausgefülltes
// Formular ist kein Lernfortschritt, und der Token hat in einer exportierbaren
// Sicherung nichts verloren.
let freigeschaltet = false;
let entwurf = null;        // Formularwerte, siehe leererEntwurf()
let bild = null;           // { blob, breite, hoehe, bytes, format, url }
let meldung = null;        // { art: 'ok'|'fehler', text, href? }

function leererEntwurf() {
  return {
    originalId: null,      // gesetzt = vorhandene Show, ID ist dann unveränderlich
    datum: '', genauigkeit: 'tag', titel: '', kurzname: '',
    ort: '', veranstalter: '', gestaltung: '', quelle: '',
    bands: '', stil: [], text: '', alt: '',
    bildName: '',          // Dateiname der bereits vorhandenen Show
  };
}

// ---------------------------------------------------------------------------
// Reine Hilfsfunktionen

// Umlaute werden VOR dem Akzent-Strippen ersetzt: `normalize('NFD')` zerlegt
// „ä" in a + Trema, und das Wegwerfen des Tremas ergäbe „a" statt „ae". Die
// Reihenfolge ist der ganze Unterschied zwischen „koeln" und „koln".
function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// JJJJ-MM-TT auf die gewählte Genauigkeit kürzen. Ein Archiv hat regelmäßig nur
// Monat oder Jahr — ein erfundener 1. Januar wäre eine Falschangabe.
function datumTeil(datum, genauigkeit) {
  if (!datum) return '';
  if (genauigkeit === 'jahr') return datum.slice(0, 4);
  if (genauigkeit === 'monat') return datum.slice(0, 7);
  return datum;
}

// Gemessenes Seitenverhältnis → Wort. Dieselben Schwellen wie formatWort() in
// scripts/validate.py; `format` wird deshalb nie getippt, sondern gemessen.
function formatWort(breite, hoehe) {
  const r = breite / hoehe;
  return r < 0.92 ? 'hoch' : r > 1.08 ? 'quer' : 'quadrat';
}

function istEchtesDatum(datum) {
  const teile = datum.split('-').map(Number);
  if (teile.length >= 2 && (teile[1] < 1 || teile[1] > 12)) return false;
  if (teile.length === 3) {
    const d = new Date(Date.UTC(teile[0], teile[1] - 1, teile[2]));
    return d.getUTCFullYear() === teile[0] && d.getUTCMonth() === teile[1] - 1 && d.getUTCDate() === teile[2];
  }
  return true;
}

// Baut aus dem Formular den Eintrag, wie er in data/shows.json stehen wird.
// Feldreihenfolge = Reihenfolge der vorhandenen Einträge, damit der Diff auf
// GitHub lesbar bleibt. Leere Felder fallen weg statt als "" dazustehen.
function entwurfZuEintrag(e, gemessenesFormat) {
  const datum = datumTeil(e.datum, e.genauigkeit);
  const id = e.originalId || [datum, slug(e.kurzname)].filter(Boolean).join('-');
  const bands = e.bands.split('\n').map((z) => z.trim()).filter(Boolean);
  const eintrag = { id, datum, titel: e.titel.trim() };
  if (e.ort.trim()) eintrag.ort = e.ort.trim();
  if (e.veranstalter.trim()) eintrag.veranstalter = e.veranstalter.trim();
  if (bands.length) eintrag.bands = bands;
  if (e.stil.length) eintrag.stil = [...e.stil];
  eintrag.bild = bild ? `${id}.webp` : e.bildName;
  eintrag.format = gemessenesFormat || 'hoch';
  if (e.alt.trim()) eintrag.alt = e.alt.trim();
  if (e.text.trim()) eintrag.text = e.text.trim();
  if (e.gestaltung.trim()) eintrag.gestaltung = e.gestaltung.trim();
  if (e.quelle.trim()) eintrag.quelle = e.quelle.trim();
  return eintrag;
}

// Spiegel von pruefe_shows() in scripts/validate.py. Liefert [{art, text}].
function pruefe(eintrag, vorhandene, voka) {
  const p = [];
  const fehler = (text) => p.push({ art: 'fehler', text });
  const warnung = (text) => p.push({ art: 'warnung', text });

  if (!eintrag.datum) fehler(t('editor_p_datum_fehlt'));
  else if (!istEchtesDatum(eintrag.datum)) fehler(t('editor_p_datum_unecht', { datum: eintrag.datum }));
  else {
    const jahr = Number(eintrag.datum.slice(0, 4));
    const jetzt = new Date().getUTCFullYear();
    if (jahr < 1975 || jahr > jetzt + 2) fehler(t('editor_p_jahr', { jahr, max: jetzt + 2 }));
  }
  if (!eintrag.titel) fehler(t('editor_p_titel'));
  if (!eintrag.id || !ID_MUSTER.test(eintrag.id)) fehler(t('editor_p_id_muster'));
  else if (GESPERRTE_IDS.has(eintrag.id)) fehler(t('editor_p_id_gesperrt', { id: eintrag.id }));
  else if (eintrag.datum && !eintrag.id.startsWith(eintrag.datum.slice(0, 4))) {
    fehler(t('editor_p_id_jahr', { jahr: eintrag.datum.slice(0, 4) }));
  }
  if (vorhandene.some((s) => s.id === eintrag.id)) fehler(t('editor_p_id_doppelt', { id: eintrag.id }));
  if (!eintrag.bild) fehler(t('editor_p_bild_fehlt'));

  if (bild) {
    if (bild.bytes > MAX_BYTES) {
      fehler(t('editor_p_bild_gross', { kb: Math.round(bild.bytes / 1024), max: MAX_BYTES / 1024 }));
    } else if (bild.bytes > WARN_BYTES) {
      warnung(t('editor_p_bild_schwer', { kb: Math.round(bild.bytes / 1024) }));
    }
    const kante = Math.max(bild.breite, bild.hoehe);
    if (kante < 800) warnung(t('editor_p_kante_klein', { kante }));
  }
  if (!eintrag.alt) warnung(t('editor_p_alt'));
  for (const s of eintrag.stil || []) {
    if (Array.isArray(voka?.stil) && !voka.stil.includes(s)) fehler(t('editor_p_stil', { stil: s }));
  }
  return p;
}

// ---------------------------------------------------------------------------
// Bild: im Browser auf Zielmaß rechnen

async function verkleinere(datei) {
  // `imageOrientation: 'from-image'` ist hier nicht Feinschliff, sondern Pflicht:
  // Handyfotos tragen ihre Drehung im EXIF statt in den Pixeln. Ohne das läge
  // ein hochformatiger Flyer quer im Bild — und `format` würde falsch GEMESSEN,
  // also auch von der Prüfung nicht gefangen.
  const bitmap = await createImageBitmap(datei, { imageOrientation: 'from-image' });
  const faktor = Math.min(1, KANTE / Math.max(bitmap.width, bitmap.height));
  const breite = Math.max(1, Math.round(bitmap.width * faktor));
  const hoehe = Math.max(1, Math.round(bitmap.height * faktor));
  const leinwand = document.createElement('canvas');
  leinwand.width = breite;
  leinwand.height = hoehe;
  leinwand.getContext('2d').drawImage(bitmap, 0, 0, breite, hoehe);
  bitmap.close?.();

  let blob = null;
  for (const q of QUALITAETEN) {
    blob = await new Promise((fertig) => leinwand.toBlob(fertig, 'image/webp', q));
    if (!blob) throw new Error('WebP konnte nicht erzeugt werden');
    if (blob.size <= WARN_BYTES) break;
  }
  return { blob, breite, hoehe, bytes: blob.size, format: formatWort(breite, hoehe) };
}

// ---------------------------------------------------------------------------
// Token

function holeToken() {
  const d = holeWerkzeugDaten(SPEICHER, null);
  return typeof d?.token === 'string' ? d.token : '';
}
function merkeToken(token) {
  setzeWerkzeugDaten(SPEICHER, { token });
}

// ---------------------------------------------------------------------------
// Markup

function feld(id, labelKey, { mehrzeilig = false, typ = 'text', wert = '', hinweis = '', zeilen = 4 } = {}) {
  const eingabe = mehrzeilig
    ? `<textarea id="${id}" class="editor-eingabe" rows="${zeilen}" data-feld>${esc(wert)}</textarea>`
    : `<input id="${id}" class="editor-eingabe" type="${typ}" value="${esc(wert)}" data-feld>`;
  return `
    <div class="editor-feld">
      <label for="${id}">${esc(t(labelKey))}</label>
      ${eingabe}
      ${hinweis ? `<p class="editor-feld-hinweis leise">${esc(t(hinweis))}</p>` : ''}
    </div>`;
}

function schlossHtml() {
  return `
    <section class="abschnitt">
      <h2 class="abschnitt-titel">${esc(t('intern_schloss_titel'))}</h2>
      <form class="editor-pw-form" novalidate>
        <div class="editor-feld">
          <label for="editor-pw">${esc(t('intern_pw_label'))}</label>
          <input id="editor-pw" class="editor-eingabe" type="password" autocomplete="current-password"
                 aria-describedby="editor-pw-fehler">
        </div>
        <button type="submit" class="knopf knopf-primaer">${esc(t('intern_oeffnen'))}</button>
      </form>
      <p id="editor-pw-fehler" class="editor-fehler" role="alert" aria-live="polite"></p>
    </section>`;
}

function tokenHtml() {
  const token = holeToken();
  return `
    <section class="abschnitt">
      <h2 class="abschnitt-titel">${esc(t('editor_token_titel'))}</h2>
      <form class="editor-token-form" novalidate>
        <div class="editor-feld">
          <label for="editor-token">${esc(t('editor_token_label'))}</label>
          <input id="editor-token" class="editor-eingabe" type="password" autocomplete="off"
                 spellcheck="false" placeholder="github_pat_…" value="${esc(token)}">
        </div>
        <button type="submit" class="knopf knopf-sekundaer">${esc(t('editor_token_merken'))}</button>
        ${token ? `<button type="button" class="knopf knopf-leise" data-token-weg>${esc(t('editor_token_vergessen'))}</button>` : ''}
      </form>
      <p class="leise editor-token-hinweis">${esc(t('editor_token_hinweis'))}
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">${esc(t('editor_token_anlegen'))}</a>
      </p>
    </section>`;
}

function auswahlHtml(shows) {
  const chips = shows
    .map((s) => `<button type="button" class="chip${entwurf?.originalId === s.id ? ' aktiv' : ''}" data-waehle="${esc(s.id)}">${esc(s.titel || s.id)}</button>`)
    .join('');
  return `
    <section class="abschnitt">
      <h2 class="abschnitt-titel">${esc(t('editor_auswahl_titel'))}</h2>
      <p class="chip-zeile">
        <button type="button" class="chip${entwurf?.originalId ? '' : ' aktiv'}" data-waehle="">
          <i class="fa-solid fa-plus" aria-hidden="true"></i> ${esc(t('editor_neu'))}
        </button>
        ${chips}
      </p>
    </section>`;
}

function formularHtml(voka) {
  const e = entwurf;
  const stile = (voka?.stil || [])
    .map((s) => `
      <label class="chip editor-stil${e.stil.includes(s) ? ' aktiv' : ''}">
        <input type="checkbox" data-stil="${esc(s)}" ${e.stil.includes(s) ? 'checked' : ''}> ${esc(label('stil', s))}
      </label>`)
    .join('');
  return `
    <section class="abschnitt">
      <h2 class="abschnitt-titel">${esc(t('editor_form_titel'))}</h2>
      <div class="editor-gitter">
        <div class="editor-feld">
          <label for="editor-datum">${esc(t('editor_feld_datum'))}</label>
          <input id="editor-datum" class="editor-eingabe" type="date" value="${esc(e.datum)}" data-feld>
        </div>
        <div class="editor-feld">
          <label for="editor-genauigkeit">${esc(t('editor_feld_genauigkeit'))}</label>
          <select id="editor-genauigkeit" class="editor-eingabe" data-feld>
            ${['tag', 'monat', 'jahr'].map((g) => `<option value="${g}"${e.genauigkeit === g ? ' selected' : ''}>${esc(t(`editor_genau_${g}`))}</option>`).join('')}
          </select>
        </div>
      </div>
      ${feld('editor-titel', 'editor_feld_titel', { wert: e.titel })}
      <div class="editor-gitter">
        ${feld('editor-kurzname', 'editor_feld_kurzname', { wert: e.kurzname, hinweis: 'editor_feld_kurzname_hinweis' })}
        <div class="editor-feld">
          <label for="editor-id">${esc(t('editor_feld_id'))}</label>
          <input id="editor-id" class="editor-eingabe" type="text" readonly value="">
          <p class="editor-feld-hinweis leise">${esc(t(e.originalId ? 'editor_feld_id_fest' : 'editor_feld_id_hinweis'))}</p>
        </div>
      </div>
      <div class="editor-gitter">
        ${feld('editor-ort', 'editor_feld_ort', { wert: e.ort })}
        ${feld('editor-veranstalter', 'editor_feld_veranstalter', { wert: e.veranstalter })}
      </div>
      ${feld('editor-bands', 'editor_feld_bands', { mehrzeilig: true, wert: e.bands, hinweis: 'editor_feld_bands_hinweis', zeilen: 3 })}
      <div class="editor-feld">
        <span class="editor-feld-titel">${esc(t('editor_feld_stil'))}</span>
        <p class="chip-zeile editor-stile">${stile}</p>
      </div>
      ${feld('editor-text', 'editor_feld_text', { mehrzeilig: true, wert: e.text, hinweis: 'editor_feld_text_hinweis', zeilen: 6 })}
      ${feld('editor-alt', 'editor_feld_alt', { mehrzeilig: true, wert: e.alt, hinweis: 'editor_feld_alt_hinweis', zeilen: 3 })}
      <div class="editor-gitter">
        ${feld('editor-gestaltung', 'editor_feld_gestaltung', { wert: e.gestaltung })}
        ${feld('editor-quelle', 'editor_feld_quelle', { wert: e.quelle })}
      </div>
    </section>

    <section class="abschnitt">
      <h2 class="abschnitt-titel">${esc(t('editor_bild_titel'))}</h2>
      <div class="editor-feld">
        <label for="editor-bild">${esc(t('editor_bild_waehlen'))}</label>
        <input id="editor-bild" class="editor-eingabe" type="file" accept="image/*">
        <p class="editor-feld-hinweis leise">${esc(t('editor_bild_hinweis'))}</p>
      </div>
      <p class="editor-bild-status" aria-live="polite"></p>
    </section>`;
}

function editorHtml(daten) {
  const shows = daten.shows?.shows || [];
  return `
    ${tokenHtml()}
    ${auswahlHtml(shows)}
    ${formularHtml(daten.vokabulare)}

    <section class="abschnitt">
      <h2 class="abschnitt-titel">${esc(t('editor_pruefung_titel'))}</h2>
      <ul class="editor-pruefung" aria-live="polite"></ul>
    </section>

    <section class="abschnitt">
      <h2 class="abschnitt-titel">${esc(t('editor_vorschau_titel'))}</h2>
      <p class="leise">${esc(t('editor_vorschau_kachel'))}</p>
      <div class="shows-gitter editor-vorschau-kachel"></div>
      <p class="leise">${esc(t('editor_vorschau_detail'))}</p>
      <div class="editor-vorschau-detail"></div>
    </section>

    <section class="abschnitt">
      <h2 class="abschnitt-titel">${esc(t('editor_aktionen_titel'))}</h2>
      <div class="knopf-zeile editor-aktionen">
        <button type="button" class="knopf knopf-primaer" data-speichern>
          <i class="fa-solid fa-upload" aria-hidden="true"></i> ${esc(t('editor_speichern'))}
        </button>
        <button type="button" class="knopf knopf-sekundaer" data-download>
          <i class="fa-solid fa-download" aria-hidden="true"></i> ${esc(t('editor_herunterladen'))}
        </button>
        ${entwurf?.originalId ? `<button type="button" class="knopf knopf-leise" data-loeschen>${esc(t('editor_loeschen'))}</button>` : ''}
      </div>
      <p class="leise">${esc(t('editor_zweig_hinweis', { zweig: ZWEIG }))}</p>
      <p class="editor-meldung" role="status" aria-live="polite"></p>
    </section>`;
}

// ---------------------------------------------------------------------------
// Verdrahtung

export function renderShowsEditor(el, daten) {
  el.innerHTML = `
    <article class="editor-seite">
      ${landingHeroHtml('fa-pen-nib', t('editor_titel'), t('editor_untertitel'), 'pf-schiefer', 'editor')}
      <p class="editor-warnung leise">${esc(t('editor_hinweis'))}</p>
      <div class="editor-inhalt"></div>
    </article>`;
  // Bei JEDEM Rendern registrieren, nicht beim Import: Der Router leert die
  // Aufraeum-Haken nach dem Ausfuehren, ein Modul-Haken liefe genau einmal.
  registriereAufraeumen(() => setzeBild(null));
  zeichne(el, daten);
}

function zeichne(el, daten) {
  const bereich = el.querySelector('.editor-inhalt');
  if (!bereich) return;
  if (!freigeschaltet) {
    bereich.innerHTML = schlossHtml();
    const feldPw = bereich.querySelector('#editor-pw');
    feldPw?.focus();
    bereich.querySelector('.editor-pw-form')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if ((feldPw?.value || '').trim().toLowerCase() !== PASSWORT) {
        bereich.querySelector('#editor-pw-fehler').textContent = t('intern_pw_falsch');
        feldPw?.select();
        return;
      }
      freigeschaltet = true;
      if (!entwurf) entwurf = leererEntwurf();
      zeichne(el, daten);
    });
    return;
  }

  if (!entwurf) entwurf = leererEntwurf();
  bereich.innerHTML = editorHtml(daten);
  bindeEreignisse(el, bereich, daten);
  aktualisiere(bereich, daten);
}

function leseFormular(bereich) {
  const v = (id) => bereich.querySelector(id)?.value ?? '';
  entwurf.datum = v('#editor-datum');
  entwurf.genauigkeit = v('#editor-genauigkeit') || 'tag';
  entwurf.titel = v('#editor-titel');
  entwurf.kurzname = v('#editor-kurzname');
  entwurf.ort = v('#editor-ort');
  entwurf.veranstalter = v('#editor-veranstalter');
  entwurf.bands = v('#editor-bands');
  entwurf.text = v('#editor-text');
  entwurf.alt = v('#editor-alt');
  entwurf.gestaltung = v('#editor-gestaltung');
  entwurf.quelle = v('#editor-quelle');
  entwurf.stil = [...bereich.querySelectorAll('[data-stil]')]
    .filter((k) => k.checked).map((k) => k.dataset.stil);
}

// Aktualisiert NUR die abgeleiteten Bereiche (ID, Prüfliste, Vorschau, Meldung).
// Das Formular selbst wird bewusst nicht neu gezeichnet: Es würde bei jedem
// Tastendruck den Fokus verlieren — derselbe Grund, aus dem das Profil-Auswahl-
// feld nicht neu rendert.
function aktualisiere(bereich, daten) {
  const voka = daten.vokabulare;
  const alle = daten.shows?.shows || [];
  const andere = alle.filter((s) => s.id !== entwurf.originalId);
  const eintrag = entwurfZuEintrag(entwurf, bild?.format || (alle.find((s) => s.id === entwurf.originalId)?.format));

  const idFeld = bereich.querySelector('#editor-id');
  if (idFeld) idFeld.value = eintrag.id;

  const punkte = pruefe(eintrag, andere, voka);
  const liste = bereich.querySelector('.editor-pruefung');
  if (liste) {
    liste.innerHTML = punkte.length
      ? punkte.map((p) => `<li class="editor-p editor-p-${p.art}"><span class="editor-p-marke">${p.art === 'fehler' ? '✗' : '!'}</span> ${esc(p.text)}</li>`).join('')
      : `<li class="editor-p editor-p-ok"><span class="editor-p-marke">✓</span> ${esc(t('editor_pruefung_ok'))}</li>`;
  }
  const blocker = punkte.some((p) => p.art === 'fehler');
  const speichern = bereich.querySelector('[data-speichern]');
  if (speichern) speichern.disabled = blocker;
  const download = bereich.querySelector('[data-download]');
  if (download) download.disabled = blocker;

  // Vorschau aus DENSELBEN Bauern wie die echte Seite (kachelHtml/detailHtml).
  // Eine nachgebaute Vorschau liefe garantiert irgendwann auseinander und
  // zeigte dann etwas, das die Seite gar nicht rendert.
  const kachelZiel = bereich.querySelector('.editor-vorschau-kachel');
  const detailZiel = bereich.querySelector('.editor-vorschau-detail');
  if (kachelZiel && detailZiel) {
    kachelZiel.innerHTML = kachelHtml(eintrag, 0);
    detailZiel.innerHTML = detailHtml(eintrag);
    // Das Bild liegt noch nicht im Repository — die Vorschau zeigt den frisch
    // gerechneten Blob. Ohne diesen Tausch liefe jede Vorschau in einen 404.
    if (bild?.url) {
      for (const img of [...kachelZiel.querySelectorAll('img'), ...detailZiel.querySelectorAll('img')]) {
        img.src = bild.url;
      }
    }
    bindeBildausfall(kachelZiel);
    bindeBildausfall(detailZiel);
  }

  const m = bereich.querySelector('.editor-meldung');
  if (m) {
    m.className = `editor-meldung${meldung ? ` editor-meldung-${meldung.art}` : ''}`;
    m.innerHTML = meldung
      ? `${esc(meldung.text)}${meldung.href ? ` <a href="${esc(meldung.href)}" target="_blank" rel="noopener noreferrer">${esc(t('editor_pr_oeffnen'))}</a>` : ''}`
      : '';
  }
}

function bindeEreignisse(el, bereich, daten) {
  const alle = daten.shows?.shows || [];

  bereich.addEventListener('input', (ev) => {
    if (!ev.target.closest('[data-feld], [data-stil]')) return;
    leseFormular(bereich);
    meldung = null;
    aktualisiere(bereich, daten);
  });
  bereich.addEventListener('change', (ev) => {
    if (!ev.target.matches('[data-stil], #editor-genauigkeit, #editor-datum')) return;
    leseFormular(bereich);
    ev.target.closest('.editor-stil')?.classList.toggle('aktiv', ev.target.checked);
    meldung = null;
    aktualisiere(bereich, daten);
  });

  // Show wählen: das Formular wird komplett neu gezeichnet — hier ist das
  // richtig, weil sich alle Werte auf einmal ändern.
  bereich.addEventListener('click', (ev) => {
    const knopf = ev.target.closest('[data-waehle]');
    if (!knopf) return;
    const id = knopf.dataset.waehle;
    const s = alle.find((x) => x.id === id);
    entwurf = leererEntwurf();
    if (s) {
      const teile = (s.datum || '').split('-');
      entwurf.originalId = s.id;
      entwurf.genauigkeit = teile.length === 3 ? 'tag' : teile.length === 2 ? 'monat' : 'jahr';
      // <input type="date"> braucht immer ein volles Datum; die Genauigkeit
      // schneidet beim Speichern wieder ab.
      entwurf.datum = [teile[0], teile[1] || '01', teile[2] || '01'].join('-');
      entwurf.titel = s.titel || '';
      entwurf.ort = s.ort || '';
      entwurf.veranstalter = s.veranstalter || '';
      entwurf.gestaltung = s.gestaltung || '';
      entwurf.quelle = s.quelle || '';
      entwurf.bands = (s.bands || []).join('\n');
      entwurf.stil = [...(s.stil || [])];
      entwurf.text = s.text || '';
      entwurf.alt = s.alt || '';
      entwurf.bildName = s.bild || '';
    }
    setzeBild(null);
    meldung = null;
    zeichne(el, daten);
  });

  bereich.querySelector('#editor-bild')?.addEventListener('change', async (ev) => {
    const datei = ev.target.files?.[0];
    const status = bereich.querySelector('.editor-bild-status');
    if (!datei) return;
    status.textContent = t('editor_bild_rechnet');
    try {
      const ergebnis = await verkleinere(datei);
      setzeBild({ ...ergebnis, url: URL.createObjectURL(ergebnis.blob) });
      status.textContent = t('editor_bild_fertig', {
        breite: bild.breite, hoehe: bild.hoehe,
        kb: Math.round(bild.bytes / 1024), format: bild.format,
      });
    } catch (fehler) {
      // Häufigster Fall: HEIC vom iPhone, das der Browser nicht dekodiert.
      setzeBild(null);
      status.textContent = t('editor_bild_fehler', { grund: fehler.message });
    }
    leseFormular(bereich);
    aktualisiere(bereich, daten);
  });

  bereich.querySelector('.editor-token-form')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    merkeToken(bereich.querySelector('#editor-token').value.trim());
    meldung = { art: 'ok', text: t('editor_token_gemerkt') };
    zeichne(el, daten);
  });
  bereich.querySelector('[data-token-weg]')?.addEventListener('click', () => {
    merkeToken('');
    meldung = { art: 'ok', text: t('editor_token_weg') };
    zeichne(el, daten);
  });

  bereich.querySelector('[data-speichern]')?.addEventListener('click', () => speichern(el, bereich, daten, false));
  bereich.querySelector('[data-loeschen]')?.addEventListener('click', () => {
    if (window.confirm(t('editor_loeschen_frage', { titel: entwurf.titel || entwurf.originalId }))) {
      speichern(el, bereich, daten, true);
    }
  });
  bereich.querySelector('[data-download]')?.addEventListener('click', () => herunterladen(bereich, daten));
}

// Objekt-URLs beim Ansichtswechsel freigeben — sonst hält jeder Versuch sein
// Bild bis zum Neuladen im Speicher.
function setzeBild(neu) {
  if (bild?.url) URL.revokeObjectURL(bild.url);
  bild = neu;
}

function dateiHerunterladen(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Erst nach dem Klick freigeben; sofortiges revoke bricht den Download ab.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Rückfallweg ohne Token: fertiges Bild und fertige shows.json zum Ablegen auf
// github.com. Nimmt bewusst den LOKAL geladenen Stand als Grundlage — ohne
// Token kann der Editor den Server nicht fragen, und der Mensch sieht den Diff
// auf GitHub ohnehin, bevor er committet.
function herunterladen(bereich, daten) {
  leseFormular(bereich);
  const alle = daten.shows?.shows || [];
  const eintrag = entwurfZuEintrag(entwurf, bild?.format || alle.find((s) => s.id === entwurf.originalId)?.format);
  const datei = { ...(daten.shows || {}) };
  delete datei.shows;
  const liste = alle.filter((s) => s.id !== eintrag.id).concat([eintrag]);
  const inhalt = `${JSON.stringify({ ...datei, shows: liste }, null, 2)}\n`;
  if (bild) dateiHerunterladen(bild.blob, eintrag.bild);
  dateiHerunterladen(new Blob([inhalt], { type: 'application/json' }), 'shows.json');
  meldung = { art: 'ok', text: t('editor_download_fertig') };
  aktualisiere(bereich, daten);
}

async function speichern(el, bereich, daten, loeschen) {
  leseFormular(bereich);
  const token = holeToken();
  if (!token) {
    meldung = { art: 'fehler', text: t('editor_token_fehlt') };
    aktualisiere(bereich, daten);
    return;
  }
  const knopf = bereich.querySelector('[data-speichern]');
  if (knopf) knopf.disabled = true;
  meldung = { art: 'ok', text: t('editor_speichert') };
  aktualisiere(bereich, daten);

  try {
    const client = githubClient({ token, owner: OWNER, repo: REPO });
    // Aktuellen Stand holen — vom Arbeitszweig, wenn er der Basis voraus ist.
    const status = await client.vergleiche(BASIS, ZWEIG);
    const quelle = status === 'ahead' ? ZWEIG : BASIS;
    const roh = await client.holeDatei(DATEI, quelle);
    if (!roh) throw new Error(`${DATEI} auf "${quelle}" nicht gefunden`);
    const datei = JSON.parse(roh);
    const vorher = Array.isArray(datei.shows) ? datei.shows : [];

    const alle = daten.shows?.shows || [];
    const eintrag = entwurfZuEintrag(entwurf, bild?.format || alle.find((s) => s.id === entwurf.originalId)?.format);
    const dateien = [];
    let nachricht;

    if (loeschen) {
      const weg = vorher.find((s) => s.id === entwurf.originalId);
      datei.shows = vorher.filter((s) => s.id !== entwurf.originalId);
      if (weg?.bild) dateien.push({ pfad: BILDORDNER + weg.bild, loeschen: true });
      nachricht = `Show "${weg?.titel || entwurf.originalId}" entfernt`;
    } else {
      // Ersetzen statt anhängen, damit ein zweites Speichern desselben Eintrags
      // keine Dublette erzeugt. Die Anzeige sortiert ohnehin nach `datum`.
      const ohne = vorher.filter((s) => s.id !== eintrag.id && s.id !== entwurf.originalId);
      datei.shows = [...ohne, eintrag];
      if (bild) dateien.push({ pfad: BILDORDNER + eintrag.bild, base64: await blobZuBase64(bild.blob) });
      nachricht = `Show "${eintrag.titel}" ${entwurf.originalId ? 'aktualisiert' : 'ergaenzt'}`;
    }
    dateien.push({ pfad: DATEI, inhalt: `${JSON.stringify(datei, null, 2)}\n` });

    const ergebnis = await client.commit({ zweig: ZWEIG, basis: BASIS, dateien, nachricht });
    meldung = {
      art: 'ok',
      text: t(ergebnis.weitergebaut ? 'editor_gespeichert_weiter' : 'editor_gespeichert', { zweig: ZWEIG }),
      href: `https://github.com/${OWNER}/${REPO}/compare/${BASIS}...${ZWEIG}?expand=1`,
    };
    setzeBild(null);
    entwurf = leererEntwurf();
    zeichne(el, daten);
  } catch (fehler) {
    meldung = { art: 'fehler', text: t('editor_fehler', { grund: fehler.message }) };
    if (knopf) knopf.disabled = false;
    aktualisiere(bereich, daten);
  }
}

