// Werkzeug: Gefühlslandkarte (Grenzgänger-Zweig). Zwei Blickrichtungen auf
// dieselben Daten (data/gefuehlslandkarte.json — 13 Genres, je 3–4 Gefühls-Tags,
// verortet auf x=Energie/Tempo und y=Grundton):
//
//   • „Genre → Gefühl" — die vertraute Punktwolke (monochrom, currentColor) mit
//     verbesserten Achsen (Titel + Endpunkt-Beschriftung + Pfeilspitzen).
//   • „Gefühl → Genre" — die Umkehr: ein farbiges Feld je Genre, das über den
//     Canvas fließt und sich mit den Nachbarn mischt (bewusst bunt — Ausnahme vom
//     Monochrom-System). Ein Gefühl anwählen hebt die Genres hervor, die es tragen.
//
// Kein Audio, kein Fortschritt — Referenzbereich. Zugänglichkeit: der Canvas ist
// dekorativ (aria-hidden); die eigentliche Bedienung läuft über tastaturbediente
// Chips (Gefühle + Genres) und ein aria-live-Ergebnisfeld. Die Drift-Animation
// respektiert prefers-reduced-motion und wird beim Verlassen aufgeräumt.

import { t } from '../i18n.js';
import { esc, registriereAufraeumen } from '../oberflaeche.js';
import { landkarteName } from '../genre-namen.js';

// Modus überlebt ein Neu-Rendern (Modul-State wie in Suche/Stimmungen).
let modus = 'gefuehl';
// Laufende Canvas-Animation, damit ein Moduswechsel (In-Place-Neuzeichnung) die
// alte Schleife stoppt, bevor eine neue startet — sonst stapeln sich rAF-Loops.
let laufendeFelder = null;

// ---------------------------------------------------------------------------
// Achsen-Helfer (Objekt {titel,von,bis}; alte String-Form fällt weich zurück).
function achse(a, titelFallback) {
  if (a && typeof a === 'object') return { titel: a.titel || titelFallback, von: a.von || '', bis: a.bis || '' };
  return { titel: a || titelFallback, von: '', bis: '' };
}

// ---------------------------------------------------------------------------
// MODUS 1 — Genre → Gefühl (bestehende Punktwolke, verbesserte Achsen).
const B = 340;
const H = 264;
const RAND = { l: 34, r: 20, o: 18, u: 40 };
function px(x) {
  return RAND.l + (x / 10) * (B - RAND.l - RAND.r);
}
function py(y) {
  return H - RAND.u - (y / 10) * (H - RAND.o - RAND.u);
}

function punkteSvg(genres, achsen) {
  const ax = achse(achsen.x, 'Energie & Tempo');
  const ay = achse(achsen.y, 'Grundton');
  const x0 = RAND.l;
  const y0 = H - RAND.u;
  const x1 = B - RAND.r;
  const y1 = RAND.o;
  const rahmen = `
    <defs><marker id="lk-pfeil" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="currentColor"></path></marker></defs>
    <line class="lk-achse" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" marker-end="url(#lk-pfeil)"></line>
    <line class="lk-achse" x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" marker-end="url(#lk-pfeil)"></line>
    <text class="lk-ende" x="${x0 + 2}" y="${y0 + 13}" text-anchor="start">${esc(ax.von)}</text>
    <text class="lk-ende" x="${x1}" y="${y0 + 13}" text-anchor="end">${esc(ax.bis)}</text>
    <text class="lk-achstitel" x="${(x0 + x1) / 2}" y="${H - 3}" text-anchor="middle">${esc(ax.titel)} →</text>
    <text class="lk-ende" x="11" y="${y0 - 2}" text-anchor="start" transform="rotate(-90 11 ${y0 - 2})">${esc(ay.von)}</text>
    <text class="lk-ende" x="11" y="${y1 + 2}" text-anchor="end" transform="rotate(-90 11 ${y1 + 2})">${esc(ay.bis)}</text>
    <text class="lk-achstitel" x="24" y="${(y0 + y1) / 2}" text-anchor="middle" transform="rotate(-90 24 ${(y0 + y1) / 2})">${esc(ay.titel)}</text>`;
  const punkte = genres
    .map((g, i) => {
      const cx = px(g.x).toFixed(1);
      const cy = py(g.y).toFixed(1);
      const name = landkarteName(g.genre);
      return `<g class="lk-punkt" data-i="${i}" data-genre="${esc(g.genre)}" tabindex="0" role="button"
        aria-label="${esc(t('wz_lk_punkt_aria', { genre: name }))}" aria-pressed="false">
        <circle class="lk-kreis" cx="${cx}" cy="${cy}" r="6"></circle>
        <text class="lk-name" x="${cx}" y="${(Number(cy) - 10).toFixed(1)}" text-anchor="middle">${esc(name)}</text>
      </g>`;
    })
    .join('');
  return `<svg class="lk-svg" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(t('wz_lk_svg_aria'))}">
    ${rahmen}${punkte}</svg>`;
}

