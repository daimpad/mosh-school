// Volltext-Suche + Facetten über den vorgebauten Index (Trainings-Loop §3c).
// Durchsucht Bausteine UND Fehlerbilder (daten.suchindex) über den vollen,
// ungekürzten Inhalt und filtert über Domäne/Stufe/Genre/Spielziel/Typ. Jede
// Trefferkarte zeigt den selbst markierten Mastery-Status (Store) und verlinkt
// zum Baustein (Fehlerbilder auf ihren Basisbaustein).
//
// Nur der Ergebnis-/Filterbereich wird bei Eingabe neu gezeichnet, damit der
// Fokus im Suchfeld bleibt. Anfrage + Filter sind flüchtiger Modul-State
// (gerätelokal, keine URL) — wie die frühere Suche.

import { domaenenVon } from '../daten.js';
import { label, t } from '../i18n.js';
import { bausteinIcon, esc, leerHtml } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';
import {
  FACETTEN,
  ausschnitt,
  bausteinText,
  facettenZaehlung,
  normalisiere,
  normalisiereIndex,
  sucheIndex,
} from '../suche.js';
import { bausteinStatus } from '../zustand.js';

let letzteAnfrage = '';
const filter = { domaene: new Set(), kompetenzstufe: new Set(), stil: new Set(), spielziel: new Set(), typ: new Set() };

const DOMAENE_HUE = {
  gitarre: 'pf-magenta', bass: 'pf-schiefer', schlagzeug: 'pf-indigo', gesang: 'pf-violett',
  theorie: 'pf-blau', koerper: 'pf-sky', ausruestung: 'pf-teal', mentales: 'pf-blau',
};

// Nicht-farbliches Statussignal (Form + Text): ○ neu · ◐ in Arbeit · ● sitzt.
const STATUS_ZEICHEN = { neu: '○', in_arbeit: '◐', sitzt: '●' };

// Sichtbares Label je Facettenwert (Dimension bestimmt den Label-Namensraum).
function facetLabel(facette, wert) {
  if (facette === 'domaene') return label('domaene', wert);
  if (facette === 'kompetenzstufe') return label('kompetenzstufe', wert);
  if (facette === 'stil') return label('stil', wert);
  if (facette === 'spielziel') return label('spielziel_faktor', wert);
  return t('such_typ_' + wert); // typ: uebung|reflexion|fehlerbild
}

function anzahlAktiveFilter() {
  return FACETTEN.reduce((s, f) => s + filter[f].size, 0);
}

// Snippet aus dem LEBENDEN Inhalt (nicht aus dem Token-Index): lesbar, mit Term-
// Ausschnitt. Baustein -> voller Lerntext, Fehlerbild -> Symptom/Ursache/Korrektur.
function snippetFuer(daten, eintrag, term) {
  if (eintrag.typ === 'fehlerbild') {
    const fb = daten.fehlerbilder.find((f) => f.id === eintrag.id);
    const inhalt = (fb?.erklaerteil?.de) || {};
    const roh = [inhalt.symptom, inhalt.ursache, inhalt.korrektur].filter(Boolean).join(' — ');
    return ausschnitt(roh, term);
  }
  const b = daten.bausteinVonId.get(eintrag.id);
  return b ? ausschnitt(bausteinText(b), term) : '';
}

function hervorheben(roh, terme) {
  const sichere = terme.filter((x) => x.length >= 2).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (sichere.length === 0) return esc(roh);
  return roh
    .split(new RegExp(`(${sichere.join('|')})`, 'gi'))
    .map((teil, i) => (i % 2 === 1 ? `<mark>${esc(teil)}</mark>` : esc(teil)))
    .join('');
}

function statusPill(eintrag) {
  if (eintrag.typ === 'fehlerbild') return ''; // Fehlerbilder tragen keinen Mastery-Status
  const zustand = bausteinStatus(eintrag.id);
  return `<span class="such-status status-${zustand}" title="${esc(t('such_status_' + zustand))}">
      <span aria-hidden="true">${STATUS_ZEICHEN[zustand]}</span>
      <span class="nur-sr">${esc(t('such_status_' + zustand))}</span>
    </span>`;
}

function trefferZiel(eintrag) {
  // Fehlerbilder haben keine eigene Route — Sprung auf den Basisbaustein.
  const id = eintrag.typ === 'fehlerbild' ? (eintrag.basis_baustein || eintrag.id) : eintrag.id;
  return `#/baustein/${esc(id)}?kontext=kompetenz`;
}

function metaZeile(eintrag) {
  const teile = [
    ...(eintrag.domaene || []).map((d) => label('domaene', d)),
    ...(eintrag.kompetenzstufe || []).filter((s) => s !== 'trainer').map((s) => label('kompetenzstufe', s)),
    t('such_typ_' + eintrag.typ),
  ];
  return teile.filter(Boolean).join(' · ');
}

function trefferKarte(daten, eintrag, terme) {
  const titel = eintrag.typ === 'fehlerbild' ? label('fehlerbild', eintrag.id) : label('baustein', eintrag.id);
  const hue = DOMAENE_HUE[(eintrag.domaene || [])[0]] || 'pf-blau';
  const snippet = snippetFuer(daten, eintrag, terme[0]);
  return `
    <a class="karte karte-link such-treffer ${hue}" href="${trefferZiel(eintrag)}">
      <span class="such-medaille">${bausteinIcon(eintrag.id) || '<i class="fa-solid fa-feather" aria-hidden="true"></i>'}</span>
      <div class="such-treffer-text">
        <h3>${esc(titel)} ${statusPill(eintrag)}</h3>
        <p class="leise such-meta">${esc(metaZeile(eintrag))}</p>
        ${snippet ? `<p class="such-ausschnitt">${hervorheben(snippet, terme)}</p>` : ''}
      </div>
    </a>`;
}

