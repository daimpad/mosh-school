// Experimentieren-Bereich: Impuls-Karten (data/experimente.json) + die drei
// Haltungs-Bausteine + die Grenzgänger-Werkzeuge (Gefühlslandkarte, Genre-Mix).
// Referenzbereich — KEIN Fortschritt. „Ausprobiert" ist rein informativ: kein
// Zähler, keine Vollständigkeitsanzeige (§5 Trainings-Loop, gesunde Gamification).
// Der Ausprobiert-Merker lebt im Werkzeug-Speicher (eigener Namespace), die
// Zieh-/Filter-Auswahl ist flüchtiger Modul-State.

import { label, t } from '../i18n.js';
import { bausteinIcon, esc } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';
import { holeWerkzeugDaten, setzeWerkzeugDaten } from '../werkzeug-speicher.js';

// Werkzeug-Alias der Karten → tatsächliche Route (#/werkzeug/<name>).
const WERKZEUG_ROUTE = {
  gefuehlslandkarte: 'landkarte',
  genre_mix: 'genremix',
  klick: 'metronom',
  pedalboard: 'pedalboard',
  play_along: 'loops',
  riff_recorder: 'recorder',
  skizzen_recorder: 'mehrspur',
  song_struktur: 'struktur',
};

// Flüchtiger Modul-State (überlebt Neu-Rendern, nicht Reload).
let filterKat = null; // null = alle
let filterAufwand = null; // null = alle
let gezogeneId = null;

function ausprobierteMenge() {
  const d = holeWerkzeugDaten('experimente', { ausprobiert: [] });
  return new Set(d.ausprobiert || []);
}
function setzeAusprobiert(menge) {
  setzeWerkzeugDaten('experimente', { ausprobiert: [...menge] });
}

function passt(karte) {
  return (!filterKat || karte.kategorie === filterKat) && (!filterAufwand || karte.aufwand === filterAufwand);
}

// Zufällige Karte aus der gefilterten Menge, möglichst nicht dieselbe wie zuletzt.
function zieheKarte(karten) {
  const menge = karten.filter(passt);
  if (menge.length === 0) return null;
  if (menge.length === 1) return menge[0];
  let k;
  do {
    k = menge[Math.floor(Math.random() * menge.length)];
  } while (k.id === gezogeneId);
  return k;
}

function aufwandChip(wert) {
  return `<span class="chip exp-aufwand exp-aufwand-${esc(wert)}">${esc(t('exp_aufwand_' + wert))}</span>`;
}

// Die große, gezogene Karte mit ihren Aktionen.
function karteHtml(karte, ausprobiert) {
  if (!karte) return `<p class="leise exp-leer">${esc(t('exp_karten_leer'))}</p>`;
  const istAus = ausprobiert.has(karte.id);
  const wkRoute = karte.werkzeug ? WERKZEUG_ROUTE[karte.werkzeug] : null;
  const aktionen = [];
  if (wkRoute) {
    aktionen.push(
      `<a class="knopf knopf-primaer" href="#/werkzeug/${esc(wkRoute)}"><i class="fa-solid fa-sliders" aria-hidden="true"></i> ${esc(t('exp_werkzeug_oeffnen'))}</a>`,
    );
  }
  aktionen.push(
    `<a class="knopf knopf-sekundaer" href="#/werkzeug/recorder"><i class="fa-solid fa-microphone" aria-hidden="true"></i> ${esc(t('exp_aufnehmen'))}</a>`,
  );
  if (karte.bezug) {
    aktionen.push(
      `<a class="knopf knopf-sekundaer" href="#/baustein/${esc(karte.bezug)}"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i> ${esc(t('exp_mehr_dazu'))}</a>`,
    );
  }
  return `
    <article class="karte exp-karte">
      <p class="exp-karte-kopf">
        <span class="chip chip-akzent">${esc(karte.kategorie)}</span>
        ${aufwandChip(karte.aufwand)}
      </p>
      <h2 class="exp-karte-titel">${esc(karte.titel)}</h2>
      <p class="exp-karte-impuls">${esc(karte.impuls)}</p>
      <p class="knopf-zeile exp-karte-aktionen">${aktionen.join('')}</p>
      <p class="exp-karte-merker">
        <button type="button" class="chip chip-waehlbar exp-ausprobiert ${istAus ? 'chip-akzent' : ''}" data-ausprobiert="${esc(karte.id)}" aria-pressed="${istAus}">
          <i class="fa-solid ${istAus ? 'fa-check' : 'fa-star'}" aria-hidden="true"></i> ${esc(istAus ? t('exp_ausprobiert_zurueck') : t('exp_ausprobiert'))}
        </button>
      </p>
    </article>`;
}

