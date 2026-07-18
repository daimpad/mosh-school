// Volltext-Suche über die Lernbausteine. Ein Suchfeld + live gefilterte
// Trefferliste (nur der Ergebnis-Bereich wird bei Eingabe neu gezeichnet, damit
// der Fokus im Feld bleibt). Ohne/zu kurzer Anfrage steht ein aktiver Einstieg
// (Themen-Vorschläge) statt einer leeren Fläche; ohne Treffer ein Ausweg-CTA.
// Die Suchlogik liegt DOM-frei in js/suche.js (testbar); hier nur Darstellung.

import { domaenenVon, spielformVon } from '../daten.js';
import { label, t } from '../i18n.js';
import { bausteinIcon, esc, heroKlein, leerHtml } from '../oberflaeche.js';
import { themenDomaenen } from '../pfade.js';
import { sucheBausteine } from '../suche.js';

// Anfrage überlebt ein Neu-Rendern (wie der Turnier-Reiter): Modul-State, kein
// Zustand, keine URL — die Suche ist flüchtig und gerätelokal.
let letzteAnfrage = '';

const DOMAENE_HUE = {
  technik: 'pf-blau',
  taktik: 'pf-indigo',
  mentales: 'pf-violett',
  athletik_kondition: 'pf-teal',
  ausruestung: 'pf-schiefer',
  trainingsgestaltung: 'pf-magenta',
};

// In-Kontext-Rückweg passend zum Baustein: Outdoor bleibt in der Umgebungs-Achse,
// Doppel in der Spielform-Achse, sonst der Kompetenzpfad (Deep-Link-tauglich).
function kontextFuer(baustein) {
  if (baustein.typ === 'umgebungs_baustein') return 'umgebung';
  if (spielformVon(baustein) === 'doppel') return 'spielform:doppel';
  return 'kompetenz';
}

// Treffer-Terme im (escapten) Ausschnitt markieren. Ein kombinierter Ausdruck
// in einem Durchgang — so entstehen keine verschachtelten <mark> bei Überlappung.
function hervorheben(roh, terme) {
  const html = esc(roh);
  const sichere = terme
    .filter((term) => term.length >= 2)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (sichere.length === 0) return html;
  return html.replace(new RegExp(`(${sichere.join('|')})`, 'gi'), '<mark>$1</mark>');
}

function metaZeile(baustein) {
  return [
    ...domaenenVon(baustein).map((d) => label('domaene', d)),
    ...(baustein.kompetenzstufe || []).map((s) => label('kompetenzstufe', s)),
  ].join(' · ');
}

function trefferKarte(treffer, terme) {
  const b = treffer.baustein;
  const hue = DOMAENE_HUE[domaenenVon(b)[0]] || 'pf-blau';
  const kontext = kontextFuer(b);
  return `
    <a class="karte karte-link such-treffer ${hue}" href="#/baustein/${esc(b.id)}?kontext=${encodeURIComponent(kontext)}">
      <span class="such-medaille">${bausteinIcon(b.id) || '<i class="fa-solid fa-feather" aria-hidden="true"></i>'}</span>
      <div class="such-treffer-text">
        <h3>${esc(label('baustein', b.id))}</h3>
        <p class="leise such-meta">${esc(metaZeile(b))}</p>
        ${treffer.ausschnitt ? `<p class="such-ausschnitt">${hervorheben(treffer.ausschnitt, terme)}</p>` : ''}
      </div>
    </a>`;
}

// Aktiver Einstieg statt leerer Fläche: kurze Anregung + Themen-Facetten als
// Sprungmarken (nur belegte Domänen, wie auf der Themen-Übersicht).
function startVorschlaege(daten) {
  const facetten = themenDomaenen(daten)
    .filter((eintrag) => eintrag.anzahl > 0)
    .map(
      (eintrag) =>
        `<a class="such-vorschlag" href="#/pfad/themen/${esc(eintrag.domaene)}">${esc(label('domaene', eintrag.domaene))}</a>`,
    )
    .join(' ');
  return `
    <div class="karte such-start">
      <p class="leise">${esc(t('suche_start'))}</p>
      ${facetten ? `<p class="such-vorschlaege">${facetten}</p>` : ''}
    </div>`;
}

function ergebnisseHtml(daten, anfrage) {
  const roh = anfrage.trim();
  if (roh.length < 2) return startVorschlaege(daten);
  const treffer = sucheBausteine(daten, roh, (id) => label('baustein', id));
  if (treffer.length === 0) {
    const aktion = `<a class="knopf knopf-primaer" href="#/pfad/themen">${esc(t('kapitel_entdecken'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>`;
    return leerHtml(t('suche_keine_treffer', { q: roh }), 'fa-magnifying-glass', aktion);
  }
  const terme = roh.split(/\s+/).filter(Boolean);
  const kopf = `<p class="such-anzahl leise" role="status">${esc(t('suche_treffer', { n: treffer.length }))}</p>`;
  return kopf + `<div class="such-liste">${treffer.map((tr) => trefferKarte(tr, terme)).join('')}</div>`;
}

export function renderSuche(el, daten) {
  el.innerHTML = `
    ${heroKlein('fa-magnifying-glass', t('suche_titel'), t('suche_intro'), 'pf-blau')}
    <form class="such-form" id="such-form" role="search">
      <label class="nur-sr" for="such-feld">${esc(t('suche_feld_label'))}</label>
      <div class="such-feld-zeile">
        <i class="fa-solid fa-magnifying-glass such-feld-icon" aria-hidden="true"></i>
        <input type="search" id="such-feld" class="such-feld" name="q" value="${esc(letzteAnfrage)}"
          placeholder="${esc(t('suche_platzhalter'))}" autocomplete="off" enterkeyhint="search"
          spellcheck="false" aria-controls="such-ergebnisse">
      </div>
    </form>
    <div id="such-ergebnisse" aria-live="polite">${ergebnisseHtml(daten, letzteAnfrage)}</div>`;

  const feld = el.querySelector('#such-feld');
  const ziel = el.querySelector('#such-ergebnisse');
  // Live-Filterung: nur den Ergebnis-Bereich neu zeichnen — das Feld behält Fokus/Cursor.
  feld.addEventListener('input', () => {
    letzteAnfrage = feld.value;
    ziel.innerHTML = ergebnisseHtml(daten, letzteAnfrage);
  });
  el.querySelector('#such-form').addEventListener('submit', (ereignis) => ereignis.preventDefault());
  // Fokus ans Suchfeld — erst im nächsten Frame, da der Router direkt nach dem
  // Rendern #ansicht fokussiert (Routen-Ansage) und den Fokus sonst gleich wieder
  // wegnähme. Cursor ans Ende, ohne die Seite zu scrollen.
  requestAnimationFrame(() => {
    feld.focus({ preventScroll: true });
    const laenge = feld.value.length;
    feld.setSelectionRange(laenge, laenge);
  });
}
