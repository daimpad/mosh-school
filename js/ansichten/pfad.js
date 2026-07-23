// Stationslisten der drei Baustein-Pfade. Überall gilt die Zwei-Ebenen-Logik:
// die Liste ordnet, sperrt aber nichts — Hinweise statt Zugangssperren.

import { markiereAbsolviert } from '../aktionen.js';
import { projektion } from '../fortschritt.js';
import { label, t } from '../i18n.js';
import { balkenHtml, bausteinIcon, domaeneIcon, entdeckenAktion, esc, leerHtml, neuRendern, statusPunktHtml, zeigeMeilenstein } from '../oberflaeche.js';
import { INSTRUMENTE, bandpfad, individualpfad, instrumentUebersicht, instrumentpfad, kompetenzpfad, stile, stilpfad, themenDomaenen, themenpfad, umgebungspfad, witterungen } from '../pfade.js';
import { diagnose, einstellungen, setzeDiagnose } from '../zustand.js';
import { gewaehlteZiele, zielLabels, zielwahlHtml } from './zielwahl.js';
import { genreInszenierungHtml, genreKurz, genreMotivSvg, genrePlatzhalterSvg, landingHeroHtml } from '../genre-inszenierung.js';
import { zeichneKoennenscheck } from './koennenscheck.js';

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
      ${landingHeroHtml('fa-chart-line', t('pfad_kompetenz'), '', 'pf-blau')}
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
    ${landingHeroHtml('fa-chart-line', t('pfad_kompetenz'), t('pfad_kompetenz_text'), 'pf-blau', `kompetenz-${pfad.stufe}`, label('kompetenzstufe', pfad.stufe))}
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
    el.innerHTML = `${landingHeroHtml('fa-layer-group', t('pfad_themen'), t('pfad_themen_text'), 'pf-teal')}${zeilen}`;
    return;
  }
  const pfad = themenpfad(daten, domaene);
  const inhalt =
    pfad.stationen.length === 0
      ? leerHtml(t('leer_domaene'), 'fa-compass', entdeckenAktion())
      : `${balkenHtml(projektion(pfad.stationen.map((s) => s.baustein)))}${stationslisteHtml(pfad.stationen, `themen:${domaene}`)}`;
  el.innerHTML = `
    ${landingHeroHtml('fa-layer-group', label('domaene', domaene), t('vorgeschlagene_reihenfolge'), 'pf-teal', `themen-${domaene}`)}
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
    // Unten featured: Beispielsongs + Gefühlslandkarte — bewusst in einem anderen
    // Stil als die Genre-Karten (breite Feature-Kacheln mit Icon).
    const featured = `
      <h2 class="abschnitt-titel genre-featured-titel">${esc(t('genre_featured_titel'))}</h2>
      <div class="genre-featured">
        <a class="genre-featured-karte" href="#/songs">
          <span class="genre-featured-icon"><i class="fa-solid fa-play" aria-hidden="true"></i></span>
          <span class="genre-featured-text">
            <strong>${esc(t('nav_songs'))}</strong>
            <span class="leise">${esc(t('genre_featured_songs'))}</span>
          </span>
          <i class="fa-solid fa-arrow-right genre-featured-pfeil" aria-hidden="true"></i>
        </a>
        <a class="genre-featured-karte" href="#/werkzeug/landkarte">
          <span class="genre-featured-icon"><i class="fa-solid fa-compass" aria-hidden="true"></i></span>
          <span class="genre-featured-text">
            <strong>${esc(t('wz_landkarte_titel'))}</strong>
            <span class="leise">${esc(t('genre_featured_landkarte'))}</span>
          </span>
          <i class="fa-solid fa-arrow-right genre-featured-pfeil" aria-hidden="true"></i>
        </a>
      </div>`;
    el.innerHTML = `${hero}${zeilen || leerHtml(t('leer_domaene'), 'fa-compass', entdeckenAktion())}${zeilen ? featured : ''}`;
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

// Instrument-Landing: ein Zuhause je Instrument. Ohne Instrument der Picker (vier
// Kacheln), mit Instrument die gebündelte Seite: Technik nach Stufe, Ausrüstung,
// eingebetteter Könnens-Check und passende Werkzeuge. Ziel des mobilen „Lernen".
const INSTR_WERKZEUGE = {
  gitarre: ['stimmgeraet', 'metronom', 'pedalboard', 'ampbox', 'loops', 'recorder'],
  bass: ['stimmgeraet', 'metronom', 'pedalboard', 'ampbox', 'loops', 'recorder'],
  schlagzeug: ['metronom', 'loops', 'struktur', 'recorder', 'mehrspur'],
  gesang: ['stimmgeraet', 'recorder', 'metronom', 'loops', 'struktur'],
};
const WZ_ICON = {
  explorer: 'fa-magnifying-glass', metronom: 'fa-stopwatch', loops: 'fa-drum',
  stimmgeraet: 'fa-wave-square', pedalboard: 'fa-layer-group', ampbox: 'fa-volume-high',
  struktur: 'fa-list-check', recorder: 'fa-microphone', mehrspur: 'fa-sliders',
};
const INSTR_STUFEN = ['einsteiger', 'fortgeschritten', 'experte'];
function instrumentStufe(baustein) {
  return INSTR_STUFEN.find((s) => (baustein.kompetenzstufe || []).includes(s)) || 'einsteiger';
}
// Instrumente mit gestimmten Saiten bekommen zusätzlich den Reiter „Stimmung".
const INSTR_STIMMUNG = ['gitarre', 'bass'];
// Aktiver In-Page-Reiter (überlebt ein Neu-Rendern; wird zurückgesetzt, wenn er
// im aktuellen Instrument nicht existiert).
let instrAktiverReiter = 'praxis';

// Reiter-Definition je Instrument (Reihenfolge = Anzeige).
function instrumentReiter(domaene) {
  const reiter = [
    { id: 'theorie', titel: t('instrument_theorie'), icon: 'fa-book-open' },
    { id: 'praxis', titel: t('instrument_praxis'), icon: 'fa-list-check' },
    { id: 'tools', titel: t('nav_werkzeuge'), icon: 'fa-toolbox' },
    { id: 'pruefung', titel: t('nav_koennenscheck'), icon: 'fa-flag-checkered' },
    { id: 'geraete', titel: t('wz_explorer_titel'), icon: 'fa-volume-high' },
  ];
  if (INSTR_STIMMUNG.includes(domaene)) reiter.push({ id: 'stimmung', titel: t('instrument_stimmung'), icon: 'fa-wave-square' });
  if (domaene === 'schlagzeug') reiter.push({ id: 'patterns', titel: t('nav_patterns'), icon: 'fa-repeat' });
  return reiter;
}

// Inhalt eines Reiters (reines HTML; der Könnens-Check wird nach dem Einsetzen
// separat verdrahtet).
function instrumentReiterInhalt(daten, domaene, pfad, id) {
  const kontext = `instrument:${domaene}`;
  const stufenListe = (stationen) => {
    const gruppen = INSTR_STUFEN.map((stufe) => ({ stufe, st: stationen.filter((s) => instrumentStufe(s.baustein) === stufe) })).filter((g) => g.st.length);
    return gruppen.length
      ? gruppen.map(({ stufe, st }) => `<h3 class="instr-stufe-titel"><span class="chip chip-stufe chip-stufe-${esc(stufe)}">${esc(label('kompetenzstufe', stufe))}</span></h3>${stationslisteHtml(st, kontext)}`).join('')
      : `<p class="leise">${esc(t('instrument_leer_abschnitt'))}</p>`;
  };
  if (id === 'theorie') return `${balkenHtml(projektion(pfad.theorie.map((s) => s.baustein)))}${stufenListe(pfad.theorie)}`;
  if (id === 'praxis') return `${balkenHtml(projektion(pfad.praxis.map((s) => s.baustein)))}${stufenListe(pfad.praxis)}`;
  if (id === 'tools') {
    const chips = (INSTR_WERKZEUGE[domaene] || [])
      .map((wid) => `<a class="chip chip-akzent instr-wz-chip" href="#/werkzeug/${esc(wid)}"><i class="fa-solid ${WZ_ICON[wid] || 'fa-toolbox'}" aria-hidden="true"></i> ${esc(t('wz_' + wid + '_titel'))}</a>`)
      .join(' ');
    return `<p class="leise">${esc(t('instrument_tools_text'))}</p><p class="chip-zeile">${chips}</p>`;
  }
  if (id === 'pruefung') return `<p class="leise">${esc(t('instrument_kc_intro', { instrument: label('domaene', domaene) }))}</p><div class="instr-kc"></div>`;
  if (id === 'geraete') {
    const explorer = `<a class="chip chip-akzent instr-wz-chip" href="#/werkzeug/explorer?ansicht=gitarre_bass"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> ${esc(t('wz_explorer_titel'))}</a>`;
    const gear = pfad.ausruestung.length ? stationslisteHtml(pfad.ausruestung, kontext) : `<p class="leise">${esc(t('instrument_keine_ausruestung'))}</p>`;
    return `<p class="chip-zeile">${explorer}</p>${gear}`;
  }
  if (id === 'stimmung') {
    return `<p class="leise">${esc(t('instrument_stimmung_text'))}</p>
      <p class="chip-zeile">
        <a class="chip chip-akzent instr-wz-chip" href="#/stimmungen"><i class="fa-solid fa-wave-square" aria-hidden="true"></i> ${esc(t('nav_stimmungen'))}</a>
        <a class="chip chip-akzent instr-wz-chip" href="#/werkzeug/stimmgeraet"><i class="fa-solid fa-wave-square" aria-hidden="true"></i> ${esc(t('wz_stimmgeraet_titel'))}</a>
      </p>`;
  }
  if (id === 'patterns') {
    return `<p class="leise">${esc(t('instrument_patterns_text'))}</p>
      <p class="chip-zeile">
        <a class="chip chip-akzent instr-wz-chip" href="#/patterns"><i class="fa-solid fa-repeat" aria-hidden="true"></i> ${esc(t('nav_patterns'))}</a>
        <a class="chip chip-akzent instr-wz-chip" href="#/werkzeug/metronom"><i class="fa-solid fa-stopwatch" aria-hidden="true"></i> ${esc(t('wz_metronom_titel'))}</a>
      </p>`;
  }
  return '';
}

export function renderInstrument(el, daten, domaene) {
  if (!domaene || !INSTRUMENTE.includes(domaene)) {
    const karten = instrumentUebersicht(daten)
      .map(
        ({ domaene: d, anzahl }) => `
        <a class="karte karte-link pfad-kachel instr-kachel pf-blau" href="#/instrument/${esc(d)}">
          <div class="pfad-kachel-kopf">
            <span class="pfad-medaille">${domaeneIcon(d)}</span>
            <h3>${esc(label('domaene', d))}</h3>
          </div>
          <div class="pfad-kachel-text">
            <p class="leise">${esc(t('n_bausteine', { n: anzahl }))}</p>
            <span class="pfad-cta">${esc(t('instrument_oeffnen'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
          </div>
        </a>`
      )
      .join('');
    el.innerHTML = `
      ${landingHeroHtml('fa-bolt', t('instrument_picker_titel'), t('instrument_picker_text'), 'pf-blau')}
      <div class="pfad-gitter instr-picker">${karten}</div>`;
    return;
  }

  const pfad = instrumentpfad(daten, domaene);
  const reiter = instrumentReiter(domaene);
  if (!reiter.some((r) => r.id === instrAktiverReiter)) instrAktiverReiter = reiter[0].id;

  const reiterBar = `<div class="instr-reiter" role="tablist" aria-label="${esc(t('instrument_untertitel'))}">${reiter
    .map((r) => `<button type="button" class="chip chip-waehlbar instr-reiter-knopf ${r.id === instrAktiverReiter ? 'chip-akzent' : ''}" role="tab" aria-selected="${r.id === instrAktiverReiter}" data-reiter="${esc(r.id)}"><i class="fa-solid ${r.icon}" aria-hidden="true"></i> ${esc(r.titel)}</button>`)
    .join('')}</div>`;

  el.innerHTML = `
    ${landingHeroHtml(null, label('domaene', domaene), t('instrument_untertitel'), 'pf-blau', `instrument-${domaene}`, '', domaeneIcon(domaene))}
    ${reiterBar}
    <div class="instr-tab-inhalt" role="tabpanel">${instrumentReiterInhalt(daten, domaene, pfad, instrAktiverReiter)}</div>
    <p class="knopf-zeile instr-fuss">
      <a class="knopf knopf-sekundaer" href="#/instrument"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('instrument_alle'))}</a>
      <a class="knopf knopf-sekundaer" href="#/training"><i class="fa-solid fa-list-check" aria-hidden="true"></i> ${esc(t('nav_training'))}</a>
    </p>`;

  const inhalt = el.querySelector('.instr-tab-inhalt');
  const kcVerdrahten = () => {
    const kc = inhalt.querySelector('.instr-kc');
    if (kc) zeichneKoennenscheck(kc, daten, { mitHero: false });
  };
  kcVerdrahten();

  for (const knopf of el.querySelectorAll('[data-reiter]')) {
    knopf.addEventListener('click', () => {
      instrAktiverReiter = knopf.dataset.reiter;
      for (const k of el.querySelectorAll('[data-reiter]')) {
        const an = k.dataset.reiter === instrAktiverReiter;
        k.classList.toggle('chip-akzent', an);
        k.setAttribute('aria-selected', String(an));
      }
      inhalt.innerHTML = instrumentReiterInhalt(daten, domaene, pfad, instrAktiverReiter);
      kcVerdrahten();
    });
  }
}

// Band-Landing: Querschnittsthemen, die mehrere Instrumente zugleich betreffen
// (Ensemble, Proberaum, Songwriting, Auftritt). Ziel der Band-Kachel der Startseite.
export function renderBand(el, daten) {
  const pfad = bandpfad(daten);
  const liste = pfad.stationen.length
    ? `${balkenHtml(projektion(pfad.stationen.map((s) => s.baustein)))}${stationslisteHtml(pfad.stationen, 'band')}`
    : leerHtml(t('leer_domaene'), 'fa-users', entdeckenAktion());
  el.innerHTML = `
    ${landingHeroHtml('fa-users', t('band_titel'), t('band_untertitel'), 'pf-schiefer')}
    <p class="leise">${esc(t('band_intro'))}</p>
    ${liste}`;
}

// Kontext-Achse (Querschnitt): Hub über die Spielsituationen (Proberaum, Bühne,
// Aufnahme, Solo) plus die vollständige Reihe. Einzelne Situationswerte sind
// eigene Ansichten. Quer zu Stufe und Instrument.
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
  // Facetten-Sektion nur zeigen, wenn tatsächlich Situationswerte belegt sind.
  const witt = witterungen(daten);
  const facettenSektion = (titel, eintraege, achsenName) =>
    eintraege.length ? `<h2>${esc(t(titel))}</h2>${achsenKarten(eintraege, achsenName)}` : '';
  el.innerHTML = `
    ${landingHeroHtml('fa-people-group', t('pfad_umgebung'), t('pfad_umgebung_text'), 'pf-sky', 'kontext')}
    ${facettenSektion('umgebung_wetter', witt, 'witterung')}
    <h2>${esc(t('umgebung_alle'))}</h2>
    ${liste}`;
}

export function renderIndividual(el, daten) {
  const pfad = individualpfad(daten);
  if (!pfad.ziel) {
    el.innerHTML = `
      ${landingHeroHtml('fa-bullseye', t('pfad_individual'), t('ziel_hinweis'), 'pf-violett')}
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
    ${landingHeroHtml('fa-bullseye', t('pfad_individual'), '', 'pf-violett')}
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
