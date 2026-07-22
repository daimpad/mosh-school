// Heim: Marken-Hero mit Einstiegs-CTAs plus die Bereich-Kacheln als Raster.
// Jede Kachel trägt eine eigene Hue (Icon-Medaille) + einen CTA. Der frühere
// Weiterlernen-/„Kapitel entdecken"-Container ist in den Hero gewandert; der
// Themen-Einstieg ist jetzt der Hero-CTA „Kapitel entdecken". Kompetenzpfad
// ist von der Startseite entfernt; dafür führen Regeln und Profil als Kacheln.

import { label, t } from '../i18n.js';
import { domaeneIcon, esc, markeHeroGross } from '../oberflaeche.js';
import { INSTRUMENTE, bandAnzahl, instrumentUebersicht, stile } from '../pfade.js';
import { diagnose, speicherIstVerfuegbar, zuletzt } from '../zustand.js';
import { zielLabels } from './zielwahl.js';

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

  // Eine Bereich-Kachel: farbige Icon-Medaille (Hue) + Titel + Kurztext + CTA.
  // Die ganze Kachel ist ein Link; der CTA verstärkt die Aktion sichtbar.
  const cta = `<span class="pfad-cta">${esc(t('ansehen'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>`;
  const kachel = ({ href, hue, icon, titel, meta = '', text = '', extra = '' }) => `
    <a class="karte karte-link pfad-kachel ${hue}" href="${esc(href)}">
      <div class="pfad-kachel-kopf">
        <span class="pfad-medaille"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
        <h3>${titel}${meta}</h3>
      </div>
      <div class="pfad-kachel-text">
        ${text ? `<p class="leise">${text}</p>` : ''}
        ${extra}
        ${cta}
      </div>
    </a>`;

  const trainingKachel = kachel({
    href: '#/training', hue: 'pf-indigo', icon: 'fa-list-check',
    titel: esc(t('pfad_training')),
    meta: ` <span class="chip">${esc(t('n_einheiten', { n: daten.einheiten.length }))}</span>`,
    text: esc(t('pfad_training_text')),
  });

  // Individualpfad zeigt gewählte Ziele — der Leer-Zustand („Keine Ziele gewählt")
  // erscheint hier nicht mehr; ohne Ziel bleibt nur Beschreibung + CTA.
  const individualKachel = kachel({
    href: '#/pfad/individual', hue: 'pf-violett', icon: 'fa-bullseye',
    titel: esc(t('pfad_individual')),
    text: esc(t('pfad_individual_text')),
    extra: zielBeschriftungen.length > 0
      ? `<p class="leise pfad-kachel-ziel">${esc(t('ziel_aktuell'))}: ${esc(zielBeschriftungen.join(' · '))}</p>`
      : '',
  });

  const genres = stile(daten);
  const genreKachel = genres.length > 0
    ? kachel({
        href: '#/pfad/stil', hue: 'pf-magenta', icon: 'fa-fire',
        titel: esc(t('pfad_stil')),
        meta: ` <span class="chip">${esc(t('n_genres', { n: genres.length }))}</span>`,
        text: esc(t('pfad_stil_text')),
      })
    : '';

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

  const werkzeugeKachel = kachel({
    href: '#/werkzeuge', hue: 'pf-teal', icon: 'fa-toolbox',
    titel: esc(t('nav_werkzeuge')),
    text: esc(t('wz_hub_untertitel')),
  });

  const songsKachel = kachel({
    href: '#/songs', hue: 'pf-schiefer', icon: 'fa-play',
    titel: esc(t('nav_songs')),
    text: esc(t('songs_untertitel')),
  });

  const profilKachel = kachel({
    href: '#/profil', hue: 'pf-blau', icon: 'fa-user',
    titel: esc(t('nav_profil')),
    text: esc(t('profil_intro')),
  });

  // Instrument-Kacheln (Gitarre/Bass/Drums/Vocals) + Band-Querschnitt.
  const instrumentKacheln = instrumentUebersicht(daten)
    .map(({ domaene, anzahl }) => `
      <a class="karte karte-link pfad-kachel instr-kachel pf-blau" href="#/instrument/${esc(domaene)}">
        <div class="pfad-kachel-kopf">
          <span class="pfad-medaille">${domaeneIcon(domaene)}</span>
          <h3>${esc(label('domaene', domaene))}</h3>
        </div>
        <div class="pfad-kachel-text"><p class="leise">${esc(t('n_bausteine', { n: anzahl }))}</p>${cta}</div>
      </a>`)
    .join('');
  const bandKachel = `
    <a class="karte karte-link pfad-kachel band-kachel pf-schiefer" href="#/band">
      <div class="pfad-kachel-kopf">
        <span class="pfad-medaille"><i class="fa-solid fa-users" aria-hidden="true"></i></span>
        <h3>${esc(t('band_titel'))}</h3>
      </div>
      <div class="pfad-kachel-text"><p class="leise">${esc(t('band_kachel_text'))}</p>${cta}</div>
    </a>`;

  el.innerHTML = `
    ${markeHeroGross(heroCta)}
    ${speicherIstVerfuegbar() ? '' : `<div class="banner-hinweis">${esc(t('speicher_warnung'))}</div>`}
    ${fortsetzenStreifen}
    <h2 class="abschnitt-titel">${esc(t('instrumente'))}</h2>
    <div class="pfad-gitter">
      ${instrumentKacheln}
      ${bandKachel}
    </div>
    <h2 class="abschnitt-titel">${esc(t('pfade'))}</h2>
    <div class="pfad-gitter">
      ${genreKachel}
      ${songsKachel}
      ${trainingKachel}
      ${individualKachel}
      ${werkzeugeKachel}
      ${profilKachel}
    </div>`;
}
