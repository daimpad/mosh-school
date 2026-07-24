// Aktivitäts-Hubs (D6, Teil 1): die drei tätigkeitsorientierten Sammelseiten
// Lernen · Üben · Songwriting (Experimentieren hat eine eigene View). Jede Hub
// ist eine Landing mit gruppierten Kacheln, die auf bestehende Routen zeigen —
// KEINE neuen Inhalte, nur eine Ordnung nach Tätigkeit. Werkzeuge dürfen bewusst
// in mehreren Hubs auftauchen (z. B. Klick-Track in Üben und Songwriting).
//
// Reine Präsentation: liest nur Daten/Engine, mutiert nie. Der Fortschritt bleibt
// hub-übergreifend (ein Zustand), die Hubs sind nur der Ort der Ausführung.

import { label, t } from '../i18n.js';
import { bausteinIcon, domaeneIcon, esc } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';
import { instrumentUebersicht } from '../pfade.js';

// Die Songwriting-Lernbausteine (data/bausteine.songwriting.json). Bewusst als ID-
// Liste hier gepflegt (wie die Region-Regeln im Gear-Explorer) — sie tragen keine
// eigene Domäne, über die man sie sonst als Gruppe fassen könnte. Nicht mehr
// vorhandene IDs werden beim Rendern still übersprungen.
const SONGWRITING_BAUSTEINE = [
  'songidee_teilen',
  'riff_zu_part_entwickeln',
  'uebergaenge_arrangieren',
  'song_arrangieren_ganz',
  'parts_verteilen',
  'text_thema_gesang',
  'pre_production_plan',
];

// Kompakte Baustein-Links (wie die Equipment-Landing): Icon + Titel + Pfeil.
function bausteinLinks(daten, ids) {
  return ids
    .filter((id) => daten.bausteinVonId?.has(id))
    .map(
      (id) => `<a class="karte karte-link geraete-eintrag" href="#/baustein/${esc(id)}?kontext=kompetenz">
        <span class="geraete-eintrag-icon">${bausteinIcon(id) || '<i class="fa-solid fa-pen-nib" aria-hidden="true"></i>'}</span>
        <span class="geraete-eintrag-text">${esc(label('baustein', id))}</span>
        <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </a>`,
    )
    .join('');
}

const cta = `<span class="pfad-cta">${esc(t('ansehen'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>`;

function kachel({ href, hue, icon, titel, text = '' }) {
  return `
    <a class="karte karte-link pfad-kachel ${hue}" href="${esc(href)}">
      <div class="pfad-kachel-kopf">
        <span class="pfad-medaille"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
        <h3>${esc(titel)}</h3>
      </div>
      <div class="pfad-kachel-text">
        ${text ? `<p class="leise">${esc(text)}</p>` : ''}
        ${cta}
      </div>
    </a>`;
}

// Instrument-Kacheln (nur im Lernen-Hub) mit Instrument-SVG statt fa-Icon.
function instrumentKacheln(daten) {
  return instrumentUebersicht(daten)
    .map(({ domaene, anzahl }) => `
      <a class="karte karte-link pfad-kachel instr-kachel pf-blau" href="#/instrument/${esc(domaene)}">
        <div class="pfad-kachel-kopf">
          <span class="pfad-medaille">${domaeneIcon(domaene)}</span>
          <h3>${esc(label('domaene', domaene))}</h3>
        </div>
        <div class="pfad-kachel-text"><p class="leise">${esc(t('n_bausteine', { n: anzahl }))}</p>${cta}</div>
      </a>`)
    .join('');
}

// Ein Hub rendern: Hero + benannte Abschnitte mit Kachelrastern.
function renderHub(el, { icon, titel, untertitel, hue }, abschnitte) {
  const bloecke = abschnitte
    .map(
      (a) => `
      <h2 class="abschnitt-titel">${esc(a.titel)}</h2>
      <div class="${a.container || 'pfad-gitter'}${a.klasse ? ` ${a.klasse}` : ''}">${a.kacheln}</div>`,
    )
    .join('');
  el.innerHTML = `
    ${landingHeroHtml(icon, titel, untertitel, hue, null)}
    ${bloecke}`;
}

