// Stationslisten der drei Baustein-Pfade. Überall gilt die Zwei-Ebenen-Logik:
// die Liste ordnet, sperrt aber nichts — Hinweise statt Zugangssperren.

import { markiereAbsolviert } from '../aktionen.js';
import { projektion } from '../fortschritt.js';
import { label, t } from '../i18n.js';
import { balkenHtml, bausteinIcon, entdeckenAktion, esc, heroKlein, leerHtml, neuRendern, statusPunktHtml, zeigeMeilenstein } from '../oberflaeche.js';
import { individualpfad, kompetenzpfad, stile, stilpfad, themenDomaenen, themenpfad, umgebungspfad, untergruende, witterungen } from '../pfade.js';
import { diagnose, einstellungen, setzeDiagnose } from '../zustand.js';
import { gewaehlteZiele, zielLabels, zielwahlHtml } from './zielwahl.js';
import { genreInszenierungHtml, genreKurz, genreMotivSvg, genrePlatzhalterSvg } from '../genre-inszenierung.js';

// In der Liste ordnet bereits die Reihenfolge; der „Empfohlen vorher"-Hinweis
// gehört zum Zugriffsmoment und lebt in der Baustein-Ansicht (Spez. 4.4).
// Hier erscheint nur, was die Liste selbst nicht zeigen kann: Voraussetzungen
// außerhalb der gefilterten Menge (Individualpfad, 6.2).
function hinweisZeilen(station) {
  if (station.status.absolviert || station.ausserhalbMenge.length === 0) return '';
  const namen = station.ausserhalbMenge.map((id) => label('baustein', id)).join(', ');
  return `<span class="station-hinweis">${esc(`${t('ausserhalb_auswahl')} ${namen}`)}</span>`;
}

function stationslisteHtml(stationen, kontext, { mitSkip = false } = {}) {
  const kuerzelSichtbar = einstellungen().transferKuerzelSichtbar;
  const eintraege = stationen
    .map((station, i) => {
      // Kennzeichnung (6.5.3): die Herkunft steuert die dezenten Kürzel.
      const deltaChip =
        station.delta && kuerzelSichtbar
          ? `<span class="chip chip-akzent" title="${esc(t('delta_hinweis', { herkunft: label('transfer_herkunft', station.delta.ersetzt_bei_herkunft) }))}">${esc(station.delta.ersetzt_bei_herkunft)}</span>`
          : '';
      const skipKnopf =
        mitSkip && station.skipKandidat
          ? `<button class="knopf knopf-leise station-skip" data-skip="${esc(station.baustein.id)}">${esc(t('kann_ich_schon'))}</button>`
          : '';
      return `
        <li class="station ${station.status.absolviert ? 'station-absolviert' : ''}">
          <a class="station-link" href="#/baustein/${esc(station.baustein.id)}?kontext=${encodeURIComponent(kontext)}">
            <span class="station-nummer" aria-hidden="true">${i + 1}</span>
            <span class="station-mitte">
              <span class="station-titel">${bausteinIcon(station.baustein.id, 'station-icon')} ${esc(label('baustein', station.baustein.id))} ${deltaChip}</span>
              ${hinweisZeilen(station)}
            </span>
            ${statusPunktHtml(station)}
          </a>
          ${skipKnopf}
        </li>`;
    })
    .join('');
  return `<ol class="stationsliste">${eintraege}</ol>`;
}

function bindeSkip(el, daten, kontext, stationen) {
  for (const knopf of el.querySelectorAll('[data-skip]')) {
    knopf.addEventListener('click', () => {
      const station = stationen.find((s) => s.baustein.id === knopf.dataset.skip);
      if (!station) return;
      const { meilenstein } = markiereAbsolviert(daten, kontext, station.baustein);
      if (meilenstein) zeigeMeilenstein(meilenstein);
      else neuRendern();
    });
  }
}