// „Stöbern": alle Karten nach Kategorie, als anklickbare Titel (zieht die Karte).
function stoebernHtml(karten) {
  const kats = [...new Set(karten.map((k) => k.kategorie))].sort();
  const abschnitt = (kat) => {
    const liste = karten
      .filter((k) => k.kategorie === kat)
      .map((k) => `<li><button type="button" class="exp-stoeber-titel" data-karte="${esc(k.id)}">${esc(k.titel)} ${aufwandChip(k.aufwand)}</button></li>`)
      .join('');
    return `<details class="exp-stoeber-kat"><summary>${esc(kat)} <span class="leise">(${karten.filter((k) => k.kategorie === kat).length})</span></summary><ul class="exp-stoeber-liste">${liste}</ul></details>`;
  };
  return kats.map(abschnitt).join('');
}

export function renderExperimentieren(el, daten) {
  const deck = daten.experimente || { experimente: [], hinweis: '' };
  const karten = deck.experimente || [];
  if (karten.length === 0) {
    el.innerHTML = `<article>${landingHeroHtml('fa-seedling', t('nav_experimentieren'), t('exp_untertitel'), 'pf-violett', 'experimentieren')}<p class="leise">${esc(t('exp_leer'))}</p></article>`;
    return;
  }
  const ausprobiert = ausprobierteMenge();
  if (!gezogeneId || !karten.some((k) => k.id === gezogeneId && passt(k))) {
    const k = zieheKarte(karten);
    gezogeneId = k ? k.id : null;
  }
  const gezogen = karten.find((k) => k.id === gezogeneId) || null;

  const kategorien = deck.kategorien && deck.kategorien.length ? deck.kategorien : [...new Set(karten.map((k) => k.kategorie))].sort();
  const katChips = [
    `<button type="button" class="chip chip-waehlbar ${!filterKat ? 'chip-akzent' : ''}" data-kat="">${esc(t('exp_kategorie_alle'))}</button>`,
    ...kategorien.map(
      (k) => `<button type="button" class="chip chip-waehlbar ${filterKat === k ? 'chip-akzent' : ''}" data-kat="${esc(k)}">${esc(k)}</button>`,
    ),
  ].join(' ');
  const aufwandChips = [
    `<button type="button" class="chip chip-waehlbar ${!filterAufwand ? 'chip-akzent' : ''}" data-aufwand="">${esc(t('exp_aufwand_alle'))}</button>`,
    ...['kurz', 'mittel', 'lang'].map(
      (a) => `<button type="button" class="chip chip-waehlbar ${filterAufwand === a ? 'chip-akzent' : ''}" data-aufwand="${esc(a)}">${esc(t('exp_aufwand_' + a))}</button>`,
    ),
  ].join(' ');

  // Haltungs-Bausteine (die drei Experiment-Grundhaltungen).
  const HALTUNG = ['experiment_haltung', 'beschraenkung_als_werkzeug', 'experiment_dokumentieren'];
  const haltungHtml = HALTUNG.filter((id) => daten.bausteinVonId?.get(id))
    .map((id) => `<a class="karte karte-link exp-haltung-karte" href="#/baustein/${esc(id)}">${bausteinIcon(id) || '<i class="fa-solid fa-lightbulb" aria-hidden="true"></i>'} <span>${esc(label('baustein', id))}</span></a>`)
    .join('');

  el.innerHTML = `
    <article>
      ${landingHeroHtml('fa-seedling', t('nav_experimentieren'), t('exp_untertitel'), 'pf-violett', 'experimentieren')}
      <p class="lk-hinweis banner-hinweis" role="note"><span><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ${esc(deck.hinweis)}</span></p>

      <div class="exp-ziehbereich">
        <p class="chip-zeile" role="group" aria-label="${esc(t('exp_kategorie_alle'))}">${katChips}</p>
        <p class="chip-zeile" role="group" aria-label="${esc(t('exp_aufwand_alle'))}">${aufwandChips}</p>
        <p class="knopf-zeile"><button type="button" class="knopf knopf-primaer exp-ziehen"><i class="fa-solid fa-rotate" aria-hidden="true"></i> ${esc(t('exp_weiterziehen'))}</button></p>
        <div class="exp-gezogen" role="status" aria-live="polite">${karteHtml(gezogen, ausprobiert)}</div>
      </div>

      <details class="exp-stoebern"><summary class="abschnitt-titel">${esc(t('exp_stoebern'))}</summary>
        <div class="exp-stoeber-gruppen">${stoebernHtml(karten)}</div>
      </details>

      ${haltungHtml ? `<h2 class="abschnitt-titel">${esc(t('exp_haltung_titel'))}</h2><div class="exp-haltung">${haltungHtml}</div>` : ''}

      <h2 class="abschnitt-titel">${esc(t('exp_grenzgaenger_titel'))}</h2>
      <p class="chip-zeile exp-grenzgaenger">
        <a class="chip chip-waehlbar" href="#/werkzeug/landkarte"><i class="fa-solid fa-compass" aria-hidden="true"></i> ${esc(t('wz_landkarte_titel'))}</a>
        <a class="chip chip-waehlbar" href="#/werkzeug/genremix"><i class="fa-solid fa-right-left" aria-hidden="true"></i> ${esc(t('wz_genremix_titel'))}</a>
      </p>
    </article>`;

  const gezogenFeld = el.querySelector('.exp-gezogen');
  const neuZeichnenKarte = () => {
    const k = karten.find((x) => x.id === gezogeneId) || null;
    gezogenFeld.innerHTML = karteHtml(k, ausprobierteMenge());
    verdrahteKarte();
  };
  function verdrahteKarte() {
    const knopf = gezogenFeld.querySelector('[data-ausprobiert]');
    if (!knopf) return;
    knopf.addEventListener('click', () => {
      const menge = ausprobierteMenge();
      const id = knopf.dataset.ausprobiert;
      if (menge.has(id)) menge.delete(id);
      else menge.add(id);
      setzeAusprobiert(menge);
      neuZeichnenKarte();
    });
  }
  verdrahteKarte();

  el.querySelector('.exp-ziehen').addEventListener('click', () => {
    const k = zieheKarte(karten);
    gezogeneId = k ? k.id : null;
    neuZeichnenKarte();
  });
  for (const knopf of el.querySelectorAll('[data-kat]')) {
    knopf.addEventListener('click', () => {
      filterKat = knopf.dataset.kat || null;
      renderExperimentieren(el, daten);
    });
  }
  for (const knopf of el.querySelectorAll('[data-aufwand]')) {
    knopf.addEventListener('click', () => {
      filterAufwand = knopf.dataset.aufwand || null;
      renderExperimentieren(el, daten);
    });
  }
  for (const knopf of el.querySelectorAll('[data-karte]')) {
    knopf.addEventListener('click', () => {
      gezogeneId = knopf.dataset.karte;
      neuZeichnenKarte();
      gezogenFeld.scrollIntoView({ block: 'nearest' });
    });
  }
}
