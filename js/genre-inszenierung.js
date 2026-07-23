// Inszenierung der Genre-Achse (#/pfad/stil): baut aus data/genres.json die
// Genre-Präsentation — cooler Einstiegstext, musikwissenschaftliche Einordnung
// und die Verwandtschaft zu Nachbarstilen (grafisch als Hub-Speichen-Diagramm +
// textlich als anklickbare Chips). Reine HTML-Erzeugung (DOM-frei), monochrom
// über currentColor. Referenzbereich, kein Fortschritt.

import { label, t } from './i18n.js';
import { esc } from './oberflaeche.js';

// Reihenfolge der Einordnungs-Dimensionen (Feld -> i18n-Titel).
const EINORDNUNG = ['tempo', 'sound', 'vocals', 'struktur', 'herkunft'];

export function genreDaten(daten, stil) {
  return daten.genres?.[stil] || null;
}

// ----------------------------------------------------------------------------
// Genre-Motiv (Landing-Hero-Hintergrund): jedes Genre bekommt ein EIGENES
// abstraktes, monochromes Motiv. Eine Grundform (Balken/Wellen/Raster/Chaos)
// plus seeded Parameter, deterministisch aus dem Slug (kein Math.random →
// stabil über Reloads). currentColor, wirkt nur inline (Backdrop hinter dem
// Hero-Text). Formvokabular wie die Baustein-Grafiken: Balken = Anschlag/
// Gewicht · Wellen = klingend/Tremolo · Raster = Metrik/Polyrhythmik ·
// Chaos (Jitter) = Harsh/Noise · Punkte = Puls/Blasts.
//   [form, { n Dichte, h Höhe 0..1, w Strichstärke, j Rauheit, wellen, punkte }]
const GENRE_MOTIV = {
  hardcore:      ['balken', { n: 26, h: 0.72, w: 4.5, j: 0.10, wellen: 0, punkte: 0 }],
  metalcore:     ['balken', { n: 22, h: 0.62, w: 3.4, j: 0.05, wellen: 1, punkte: 7 }],
  thrash:        ['balken', { n: 40, h: 0.55, w: 2.2, j: 0.14, wellen: 1, punkte: 0 }],
  death_metal:   ['wellen', { n: 5,  h: 0.90, w: 2.6, j: 0.16, wellen: 4, punkte: 24 }],
  black_metal:   ['wellen', { n: 6,  h: 0.95, w: 1.4, j: 0.13, wellen: 5, punkte: 0 }],
  doom:          ['balken', { n: 9,  h: 0.92, w: 9.0, j: 0.03, wellen: 1, punkte: 0 }],
  crust:         ['chaos',  { n: 46, h: 0.80, w: 3.0, j: 0.30, wellen: 1, punkte: 16 }],
  grindcore:     ['chaos',  { n: 66, h: 0.85, w: 2.0, j: 0.34, wellen: 2, punkte: 30 }],
  powerviolence: ['chaos',  { n: 40, h: 0.78, w: 3.4, j: 0.26, wellen: 0, punkte: 20 }],
  sludge:        ['wellen', { n: 4,  h: 0.85, w: 6.5, j: 0.08, wellen: 3, punkte: 0 }],
  deathcore:     ['raster', { n: 8,  h: 0.70, w: 5.0, j: 0.10, wellen: 1, punkte: 12 }],
  djent:         ['raster', { n: 11, h: 0.60, w: 4.0, j: 0.04, wellen: 1, punkte: 16 }],
  stoner_post:   ['wellen', { n: 4,  h: 0.55, w: 3.2, j: 0.04, wellen: 4, punkte: 0 }],
};
const MOTIV_STANDARD = ['balken', { n: 24, h: 0.65, w: 3, j: 0.08, wellen: 1, punkte: 0 }];

