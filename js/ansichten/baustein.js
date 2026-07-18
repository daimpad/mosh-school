// Baustein-Ansicht: Erklär- und Übungsteil mit getrennter Quittierung.
// Im Kompetenz-Kontext greift der Cross-Sport-Modifikator: bei passender
// Herkunft tritt der Delta-Erklärteil an die Stelle des Basis-Erklärteils —
// der Übungsteil des Basisbausteins bleibt stets erhalten (Spez. 4.2, 5).

import { schalteTeil } from '../aktionen.js';
import { domaenenVon, fehlerbilderFuer, hatReflexionsaufgabe, hatUebungsteil, untergrundVon, witterungVon } from '../daten.js';
import { label, t, text } from '../i18n.js';
import { absaetze, bausteinIcon, domaeneIcon, esc, neuRendern, zeigeMeilenstein } from '../oberflaeche.js';
import { stationImKontext } from '../pfade.js';
import { diagnose, einstellungen } from '../zustand.js';

function kontextZuListe(kontext) {
  const [art, parameter] = String(kontext).split(':');
  if (art === 'themen') return `#/pfad/themen/${parameter}`;
  if (art === 'spielform') return `#/pfad/spielform/${parameter}`;
  if (art === 'stil') return `#/pfad/stil/${parameter}`;
  if (art === 'umgebung') return '#/pfad/umgebung';
  if (art === 'witterung' || art === 'untergrund') return `#/pfad/${art}/${parameter}`;
  if (art === 'individual') return '#/pfad/individual';
  return parameter ? `#/pfad/kompetenz/${parameter}` : '#/pfad/kompetenz';
}

// Ampellogik der CI: offen = Rot, erledigt = Grün (siehe docs/ci.md).
function statusChip(status) {
  const erledigt = status === 'erledigt';
  return `<span class="chip ${erledigt ? 'chip-gruen' : 'chip-rot'}">${esc(label('abschluss_status', erledigt ? 'erledigt' : 'offen'))}</span>`;
}

function quittierKnopf(id, teil, status, beschriftungOffen, beschriftungErledigt) {
  const erledigt = status === 'erledigt';
  return `
    <button class="knopf ${erledigt ? 'knopf-sekundaer knopf-erledigt' : 'knopf-primaer'}"
      data-quittiere="${esc(teil)}" data-baustein="${esc(id)}"
      ${erledigt ? `title="${esc(t('zuruecknehmen'))}"` : ''}
      aria-pressed="${erledigt}">
      ${erledigt ? `${esc(beschriftungErledigt)} <i class="fa-solid fa-check" aria-hidden="true"></i>` : esc(beschriftungOffen)}
    </button>`;
}

function grafikenHtml(baustein) {
  return (baustein.grafik || [])
    .map(
      (id) => `
      <figure class="grafik-platzhalter">
        <img class="grafik-bild" src="images/${esc(id)}.png" alt="${esc(label('grafik', id))}" loading="lazy" />
        <figcaption class="leise">${esc(label('grafik', id))}</figcaption>
      </figure>`
    )
    .join('');
}

// Übungsteile sind heterogen (schritte vs. schritte_teil1/2, optionale Felder).
// Der Renderer folgt der Feldreihenfolge der Daten, kennt die bekannten Felder
// und bleibt für künftige tolerant. Auch vom Trainingspfad genutzt.
export function uebungsteilHtml(uebungsteil) {
  if (!uebungsteil) return '';
  const block = (ueberschrift, inhalt) =>
    `<div class="ue-block"><h4>${esc(ueberschrift)}</h4><p>${esc(inhalt)}</p></div>`;
  const schrittliste = (ueberschrift, schritte) =>
    `<div class="ue-block"><h4>${esc(ueberschrift)}</h4><ol class="schrittliste">${schritte
      .map((s) => `<li>${esc(s)}</li>`)
      .join('')}</ol></div>`;
  const bekannt = {
    titel: (wert) => `<h3 class="ue-titel">${esc(wert)}</h3>`,
    ziel: (wert) => block(t('ue_ziel'), wert),
    schritte: (wert) => schrittliste(t('ue_schritte'), wert),
    schritte_teil1: (wert) => schrittliste(`${t('ue_schritte')} — ${t('teil_1')}`, wert),
    schritte_teil2: (wert) => schrittliste(`${t('ue_schritte')} — ${t('teil_2')}`, wert),
    steigerung: (wert) => block(t('ue_steigerung'), wert),
    selbstkontrolle: (wert) => block(t('ue_selbstkontrolle'), wert),
    abschluss: (wert) => block(t('ue_abschluss'), wert),
    naechste_stufe: (wert) => block(t('ue_naechste_stufe'), wert),
  };
  return Object.entries(uebungsteil)
    .map(([feld, wert]) => {
      if (bekannt[feld]) return bekannt[feld](wert);
      if (Array.isArray(wert)) return schrittliste(feld, wert);
      if (typeof wert === 'string') return block(feld, wert);
      return '';
    })
    .join('');
}

