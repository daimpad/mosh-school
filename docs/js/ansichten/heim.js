// Heim: Marken-Hero mit Einstiegs-CTAs plus die Bereich-Kacheln als Raster.
//
// Kachel-Muster („Rhythmus C" aus mockups/startseite-muster.html): Das Bild ist
// kein Schmuck, sondern ein Signal für die Art des Ziels. Je weiter unten auf der
// Seite, desto funktionaler der Bereich — und desto weniger Bild:
//
//   Marke      Bild, groß       der einzige Ort, an dem Atmosphäre allein zählt
//   Instrumente Bild            Orte, in die man eintaucht (+ Band-Querschnitt)
//   Lernwege   Bild             Wege durch den Stoff
//   Werkzeuge  flach, nur Icon  wird bedient und wiedergefunden, nicht durchstöbert
//   Entdecken  Zeile mit Icon   alles, was woanders hinführt
//
// Die Bildebene kommt aus js/hintergrundbilder.js und ist optional: Fehlt
// images/bg/bilder.json, rendern dieselben Kacheln ohne Foto (Motiv + Scrim
// bleiben) — kein Bruch, nur ruhiger.

import { bildEbene } from '../hintergrundbilder.js';
import { label, t } from '../i18n.js';
import { domaeneIcon, esc } from '../oberflaeche.js';
import { markeHeroInszeniert, motivSvg } from '../genre-inszenierung.js';
import { instrumentUebersicht, stile } from '../pfade.js';
import { diagnose, speicherIstVerfuegbar, zuletzt } from '../zustand.js';
import { zielLabels } from './zielwahl.js';

// Je Instrument eine eigene Hue — vorher trugen alle vier dasselbe Blau. Mit dem
// Bildhintergrund lohnt sich die Unterscheidung: Die Hue färbt Augenbraue,
// Verlauf und Motiv und macht die vier Kacheln auf einen Blick auseinanderhaltbar.
const INSTRUMENT_HUE = {
  gitarre: 'pf-magenta',
  bass: 'pf-indigo',
  schlagzeug: 'pf-sky',
  gesang: 'pf-teal',
};