// FNV-1a-Hash über den Slug → Seed; mulberry32 als deterministischer PRNG.
function hashSlug(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Grundformen — jede gibt SVG-Innenmarkup zurück (viewBox 480×270, Basislinie 210).
function formBalken(r, p) {
  const W = 480, BY = 210, top = 40;
  const schritt = W / (p.n + 1);
  let out = '';
  for (let i = 0; i < p.n; i++) {
    const x = schritt * (i + 1);
    const hoehe = (0.25 + r() * p.h) * (BY - top);
    const neig = (r() - 0.5) * p.j * 40;
    out += `<line x1="${x.toFixed(1)}" y1="${BY}" x2="${(x + neig).toFixed(1)}" y2="${(BY - hoehe).toFixed(1)}" stroke-width="${p.w}" />`;
  }
  return out;
}
function formWellen(r, p, staerke) {
  const W = 480, H = 270;
  const lagen = Math.max(1, p.wellen || 3);
  let out = '';
  for (let l = 0; l < lagen; l++) {
    const yBasis = 55 + (H - 95) * (l / Math.max(1, lagen - 1));
    const amp = (8 + r() * 26) * p.h;
    const phase = r() * Math.PI * 2;
    const freq = 1.4 + r() * 3;
    const pkt = [];
    for (let x = 0; x <= W; x += 12) {
      const jit = (r() - 0.5) * p.j * 26;
      const y = yBasis + Math.sin((x / W) * Math.PI * 2 * freq + phase) * amp + jit;
      pkt.push(`${x},${y.toFixed(1)}`);
    }
    out += `<polyline points="${pkt.join(' ')}" stroke-width="${staerke ?? p.w}" opacity="${(0.85 - l * 0.11).toFixed(2)}" />`;
  }
  return out;
}
function formRaster(r, p) {
  const W = 480, top = 50, BY = 210, reihen = 3;
  const schritt = W / p.n;
  let out = '';
  for (let c = 0; c < p.n; c++) {
    const x = c * schritt + schritt * 0.15;
    const bw = schritt * 0.7;
    const hi = 1 + Math.floor(r() * reihen);
    for (let rr = 0; rr < hi; rr++) {
      const y = BY - (rr + 1) * ((BY - top) / reihen) + 4;
      const bh = (BY - top) / reihen - 8;
      out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" stroke-width="${(p.w * 0.5).toFixed(1)}" />`;
    }
  }
  return out;
}
function formChaos(r, p) {
  const W = 480, top = 40, BY = 220;
  let out = '';
  for (let i = 0; i < p.n; i++) {
    const x = r() * W, y = top + r() * (BY - top);
    const len = (6 + r() * 26) * p.h;
    const ang = (r() - 0.5) * Math.PI * p.j * 4;
    out += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.cos(ang) * len).toFixed(1)}" y2="${(y + Math.sin(ang) * len).toFixed(1)}" stroke-width="${p.w}" />`;
  }
  return out;
}
function formPunkte(r, anzahl) {
  const W = 480, top = 30, BY = 230;
  let out = '';
  for (let i = 0; i < anzahl; i++) {
    const x = r() * W, y = top + r() * (BY - top), rad = 2 + r() * 3;
    const voll = r() > 0.4;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" ${voll ? 'fill="currentColor" stroke="none"' : 'stroke-width="1.5"'} />`;
  }
  return out;
}

// Vollständiges Motiv-SVG für ein Genre (Landing-Hero-Backdrop). Deterministisch.
export function genreMotivSvg(stil) {
  const [form, p] = GENRE_MOTIV[stil] || MOTIV_STANDARD;
  const r = prng(hashSlug('mosh:' + stil));
  const gen = { balken: formBalken, wellen: formWellen, raster: formRaster, chaos: formChaos }[form] || formBalken;
  const koerper = gen(r, p);
  const wellenLage = form !== 'wellen' && p.wellen ? formWellen(r, p, 1.4) : '';
  const punkte = p.punkte ? formPunkte(r, p.punkte) : '';
  const grund = form === 'wellen' ? '' : '<line x1="0" y1="210" x2="480" y2="210" stroke-width="1.5" opacity="0.4" />';
  return `<svg class="genre-landing-bild" viewBox="0 0 480 270" fill="none" stroke="currentColor"
      stroke-linecap="round" stroke-linejoin="round" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${grund}${wellenLage}${koerper}${punkte}
    </svg>`;
}