function legende(genres) {
  const chips = genres
    .map(
      (g, i) =>
        `<button type="button" class="chip chip-waehlbar lk-legende-chip" data-i="${i}" aria-pressed="false">${esc(landkarteName(g.genre))}</button>`
    )
    .join(' ');
  return `<div class="chip-zeile lk-legende" role="group" aria-label="${esc(t('wz_lk_legende_aria'))}">${chips}</div>`;
}

function tagsPanel(g) {
  if (!g) return `<p class="leise lk-tags-leer">${esc(t('wz_lk_tipp'))}</p>`;
  const chips = (g.tags || []).map((tag) => `<span class="chip lk-tag">${esc(tag)}</span>`).join(' ');
  return `<div class="lk-tags-kopf"><strong>${esc(landkarteName(g.genre))}</strong>
      <span class="leise">${esc(t('wz_lk_koordinate', { x: g.x, y: g.y }))}</span></div>
    <p class="chip-zeile lk-tag-zeile">${chips}</p>`;
}

function verdrahteKarte(el, genres) {
  const panel = el.querySelector('.lk-tags');
  const punkte = [...el.querySelectorAll('.lk-punkt')];
  const chips = [...el.querySelectorAll('.lk-legende-chip')];
  const waehle = (i) => {
    const g = genres[i];
    if (panel) panel.innerHTML = tagsPanel(g);
    for (const p of punkte) {
      const an = Number(p.dataset.i) === i;
      p.classList.toggle('aktiv', an);
      p.setAttribute('aria-pressed', String(an));
    }
    for (const c of chips) {
      const an = Number(c.dataset.i) === i;
      c.classList.toggle('chip-akzent', an);
      c.setAttribute('aria-pressed', String(an));
    }
  };
  for (const p of punkte) {
    const i = Number(p.dataset.i);
    p.addEventListener('click', () => waehle(i));
    p.addEventListener('focus', () => waehle(i));
    p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        waehle(i);
      }
    });
  }
  for (const c of chips) c.addEventListener('click', () => waehle(Number(c.dataset.i)));
}

// ---------------------------------------------------------------------------
// MODUS 2 — Gefühl → Genre (bunte, fließende Felder auf Canvas).

