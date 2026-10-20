// Pattern-Werkzeug: interaktive Referenz typischer Riffs (TAB) und Drumpattern
// pro Genre. Buildfrei, offline-fähig. Klang aus den Stimmen des Audio-Kerns
// (Sample-Bank für Schlagzeug, Gitarre und Bass; Synthese als Rückfall).
// Referenzbereich wie das Stimmungs-Werkzeug: NICHT im
// Baustein-Pool, kein Fortschritt.
//
// Zustand ist flüchtig und gerätelokal (Modul-State wie in der Suche): das gewählte
// Genre überlebt ein Neu-Rendern, aber keinen Reload.

import { label, t, text } from '../i18n.js';
import { domaeneIcon, esc, registriereAufraeumen } from '../oberflaeche.js';
import { aktiviere, holeAusgang, holeKontext as holeKernKontext } from '../audio/kontext.js';
import { crash, hihat, kick, saite, snare } from '../audio/stimmen.js';
import { frequenzVon } from './stimmungen.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

let aktivesGenre = null;
let laufTimer = [];
let tempoFaktor = 1; // globaler Tempo-Regler (0.5–1.5), skaliert alle Patterns
let loopAn = false; // Loop-Schalter: Pattern wiederholt bis Stopp
let loopTimer = null;
// Alle eingeplanten Klangquellen der laufenden Wiedergabe — damit ein neuer Start
// oder der Stopp-Knopf die noch geplanten Töne abbrechen kann (sonst Überlagerung).
let aktiveKlaenge = [];