// Generisches Motiv aus einem beliebigen Schlüssel (Seite/Bereich) — deterministisch
// wie das Genre-Motiv, nur ohne Genre-Tabelle: Grundform + Parameter aus dem Hash.
// Für die großen Landing-Heros aller Bereiche (Startseite/Menü), gleiches Vokabular.
const MOTIV_FORMEN = ['balken', 'wellen', 'raster', 'chaos'];
export function motivSvg(schluessel) {
  const r = prng(hashSlug('mosh-landing:' + schluessel));
  const form = MOTIV_FORMEN[Math.floor(r() * MOTIV_FORMEN.length)];
  const p = {
    n: form === 'wellen' ? 4 + Math.floor(r() * 3) : form === 'raster' ? 8 + Math.floor(r() * 4) : 20 + Math.floor(r() * 30),
    h: 0.55 + r() * 0.4,
    w: form === 'balken' ? 3 + r() * 4 : form === 'wellen' ? 3 + r() * 3 : 2 + r() * 2,
    j: r() * 0.2,
    wellen: 2 + Math.floor(r() * 3),
    punkte: Math.floor(r() * 16),
  };
  const gen = { balken: formBalken, wellen: formWellen, raster: formRaster, chaos: formChaos }[form];
  const koerper = gen(r, p);
  const wellenLage = form !== 'wellen' && p.wellen ? formWellen(r, p, 1.4) : '';
  const punkte = p.punkte ? formPunkte(r, p.punkte) : '';
  const grund = form === 'wellen' ? '' : '<line x1="0" y1="210" x2="480" y2="210" stroke-width="1.5" opacity="0.4" />';
  return `<svg class="genre-landing-bild" viewBox="0 0 480 270" fill="none" stroke="currentColor"
      stroke-linecap="round" stroke-linejoin="round" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${grund}${wellenLage}${koerper}${punkte}
    </svg>`;
}

// Wiederverwendbarer großer Landing-Hero (Motiv-Backdrop + Reinbox-Effekt), im
// selben Stil wie der Genre-Hero — für alle Bereiche aus Startseite/Menü. Nutzt
// die bestehenden .genre-landing-*-Klassen (Box-in-Animation greift automatisch).
export function landingHeroHtml(icon, titel, untertitel = '', hue = 'pf-blau', motivKey = null, augenbraue = '', iconHtml = '') {
  const key = motivKey || titel || 'mosh';
  const iconTeil = iconHtml
    ? `<span class="genre-landing-symbol" aria-hidden="true">${iconHtml}</span>`
    : icon
      ? `<i class="fa-solid ${esc(icon)}" aria-hidden="true"></i>`
      : '';
  return `
    <section class="marke-hero genre-landing-hero landing-hero ${esc(hue)}">
      ${motivSvg(key)}
      <div class="genre-landing-scrim" aria-hidden="true"></div>
      <div class="genre-landing-inhalt">
        ${iconTeil || augenbraue ? `<p class="genre-landing-augenbraue">${iconTeil}${augenbraue ? ` ${esc(augenbraue)}` : ''}</p>` : ''}
        <h1>${esc(titel)}</h1>
        ${untertitel ? `<p class="genre-landing-kurz">${esc(untertitel)}</p>` : ''}
      </div>
    </section>`;
}

// Abstraktes Platzhalter-„Bild" für den Genre-Hub-Hero: ein monochromes
// Klang-Spektrum (Balken unterschiedlicher Höhe) mit Wellenlinie darüber.
// Deterministisch, currentColor, wirkt nur inline.
const SPEKTRUM = [8, 22, 14, 34, 26, 44, 30, 52, 40, 62, 48, 58, 70, 54, 66, 46, 60, 38, 50, 30, 42, 22, 32, 16];
export function genrePlatzhalterSvg() {
  const breite = 240;
  const basis = 104;
  const schritt = breite / (SPEKTRUM.length + 1);
  const balken = SPEKTRUM.map((h, i) => {
    const x = schritt * (i + 1);
    return `<line x1="${x.toFixed(1)}" y1="${basis}" x2="${x.toFixed(1)}" y2="${(basis - h).toFixed(1)}" stroke-width="3" />`;
  }).join('');
  const welle = SPEKTRUM.map((h, i) => {
    const x = schritt * (i + 1);
    return `${(x).toFixed(1)},${(30 - h / 6).toFixed(1)}`;
  }).join(' ');
  return `<svg class="genre-hero-bild" viewBox="0 0 240 120" fill="none" stroke="currentColor"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="${welle}" stroke-width="1.5" opacity="0.6" />
      ${balken}
      <line x1="8" y1="${basis}" x2="232" y2="${basis}" stroke-width="1.5" opacity="0.5" />
    </svg>`;
}