// Trainer-Layer (Spez. 5): in-situ am Basisbaustein, nur in der Trainer-
// Perspektive. Fehlerbilder sind eigene Entitäten, aber nie eigene Station;
// die drei Felder spiegeln die diagnostische Kette Symptom → Ursache → Korrektur.
function trainerLayerHtml(daten, baustein) {
  if (!diagnose().trainer) return '';
  const fehlerbilder = fehlerbilderFuer(daten, baustein.id);
  if (fehlerbilder.length === 0) return '';
  const feld = (icon, begriff, wert) =>
    wert ? `<div class="fb-feld"><h4><i class="fa-solid ${icon}" aria-hidden="true"></i> ${esc(begriff)}</h4><p>${esc(wert)}</p></div>` : '';
  const karten = fehlerbilder
    .map((fb) => {
      const inhalt = text(fb.erklaerteil) || {};
      const ziele = (fb.vermittlungsziele || [])
        .map((z) => `<span class="chip">${esc(label('vermittlungsziel_faktor', z))}</span>`)
        .join(' ');
      return `
        <article class="fb-karte">
          <h3><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${esc(label('fehlerbild', fb.id))}</h3>
          ${feld('fa-eye', t('fb_symptom'), inhalt.symptom)}
          ${feld('fa-magnifying-glass', t('fb_ursache'), inhalt.ursache)}
          ${feld('fa-comment-dots', t('fb_korrektur'), inhalt.korrektur)}
          ${ziele ? `<p class="chip-zeile">${ziele}</p>` : ''}
        </article>`;
    })
    .join('');
  return `
    <section class="abschnitt trainer-layer">
      <div class="abschnitt-kopf">
        <h2><i class="fa-solid fa-stethoscope" aria-hidden="true"></i> ${esc(t('trainer_layer'))}</h2>
        <span class="chip chip-akzent">${esc(label('kompetenzstufe', 'trainer'))}</span>
      </div>
      <p class="leise">${esc(t('trainer_layer_hinweis'))}</p>
      ${karten}
    </section>`;
}

function voraussetzungsBanner(station, kontext) {
  if (station.status.absolviert || station.fehlendeVoraussetzungen.length === 0) return '';
  const verweise = station.fehlendeVoraussetzungen
    .map((id) => `<a href="#/baustein/${esc(id)}?kontext=${encodeURIComponent(kontext)}">${esc(label('baustein', id))}</a>`)
    .join(', ');
  return `<div class="banner-hinweis">${esc(t('empfohlen_vorher'))} ${verweise}</div>`;
}

function einordnungHtml(baustein, kuerzelSichtbar) {
  const zeile = (begriff, wert) => (wert ? `<dt>${esc(begriff)}</dt><dd>${wert}</dd>` : '');
  const spielziele = (baustein.spielziele || []).map((f) => esc(label('spielziel_faktor', f))).join(', ');
  const vermittlungsziele = (baustein.vermittlungsziele || []).map((f) => esc(label('vermittlungsziel_faktor', f))).join(', ');
  const witterung = witterungVon(baustein).map((w) => esc(label('witterung', w))).join(', ');
  const untergrund = untergrundVon(baustein).filter((u) => u !== 'halle').map((u) => esc(label('untergrund', u))).join(', ');
  const transfer = kuerzelSichtbar
    ? (baustein.transfer_herkunft || []).map((k) => esc(label('transfer_herkunft', k))).join(', ')
    : '';
  const voraussetzungen = (baustein.voraussetzungen || [])
    .map((id) => `<a href="#/baustein/${esc(id)}?kontext=kompetenz">${esc(label('baustein', id))}</a>`)
    .join(', ');
  return `
    <details class="einordnung karte">
      <summary>${esc(t('einordnung'))}</summary>
      <dl>
        ${zeile(t('meta_spielziele'), spielziele)}
        ${zeile(t('meta_vermittlungsziele'), vermittlungsziele)}
        ${zeile(t('meta_untergrund'), untergrund)}
        ${zeile(t('meta_witterung'), witterung)}
        ${zeile(t('meta_transfer'), transfer)}
        ${zeile(t('meta_voraussetzungen'), voraussetzungen)}
      </dl>
    </details>`;
}

