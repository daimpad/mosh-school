// Brand Alert: der einzige markierte Ausnahmebereich der App, an dem Modellnamen
// genannt werden. Klang entsteht sonst aus Bauteilen und Physik — hier steht die
// historische Einordnung weniger Geräte, deren Name zum Verständnis eines
// Genre-Klangs nötig ist. Referenzbereich wie Songs/Patterns: NICHT im
// Baustein-Pool, kein Fortschritt.
//
// Rahmung (nicht abschwächen): keine Werbung/Kaufempfehlung, keine Preise/Links/
// Bewertungen; das `alternative`-Feld jedes Eintrags wird GLEICHWERTIG dargestellt
// (bezahlbares Equipment existiert). Der einleitende Baustein `brand_alert` steht
// vor der Liste, der `hinweis` sichtbar oben.
//
// Navigation: eine Kategorie-Filterleiste (Modul-State, wie im Glossar) blendet
// auf eine Kategorie ein; jede Kategorie trägt ein monochromes Symbol neben dem
// Titel. Filter-State ist flüchtig (überlebt Neu-Rendern, keinen Reload).

import { label, t } from '../i18n.js';
import { bausteinIcon, domaeneIcon, esc } from '../oberflaeche.js';
import { landingHeroHtml } from '../genre-inszenierung.js';

const INTRO_BAUSTEIN = 'brand_alert';

let aktiveKategorie = null; // null = alle

// Querverweis je Kategorie auf den erklärenden Baustein (die Physik dahinter) —
// statt sie in der Liste zu wiederholen. Fehlt der Baustein im Pool, entfällt der
// Link stillschweigend.
const KATEGORIE_BAUSTEIN = {
  'Verstärker': 'amp_grundlagen',
  'Boxen & Lautsprecher': 'box_grundlagen',
  'Pedale & Effekte': 'pedalboard_grundlagen',
  'Gitarren': 'bauform_und_bauteilpaket',
  'Bässe': 'bass_ton_gear',
  'Drums': 'schlagzeug_komponenten',
  'Mikrofone': 'mikrofon_typen',
  'Software (Open Source)': 'recording_grundausstattung',
};