export function renderLernen(el, daten) {
  renderHub(
    el,
    { icon: 'fa-book-open', titel: t('nav_lernen'), untertitel: t('hub_lernen_intro'), hue: 'pf-blau' },
    [
      { titel: t('instrumente'), klasse: 'instr-gitter', kacheln: instrumentKacheln(daten) },
      {
        titel: t('hub_lernen_wege'),
        kacheln: [
          kachel({ href: '#/pfad/stil', hue: 'pf-magenta', icon: 'fa-fire', titel: t('pfad_stil'), text: t('pfad_stil_text') }),
          kachel({ href: '#/pfad/umgebung', hue: 'pf-sky', icon: 'fa-people-group', titel: t('pfad_umgebung'), text: t('pfad_umgebung_text') }),
          kachel({ href: '#/pfad/kompetenz', hue: 'pf-indigo', icon: 'fa-stairs', titel: t('pfad_kompetenz'), text: t('pfad_kompetenz_text') }),
          kachel({ href: '#/suche', hue: 'pf-schiefer', icon: 'fa-magnifying-glass', titel: t('nav_suche'), text: t('hub_suche_text') }),
        ].join(''),
      },
      {
        titel: t('hub_lernen_wissen'),
        kacheln: [
          kachel({ href: '#/werkzeug/explorer', hue: 'pf-teal', icon: 'fa-microchip', titel: t('wz_explorer_titel'), text: t('wz_explorer_kurz') }),
          kachel({ href: '#/koennenscheck', hue: 'pf-teal', icon: 'fa-flag-checkered', titel: t('nav_koennenscheck'), text: t('koennenscheck_untertitel') }),
        ].join(''),
      },
    ],
  );
}

export function renderUeben(el, daten) {
  renderHub(
    el,
    { icon: 'fa-list-check', titel: t('nav_ueben'), untertitel: t('hub_ueben_intro'), hue: 'pf-indigo' },
    [
      {
        titel: t('hub_ueben_arbeiten'),
        kacheln: [
          kachel({ href: '#/training', hue: 'pf-indigo', icon: 'fa-list-check', titel: t('pfad_training'), text: t('pfad_training_text') }),
          kachel({ href: '#/profil', hue: 'pf-blau', icon: 'fa-user', titel: t('nav_profil'), text: t('hub_fortschritt_text') }),
        ].join(''),
      },
      {
        titel: t('hub_ueben_werkzeuge'),
        kacheln: [
          kachel({ href: '#/werkzeug/metronom', hue: 'pf-teal', icon: 'fa-stopwatch', titel: t('wz_metronom_titel'), text: t('wz_metronom_kurz') }),
          kachel({ href: '#/werkzeug/stimmgeraet', hue: 'pf-teal', icon: 'fa-wave-square', titel: t('wz_stimmgeraet_titel'), text: t('wz_stimmgeraet_kurz') }),
          kachel({ href: '#/werkzeug/loops', hue: 'pf-teal', icon: 'fa-drum', titel: t('wz_loops_titel'), text: t('wz_loops_kurz') }),
          kachel({ href: '#/patterns', hue: 'pf-indigo', icon: 'fa-repeat', titel: t('nav_patterns'), text: t('pattern_untertitel') }),
        ].join(''),
      },
    ],
  );
}

export function renderSongwriting(el, daten) {
  renderHub(
    el,
    { icon: 'fa-pen-nib', titel: t('nav_songwriting'), untertitel: t('hub_songwriting_intro'), hue: 'pf-violett' },
    [
      {
        titel: t('hub_songwriting_lernen'),
        container: 'geraete-liste',
        kacheln: bausteinLinks(daten, SONGWRITING_BAUSTEINE),
      },
      {
        titel: t('hub_songwriting_werkzeuge'),
        kacheln: [
          kachel({ href: '#/werkzeug/struktur', hue: 'pf-violett', icon: 'fa-diagram-project', titel: t('wz_struktur_titel'), text: t('wz_struktur_kurz') }),
          kachel({ href: '#/werkzeug/recorder', hue: 'pf-magenta', icon: 'fa-microphone', titel: t('wz_recorder_titel'), text: t('wz_recorder_kurz') }),
          kachel({ href: '#/werkzeug/mehrspur', hue: 'pf-magenta', icon: 'fa-layer-group', titel: t('wz_mehrspur_titel'), text: t('wz_mehrspur_kurz') }),
        ].join(''),
      },
      {
        titel: t('hub_songwriting_klang'),
        kacheln: [
          kachel({ href: '#/werkzeug/pedalboard', hue: 'pf-teal', icon: 'fa-sliders', titel: t('wz_pedalboard_titel'), text: t('wz_pedalboard_kurz') }),
          kachel({ href: '#/werkzeug/ampbox', hue: 'pf-teal', icon: 'fa-wave-square', titel: t('wz_ampbox_titel'), text: t('wz_ampbox_kurz') }),
          kachel({ href: '#/songs', hue: 'pf-schiefer', icon: 'fa-play', titel: t('nav_songs'), text: t('songs_untertitel') }),
        ].join(''),
      },
    ],
  );
}
