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
  return `
    <div class="genre-inszenierung">
      <p class="genre-kurz">${esc(g.kurz)}</p>
      <section class="genre-einordnung">
        <h2 class="genre-abschnitt-titel">${esc(t('genre_einordnung_titel'))}</h2>
        <dl class="genre-ein-liste">${einordnung}</dl>
      </section>
      ${verwandtBlock}
    </div>`;
}
