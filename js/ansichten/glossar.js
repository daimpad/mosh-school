// Szene-Glossar (Kontext-Praxis): Kurzsprache aus der Praxis als durchsuchbare,
// nach Kategorie filterbare Referenz. Jeder Begriff verweist optional auf einen
// vertiefenden Baustein. Referenzbereich wie Songs/Patterns — NICHT im
// Baustein-Pool, kein Fortschritt.
//
// Filter-/Suchzustand ist flüchtiger Modul-State (wie patterns.js): überlebt ein
// Neu-Rendern, aber keinen Reload.

import { label, t } from '../i18n.js';
import { bausteinIcon, esc } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

const INTRO_BAUSTEIN = 'szene_sprache';

let sucheText = '';
let aktiveKategorie = null; // null = alle

function normalisiere(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function bausteinDa(daten, id) {
  return !!id && (daten.bausteinVonId?.has?.(id) ?? daten.bausteine?.some((b) => b.id === id));
}

// Ein Begriff passt, wenn Kategorie und (falls gesetzt) Suchtext greifen.
function passt(e) {
  if (aktiveKategorie && e.kategorie !== aktiveKategorie) return false;
  if (!sucheText) return true;
  const q = normalisiere(sucheText);
  return normalisiere(e.begriff).includes(q) || normalisiere(e.erklaerung).includes(q);
}

function eintragHtml(daten, e) {
  const bezug =
    bausteinDa(daten, e.bezug)
      ? `<a class="glossar-bezug" href="#/baustein/${esc(e.bezug)}?kontext=kompetenz">${esc(t('glossar_vertiefen'))}: ${esc(label('baustein', e.bezug))}</a>`
      : '';
  return `
    <li class="glossar-eintrag">
      <dt class="glossar-begriff">${esc(e.begriff)}</dt>
      <dd class="glossar-erklaerung">${esc(e.erklaerung)}${bezug}</dd>
    </li>`;
}

// Nach Kategorie gruppierte, gefilterte Liste (deklarierte Kategorie-Reihenfolge).
function listeHtml(daten) {
  const alle = daten.glossar?.begriffe || [];
  const reihenfolge = [...(daten.glossar?.kategorien || [])];
  for (const e of alle) if (!reihenfolge.includes(e.kategorie)) reihenfolge.push(e.kategorie);
  const gruppen = reihenfolge
    .map((k) => [k, alle.filter((e) => e.kategorie === k && passt(e))])
    .filter(([, es]) => es.length > 0);
  if (gruppen.length === 0) return `<p class="leise glossar-leer">${esc(t('glossar_keine_treffer'))}</p>`;
  return gruppen
    .map(
      ([k, es]) => `<section class="glossar-gruppe" aria-label="${esc(k)}">
        <h2 class="glossar-kat-titel">${esc(k)}</h2>
        <dl class="glossar-liste">${es.map((e) => eintragHtml(daten, e)).join('')}</dl>
      </section>`,
    )
    .join('');
}

function kategorieChips(daten) {
  const kats = daten.glossar?.kategorien || [];
  const chip = (wert, text, aktiv) =>
    `<button type="button" class="chip glossar-kat-chip${aktiv ? ' aktiv' : ''}" data-kat="${esc(wert)}"${aktiv ? ' aria-current="true"' : ''}>${esc(text)}</button>`;
  return [chip('', t('glossar_alle'), !aktiveKategorie)]
    .concat(kats.map((k) => chip(k, k, aktiveKategorie === k)))
    .join('');
}

export function renderGlossar(el, daten) {
  const g = daten.glossar || {};
  if (!(g.begriffe || []).length) {
    el.innerHTML = `<article><p class="leise">${esc(t('glossar_leer'))}</p></article>`;
    return;
  }
  const introDa = bausteinDa(daten, INTRO_BAUSTEIN);
  const introHtml = introDa
    ? `<a class="karte karte-link geraete-eintrag glossar-intro" href="#/baustein/${esc(INTRO_BAUSTEIN)}?kontext=kompetenz">
        <span class="geraete-eintrag-icon">${bausteinIcon(INTRO_BAUSTEIN) || '<i class="fa-solid fa-comment" aria-hidden="true"></i>'}</span>
        <span class="geraete-eintrag-text">${esc(label('baustein', INTRO_BAUSTEIN))}</span>
        <i class="fa-solid fa-arrow-right geraete-eintrag-pfeil" aria-hidden="true"></i>
      </a>`
    : '';

  el.innerHTML = `
    <article class="glossar-seite">
      ${landingHeroHtml('fa-book', t('glossar_titel'), t('glossar_untertitel'), 'pf-sky')}
      ${g.hinweis ? `<p class="glossar-hinweis leise">${esc(g.hinweis)}</p>` : ''}
      ${introHtml}
      <div class="glossar-steuerung">
        <label class="glossar-suche-label">
          <span class="nur-sr">${esc(t('glossar_suche'))}</span>
          <input type="search" class="glossar-suche" placeholder="${esc(t('glossar_suche'))}" value="${esc(sucheText)}" aria-label="${esc(t('glossar_suche'))}">
        </label>
        <div class="glossar-kats" role="group" aria-label="${esc(t('glossar_kategorie'))}">${kategorieChips(daten)}</div>
      </div>
      <div class="glossar-treffer" aria-live="polite">${listeHtml(daten)}</div>
    </article>`;

  const treffer = el.querySelector('.glossar-treffer');
  const suche = el.querySelector('.glossar-suche');
  if (suche) {
    suche.addEventListener('input', () => {
      sucheText = suche.value;
      if (treffer) treffer.innerHTML = listeHtml(daten);
    });
  }
  for (const btn of el.querySelectorAll('.glossar-kat-chip')) {
    btn.addEventListener('click', () => {
      aktiveKategorie = btn.dataset.kat || null;
      for (const b2 of el.querySelectorAll('.glossar-kat-chip')) {
        const an = (b2.dataset.kat || '') === (aktiveKategorie || '');
        b2.classList.toggle('aktiv', an);
        if (an) b2.setAttribute('aria-current', 'true');
        else b2.removeAttribute('aria-current');
      }
      if (treffer) treffer.innerHTML = listeHtml(daten);
    });
  }
}