// Gefühl-Index: Tag → Liste der Genre-Indizes, absteigend nach Häufigkeit sortiert.
function gefuehlsIndex(genres) {
  const map = new Map();
  genres.forEach((g, i) => (g.tags || []).forEach((tag) => {
    if (!map.has(tag)) map.set(tag, []);
    map.get(tag).push(i);
  }));
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

// Farbe je Genre über das volle Spektrum (bewusst bunt): die Energie-Achse (x)
// führt von träge=Blau/Violett über Cyan, Grün, Gelb bis rasend=Rot; der Grundton
// (y) hellt auf (licht heller, finster dunkler) und streut gleiche x leicht.
function genreFarbe(g) {
  const h = (((265 - (g.x / 10) * 250 - (g.y / 10) * 18) % 360) + 360) % 360;
  const l = 46 + (g.y / 10) * 18;
  return { h, l };
}
// Normierte Feldmitte (0..1) im Canvas: x=Energie, y invertiert (hoch = oben).
function feldPos(g) {
  return { fx: 0.09 + 0.82 * (g.x / 10), fy: 0.90 - 0.78 * (g.y / 10) };
}

function gefuehlWolke(index) {
  const chips = index
    .map(
      ([tag, gs]) =>
        `<button type="button" class="chip chip-waehlbar gf-chip" data-gefuehl="${esc(tag)}" aria-pressed="false">${esc(tag)}${gs.length > 1 ? ` <span class="gf-zahl" aria-hidden="true">${gs.length}</span>` : ''}</button>`
    )
    .join(' ');
  return `<div class="chip-zeile gf-wolke" role="group" aria-label="${esc(t('wz_lk_gefuehl_wolke_aria'))}">${chips}</div>`;
}

// Startet den Canvas: zeichnet die Felder (mit 'lighter'-Blending → fließendes
// Ineinander), optional sanft driftend. Gibt eine API zum Setzen der Hervorhebung
// und zum Aufräumen (Animation stoppen). Bewegung nur ohne reduzierte-Bewegung.
function starteFelder(canvas, genres, onGenre) {
  const ctx = canvas.getContext('2d');
  const bewegung =
    typeof window.matchMedia !== 'function' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let aktiv = null; // Set<genreIndex> | null (null = alle voll)
  let raf = null;
  let start = null;

  function zeichne(zeit) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 240;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    genres.forEach((g, i) => {
      const { fx, fy } = feldPos(g);
      const dx = bewegung && zeit != null ? Math.sin(zeit * 0.00042 + i * 1.7) * 0.022 * w : 0;
      const dy = bewegung && zeit != null ? Math.cos(zeit * 0.00037 + i * 2.3) * 0.026 * h : 0;
      const cx = fx * w + dx;
      const cy = fy * h + dy;
      const hervor = !aktiv || aktiv.has(i);
      const rad = (hervor ? 0.30 : 0.16) * Math.min(w, h);
      const alpha = hervor ? 0.5 : 0.08;
      const { h: hue, l } = genreFarbe(g);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, `hsla(${hue}, 80%, ${l}%, ${alpha})`);
      grad.addColorStop(1, `hsla(${hue}, 80%, ${l}%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    });
    // Beschriftung (über dem Blending). Damit sich die Namen nicht überlagern
    // (bei eng beieinander liegenden Genres), werden nahe Etiketten senkrecht
    // auseinandergeschoben: nach cy sortieren, bei zu geringem Abstand UND
    // horizontaler Nähe das untere nach unten nudgen, dann in den Canvas clampen.
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '600 12px Rubik, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const etiketten = [];
    genres.forEach((g, i) => {
      if (aktiv && !aktiv.has(i)) return;
      const { fx, fy } = feldPos(g);
      etiketten.push({ name: landkarteName(g.genre), cx: fx * w, cy: fy * h });
    });
    etiketten.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
    const minAbstand = 15;
    for (let k = 1; k < etiketten.length; k++) {
      const vor = etiketten[k - 1];
      const cur = etiketten[k];
      const naheX = (vor.name.length + cur.name.length) * 3.1;
      if (cur.cy - vor.cy < minAbstand && Math.abs(cur.cx - vor.cx) < naheX) {
        cur.cy = vor.cy + minAbstand;
      }
    }
    for (const e of etiketten) {
      const cy = Math.max(9, Math.min(h - 7, e.cy));
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(e.name, e.cx, cy);
      ctx.fillStyle = '#fff';
      ctx.fillText(e.name, e.cx, cy);
    }
  }

  function schleife(zeit) {
    if (start == null) start = zeit;
    zeichne(zeit - start);
    raf = requestAnimationFrame(schleife);
  }

  // Klick auf ein Feld → nächstliegendes Genre (in Reichweite) melden.
  function beiKlick(ereignis) {
    const r = canvas.getBoundingClientRect();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const mx = ereignis.clientX - r.left;
    const my = ereignis.clientY - r.top;
    let besterI = -1;
    let besteDist = Infinity;
    genres.forEach((g, i) => {
      const { fx, fy } = feldPos(g);
      const d = Math.hypot(fx * w - mx, fy * h - my);
      if (d < besteDist) {
        besteDist = d;
        besterI = i;
      }
    });
    if (besterI >= 0 && besteDist < 0.2 * Math.min(w, h)) onGenre(besterI);
  }
  canvas.addEventListener('click', beiKlick);

  if (bewegung) raf = requestAnimationFrame(schleife);
  else zeichne(null);

  return {
    setzeAktiv(menge) {
      aktiv = menge;
      if (!bewegung) zeichne(null);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('click', beiKlick);
    },
  };
}

function ergebnisPanel(kind) {
  if (!kind) return `<p class="leise gf-ergebnis-leer">${esc(t('wz_lk_gefuehl_tipp'))}</p>`;
  if (kind.typ === 'gefuehl') {
    // Ein oder mehrere Gefühle: Genres nach Trefferzahl (wie viele der gewählten
    // Gefühle sie tragen) absteigend; bei Mehrfachwahl trägt jedes Genre eine
    // kleine Trefferzahl. `kind.treffer` ist eine Map genreIndex→Anzahl.
    const tags = kind.tags || [];
    const mehr = tags.length > 1;
    const eintraege = [...(kind.treffer || new Map()).entries()].sort(
      (a, b) => b[1] - a[1] || landkarteName(kind.genres[a[0]].genre).localeCompare(landkarteName(kind.genres[b[0]].genre))
    );
    const chips = eintraege
      .map(([i, n]) => {
        const g = kind.genres[i];
        const marke = mehr && n > 1 ? ` <span class="gf-zahl" aria-hidden="true">${n}</span>` : '';
        return `<a class="chip chip-akzent gf-genre-link" href="#/pfad/stil/${esc(g.genre)}">${esc(landkarteName(g.genre))}${marke}</a>`;
      })
      .join(' ');
    const titel = mehr ? t('wz_lk_gefuehl_mehr', { n: tags.length }) : tags[0];
    return `<div class="lk-tags-kopf"><strong>${esc(titel)}</strong> <span class="leise">${esc(t('wz_lk_gefuehl_n_genres', { n: eintraege.length }))}</span></div>
      <p class="chip-zeile lk-tag-zeile">${chips}</p>`;
  }
  // typ === 'genre'
  const chips = (kind.genre.tags || []).map((tag) => `<button type="button" class="chip chip-waehlbar gf-chip-inline" data-gefuehl="${esc(tag)}">${esc(tag)}</button>`).join(' ');
  return `<div class="lk-tags-kopf"><strong>${esc(landkarteName(kind.genre.genre))}</strong> <span class="leise">${esc(t('wz_lk_traegt'))}</span></div>
    <p class="chip-zeile lk-tag-zeile">${chips}</p>`;
}

function verdrahteFelder(el, genres, index) {
  const canvas = el.querySelector('.gf-canvas');
  const panel = el.querySelector('.gf-ergebnis');
  const leerenKnopf = el.querySelector('.gf-leeren');
  const gefuehlChips = () => [...el.querySelectorAll('[data-gefuehl]')];
  const genreChips = [...el.querySelectorAll('.gf-genre-chip')];
  if (!canvas) return;

  const felder = starteFelder(canvas, genres, (i) => zeigeGenre(i));
  laufendeFelder = felder;
  registriereAufraeumen(() => {
    felder.stop();
    if (laufendeFelder === felder) laufendeFelder = null;
  });

  // Mehrfachauswahl: Menge gewählter Gefühls-Tags. Die hervorgehobenen Genres
  // sind die Vereinigung (jedes Genre, das mindestens eins der Gefühle trägt),
  // sortiert nach Trefferzahl.
  const gewaehlt = new Set();

  function markiereChips() {
    for (const c of gefuehlChips()) {
      const an = gewaehlt.has(c.dataset.gefuehl);
      c.classList.toggle('chip-akzent', an && c.classList.contains('gf-chip'));
      c.setAttribute('aria-pressed', String(an));
    }
    for (const c of genreChips) c.setAttribute('aria-pressed', 'false');
  }

  function aktualisiere() {
    if (leerenKnopf) leerenKnopf.hidden = gewaehlt.size === 0;
    if (gewaehlt.size === 0) {
      felder.setzeAktiv(null);
      panel.innerHTML = ergebnisPanel(null);
      markiereChips();
      return;
    }
    // Trefferzahl je Genre über alle gewählten Gefühle.
    const treffer = new Map();
    for (const tag of gewaehlt) {
      const eintrag = index.find(([tg]) => tg === tag);
      if (!eintrag) continue;
      for (const i of eintrag[1]) treffer.set(i, (treffer.get(i) || 0) + 1);
    }
    felder.setzeAktiv(new Set(treffer.keys()));
    panel.innerHTML = ergebnisPanel({ typ: 'gefuehl', tags: [...gewaehlt], treffer, genres });
    markiereChips();
    verdrahteInline();
  }

  function toggleGefuehl(tag) {
    if (!index.some(([tg]) => tg === tag)) return;
    if (gewaehlt.has(tag)) gewaehlt.delete(tag);
    else gewaehlt.add(tag);
    aktualisiere();
  }
  // Ein Genre antippen: seine Gefühle zeigen (als anklickbare Chips, die in die
  // Mehrfachauswahl übernommen werden) und das eine Feld hervorheben.
  function zeigeGenre(i) {
    felder.setzeAktiv(new Set([i]));
    panel.innerHTML = ergebnisPanel({ typ: 'genre', genre: genres[i] });
    markiereChips();
    verdrahteInline();
  }
  // Inline-Gefühl-Chips im Ergebnis (Genre → seine Gefühle) übernehmen ins Set.
  function verdrahteInline() {
    for (const c of panel.querySelectorAll('.gf-chip-inline')) {
      c.classList.toggle('chip-akzent', gewaehlt.has(c.dataset.gefuehl));
      c.addEventListener('click', () => toggleGefuehl(c.dataset.gefuehl));
    }
  }

  for (const c of el.querySelectorAll('.gf-chip')) {
    c.addEventListener('click', () => toggleGefuehl(c.dataset.gefuehl));
  }
  for (const c of genreChips) {
    c.addEventListener('click', () => zeigeGenre(Number(c.dataset.i)));
  }
  if (leerenKnopf) {
    leerenKnopf.addEventListener('click', () => {
      gewaehlt.clear();
      aktualisiere();
    });
  }
}

// ---------------------------------------------------------------------------
export function renderWerkzeugLandkarte(el, daten) {
  // Alte Canvas-Schleife stoppen (In-Place-Neuzeichnung bei Moduswechsel).
  if (laufendeFelder) {
    laufendeFelder.stop();
    laufendeFelder = null;
  }
  const lk = daten.gefuehlslandkarte || { genres: [], achsen: {}, hinweis: '' };
  const genres = lk.genres || [];
  const achsen = lk.achsen || {};
  const index = gefuehlsIndex(genres);

  const modusUmschalter = `
    <div class="chip-zeile lk-modus" role="group" aria-label="${esc(t('wz_lk_modus_aria'))}">
      <button type="button" class="chip chip-waehlbar lk-modus-knopf ${modus === 'gefuehl' ? 'chip-akzent' : ''}" data-modus="gefuehl" aria-pressed="${modus === 'gefuehl'}">${esc(t('wz_lk_modus_gefuehl'))}</button>
      <button type="button" class="chip chip-waehlbar lk-modus-knopf ${modus === 'genre' ? 'chip-akzent' : ''}" data-modus="genre" aria-pressed="${modus === 'genre'}">${esc(t('wz_lk_modus_genre'))}</button>
    </div>`;

  const genreLegendeChips = genres
    .map((g, i) => `<button type="button" class="chip chip-waehlbar gf-genre-chip" data-i="${i}" aria-pressed="false">${esc(landkarteName(g.genre))}</button>`)
    .join(' ');

  const inhalt =
    modus === 'genre'
      ? `
      <div class="lk-karte">
        ${punkteSvg(genres, achsen)}
      </div>
      ${legende(genres)}
      <div class="lk-tags" role="status" aria-live="polite">${tagsPanel(null)}</div>`
      : `
      <canvas class="gf-canvas" aria-hidden="true"></canvas>
      <p class="leise gf-canvas-hinweis">${esc(t('wz_lk_gefuehl_canvas_hinweis'))}</p>
      <h2 class="abschnitt-titel">${esc(t('wz_lk_gefuehl_waehlen'))}</h2>
      ${gefuehlWolke(index)}
      <p class="chip-zeile gf-werkzeugleiste"><button type="button" class="chip chip-waehlbar gf-leeren" hidden><i class="fa-solid fa-xmark" aria-hidden="true"></i> ${esc(t('wz_lk_gefuehl_leeren'))}</button></p>
      <div class="gf-ergebnis" role="status" aria-live="polite">${ergebnisPanel(null)}</div>
      <details class="gf-genre-liste"><summary class="leise">${esc(t('wz_lk_gefuehl_genre_liste'))}</summary>
        <div class="chip-zeile">${genreLegendeChips}</div></details>`;

  el.innerHTML = `
    <article class="wz-werkzeug">
      <p><a class="chip" href="#/werkzeuge"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('wz_zurueck'))}</a></p>
      <section class="marke-hero klein hue pf-teal">
        <span class="marke-hero-icon"><i class="fa-solid fa-compass" aria-hidden="true"></i></span>
        <div class="marke-hero-text">
          <h1>${esc(t('wz_landkarte_titel'))}</h1>
          <p class="marke-hero-untertitel">${esc(t('wz_landkarte_untertitel'))}</p>
        </div>
      </section>

      <p class="lk-hinweis banner-hinweis" role="note">
        <span><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ${esc(lk.hinweis || t('wz_lk_hinweis_fallback'))}</span>
      </p>

      ${modusUmschalter}
      ${inhalt}

      <p class="chip-zeile lk-fuss">
        <a class="chip chip-waehlbar" href="#/werkzeug/genremix"><i class="fa-solid fa-right-left" aria-hidden="true"></i> ${esc(t('wz_lk_zum_generator'))}</a>
      </p>
      <p class="leise wz-metro-fuss">${esc(t('wz_landkarte_fuss'))}</p>
    </article>`;

  for (const knopf of el.querySelectorAll('[data-modus]')) {
    knopf.addEventListener('click', () => {
      if (modus === knopf.dataset.modus) return;
      modus = knopf.dataset.modus;
      renderWerkzeugLandkarte(el, daten);
    });
  }

  if (modus === 'genre') verdrahteKarte(el, genres);
  else verdrahteFelder(el, genres, index);
}
