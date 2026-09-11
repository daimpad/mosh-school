// Shows (#/shows, #/shows/<id>): vergangene Abende des Kollektivs, dokumentiert
// über ihre Flyer. Referenzbereich wie Stimmungen/Zerrtypen/Songs — NICHT im
// Baustein-Pool, kein Fortschritt, keine Voraussetzungen.
//
// Das ganze „Mikro-CMS" sind ZWEI Orte: data/shows.json (Texte) und
// images/shows/ (Flyer-Bilder). Beides über die GitHub-Weboberfläche pflegbar,
// ohne Build-Schritt und ohne Generator dazwischen — die Pflege-Anleitung steht
// in images/shows/README.md und in `_meta` der JSON, also dort, wo jemand beim
// Editieren im Browser sie auch offen hat.
//
// Anders als bei den Bausteinen stehen die sichtbaren Texte (Titel, Ort, Bands,
// Fließtext) IN der Datei und nicht in labels/de.json: Der Titel ist der
// Eigenname eines Abends, kein übersetzbares Beschriftungs-Element. Genau so
// halten es zerrtypen.json und genres.json auch. Die Rahmen-Beschriftungen
// dieser Ansicht laufen dagegen wie überall durch t().

import { label, t } from '../i18n.js';
import { esc, nichtGefundenHtml } from '../oberflaeche.js';
import { markdownHtml } from '../markdown.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

const ORDNER = 'images/shows/';

function liste(daten) {
  return daten.shows?.shows || [];
}

// Absteigend nach Datum. `datum` darf JJJJ, JJJJ-MM oder JJJJ-MM-TT sein —
// ein reiner String-Vergleich sortiert diese Formen korrekt gegeneinander
// ("2019" < "2019-03"), weil das genauere immer mit dem gröberen beginnt.
// Bei gleichem Datum entscheidet der Titel, damit die Reihenfolge nicht von
// der Position in der Datei abhängt (sonst verschiebt ein Einschub in der
// Mitte die Anzeige an anderer Stelle).
function sortiert(eintraege) {
  return [...eintraege].sort((a, b) => {
    const d = String(b.datum || '').localeCompare(String(a.datum || ''));
    return d !== 0 ? d : String(a.titel || '').localeCompare(String(b.titel || ''), 'de');
  });
}

// „08.03.2019" / „März 2019" / „2019", je nachdem, wie genau das Datum ist.
// Ein Archiv hat regelmäßig nur das Jahr — dann soll da auch nur das Jahr
// stehen und kein erfundener 1. Januar.
const MONATE = [
  'monat_1', 'monat_2', 'monat_3', 'monat_4', 'monat_5', 'monat_6',
  'monat_7', 'monat_8', 'monat_9', 'monat_10', 'monat_11', 'monat_12',
];
function datumText(datum) {
  const teile = String(datum || '').split('-');
  const [jahr, monat, tag] = teile;
  if (!jahr) return '';
  if (tag) return `${tag}.${monat}.${jahr}`;
  if (monat) {
    const name = MONATE[Number(monat) - 1];
    return name ? `${t(name)} ${jahr}` : `${monat}/${jahr}`;
  }
  return jahr;
}

// Kurze Meta-Zeile: Datum · Ort. Beides optional, der Trenner nur dazwischen.
function metaZeile(f) {
  return [datumText(f.datum), f.ort].filter(Boolean).join(' · ');
}

// Ersatztext, wenn `alt` fehlt. Bewusst nicht „Flyer" allein: Ohne
// Bildbeschreibung ist das Bild für Screenreader der ganze verlorene Inhalt,
// also tragen wenigstens Titel, Datum und Ort hinüber. validate.py warnt
// zusätzlich, damit der Ersatz nicht zum Normalfall wird.
function altText(f) {
  return f.alt || [f.titel, metaZeile(f)].filter(Boolean).join(' — ');
}

export function kachelHtml(f, index = 0) {
  // Die ersten sechs Kacheln liegen beim Aufschlagen im Bild: `lazy` würde
  // dort genau das Bild verzögern, das als größter sichtbarer Inhalt zählt.
  // Alles darunter lädt erst beim Heranscrollen — sonst zieht ein Archiv mit
  // 60 Einträgen beim Öffnen mehrere Megabyte.
  const frueh = index < 6;
  return `
    <a class="karte karte-link shows-kachel" href="#/shows/${encodeURIComponent(f.id)}">
      <img class="shows-bild" src="${esc(ORDNER + f.bild)}" alt=""
           ${frueh ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      <h3 class="shows-kachel-titel">${esc(f.titel || f.id)}</h3>
      ${metaZeile(f) ? `<p class="shows-kachel-meta leise">${esc(metaZeile(f))}</p>` : ''}
    </a>`;
}