// Filter-Chips je Dimension, nur Werte mit Treffern in der aktuellen Menge; die
// gewählten bleiben immer sichtbar (auch bei 0, damit man sie wieder lösen kann).
function facettenHtml(zaehlung) {
  const gruppen = FACETTEN.map((facette) => {
    const werte = [...zaehlung[facette].entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
    const gewaehlt = filter[facette];
    const sichtbar = werte.filter(([wert]) => zaehlung[facette].get(wert) > 0 || gewaehlt.has(wert));
    if (sichtbar.length === 0) return '';
    const chips = sichtbar
      .map(([wert, n]) => {
        const aktiv = gewaehlt.has(wert);
        return `<button type="button" class="chip such-facette-chip${aktiv ? ' aktiv' : ''}"
            data-facette="${esc(facette)}" data-wert="${esc(wert)}" aria-pressed="${aktiv}">
            ${esc(facetLabel(facette, wert))} <span class="such-facette-zahl">${n}</span>
          </button>`;
      })
      .join('');
    return `<div class="such-facette-gruppe">
        <span class="such-facette-titel">${esc(t('such_facette_' + facette))}</span>
        <div class="such-facette-chips">${chips}</div>
      </div>`;
  }).join('');
  const aktive = anzahlAktiveFilter();
  const reset = aktive > 0
    ? `<button type="button" class="knopf knopf-leise such-filter-reset" id="such-filter-reset">${esc(t('such_filter_zuruecksetzen'))} (${aktive})</button>`
    : '';
  return `<div class="such-filter">${gruppen}${reset}</div>`;
}

function startVorschlaege() {
  return `<div class="karte such-start"><p class="leise">${esc(t('suche_start'))}</p></div>`;
}

function ergebnisseHtml(daten) {
  const roh = letzteAnfrage.trim();
  const treffer = sucheIndex(daten.suchindex, roh, filter);
  const zaehlung = facettenZaehlung(treffer.map((tr) => tr.eintrag));
  // Gewählte Facettenwerte immer sichtbar halten (auch bei 0 Treffern) — sonst
  // verschwinden bei einer Filterkombination ohne Ergebnis alle Chips und die
  // Auswahl lässt sich nur noch global zurücksetzen, nicht einzeln abwählen.
  for (const facette of FACETTEN) {
    for (const wert of filter[facette]) {
      if (!zaehlung[facette].has(wert)) zaehlung[facette].set(wert, 0);
    }
  }
  const filterUi = facettenHtml(zaehlung);

  if (roh.length < 2 && anzahlAktiveFilter() === 0) {
    return filterUi + startVorschlaege();
  }
  if (treffer.length === 0) {
    const aktion = `<a class="knopf knopf-primaer" href="#/pfad/themen">${esc(t('kapitel_entdecken'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>`;
    return filterUi + leerHtml(t('suche_keine_treffer', { q: roh || '…' }), 'fa-magnifying-glass', aktion);
  }
  const terme = normalisiere(roh).split(/\s+/).filter(Boolean);
  const kopf = `<p class="such-anzahl leise" role="status">${esc(t('suche_treffer', { n: treffer.length }))}</p>`;
  const karten = treffer.map((tr) => trefferKarte(daten, tr.eintrag, terme)).join('');
  return filterUi + kopf + `<div class="such-liste">${karten}</div>`;
}

export function renderSuche(el, daten) {
  normalisiereIndex(daten.suchindex);

  const zeichneErgebnisse = (ziel) => {
    ziel.innerHTML = ergebnisseHtml(daten);
    // Facetten-Chips (neu gezeichnet) verdrahten.
    for (const chip of ziel.querySelectorAll('.such-facette-chip')) {
      chip.addEventListener('click', () => {
        const { facette, wert } = chip.dataset;
        filter[facette].has(wert) ? filter[facette].delete(wert) : filter[facette].add(wert);
        zeichneErgebnisse(ziel);
      });
    }
    ziel.querySelector('#such-filter-reset')?.addEventListener('click', () => {
      for (const f of FACETTEN) filter[f].clear();
      zeichneErgebnisse(ziel);
    });
  };

  el.innerHTML = `
    ${landingHeroHtml('fa-magnifying-glass', t('suche_titel'), t('suche_intro'), 'pf-blau')}
    <form class="such-form" id="such-form" role="search">
      <label class="nur-sr" for="such-feld">${esc(t('suche_feld_label'))}</label>
      <div class="such-feld-zeile">
        <i class="fa-solid fa-magnifying-glass such-feld-icon" aria-hidden="true"></i>
        <input type="search" id="such-feld" class="such-feld" name="q" value="${esc(letzteAnfrage)}"
          placeholder="${esc(t('suche_platzhalter'))}" autocomplete="off" enterkeyhint="search"
          spellcheck="false" aria-controls="such-ergebnisse">
      </div>
    </form>
    <div id="such-ergebnisse" aria-live="polite"></div>`;

  const feld = el.querySelector('#such-feld');
  const ziel = el.querySelector('#such-ergebnisse');
  zeichneErgebnisse(ziel);

  feld.addEventListener('input', () => {
    letzteAnfrage = feld.value;
    zeichneErgebnisse(ziel);
  });
  el.querySelector('#such-form').addEventListener('submit', (e) => e.preventDefault());
  requestAnimationFrame(() => {
    feld.focus({ preventScroll: true });
    const laenge = feld.value.length;
    feld.setSelectionRange(laenge, laenge);
  });
}