// Dekoratives Hub-Speichen-Diagramm: Mittelpunkt = aktuelles Genre, Speichen zu
// den Nachbarn (Punkte). Rein grafisch (aria-hidden); die Namen tragen die Chips.
function verwandtschaftSvg(anzahl) {
  const cx = 120;
  const cy = 60;
  const slots = {
    1: [[210, 60]],
    2: [[205, 30], [205, 90]],
    3: [[210, 26], [210, 94], [30, 94]],
  }[Math.min(3, anzahl)] || [[210, 60]];
  const speichen = slots.map(([x, y]) => `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke-width="1.5" opacity="0.7" />`).join('');
  const knoten = slots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" stroke-width="2" />`).join('');
  return `<svg class="genre-verwandt-svg" viewBox="0 0 240 120" fill="none" stroke="currentColor"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      ${speichen}${knoten}
      <circle cx="${cx}" cy="${cy}" r="12" stroke-width="2.5" />
      <circle cx="${cx}" cy="${cy}" r="3" fill="currentColor" stroke="none" />
    </svg>`;
}

function verwandtChips(daten, verwandt) {
  return verwandt
    .filter((slug) => daten.genres?.[slug])
    .map((slug) => `<a class="chip genre-verwandt-chip" href="#/pfad/stil/${esc(slug)}">${esc(label('stil', slug))}</a>`)
    .join('');
}

// Kurzbeschreibung (cooler Einstieg) — auch für die Hub-Karten.
export function genreKurz(daten, stil) {
  return genreDaten(daten, stil)?.kurz || '';
}

// Vollständiger Inszenierungs-Block der Genre-Detailseite: Einstieg, Einordnung,
// Verwandtschaft. Wird vor der Baustein-Liste gerendert.
export function genreInszenierungHtml(daten, stil) {
  const g = genreDaten(daten, stil);
  if (!g) return '';
  const einordnung = EINORDNUNG.filter((f) => g.einordnung?.[f])
    .map(
      (f) => `<div class="genre-ein-zeile">
          <dt class="genre-ein-titel">${esc(t('genre_ein_' + f))}</dt>
          <dd class="genre-ein-text">${esc(g.einordnung[f])}</dd>
        </div>`
    )
    .join('');
  const verwandt = (g.verwandt || []).filter((slug) => daten.genres?.[slug]);
  const verwandtBlock = verwandt.length
    ? `<section class="genre-verwandt">
        <h2 class="genre-abschnitt-titel">${esc(t('genre_verwandt_titel'))}</h2>
        <div class="genre-verwandt-inhalt">
          ${verwandtschaftSvg(verwandt.length)}
          <div class="genre-verwandt-text">
            <p class="leise">${esc(t('genre_verwandt_intro'))}</p>
            <div class="genre-verwandt-chips">${verwandtChips(daten, verwandt)}</div>
          </div>
        </div>
      </section>`
    : '';
  // Der Kurz-Einstieg steht jetzt im großen Landing-Hero (genre-landing-kurz) —
  // hier nicht doppeln.
  return `
    <div class="genre-inszenierung">
      <section class="genre-einordnung">
        <h2 class="genre-abschnitt-titel">${esc(t('genre_einordnung_titel'))}</h2>
        <dl class="genre-ein-liste">${einordnung}</dl>
      </section>
      ${verwandtBlock}
    </div>`;
}
