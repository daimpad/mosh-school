// Heim: Marken-Hero mit Einstiegs-CTAs plus die Bereich-Kacheln als Raster.
// Jede Kachel trägt eine eigene Hue (Icon-Medaille) + einen CTA. Der frühere
// Weiterlernen-/„Kapitel entdecken"-Container ist in den Hero gewandert; der
// Themen-Einstieg ist jetzt der Hero-CTA „Kapitel entdecken". Kompetenzpfad
// ist von der Startseite entfernt; dafür führen Regeln und Profil als Kacheln.

import { label, t } from '../i18n.js';
import { esc, markeHeroGross } from '../oberflaeche.js';
import { stile, umgebungBausteine } from '../pfade.js';
import { diagnose, speicherIstVerfuegbar, zuletzt } from '../zustand.js';
import { zielLabels } from './zielwahl.js';

export function renderHeim(el, daten) {
  const d = diagnose();
  const umgebung = umgebungBausteine(daten);
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
      <span class="pfad-medaille"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
      <div class="pfad-kachel-text">
        <h3>${titel}${meta}</h3>
        ${text ? `<p class="leise">${text}</p>` : ''}
        ${extra}
        ${cta}
      </div>
    </a>`;

  const umgebungKachel = umgebung.length > 0
    ? kachel({
        href: '#/pfad/umgebung', hue: 'pf-sky', icon: 'fa-users',
        titel: esc(t('pfad_umgebung')),
        meta: ` <span class="chip">${esc(t('n_bausteine', { n: umgebung.length }))}</span>`,
        text: esc(t('pfad_umgebung_text')),
      })
    : '';

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

  // „Fortsetzen wo du warst" (§3b): nur wenn ein zuletzt geöffneter Baustein
  // existiert und noch im Pool ist. Steht als erste Kachel oben.
  const letzter = zuletzt();
  const fortsetzenKachel = letzter?.baustein && daten.bausteinVonId.has(letzter.baustein)
    ? kachel({
        href: `#/baustein/${encodeURIComponent(letzter.baustein)}?kontext=kompetenz`,
        hue: 'pf-magenta', icon: 'fa-play',
        titel: esc(t('heim_fortsetzen')),
        text: esc(label('baustein', letzter.baustein)),
      })
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

  el.innerHTML = `
    ${markeHeroGross(heroCta)}
    ${speicherIstVerfuegbar() ? '' : `<div class="banner-hinweis">${esc(t('speicher_warnung'))}</div>`}
    <h2 class="abschnitt-titel">${esc(t('pfade'))}</h2>
    <div class="pfad-gitter">
      ${fortsetzenKachel}
      ${umgebungKachel}
      ${genreKachel}
      ${trainingKachel}
      ${individualKachel}
      ${werkzeugeKachel}
      ${songsKachel}
      ${profilKachel}
    </div>`;
}