export function renderKompetenzpfad(el, daten, stufe) {
  const pfad = kompetenzpfad(daten, stufe || undefined);
  const kontext = stufe ? `kompetenz:${stufe}` : 'kompetenz';
  if (!pfad.stufe) {
    // Ohne Stufe keine Sequenz (Spez. 7.1) — der Zugriff auf die Inhalte
    // bleibt über Themen-/Individualpfad trotzdem frei.
    el.innerHTML = `
      ${heroKlein('fa-chart-line', t('pfad_kompetenz'), '', 'pf-blau')}
      <div class="karte">
        <p class="leise">${esc(t('stufe_fehlt'))}</p>
        <div class="knopf-zeile" style="justify-content:flex-start">
          <a class="knopf knopf-primaer" href="#/onboarding">${esc(t('stufe_waehlen'))}</a>
          <a class="knopf knopf-leise" href="#/pfad/themen">${esc(t('kapitel_entdecken'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
        </div>
      </div>`;
    return;
  }
  const inhalt =
    pfad.stationen.length === 0
      ? leerHtml(t('leer_stufe'), 'fa-compass', entdeckenAktion())
      : `${balkenHtml(projektion(pfad.stationen.map((s) => s.baustein)))}${stationslisteHtml(pfad.stationen, kontext, { mitSkip: Boolean(pfad.herkunft) })}`;
  el.innerHTML = `
    ${heroKlein('fa-chart-line', t('pfad_kompetenz'), t('pfad_kompetenz_text'), 'pf-blau', ` <span class="chip chip-stufe chip-stufe-${esc(pfad.stufe)}">${esc(label('kompetenzstufe', pfad.stufe))}</span>`)}
    ${inhalt}`;
  bindeSkip(el, daten, kontext, pfad.stationen);
}

export function renderThemen(el, daten, domaene) {
  if (!domaene) {
    // Nur belegte Domänen zeigen (wie die Startseiten-Chips). Eine reine
    // Trainer-Domäne (Trainingsgestaltung) hat für Nicht-Trainer 0 Bausteine und
    // erschiene sonst als leere „0-Bausteine"-Karte — die wird ausgeblendet.
    const zeilen = themenDomaenen(daten)
      .filter((eintrag) => eintrag.anzahl > 0)
      .map((eintrag) => {
        const beschriftung = `<h3>${esc(label('domaene', eintrag.domaene))}</h3><p class="leise">${esc(t('n_bausteine', { n: eintrag.anzahl }))}</p>`;
        return `<a class="karte karte-link" href="#/pfad/themen/${esc(eintrag.domaene)}">${beschriftung}</a>`;
      })
      .join('');
    el.innerHTML = `${heroKlein('fa-layer-group', t('pfad_themen'), t('pfad_themen_text'), 'pf-teal')}${zeilen}`;
    return;
  }
  const pfad = themenpfad(daten, domaene);
  const inhalt =
    pfad.stationen.length === 0
      ? leerHtml(t('leer_domaene'), 'fa-compass', entdeckenAktion())
      : `${balkenHtml(projektion(pfad.stationen.map((s) => s.baustein)))}${stationslisteHtml(pfad.stationen, `themen:${domaene}`)}`;
  el.innerHTML = `
    ${heroKlein('fa-layer-group', label('domaene', domaene), t('vorgeschlagene_reihenfolge'), 'pf-teal')}
    ${inhalt}`;
}

// Genre-Achse (Stil): Hub über alle belegten Genres, dann je Genre eine
// inszenierte Seite — cooler Einstieg, musikwissenschaftliche Einordnung,
// Verwandtschaft (aus data/genres.json) plus alle Bausteine quer über
// Instrumente und Stufen. Reine Perspektive über den Pool.

// Erster Satz der Kurzbeschreibung — kompakter Anreißer für die Hub-Karten.
function ersterSatz(text) {
  const m = /^(.*?[.!?])(\s|$)/.exec(text || '');
  return m ? m[1] : (text || '');
}

