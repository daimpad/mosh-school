// Beispielsongs: Referenzbereich, der pro Genre zehn stilistisch breit gestreute
// Songs als anklickbare Links zeigt — zufällig gezogen aus einem Pool von 30.
// Wie Stimmungen/Patterns NICHT im Baustein-Pool, kein Fortschritt.
//
// Die Ziehung ist gerätelokal in einem eigenen localStorage-Namespace
// (moshschool.songs.v1) — bewusst getrennt vom versionierten Fortschritts-Schema
// (zustand.js). So würfelt ein normaler Reload nicht ungewollt neu; nur der
// „Neu würfeln"-Knopf zieht bewusst neu. Ohne Speicher fällt alles auf eine
// frische Ziehung je Aufruf zurück.

import { t } from '../i18n.js';
import { esc } from '../oberflaeche.js';

const SPEICHER = 'moshschool.songs.v1';
const TRENNER = '␟'; // Symbol for Unit Separator — trennt Künstler|Titel im Schlüssel.

// Fisher-Yates: zieht `anzahl` Einträge ohne Wiederholung aus dem Pool.
function ziehe(pool, anzahl = 10) {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(anzahl, a.length));
}

function songSchluessel(song) {
  return `${song.kuenstler}${TRENNER}${song.titel}`;
}

// localStorage defensiv: privater Modus / gesperrter Speicher darf nie crashen.
function ladeSpeicher() {
  try {
    return JSON.parse(localStorage.getItem(SPEICHER) || '{}') || {};
  } catch {
    return {};
  }
}
function merkeZiehung(slug, songs) {
  try {
    const alles = ladeSpeicher();
    alles[slug] = songs.map(songSchluessel);
    localStorage.setItem(SPEICHER, JSON.stringify(alles));
  } catch {
    /* Speicher nicht verfügbar — Ziehung bleibt nur für diese Ansicht bestehen. */
  }
}

// Bestimmt die anzuzeigenden 10 Songs: gespeicherte Ziehung, falls sie noch
// vollständig auflösbar ist (Reload-stabil), sonst frisch ziehen und merken.
function holeZiehung(genre) {
  const nachSchluessel = new Map(genre.songs.map((s) => [songSchluessel(s), s]));
  const gemerkt = ladeSpeicher()[genre.slug];
  if (Array.isArray(gemerkt)) {
    const aufgeloest = gemerkt.map((k) => nachSchluessel.get(k)).filter(Boolean);
    if (aufgeloest.length === Math.min(10, genre.songs.length)) return aufgeloest;
  }
  const frisch = ziehe(genre.songs, 10);
  merkeZiehung(genre.slug, frisch);
  return frisch;
}

function quelleLabel(quelle) {
  if (quelle === 'youtube') return t('songs_quelle_yt');
  if (quelle === 'bandcamp') return t('songs_quelle_bc');
  return quelle || '';
}

function songZeile(song) {
  const kopf = `${song.kuenstler} – ${song.titel}`;
  const quelle = quelleLabel(song.quelle);
  const ariaLabel = `${kopf}${song.substil_vermerk ? ', ' + song.substil_vermerk : ''} — ${quelle}, ${t('songs_neuer_tab')}`;
  return `
    <li class="song-zeile">
      <a class="song-link" href="${esc(song.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(ariaLabel)}">
        <span class="song-haupt">${esc(kopf)}</span>
        ${song.substil_vermerk ? `<span class="song-substil leise">${esc(song.substil_vermerk)}</span>` : ''}
      </a>
      <span class="song-quelle" aria-hidden="true">${esc(quelle)}</span>
    </li>`;
}

function genreChips(genres, aktiv) {
  return genres
    .map((g) => {
      const ist = g.slug === aktiv.slug;
      return `<a class="chip song-chip${ist ? ' aktiv' : ''}" href="#/songs/${encodeURIComponent(g.slug)}"${ist ? ' aria-current="page"' : ''}>${esc(g.genre)}</a>`;
    })
    .join('');
}

export function renderSongs(el, daten, slug) {
  const genres = daten.songs || [];
  if (genres.length === 0) {
    el.innerHTML = `<article><p class="leise">${esc(t('songs_leer'))}</p></article>`;
    return;
  }
  const aktiv = genres.find((g) => g.slug === slug) || genres[0];
  const gezogen = holeZiehung(aktiv);

  el.innerHTML = `
    <article>
      <section class="marke-hero klein hue pf-magenta">
        <span class="marke-hero-icon"><i class="fa-solid fa-play" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('songs_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('songs_untertitel'))}</p>
        </div>
      </section>

      <nav class="song-genres" aria-label="${esc(t('songs_genre_waehlen'))}">${genreChips(genres, aktiv)}</nav>

      <div class="song-kopf">
        <h2 class="abschnitt-titel">${esc(aktiv.genre)}</h2>
        <button type="button" class="knopf knopf-sekundaer song-wuerfeln">
          <i class="fa-solid fa-rotate" aria-hidden="true"></i> ${esc(t('songs_wuerfeln'))}
        </button>
      </div>

      <ul class="song-liste" aria-live="polite">${gezogen.map(songZeile).join('')}</ul>
      <p class="leise song-fuss">${esc(t('songs_hinweis'))}</p>
    </article>`;

  const knopf = el.querySelector('.song-wuerfeln');
  if (knopf) {
    knopf.addEventListener('click', () => {
      const frisch = ziehe(aktiv.songs, 10);
      merkeZiehung(aktiv.slug, frisch);
      const liste = el.querySelector('.song-liste');
      if (liste) liste.innerHTML = frisch.map(songZeile).join('');
    });
  }
}
