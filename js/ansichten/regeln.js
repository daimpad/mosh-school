// Regeln-Reiter (Referenz): die offiziellen Crossminton-Spielregeln, akkurat
// wiedergegeben (inhalt) und in Du-Form gedeutet (erklaerung). Eigener statischer
// Bereich — KEIN Lerninhalt: keine Voraussetzungen, keine Deltas, kein Fortschritt,
// keine Gamification. Abschnitte sind auf-/zuklappbar (natives <details>); die
// optionalen querverweis-IDs sind reine Absprünge ins Handbuch (Dokumentation,
// kein Graph, kein Pflicht-Link) — nicht auflösbare IDs werden still ausgelassen.

import { label, t, text } from '../i18n.js';
import { esc, externesZiel, heroKlein } from '../oberflaeche.js';

// Quellenangabe sichtbar im Reiter (Herausgeber + Stand): die Regeln sind strikt
// aus der offiziellen Quelle, das gehört benannt.
function quelleHtml(quelle) {
  if (!quelle || !quelle.herausgeber) return '';
  const teile = [quelle.titel, quelle.herausgeber, quelle.verband_de].filter(Boolean).join(' · ');
  const stand = quelle.stand ? ` · ${t('regeln_stand')}: ${quelle.stand}` : '';
  const link = externesZiel(quelle.link)
    ? `<a class="regeln-quelle-link" href="${esc(quelle.link)}" target="_blank" rel="noopener noreferrer">${esc(t('regeln_quelle_link'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>`
    : '';
  return `
    <p class="regeln-quelle leise">
      <i class="fa-solid fa-book-open" aria-hidden="true"></i>
      ${esc(t('regeln_quelle'))}: ${esc(teile)}${esc(stand)}
    </p>
    ${link ? `<p class="regeln-quelle leise">${link}</p>` : ''}`;
}

// Absprünge zu passenden Lernbausteinen. Nur auflösbare IDs werden verlinkt —
// ein toter Verweis erscheint gar nicht (die Regel bleibt vollständig lesbar).
function querverweisHtml(daten, ids) {
  const links = (ids || [])
    .filter((id) => daten.bausteinVonId.has(id))
    .map(
      (id) =>
        `<a class="regel-verweis" href="#/baustein/${esc(id)}?kontext=kompetenz">${esc(label('baustein', id))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>`,
    );
  if (links.length === 0) return '';
  return `<p class="regel-verweise"><span class="regel-verweise-titel">${esc(t('regeln_querverweis'))}:</span> ${links.join(' ')}</p>`;
}

function regelHtml(daten, regel) {
  const nummer = regel.nummer ? `<span class="regel-nummer">${esc(regel.nummer)}</span>` : '';
  const erklaerung = text(regel.erklaerung);
  return `
    <article class="regel-karte">
      <h3 class="regel-titel">${nummer}${esc(text(regel.titel) ?? '')}</h3>
      <div class="regel-feld">
        <h4>${esc(t('regel_label'))}</h4>
        <p>${esc(text(regel.inhalt) ?? '')}</p>
      </div>
      ${
        erklaerung
          ? `<div class="regel-feld regel-erklaerung">
        <h4><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ${esc(t('regel_bedeutung'))}</h4>
        <p>${esc(erklaerung)}</p>
      </div>`
          : ''
      }
      ${querverweisHtml(daten, regel.querverweis)}
    </article>`;
}

// Ein Abschnitt = ein aufklappbares <details>. Der erste steht offen, damit der
// Reiter nicht leer wirkt; die übrigen sind eingeklappt.
function abschnittHtml(daten, abschnitt, offen) {
  const einleitung = text(abschnitt.einleitung);
  const regeln = (abschnitt.regeln || []).map((r) => regelHtml(daten, r)).join('');
  return `
    <details class="regel-abschnitt karte"${offen ? ' open' : ''}>
      <summary><h2>${esc(text(abschnitt.titel) ?? '')}</h2></summary>
      ${einleitung ? `<p class="leise regel-einleitung">${esc(einleitung)}</p>` : ''}
      ${regeln}
    </details>`;
}

// Zwei Referenzgrafiken (bemaßtes Spielfeld, Schiedsrichter-Handzeichen) — keine
// Lernbausteine, sondern Nachschlage-Bilder des Reiters (G-060/G-061, siehe
// images/grafik-prompts.md). Eingeklappt, damit sie den Regeltext nicht verdrängen.
function referenzgrafikenHtml() {
  const bilder = ['G-060', 'G-061']
    .map(
      (id) => `
      <figure class="grafik-platzhalter">
        <img class="grafik-bild" src="images/${esc(id)}.png" alt="${esc(label('grafik', id))}" loading="lazy" />
        <figcaption class="leise">${esc(label('grafik', id))}</figcaption>
      </figure>`,
    )
    .join('');
  return `
    <details class="regel-abschnitt karte">
      <summary><h2>${esc(t('regeln_grafiken'))}</h2></summary>
      ${bilder}
    </details>`;
}

export function renderRegeln(el, daten) {
  const regeln = daten.regeln || { meta: {}, abschnitte: [] };
  const abschnitte = regeln.abschnitte.map((abschnitt, i) => abschnittHtml(daten, abschnitt, i === 0)).join('');
  el.innerHTML = `
    ${heroKlein('fa-book-open', t('regeln_titel'), t('regeln_intro'), 'pf-schiefer')}
    <a class="karte karte-link karte-akzent" href="#/turnier">
      <h3><i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> ${esc(t('turnier_titel'))}</h3>
      <p class="leise">${esc(t('turnier_kachel_text'))}</p>
    </a>
    ${quelleHtml(regeln.meta.quelle)}
    ${abschnitte || `<div class="karte"><p class="leise">${esc(t('nicht_gefunden'))}</p></div>`}
    ${referenzgrafikenHtml()}`;
}