export function renderStil(el, daten, stil) {
  if (!stil) {
    const zeilen = stile(daten)
      .map((e) => {
        const anreiss = ersterSatz(genreKurz(daten, e.stil));
        return `<a class="karte karte-link genre-karte" href="#/pfad/stil/${esc(e.stil)}">
            <h3>${esc(label('stil', e.stil))} <span class="chip">${esc(t('n_bausteine', { n: e.anzahl }))}</span></h3>
            ${anreiss ? `<p class="leise genre-karte-kurz">${esc(anreiss)}</p>` : ''}
          </a>`;
      })
      .join('');
    const hero = `
      <section class="marke-hero klein hue pf-magenta genre-hub-hero">
        <div class="marke-hero-text">
          <h1>${esc(t('pfad_stil'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('pfad_stil_text'))}</p>
        </div>
        ${genrePlatzhalterSvg()}
      </section>`;
    el.innerHTML = `${hero}${zeilen || leerHtml(t('leer_domaene'), 'fa-compass', entdeckenAktion())}`;
    return;
  }
  const pfad = stilpfad(daten, stil);
  const liste =
    pfad.stationen.length === 0
      ? leerHtml(t('leer_domaene'), 'fa-compass', entdeckenAktion())
      : `${balkenHtml(projektion(pfad.stationen.map((s) => s.baustein)))}${stationslisteHtml(pfad.stationen, `stil:${stil}`)}`;
  const inszenierung = genreInszenierungHtml(daten, stil);
  const kurz = genreKurz(daten, stil);
  // Großer Landing-Hero mit genre-eigenem Motiv-Backdrop (+ „Reinbox"-Effekt via
  // CSS). Der Inhalt darunter wird in Abschnitten gerendert, die beim Hereinscrollen
  // ein-/ausblenden (.reveal — der Beobachter in app.js schaltet .sichtbar/.raus).
  // Alles in einer .genre-landing-Hülle: so bekommt nur die Hülle den globalen
  // Einstiegs-Stagger, die inneren .reveal-Blöcke bleiben dem Scroll-Effekt überlassen.
  el.innerHTML = `
    <div class="genre-landing">
      <section class="marke-hero genre-landing-hero pf-magenta">
        ${genreMotivSvg(stil)}
        <div class="genre-landing-scrim" aria-hidden="true"></div>
        <div class="genre-landing-inhalt">
          <p class="genre-landing-augenbraue">${esc(t('genre_augenbraue'))} · ${esc(t('n_bausteine', { n: pfad.stationen.length }))}</p>
          <h1>${esc(label('stil', stil))}</h1>
          ${kurz ? `<p class="genre-landing-kurz">${esc(kurz)}</p>` : ''}
        </div>
      </section>
      ${inszenierung ? `<div class="reveal">${inszenierung}</div>` : ''}
      <h2 class="abschnitt-titel genre-bausteine-titel reveal">${esc(t('genre_bausteine_titel'))}</h2>
      <div class="reveal">${liste}</div>
    </div>`;
}