// Fällt ein Bild aus (404, halb übertragen, offline), bleibt der Eintrag
// stehen und zeigt Titel/Datum/Ort als Textkachel. Ein Archiv, das Einträge
// verschluckt, weil ein Scan fehlt, ist schlimmer als eines mit Lücken.
//
// FALLSTRICK: `error`-Ereignisse von <img> steigen NICHT auf. Ein Horcher am
// Container ohne drittes Argument sähe davon nichts — und zwar lautlos, denn
// registriert ist er ja korrekt. Deshalb die Einfangphase (`true`).
export function bindeBildausfall(el) {
  el.addEventListener(
    'error',
    (ereignis) => {
      const bild = ereignis.target;
      if (!(bild instanceof HTMLImageElement)) return;
      bild.closest('.shows-kachel, .shows-blatt')?.classList.add('bild-fehlt');
      bild.remove();
    },
    true,
  );
}

function uebersicht(el, daten) {
  const bereich = daten.shows || {};
  const eintraege = sortiert(liste(daten));
  const gitter = eintraege.length
    ? `<div class="shows-gitter">${eintraege.map(kachelHtml).join('')}</div>`
    : `<p class="leise">${esc(t('shows_leer'))}</p>`;
  el.innerHTML = `
    <article class="shows-seite">
      ${landingHeroHtml('fa-photo', bereich.titel || t('shows_titel'), '', 'pf-magenta', 'shows')}
      ${gitter}
    </article>`;
  bindeBildausfall(el);
}

export function detailHtml(f) {
  // Untertitel als HTML statt Text: Datum und Ort stehen als ruhige Zeile im
  // Hero, dieselbe Stelle, an der die Baustein-Ansicht ihren Stufen-Chip setzt.
  const untertitelHtml = metaZeile(f) ? esc(metaZeile(f)) : '';
  const bands = (Array.isArray(f.bands) ? f.bands : []).filter((b) => typeof b === 'string' && b.trim());
  const stile = (Array.isArray(f.stil) ? f.stil : []).filter(Boolean);
  // Eine Zeile je gepflegter Angabe. Derzeit ist das nur der Ort — Datum steht
  // schon im Hero, alles andere ist bewusst raus. Die Liste bleibt trotzdem
  // eine Liste, damit eine zweite Angabe eine Zeile ist und kein Umbau.
  const angaben = [
    ['shows_feld_ort', f.ort],
  ]
    .filter(([, wert]) => typeof wert === 'string' && wert.trim())
    .map(
      ([schluessel, wert]) => `
        <div class="shows-angabe">
          <dt class="leise">${esc(t(schluessel))}</dt>
          <dd>${esc(wert)}</dd>
        </div>`,
    )
    .join('');
  return `
    <article class="shows-detail">
      ${landingHeroHtml(
        '', f.titel || f.id, '', 'pf-magenta', f.id, t('shows_titel'), '',
        { augenbraueHref: '#/shows', untertitelHtml },
      )}

      <figure class="shows-blatt">
        <img src="${esc(ORDNER + f.bild)}" alt="${esc(altText(f))}" decoding="async">
        <figcaption class="shows-blatt-text">${esc(t('shows_blatt_hinweis'))}</figcaption>
      </figure>

      ${f.text ? `<div class="shows-text">${markdownHtml(f.text)}</div>` : ''}

      ${
        bands.length
          ? `<section class="abschnitt">
               <h2 class="abschnitt-titel">${esc(t('shows_lineup'))}</h2>
               <ul class="shows-bands">${bands.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
             </section>`
          : ''
      }

      ${angaben ? `<dl class="shows-angaben">${angaben}</dl>` : ''}

      ${
        stile.length
          ? `<p class="chip-zeile">${stile
              .map((s) => `<a class="chip" href="#/pfad/stil/${encodeURIComponent(s)}">${esc(label('stil', s))}</a>`)
              .join('')}</p>`
          : ''
      }

      <p><a class="chip" href="#/shows"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> ${esc(t('shows_zurueck'))}</a></p>
    </article>`;
}

export function renderShows(el, daten, id) {
  if (!id) {
    uebersicht(el, daten);
    return;
  }
  // Unbekannte ID: ausdrücklich „nicht gefunden" statt stiller Rückfall aufs
  // Gitter. Ein veraltetes Lesezeichen soll sagen, dass die Show weg ist —
  // nicht so tun, als hätte man nie einen verlinkt.
  const f = liste(daten).find((e) => e.id === id);
  if (!f) {
    el.innerHTML = nichtGefundenHtml('#/shows', t('shows_titel'));
    return;
  }
  el.innerHTML = detailHtml(f);
  bindeBildausfall(el);
}