export function renderHeim(el, daten) {
  const d = diagnose();
  const zielBeschriftungen = zielLabels(d.ziel);

  // Einstiegs-CTAs im Hero: „Kapitel entdecken" öffnet den Themen-Einstieg,
  // „Onboarding" die geführte Ersteinrichtung.
  const heroCta = `
    <div class="knopf-zeile marke-hero-cta">
      <a class="knopf knopf-primaer" href="#/pfad/themen">${esc(t('kapitel_entdecken'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      <a class="knopf knopf-sekundaer" href="#/onboarding">${esc(t('onboarding'))}</a>
    </div>`;

  const cta = `<span class="pfad-cta">${esc(t('ansehen'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>`;

  // ---- Bild-Kachel: der Hero-Aufbau im Container-Maßstab -------------------
  // Schichtung wie im Hero und in derselben Reihenfolge: Bild → Motiv → Scrim →
  // Text. `schluessel` bestimmt beides deterministisch (Motivform und Bildwahl),
  // damit eine Kachel über Reloads hinweg gleich aussieht.
  const bildKachel = ({ href, hue, schluessel, icon = '', iconHtml = '', augenbraue,
    titel, meta = '', text = '', extra = '', breit = false }) => {
    const symbol = iconHtml || (icon ? `<i class="fa-solid ${icon}" aria-hidden="true"></i>` : '');
    return `
    <a class="karte karte-link pfad-kachel bildkachel ${breit ? 'voll-breit ' : ''}${hue}" href="${esc(href)}">
      ${bildEbene(schluessel)}
      ${motivSvg(schluessel)}
      <div class="bildkachel-scrim" aria-hidden="true"></div>
      <div class="bildkachel-inhalt">
        <p class="bildkachel-augenbraue">${symbol}${esc(augenbraue)}</p>
        <h3 class="bildkachel-titel">${titel}${meta}</h3>
        ${text ? `<p class="bildkachel-text">${text}</p>` : ''}
        ${extra}
        ${cta}
      </div>
    </a>`;
  };

  // ---- Werkzeug-Kachel: flach, nur Icon ------------------------------------
  const werkzeugKachel = ({ href, hue, icon, titel, text = '' }) => `
    <a class="karte karte-link pfad-kachel werkzeugkachel ${hue}" href="${esc(href)}">
      <span class="pfad-medaille"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
      <div class="pfad-kachel-text">
        <h3>${titel}</h3>
        ${text ? `<p class="leise">${text}</p>` : ''}
      </div>
    </a>`;

  // ---- Verweis-Zeile -------------------------------------------------------
  const verweisZeile = ({ href, hue, icon, titel }) => `
    <a class="karte karte-link pfad-kachel verweiszeile ${hue}" href="${esc(href)}">
      <i class="fa-solid ${icon}" aria-hidden="true"></i>
      <h3>${titel}</h3>
      <i class="fa-solid fa-arrow-right verweiszeile-pfeil" aria-hidden="true"></i>
    </a>`;

  // ---- Instrumente + Band (Bild) ------------------------------------------
  const instrumentKacheln = instrumentUebersicht(daten)
    .map(({ domaene, anzahl }) => bildKachel({
      href: `#/instrument/${esc(domaene)}`,
      hue: INSTRUMENT_HUE[domaene] || 'pf-blau',
      schluessel: `instrument:${domaene}`,
      iconHtml: domaeneIcon(domaene),
      augenbraue: t('kicker_instrument'),
      titel: esc(label('domaene', domaene)),
      text: esc(t('n_bausteine', { n: anzahl })),
    }))
    .join('');

  const bandKachel = bildKachel({
    href: '#/band', hue: 'pf-schiefer', schluessel: 'band',
    icon: 'fa-users', augenbraue: t('kicker_zusammenspiel'),
    titel: esc(t('band_titel')), text: esc(t('band_kachel_text')),
    breit: true,
  });

  // ---- Lernwege (Bild) -----------------------------------------------------
  const genres = stile(daten);
  const genreKachel = genres.length > 0
    ? bildKachel({
        href: '#/pfad/stil', hue: 'pf-magenta', schluessel: 'lernweg:stil',
        icon: 'fa-fire', augenbraue: t('kicker_lernweg'),
        titel: esc(t('pfad_stil')),
        meta: ` <span class="chip">${esc(t('n_genres', { n: genres.length }))}</span>`,
        text: esc(t('pfad_stil_text')),
      })
    : '';

  const kontextKachel = bildKachel({
    href: '#/pfad/umgebung', hue: 'pf-sky', schluessel: 'lernweg:umgebung',
    icon: 'fa-people-group', augenbraue: t('kicker_lernweg'),
    titel: esc(t('pfad_umgebung')), text: esc(t('pfad_umgebung_text')),
  });

  const trainingKachel = bildKachel({
    href: '#/training', hue: 'pf-indigo', schluessel: 'lernweg:training',
    icon: 'fa-list-check', augenbraue: t('kicker_lernweg'),
    titel: esc(t('pfad_training')),
    meta: ` <span class="chip">${esc(t('n_einheiten', { n: daten.einheiten.length }))}</span>`,
    text: esc(t('pfad_training_text')),
  });

  // Individualpfad zeigt gewählte Ziele — ohne Ziel bleibt nur Beschreibung + CTA.
  const individualKachel = bildKachel({
    href: '#/pfad/individual', hue: 'pf-violett', schluessel: 'lernweg:individual',
    icon: 'fa-bullseye', augenbraue: t('kicker_lernweg'),
    titel: esc(t('pfad_individual')), text: esc(t('pfad_individual_text')),
    extra: zielBeschriftungen.length > 0
      ? `<p class="leise pfad-kachel-ziel">${esc(t('ziel_aktuell'))}: ${esc(zielBeschriftungen.join(' · '))}</p>`
      : '',
  });

  const pruefungKachel = bildKachel({
    href: '#/koennenscheck', hue: 'pf-teal', schluessel: 'lernweg:koennenscheck',
    icon: 'fa-flag-checkered', augenbraue: t('kicker_lernweg'),
    titel: esc(t('nav_koennenscheck')), text: esc(t('koennenscheck_untertitel')),
    breit: true,
  });

  // ---- Werkzeuge (flach) ---------------------------------------------------
  const werkzeugKacheln = [
    { href: '#/werkzeuge', hue: 'pf-teal', icon: 'fa-toolbox', titel: esc(t('nav_werkzeuge')), text: esc(t('wz_hub_untertitel')) },
    { href: '#/stimmungen', hue: 'pf-teal', icon: 'fa-sliders', titel: esc(t('nav_stimmungen')), text: esc(t('stimm_untertitel')) },
    { href: '#/patterns', hue: 'pf-indigo', icon: 'fa-repeat', titel: esc(t('nav_patterns')), text: esc(t('pattern_untertitel')) },
    { href: '#/werkzeug/explorer', hue: 'pf-schiefer', icon: 'fa-microchip', titel: esc(t('wz_explorer_titel')), text: esc(t('wz_explorer_kurz')) },
  ].map(werkzeugKachel).join('');

  // ---- Entdecken (Zeilen) --------------------------------------------------
  const verweisZeilen = [
    { href: '#/songs', hue: 'pf-schiefer', icon: 'fa-play', titel: esc(t('nav_songs')) },
    { href: '#/experimentieren', hue: 'pf-violett', icon: 'fa-seedling', titel: esc(t('nav_experimentieren')) },
    { href: '#/ueber', hue: 'pf-blau', icon: 'fa-compass', titel: esc(t('nav_ueber')) },
    { href: '#/profil', hue: 'pf-blau', icon: 'fa-user', titel: esc(t('nav_profil')) },
  ].map(verweisZeile).join('');

  // „Fortsetzen wo du warst" (§3b): ein schmaler Streifen über die ganze Breite
  // (keine Kachel), nur wenn ein zuletzt geöffneter Baustein noch im Pool ist.
  const letzter = zuletzt();
  const fortsetzenStreifen = letzter?.baustein && daten.bausteinVonId.has(letzter.baustein)
    ? `<a class="heim-fortsetzen" href="#/baustein/${encodeURIComponent(letzter.baustein)}?kontext=kompetenz">
        <span class="heim-fortsetzen-icon"><i class="fa-solid fa-play" aria-hidden="true"></i></span>
        <span class="heim-fortsetzen-text">
          <span class="heim-fortsetzen-label">${esc(t('heim_fortsetzen'))}</span>
          <span class="heim-fortsetzen-titel">${esc(label('baustein', letzter.baustein))}</span>
        </span>
        <span class="heim-fortsetzen-pfeil" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
      </a>`
    : '';

  el.innerHTML = `
    ${markeHeroInszeniert(heroCta)}
    ${speicherIstVerfuegbar() ? '' : `<div class="banner-hinweis">${esc(t('speicher_warnung'))}</div>`}
    ${fortsetzenStreifen}
    <h2 class="abschnitt-titel">${esc(t('instrumente'))}</h2>
    <div class="bild-gitter">
      ${instrumentKacheln}
      ${bandKachel}
    </div>
    <h2 class="abschnitt-titel">${esc(t('heim_gruppe_lernwege'))}</h2>
    <div class="bild-gitter">
      ${genreKachel}
      ${kontextKachel}
      ${trainingKachel}
      ${individualKachel}
      ${pruefungKachel}
    </div>
    <h2 class="abschnitt-titel">${esc(t('heim_gruppe_werkzeuge'))}</h2>
    <div class="werkzeug-gitter">${werkzeugKacheln}</div>
    <h2 class="abschnitt-titel">${esc(t('heim_gruppe_entdecken'))}</h2>
    <div class="verweis-liste">${verweisZeilen}</div>`;
}