// Domänen-Hue für den Baustein-Hero (analog zu den Startseiten-Kacheln): färbt
// Icon-Medaille und Tönung nach der fachlichen Domäne. Fällt auf Blau zurück.
const DOMAENE_HUE = {
  gitarre: 'pf-magenta',
  bass: 'pf-schiefer',
  schlagzeug: 'pf-indigo',
  gesang: 'pf-violett',
  theorie: 'pf-blau',
  koerper: 'pf-sky',
  ausruestung: 'pf-teal',
  mentales: 'pf-blau',
};

export function renderBaustein(el, daten, bausteinId, kontext) {
  const info = stationImKontext(daten, bausteinId, kontext);
  if (!info) {
    el.innerHTML = `<div class="karte"><p>${esc(t('nicht_gefunden'))}</p><a class="knopf knopf-sekundaer" href="#/">${esc(t('zurueck'))}</a></div>`;
    return;
  }
  const { station, sequenz, index, vorherige, naechste } = info;
  const b = station.baustein;
  const delta = station.delta;
  const kuerzelSichtbar = einstellungen().transferKuerzelSichtbar;

  // Domäne + Könnensstufe wandern in den Hero-Untertitel (s. u.); der interne
  // Typ ('micro' auf 96/102 – kein Unterscheidungsmerkmal) wird nicht mehr als
  // Chip gezeigt. Hier bleiben nur die spezifischen Outdoor-Chips.
  const metaChips = [
    ...witterungVon(b).map((w) => `<span class="chip">${esc(label('witterung', w))}</span>`),
    ...untergrundVon(b).filter((u) => u !== 'halle').map((u) => `<span class="chip">${esc(label('untergrund', u))}</span>`),
  ].join(' ');

  // Dezente Transfer-Kennzeichnung, per Schalter ausblendbar (Spez. 3.2/6).
  const transferChips = kuerzelSichtbar
    ? (b.transfer_herkunft || [])
        .map((k) => {
          const aktiv = delta && delta.ersetzt_bei_herkunft === k;
          return `<span class="chip ${aktiv ? 'chip-akzent' : ''}" title="${esc(label('transfer_herkunft', k))}">${esc(k)}</span>`;
        })
        .join(' ')
    : '';

  // Kleiner Hero je Baustein: eigenes Icon in der Domänen-Hue + Titel; die
  // Unterzeile nennt Domäne(n) und Könnensstufe(n), z. B. „Mentales · Experte".
  const domaenen = domaenenVon(b);
  const heroHue = DOMAENE_HUE[domaenen[0]] || 'pf-blau';
  const heroUntertitel = [
    ...domaenen.map((dd) => label('domaene', dd)),
    ...(b.kompetenzstufe || []).map((s) => label('kompetenzstufe', s)),
  ].join(' · ');
  const heroSektion = `
    <section class="marke-hero klein hue ${heroHue} baustein-hero">
      <span class="marke-hero-icon">${bausteinIcon(b.id) || domaeneIcon(domaenen[0]) || '<i class="fa-solid fa-feather" aria-hidden="true"></i>'}</span>
      <div class="marke-hero-text">
        <h1>${esc(label('baustein', b.id))}</h1>
        ${heroUntertitel ? `<p class="marke-hero-untertitel">${esc(heroUntertitel)}</p>` : ''}
      </div>
    </section>`;
  const chipZeile = metaChips || transferChips
    ? `<p class="chip-zeile">${metaChips}${metaChips && transferChips ? ' <span class="chip-trenner">·</span> ' : ''}${transferChips}</p>`
    : '';

  const positionsZeile =
    index >= 0
      ? `<p class="stationszahl">${esc(t('station_x_von_y', { a: index + 1, b: sequenz.stationen.length }))}</p>`
      : '';

  // Delta-Einblendung: ersetzt den Erklärteil, Lektüreempfehlungen der
  // Bündelung (4.3) verweisen weich auf die Basisbausteine früherer Deltas.
  const erklaertext = delta ? text(delta.erklaerteil) : text(b.erklaerteil);
  const deltaHinweis = delta
    ? `<p class="delta-hinweis"><span class="chip chip-akzent">${esc(delta.ersetzt_bei_herkunft)}</span> ${esc(
        t('delta_hinweis', { herkunft: label('transfer_herkunft', delta.ersetzt_bei_herkunft) })
      )}</p>`
    : '';
  const buendelung =
    delta && (delta.delta_buendelung || []).length > 0
      ? `<p class="leise">${esc(t('lektuere_empfehlung'))} ${(delta.delta_buendelung || [])
          .map((deltaId) => {
            const verwiesen = daten.deltas.find((eintrag) => eintrag.id === deltaId);
            if (!verwiesen) return '';
            const basisId = verwiesen.basis_baustein;
            return `<a href="#/baustein/${esc(basisId)}?kontext=${encodeURIComponent(kontext)}">${esc(label('baustein', basisId))} (${esc(t('hinweis_suffix'))})</a>`;
          })
          .filter(Boolean)
          .join(', ')}</p>`
      : '';

  const erklaerSektion = `
    <section class="abschnitt">
      <div class="abschnitt-kopf"><h2>${esc(t('erklaerteil'))}</h2>${statusChip(station.status.erklaerteil)}</div>
      ${deltaHinweis}
      ${buendelung}
      ${absaetze(erklaertext)}
      ${grafikenHtml(b)}
      <div class="knopf-zeile">${quittierKnopf(b.id, 'erklaerteil', station.status.erklaerteil, t('als_gelesen'), t('gelesen'))}</div>
    </section>`;

  let uebungsSektion = '';
  if (hatUebungsteil(b)) {
    uebungsSektion = `
      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2>${esc(t('uebungsteil'))}</h2>${statusChip(station.status.uebungsteil)}</div>
        ${delta ? `<p class="leise">${esc(t('delta_uebungsteil_gilt'))}</p>` : ''}
        ${uebungsteilHtml(text(b.uebungsteil))}
        <div class="knopf-zeile">${quittierKnopf(b.id, 'uebungsteil', station.status.uebungsteil, t('als_erledigt'), t('erledigt'))}</div>
      </section>`;
  }

  // Reflexionsaufgabe: eigener Aufgabenteil mit eigenem Status; das Quittier-
  // Label ist reflexions-passend („Mitgenommen"), nicht „Erledigt".
  let reflexionsSektion = '';
  if (hatReflexionsaufgabe(b)) {
    const status = station.status.reflexionsaufgabe;
    reflexionsSektion = `
      <section class="abschnitt">
        <div class="abschnitt-kopf"><h2><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ${esc(t('reflexionsaufgabe'))}</h2>${statusChip(status)}</div>
        ${absaetze(text(b.reflexionsaufgabe))}
        <div class="knopf-zeile">${quittierKnopf(b.id, 'reflexionsaufgabe', status, t('als_mitgenommen'), t('mitgenommen'))}</div>
      </section>`;
  }

  // Baustein-Abschluss: nur bestätigende Quittierung, keine eigene Gratifikation (8.3.1).
  const abschlussZeile = station.status.absolviert
    ? `<p class="bestaetigung">${esc(t('baustein_abgeschlossen'))}</p>`
    : '';

  const listeHref = kontextZuListe(kontext);
  const fussNavigation = `
    <nav class="baustein-fussnav" aria-label="${esc(t('baustein_navigation'))}">
      ${vorherige ? `<a class="knopf knopf-sekundaer" href="#/baustein/${esc(vorherige.baustein.id)}?kontext=${encodeURIComponent(kontext)}"><span aria-hidden="true">←</span> ${esc(label('baustein', vorherige.baustein.id))}</a>` : ''}
      <a class="knopf knopf-leise" href="${listeHref}">${esc(t('zur_liste'))}</a>
      ${naechste ? `<a class="knopf ${station.status.absolviert ? 'knopf-primaer' : 'knopf-sekundaer'}" href="#/baustein/${esc(naechste.baustein.id)}?kontext=${encodeURIComponent(kontext)}">${esc(label('baustein', naechste.baustein.id))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>` : ''}
    </nav>`;

  el.innerHTML = `
    <article class="baustein">
      ${positionsZeile}
      ${heroSektion}
      ${chipZeile}
      ${voraussetzungsBanner(station, kontext)}
      ${erklaerSektion}
      ${uebungsSektion}
      ${reflexionsSektion}
      ${trainerLayerHtml(daten, b)}
      ${abschlussZeile}
      ${einordnungHtml(b, kuerzelSichtbar)}
      ${fussNavigation}
    </article>`;

  for (const knopf of el.querySelectorAll('[data-quittiere]')) {
    knopf.addEventListener('click', () => {
      const { meilenstein } = schalteTeil(daten, kontext, knopf.dataset.baustein, knopf.dataset.quittiere);
      if (meilenstein) zeigeMeilenstein(meilenstein);
      else neuRendern();
    });
  }
}