function reduziert() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Der gemeinsame Audio-Kern statt eines zweiten AudioContext (CLAUDE.md: EIN
// Kontext fuer alles). Der alte lokale Kontext resumte ausserdem nur bei
// state === 'suspended' — nach einer Unterbrechung durch das Betriebssystem
// (iOS: 'interrupted') blieb dieses Werkzeug dauerhaft stumm, ohne Hinweis.
function holeKontext() {
  const ctx = holeKernKontext();
  if (ctx.state !== 'running') ctx.resume?.().catch(() => {});
  return ctx;
}

// Merkt eine Klangquelle für den späteren Abbruch vor.
function merke(quelle) {
  aktiveKlaenge.push(quelle);
  // Im Dauerloop kamen pro Runde neue Quellen dazu, ohne dass je eine aus der
  // Liste fiel — nach ein paar Minuten haengen dort Tausende beendeter Nodes.
  quelle.addEventListener?.('ended', () => {
    const i = aktiveKlaenge.indexOf(quelle);
    if (i !== -1) aktiveKlaenge.splice(i, 1);
  });
  return quelle;
}

// Bricht alle noch geplanten/laufenden Töne ab (idempotent) und stoppt den Loop.
function stoppeKlang() {
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
  for (const quelle of aktiveKlaenge) {
    try {
      quelle.stop();
    } catch {
      /* schon gestoppt/beendet — egal */
    }
  }
  aktiveKlaenge = [];
}

// Klang kommt aus den Stimmen des Audio-Kerns (Sample-Bank, Synthese als
// Rückfall) — hier stand früher eine zweite, eigene Synthese, die beim Umstieg
// auf echte Samples stehen geblieben wäre. Jede Stimme liefert ihre Quellen,
// damit der Stopp-Knopf sie abbrechen kann.
const merkeAlle = (quellen) => quellen.forEach(merke);
const DRUM_STIMME = Object.fromEntries(
  Object.entries({ kick, snare, hihat, crash }).map(([name, stimme]) => [
    name,
    (ctx, t0) => merkeAlle(stimme(ctx, holeAusgang(), t0)),
  ])
);
// Anzeigereihenfolge oben→unten und Symbol je Spur (Beat-Raster-Konvention).
const SPUR_ORDNUNG = ['crash', 'hihat', 'snare', 'kick'];

// Ein Schritt ist per Vorgabe eine Achtel. `aufloesung` (Schritte pro 4/4-Takt)
// erlaubt dichtere Raster — 16 macht daraus Sechzehntel. Ohne das Feld spielten
// Muster, deren Hinweis ausdruecklich von Sechzehnteln spricht (Gravity-Blast,
// Blast-Sektion), nur halb so dicht wie beschrieben.
function schrittDauer(pattern) {
  const proTakt = pattern.aufloesung || 8;
  return 240 / (proTakt * pattern.bpm * tempoFaktor);
}

function stoppeLauf() {
  laufTimer.forEach((id) => clearTimeout(id));
  laufTimer = [];
}

// Markiert die laufende Spalte im Raster mit; rein visuell, an die Audio-Zeit
// gekoppelt. Bei erneutem Start werden alte Timer verworfen. Bei
// prefers-reduced-motion bleibt die Wandermarkierung aus (Ton läuft trotzdem).
function markiereLauf(karte, ctx, start, step, anzahl) {
  stoppeLauf();
  for (const zelle of karte.querySelectorAll('.schritt-aktiv')) zelle.classList.remove('schritt-aktiv');
  if (reduziert()) return;
  for (let i = 0; i < anzahl; i++) {
    const verzoegerung = Math.max(0, (start + i * step - ctx.currentTime) * 1000);
    laufTimer.push(
      setTimeout(() => {
        for (const zelle of karte.querySelectorAll('.schritt-aktiv')) zelle.classList.remove('schritt-aktiv');
        for (const zelle of karte.querySelectorAll(`[data-schritt="${i}"]`)) zelle.classList.add('schritt-aktiv');
      }, verzoegerung)
    );
  }
  const ende = Math.max(0, (start + anzahl * step - ctx.currentTime) * 1000);
  laufTimer.push(
    setTimeout(() => {
      for (const zelle of karte.querySelectorAll('.schritt-aktiv')) zelle.classList.remove('schritt-aktiv');
    }, ende)
  );
}

// Plant eine Runde ein (ohne vorher zu stoppen) und gibt Timing + Schrittzahl
// zurück, damit der Loop die nächste Runde am Ende neu planen kann.
function planeTab(pattern, karte, start) {
  const ctx = holeKontext();
  const step = schrittDauer(pattern);
  const instrument = pattern.domaene === 'bass' ? 'bass' : 'gitarre';
  const klang = pattern.klang === 'clean' ? 'clean' : 'zerre';
  pattern.schritte.forEach((schritt, i) => {
    const t0 = start + i * step;
    // Ein Akkord soll nicht lauter sein als ein Einzelton — die Stimmen sind
    // nicht phasengleich, ihre Pegel addieren sich also etwa im Quadrat.
    const pegel = 0.7 / Math.sqrt(Math.max(1, schritt.length));
    for (const { saite: nr, bund } of schritt) {
      const offen = frequenzVon(pattern.stimmung[nr]);
      if (!offen) continue;
      merkeAlle(saite(ctx, holeAusgang(), t0, { frequenz: offen * 2 ** (bund / 12), instrument, klang, dauer: step * 1.5, pegel }));
    }
  });
  markiereLauf(karte, ctx, start, step, pattern.schritte.length);
  return { step, anzahl: pattern.schritte.length };
}

function planeDrums(pattern, karte, start) {
  const ctx = holeKontext();
  const step = schrittDauer(pattern);
  const spuren = pattern.spuren || {};
  const anzahl = Math.max(0, ...SPUR_ORDNUNG.map((s) => spuren[s]?.length || 0));
  for (let i = 0; i < anzahl; i++) {
    const t0 = start + i * step;
    for (const spur of SPUR_ORDNUNG) {
      if (spuren[spur]?.[i]) DRUM_STIMME[spur](ctx, t0);
    }
  }
  markiereLauf(karte, ctx, start, step, anzahl);
  return { step, anzahl };
}

// Eine Runde spielen und — wenn Loop an ist — am Ende die nächste planen.
// Jede Runde wird auf der Audio-Uhr geplant; der Timer weckt nur zum Nachplanen
// der naechsten. Frueher setzte jede Runde neu bei `currentTime + 0.07` an — der
// Vorlauf kam also bei JEDEM Durchgang oben drauf: eine hoerbare Luecke am
// Rundenwechsel, deren Fehler sich ueber die Zeit aufsummierte. Jetzt traegt
// `naechsterStart` die exakte Grenze weiter, und der Timer feuert davor.
function laufeEinmal(pattern, karte, start = null) {
  const ctx = holeKontext();
  const ab = start != null && start > ctx.currentTime ? start : ctx.currentTime + 0.07;
  const { step, anzahl } = pattern.typ === 'drums' ? planeDrums(pattern, karte, ab) : planeTab(pattern, karte, ab);
  if (loopAn && anzahl > 0) {
    const ende = ab + anzahl * step;
    const weckung = Math.max(0, (ende - ctx.currentTime) * 1000 - 60);
    loopTimer = setTimeout(() => {
      if (loopAn) laufeEinmal(pattern, karte, ende);
    }, Math.round(weckung));
  }
}

// Frischer Start: laufende Wiedergabe abbrechen, dann eine Runde (ggf. Loop).
// Startet, sobald Kontext und Sample-Bank bereit sind (aktiviere() wartet
// höchstens kurz auf die Bank) — sonst spielte der erste Durchgang die
// Synthese und der zweite die Samples.
function startePattern(pattern, karte) {
  stoppeKlang();
  aktiviere().then(() => laufeEinmal(pattern, karte));
}

// --- Rendern ---
function tabRasterHtml(pattern) {
  // Saiten von hoch (oben) nach tief (unten) — wie klassische TAB-Notation.
  const zeilen = [...pattern.stimmung.keys()].reverse();
  const kopf = pattern.stimmung
    .map((note) => note.replace('#', '♯').replace('b', '♭').replace(/-?\d/, ''))
    .reverse();
  const reihen = zeilen
    .map((saiteIndex, z) => {
      const zellen = pattern.schritte
        .map((schritt, i) => {
          const treffer = schritt.find((n) => n.saite === saiteIndex);
          const inhalt = treffer ? String(treffer.bund) : '';
          return `<td class="tab-zelle${treffer ? ' tab-treffer' : ''}" data-schritt="${i}">${esc(inhalt)}</td>`;
        })
        .join('');
      return `<tr><th scope="row" class="tab-saite">${esc(kopf[z])}</th>${zellen}</tr>`;
    })
    .join('');
  return `<table class="tab-raster" aria-label="${esc(t('pattern_tab_aria'))}"><tbody>${reihen}</tbody></table>`;
}

function drumRasterHtml(pattern) {
  const daten = pattern.spuren || {};
  const spuren = SPUR_ORDNUNG.filter((s) => daten[s]?.some((v) => v));
  const anzahl = spuren.length ? Math.max(...spuren.map((s) => daten[s].length)) : 0;
  const pause = t('pattern_pause');
  const reihen = spuren
    .map((spur) => {
      const spurName = t('pattern_spur_' + spur);
      const zellen = [];
      for (let i = 0; i < anzahl; i++) {
        const an = daten[spur][i];
        // Sichtbar: CSS-Form (aria-hidden). Für Screenreader: Spurname bei Treffer,
        // sonst „Pause" — sonst wäre das Drum-Raster eine Tabelle aus leeren Zellen.
        const srText = an ? spurName : pause;
        zellen.push(
          `<td class="drum-zelle${an ? ` drum-an drum-${spur}` : ''}" data-schritt="${i}"><span class="drum-mark" aria-hidden="true"></span><span class="nur-sr">${esc(srText)}</span></td>`
        );
      }
      return `<tr><th scope="row" class="drum-spur">${esc(spurName)}</th>${zellen.join('')}</tr>`;
    })
    .join('');
  return `<table class="drum-raster" aria-label="${esc(t('pattern_drum_aria'))}"><tbody>${reihen}</tbody></table>`;
}

function patternKarteHtml(pattern) {
  const raster = pattern.typ === 'drums' ? drumRasterHtml(pattern) : tabRasterHtml(pattern);
  const bpm = t('pattern_bpm', { n: pattern.bpm });
  return `
    <article class="pattern-karte" data-pattern="${esc(pattern.id)}">
      <div class="pattern-kopf">
        <h3>${domaeneIcon(pattern.domaene)} ${esc(text(pattern.titel))}</h3>
        <button type="button" class="chip chip-waehlbar pattern-play" aria-label="${esc(t('pattern_play_aria', { name: text(pattern.titel) }))}">
          <i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(t('pattern_play'))}
        </button>
      </div>
      <p class="leise pattern-meta">${esc(label('domaene', pattern.domaene))} · ${esc(bpm)}</p>
      <div class="pattern-raster">${raster}</div>
      <p class="pattern-hinweis">${esc(text(pattern.hinweis) || '')}</p>
    </article>`;
}

export function renderPatterns(el, daten, genreParam) {
  // stoppeKlang() zusaetzlich zu stoppeLauf(): der Genre-Wechsel rendert die
  // Ansicht neu, der laufende Loop lief aber weiter — und der frisch gezeichnete
  // Stopp-Knopf gehoerte zu einer anderen Karte. Der Ton liess sich dann nur
  // noch ueber einen Routenwechsel beenden. Beide Funktionen sind idempotent.
  stoppeKlang();
  stoppeLauf();
  const alle = (daten.patterns && daten.patterns.patterns) || [];
  // Genres in Erscheinungsreihenfolge, jedes nur einmal.
  const genres = [];
  for (const p of alle) if (!genres.includes(p.genre)) genres.push(p.genre);
  // Genre aus dem Deep-Link (#/patterns/<genre>) hat Vorrang, sonst Modul-State.
  if (genreParam && genres.includes(genreParam)) aktivesGenre = genreParam;
  if (!genres.includes(aktivesGenre)) aktivesGenre = genres[0] || null;
  const sichtbar = alle.filter((p) => p.genre === aktivesGenre);

  const genreKnoepfe = genres
    .map(
      (g) => `
      <button type="button" class="chip chip-waehlbar ${g === aktivesGenre ? 'chip-akzent' : ''}" data-genre="${esc(g)}" aria-pressed="${g === aktivesGenre}">
        ${esc(label('stil', g))}
      </button>`
    )
    .join(' ');

  const karten = sichtbar.map(patternKarteHtml).join('');
  const genreLink = aktivesGenre
    ? `<a class="chip" href="#/pfad/stil/${esc(aktivesGenre)}">${esc(t('pattern_zum_pfad', { name: label('stil', aktivesGenre) }))}</a>`
    : '';

  el.innerHTML = `
    <article>
      ${landingHeroHtml('fa-repeat', t('nav_patterns'), t('pattern_untertitel'), 'pf-teal', 'patterns')}
      <p class="chip-zeile">${genreKnoepfe}</p>
      <div class="pattern-steuerung">
        <label class="pattern-tempo-feld">${esc(t('pattern_tempo'))}
          <input type="range" class="pattern-tempo" min="50" max="150" step="10" value="${Math.round(tempoFaktor * 100)}" aria-label="${esc(t('pattern_tempo_aria'))}">
          <span class="pattern-tempo-wert" aria-live="polite">${Math.round(tempoFaktor * 100)} %</span>
        </label>
        <button type="button" class="chip chip-waehlbar pattern-loop ${loopAn ? 'chip-akzent' : ''}" aria-pressed="${loopAn}">
          <i class="fa-solid fa-repeat" aria-hidden="true"></i> ${esc(t('pattern_loop'))}
        </button>
      </div>
      <p class="chip-zeile">
        ${genreLink}
        <button type="button" class="chip chip-waehlbar pattern-stopp" hidden>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i> ${esc(t('pattern_stopp'))}
        </button>
      </p>
      <p class="leise pattern-status" role="status" aria-live="polite"></p>
      <div class="pattern-liste">${karten}</div>
      <p class="leise">${esc(t('pattern_hinweis_pegel'))}</p>
    </article>`;

  const status = el.querySelector('.pattern-status');
  const stoppKnopf = el.querySelector('.pattern-stopp');

  function beende() {
    stoppeKlang();
    stoppeLauf();
    for (const zelle of el.querySelectorAll('.schritt-aktiv')) zelle.classList.remove('schritt-aktiv');
    if (status) status.textContent = '';
    if (stoppKnopf) stoppKnopf.hidden = true;
  }

  for (const knopf of el.querySelectorAll('[data-genre]')) {
    knopf.addEventListener('click', () => {
      aktivesGenre = knopf.dataset.genre;
      // URL mitführen (Deep-Link/Reload), ohne einen zweiten Render auszulösen.
      if (window.history?.replaceState) {
        window.history.replaceState(null, '', `#/patterns/${encodeURIComponent(aktivesGenre)}`);
      }
      renderPatterns(el, daten);
      // Fokus nach dem Neu-Rendern auf den nun aktiven Chip zurückholen.
      el.querySelector(`[data-genre="${CSS.escape(aktivesGenre)}"]`)?.focus();
    });
  }
  for (const knopf of el.querySelectorAll('.pattern-play')) {
    knopf.addEventListener('click', () => {
      const karte = knopf.closest('.pattern-karte');
      const pattern = sichtbar.find((p) => p.id === karte.dataset.pattern);
      if (!pattern) return;
      startePattern(pattern, karte);
      if (status) status.textContent = t('pattern_spielt', { name: text(pattern.titel) });
      if (stoppKnopf) stoppKnopf.hidden = false;
    });
  }
  if (stoppKnopf) stoppKnopf.addEventListener('click', beende);

  const tempoRegler = el.querySelector('.pattern-tempo');
  const tempoWert = el.querySelector('.pattern-tempo-wert');
  if (tempoRegler) {
    tempoRegler.addEventListener('input', () => {
      tempoFaktor = Number(tempoRegler.value) / 100;
      if (tempoWert) tempoWert.textContent = `${tempoRegler.value} %`;
    });
  }
  const loopKnopf = el.querySelector('.pattern-loop');
  if (loopKnopf) {
    loopKnopf.addEventListener('click', () => {
      loopAn = !loopAn;
      loopKnopf.classList.toggle('chip-akzent', loopAn);
      loopKnopf.setAttribute('aria-pressed', String(loopAn));
      // Loop ausschalten stoppt nicht sofort — die laufende Runde spielt aus.
    });
  }

  // Beim Verlassen der Seite (Router-Wechsel) Klang + Lauf stoppen — sonst
  // spielt das Pattern im Hintergrund weiter (wie die übrigen Audio-Werkzeuge).
  registriereAufraeumen(beende);
}