// Umgebungs-Achse (Outdoor, Querschnitt): Hub über die Wetter- und Boden-Themen
// plus die vollständige Outdoor-Reihe. Einzelne Achsen-Werte (Wind, Sand …) sind
// eigene Ansichten. Kein Cross-Sport-Modifikator — Outdoor ist crossminton-eigen.
export function renderUmgebung(el, daten, achse, wert) {
  if (achse && wert) {
    const pfad = umgebungspfad(daten, achse, wert);
    const inhalt =
      pfad.stationen.length === 0
        ? leerHtml(t('leer_domaene'), 'fa-compass', entdeckenAktion())
        : `${balkenHtml(projektion(pfad.stationen.map((s) => s.baustein)))}${stationslisteHtml(pfad.stationen, `${achse}:${wert}`)}`;
    el.innerHTML = `
      <h1>${esc(t('pfad_umgebung'))} <span class="chip">${esc(label(achse, wert))}</span></h1>
      <p class="leise">${esc(t('vorgeschlagene_reihenfolge'))}</p>
      ${inhalt}`;
    return;
  }
  const achsenKarten = (eintraege, achsenName) =>
    eintraege
      .map((e) => {
        const w = e[achsenName];
        return `<a class="karte karte-link" href="#/pfad/${achsenName}/${esc(w)}"><h3>${esc(label(achsenName, w))}</h3><p class="leise">${esc(t('n_bausteine', { n: e.anzahl }))}</p></a>`;
      })
      .join('');
  const alle = umgebungspfad(daten);
  const liste =
    alle.stationen.length === 0
      ? leerHtml(t('leer_domaene'), 'fa-compass', entdeckenAktion())
      : `${balkenHtml(projektion(alle.stationen.map((s) => s.baustein)))}${stationslisteHtml(alle.stationen, 'umgebung')}`;
  // Facetten-Sektionen nur zeigen, wenn tatsächlich Werte belegt sind — so bleibt
  // eine unbelegte Facette (z. B. Untergrund) ohne leere Überschrift.
  const witt = witterungen(daten);
  const unter = untergruende(daten);
  const facettenSektion = (titel, eintraege, achsenName) =>
    eintraege.length ? `<h2>${esc(t(titel))}</h2>${achsenKarten(eintraege, achsenName)}` : '';
  el.innerHTML = `
    ${heroKlein('fa-users', t('pfad_umgebung'), t('pfad_umgebung_text'), 'pf-sky')}
    ${facettenSektion('umgebung_wetter', witt, 'witterung')}
    ${facettenSektion('umgebung_boden', unter, 'untergrund')}
    <h2>${esc(t('umgebung_alle'))}</h2>
    ${liste}`;
}

export function renderIndividual(el, daten) {
  const pfad = individualpfad(daten);
  if (!pfad.ziel) {
    el.innerHTML = `
      ${heroKlein('fa-bullseye', t('pfad_individual'), t('ziel_hinweis'), 'pf-violett')}
      <form id="zielform">${zielwahlHtml(daten, null, { mitVermittlungszielen: diagnose().trainer })}</form>
      <div class="knopf-zeile"><button class="knopf knopf-primaer" id="ziel-uebernehmen">${esc(t('uebernehmen'))}</button></div>`;
    el.querySelector('#zielform').addEventListener('submit', (ereignis) => ereignis.preventDefault());
    el.querySelector('#ziel-uebernehmen').addEventListener('click', () => {
      const ziele = gewaehlteZiele(el);
      if (!ziele) return;
      setzeDiagnose({ ziel: ziele });
      neuRendern();
    });
    return;
  }

  const zielChips = zielLabels(pfad.ziel)
    .map((beschriftung) => `<span class="chip chip-akzent">${esc(beschriftung)}</span>`)
    .join(' ');
  const inhalt =
    pfad.stationen.length === 0
      ? leerHtml(t('leer_ziel'), 'fa-bullseye', entdeckenAktion())
      : `${balkenHtml(projektion(pfad.stationen.map((s) => s.baustein)))}${stationslisteHtml(pfad.stationen, 'individual')}`;
  el.innerHTML = `
    ${heroKlein('fa-bullseye', t('pfad_individual'), '', 'pf-violett')}
    <p class="chip-zeile">${esc(t('ziel_aktuell'))}: ${zielChips}</p>
    ${inhalt}
    <details class="karte">
      <summary>${esc(t('ziel_aendern'))}</summary>
      <form id="zielform">${zielwahlHtml(daten, pfad.ziel, { mitVermittlungszielen: diagnose().trainer })}</form>
      <div class="knopf-zeile">
        <button class="knopf knopf-leise" id="ziel-entfernen">${esc(t('ziel_entfernen'))}</button>
        <button class="knopf knopf-primaer" id="ziel-uebernehmen">${esc(t('uebernehmen'))}</button>
      </div>
    </details>`;
  el.querySelector('#zielform').addEventListener('submit', (ereignis) => ereignis.preventDefault());
  el.querySelector('#ziel-uebernehmen').addEventListener('click', () => {
    const ziele = gewaehlteZiele(el);
    if (!ziele) return;
    setzeDiagnose({ ziel: ziele });
    neuRendern();
  });
  el.querySelector('#ziel-entfernen').addEventListener('click', () => {
    setzeDiagnose({ ziel: null });
    neuRendern();
  });
}