// Monochromes Symbol je Kategorie (neben dem Titel). Instrument-Kategorien erben
// die vorhandenen Domänen-Glyphen; Gear-Kategorien tragen eigene Linien-SVGs
// (currentColor, viewBox 24×24) im gleichen Stil.
const SVG = (inner) => `<svg class="ba-kat-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const KATEGORIE_ICON = {
  'Verstärker': SVG('<rect x="3" y="6" width="18" height="13" rx="1.5"/><circle cx="6.5" cy="9" r="0.9"/><circle cx="9.5" cy="9" r="0.9"/><circle cx="12.5" cy="9" r="0.9"/><rect x="6" y="12.5" width="12" height="4.6" rx="0.6"/>'),
  'Boxen & Lautsprecher': SVG('<rect x="5" y="3" width="14" height="18" rx="1"/><circle cx="12" cy="9" r="3.4"/><circle cx="12" cy="9" r="1"/><circle cx="12" cy="16.5" r="2.2"/>'),
  'Pedale & Effekte': SVG('<rect x="5.5" y="4" width="13" height="16" rx="2"/><line x1="8.5" y1="7.5" x2="15.5" y2="7.5"/><circle cx="12" cy="16" r="2.3"/>'),
  'Gitarren': domaeneIcon('gitarre'),
  'Bässe': domaeneIcon('bass'),
  'Drums': domaeneIcon('schlagzeug'),
  'Mikrofone': domaeneIcon('gesang'),
  'Software (Open Source)': SVG('<polyline points="8.5 8 5 12 8.5 16"/><polyline points="15.5 8 19 12 15.5 16"/><line x1="13.2" y1="6.5" x2="10.8" y2="17.5"/>'),
};

function bausteinDa(daten, id) {
  return !!id && (daten.bausteinVonId?.has?.(id) ?? daten.bausteine?.some((b) => b.id === id));
}

// Ein Eintrag: Bezeichnung + „warum" + „einordnung", darunter die gleichrangig
// gesetzte bezahlbare Alternative (eigener Block, nicht kleingedruckt).
function eintragKarte(e) {
  return `
    <li class="ba-eintrag">
      <h3 class="ba-eintrag-titel">${esc(e.bezeichnung)}</h3>
      ${e.warum ? `<p class="ba-warum">${esc(e.warum)}</p>` : ''}
      ${e.einordnung ? `<p class="ba-einordnung">${esc(e.einordnung)}</p>` : ''}
      ${
        e.alternative
          ? `<p class="ba-alternative"><span class="ba-alternative-label">${esc(t('ba_alternative_label'))}</span> ${esc(e.alternative)}</p>`
          : ''
      }
    </li>`;
}

// Nach Kategorie gruppiert (Reihenfolge aus dem Datenfeld `kategorien`, damit die
// deklarierte Ordnung führt; unbekannte Kategorien hängen hinten an). Ist ein
// erklärender Baustein hinterlegt, steht er als Querverweis unter dem Titel.
function kategorieAbschnitt(daten, kategorie, eintraege) {
  const physik = KATEGORIE_BAUSTEIN[kategorie];
  const physikHtml = bausteinDa(daten, physik)
    ? `<p class="ba-physik leise">${esc(t('ba_physik_label'))}
        <a href="#/baustein/${esc(physik)}?kontext=kompetenz">${esc(label('baustein', physik))}</a></p>`
    : '';
  const icon = KATEGORIE_ICON[kategorie];
  return `
    <section class="ba-kategorie" aria-label="${esc(kategorie)}">
      <div class="ba-kategorie-kopf">
        ${icon ? `<span class="ba-kategorie-icon" aria-hidden="true">${icon}</span>` : ''}
        <h2 class="ba-kategorie-titel">${esc(kategorie)} <span class="ba-kategorie-zahl leise">${eintraege.length}</span></h2>
      </div>
      ${physikHtml}
      <ul class="ba-liste">${eintraege.map(eintragKarte).join('')}</ul>
    </section>`;
}

// Kategorie-Filterleiste: „Alle" plus eine Chip je belegter Kategorie. Reiner
// In-Memory-Filter (kein Reload), analog zum Glossar.
function filterChips(gruppen) {
  const chip = (wert, text, aktiv) =>
    `<button type="button" class="chip chip-waehlbar ba-kat-chip${aktiv ? ' aktiv' : ''}" data-kat="${esc(wert)}"${aktiv ? ' aria-current="true"' : ''}>${esc(text)}</button>`;
  return [chip('', t('ba_filter_alle'), !aktiveKategorie)]
    .concat(gruppen.map(([k]) => chip(k, k, aktiveKategorie === k)))
    .join('');
}

function sichtbareGruppen(gruppen) {
  return aktiveKategorie ? gruppen.filter(([k]) => k === aktiveKategorie) : gruppen;
}

export function renderBrandAlert(el, daten) {
  const ba = daten.brandAlert || {};
  const eintraege = ba.eintraege || [];
  if (eintraege.length === 0) {
    el.innerHTML = `<article><p class="leise">${esc(t('ba_leer'))}</p></article>`;
    return;
  }

  // Reihenfolge: deklarierte Kategorien zuerst, dann evtl. übrige.
  const reihenfolge = [...(ba.kategorien || [])];
  for (const e of eintraege) if (!reihenfolge.includes(e.kategorie)) reihenfolge.push(e.kategorie);
  const gruppen = reihenfolge
    .map((k) => [k, eintraege.filter((e) => e.kategorie === k)])
    .filter(([, es]) => es.length > 0);
  if (aktiveKategorie && !gruppen.some(([k]) => k === aktiveKategorie)) aktiveKategorie = null;

  // Einleitender Baustein (steht vor der Liste, als anklickbarer Link).
  const introTitel = label('baustein', INTRO_BAUSTEIN);
  const introVorhanden = daten.bausteinNach?.has?.(INTRO_BAUSTEIN) ?? daten.bausteine?.some((b) => b.id === INTRO_BAUSTEIN);
  const introHtml = introVorhanden
    ? `<a class="karte karte-link geraete-eintrag ba-intro" href="#/baustein/${esc(INTRO_BAUSTEIN)}?kontext=kompetenz">
        <span class="geraete-eintrag-icon">${bausteinIcon(INTRO_BAUSTEIN) || '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>'}</span>
        <span class="geraete-eintrag-text">${esc(introTitel)}</span>
        <i class="fa-solid fa-arrow-right geraete-eintrag-pfeil" aria-hidden="true"></i>
      </a>`
    : '';

  el.innerHTML = `
    <article class="ba-seite">
      ${landingHeroHtml('fa-triangle-exclamation', t('ba_titel'), t('ba_untertitel'), 'pf-magenta')}

      ${ba.hinweis ? `<p class="ba-hinweis">${esc(ba.hinweis)}</p>` : ''}
      ${introHtml}

      <div class="ba-filter" role="group" aria-label="${esc(t('ba_filter_titel'))}">${filterChips(gruppen)}</div>
      <div class="ba-gruppen">${sichtbareGruppen(gruppen).map(([k, es]) => kategorieAbschnitt(daten, k, es)).join('')}</div>
    </article>`;

  const gruppenHalter = el.querySelector('.ba-gruppen');
  for (const btn of el.querySelectorAll('.ba-kat-chip')) {
    btn.addEventListener('click', () => {
      aktiveKategorie = btn.dataset.kat || null;
      for (const b of el.querySelectorAll('.ba-kat-chip')) {
        const an = (b.dataset.kat || '') === (aktiveKategorie || '');
        b.classList.toggle('aktiv', an);
        if (an) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      }
      if (gruppenHalter) gruppenHalter.innerHTML = sichtbareGruppen(gruppen).map(([k, es]) => kategorieAbschnitt(daten, k, es)).join('');
    });
  }
}
