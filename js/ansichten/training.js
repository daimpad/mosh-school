// Trainingspfad (Spez. 6.4): kuratierte Einheiten steuern gezielt Übungsteile an,
// gegliedert in drei Phasen (Erwärmung → Hauptteil → Ausklang) mit kuratorischen
// Hinweisen je Übung. Eine Sitzung ist flüchtig und wiederholbar; ihr Abschluss
// zählt kumulativ (Kontinuität ohne Abbruchmechanik, 8.3.3) und quittiert nebenbei
// offene Übungsteile baustein-gebunden.

import { einheitReferenzen } from '../daten.js';
import { projektion } from '../fortschritt.js';
import { label, t, text } from '../i18n.js';
import { bausteinIcon, entdeckenAktion, esc, heroKlein, leerHtml, neuRendern } from '../oberflaeche.js';
import { kompetenzpfad, trainingsuebersicht } from '../pfade.js';
import { kontinuitaet, registriereEinheitAbschluss, setzeTeilStatus, teilStatus } from '../zustand.js';
import { uebungsteilHtml } from './baustein.js';

let sitzung = null;

function kompetenzQuote(daten) {
  const stationen = kompetenzpfad(daten).stationen;
  if (stationen.length === 0) return null;
  return projektion(stationen.map((s) => s.baustein)).quote;
}

// Aufgelöste, geordnete Referenzliste einer Einheit (Phase + Hinweis + Baustein).
// Direktzugriff bleibt frei — die Stufen-Filterung wirkt nur in der Liste (4.4).
function referenzenVon(daten, einheit) {
  return einheitReferenzen(einheit)
    .map((ref) => ({ ...ref, baustein: daten.bausteinVonId.get(ref.baustein) }))
    .filter((ref) => ref.baustein);
}

function renderListe(el, daten) {
  sitzung = null;
  const uebersicht = trainingsuebersicht(daten);
  const karten = uebersicht
    .map(({ einheit, bausteine, absolviertZaehler }) => {
      const zaehlerText = absolviertZaehler > 0 ? t('mal_absolviert', { n: absolviertZaehler }) : t('noch_nicht_absolviert');
      // Stufen-Chip klickbar → Kompetenzpfad der Stufe; Blau-Intensität kodiert die
      // Stufe (chip-stufe-<stufe>), bewusst ohne Ampelfarben (Status bleibt Rot/Gelb/Grün).
      const stufe = einheit.kompetenzstufe;
      const metaChips = [
        `<a class="chip chip-stufe chip-stufe-${esc(stufe)}" href="#/pfad/kompetenz/${esc(stufe)}">${esc(label('kompetenzstufe', stufe))}</a>`,
        einheit.spielform === 'doppel' ? `<a class="chip chip-akzent" href="#/pfad/spielform/doppel">${esc(label('spielform', 'doppel'))}</a>` : '',
      ]
        .filter(Boolean)
        .join(' ');
      // Baustein-Titel als direkte Sprung-Buttons in den jeweiligen Baustein.
      const bausteinChips = bausteine
        .map((b) => `<a class="chip chip-baustein" href="#/baustein/${esc(b.id)}?kontext=kompetenz">${esc(label('baustein', b.id))}</a>`)
        .join(' ');
      return `
        <div class="karte">
          <h3>${esc(label('einheit', einheit.id))}</h3>
          <p class="chip-zeile">${metaChips}</p>
          <p><strong>${esc(t('einheit_schwerpunkt'))}:</strong> ${esc(text(einheit.schwerpunkt) ?? '')}</p>
          <p class="leise">${esc(text(einheit.beschreibung) ?? '')}</p>
          <p class="chip-zeile">${bausteinChips}</p>
          <p class="leise">${esc(t('uebungen_anzahl', { n: bausteine.length }))} · ${esc(zaehlerText)}</p>
          <a class="knopf knopf-primaer" href="#/training/${esc(einheit.id)}"><i class="fa-solid fa-play" aria-hidden="true"></i> ${esc(t('einheit_starten'))}</a>
        </div>`;
    })
    .join('');
  el.innerHTML = `
    ${heroKlein('fa-list-check', t('pfad_training'), t('pfad_training_text'), 'pf-indigo')}
    <a class="karte karte-link karte-akzent" href="#/plan">
      <h3><i class="fa-solid fa-calendar-days" aria-hidden="true"></i> ${esc(t('plan_titel'))}</h3>
      <p class="leise">${esc(t('plan_kachel_text'))}</p>
    </a>
    <div class="karte">
      <h3>${esc(t('kontinuitaet'))}</h3>
      <p>${esc(t('kontinuitaet_stand', { n: kontinuitaet().gesamt }))}</p>
      <p class="leise">${esc(t('kontinuitaet_text'))}</p>
    </div>
    ${karten || leerHtml(t('leer_training'), 'fa-list-check', entdeckenAktion())}`;
}

function renderAbschluss(el, daten, einheit) {
  const gesamt = kontinuitaet().gesamt;
  const kontinuitaetText = gesamt === 1 ? t('kontinuitaet_erste') : t('kontinuitaet_stand', { n: gesamt });
  // Vollendet die Sitzung nebenbei den Kompetenzpfad, wird das sachlich mitgewürdigt.
  const quoteNachher = kompetenzQuote(daten);
  const meilensteinZeile =
    sitzung.kompetenzQuoteVorher !== null && sitzung.kompetenzQuoteVorher < 1 && quoteNachher === 1
      ? `<p>${esc(t('meilenstein_kompetenz', { pfad: t('pfad_kompetenz') }))}</p>`
      : '';
  el.innerHTML = `
    <section class="karte karte-akzent einheit-abschluss">
      <p class="bestaetigung">${esc(t('einheit_abgeschlossen'))}</p>
      <h1>${esc(label('einheit', einheit.id))}</h1>
      <p>${esc(kontinuitaetText)}</p>
      <p class="leise">${esc(t('kontinuitaet_text'))}</p>
      ${meilensteinZeile}
      <a class="knopf knopf-primaer" href="#/training">${esc(t('zur_liste'))}</a>
    </section>`;
}

function renderDurchlauf(el, daten, einheit, referenzen) {
  const ref = referenzen[sitzung.index];
  const baustein = ref.baustein;
  const istLetzte = sitzung.index === referenzen.length - 1;
  const hinweis = text(ref.hinweis);

  el.innerHTML = `
    <section class="karte einheit-durchlauf">
      <p class="leise">${esc(label('einheit', einheit.id))} · ${esc(t('uebung_x_von_y', { a: sitzung.index + 1, b: referenzen.length }))} · ${esc(t('phase_' + ref.phase))}</p>
      <h1>${bausteinIcon(baustein.id, 'baustein-icon')} ${esc(label('baustein', baustein.id))}</h1>
      ${hinweis ? `<p class="einheit-hinweis">${esc(hinweis)}</p>` : ''}
      <p><a class="leise" href="#/baustein/${esc(baustein.id)}?kontext=kompetenz">${esc(t('zum_baustein'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></p>
      ${uebungsteilHtml(text(baustein.uebungsteil))}
      <div class="knopf-zeile">
        <a class="knopf knopf-leise" href="#/training">${esc(t('abbrechen'))}</a>
        <button class="knopf knopf-primaer" id="uebung-weiter">${esc(istLetzte ? t('einheit_abschliessen') : t('uebung_erledigt_weiter'))}</button>
      </div>
      <p class="leise">${esc(t('einheit_abbrechen_hinweis'))}</p>
    </section>`;

  el.querySelector('#uebung-weiter').addEventListener('click', () => {
    // Baustein-gebundene Quittierung bleibt bestehen — auch über Sitzungen hinaus (7.5).
    if (teilStatus(baustein.id, 'uebungsteil') !== 'erledigt') {
      setzeTeilStatus(baustein.id, 'uebungsteil', 'erledigt');
    }
    if (istLetzte) {
      registriereEinheitAbschluss(einheit.id);
      sitzung.fertig = true;
    } else {
      sitzung.index += 1;
    }
    neuRendern();
  });
}

export function renderTraining(el, daten, einheitId) {
  if (!einheitId) {
    renderListe(el, daten);
    return;
  }
  const einheit = daten.einheitVonId.get(einheitId);
  const referenzen = einheit ? referenzenVon(daten, einheit) : [];
  if (!einheit || referenzen.length === 0) {
    el.innerHTML = `<div class="karte"><p>${esc(t('nicht_gefunden'))}</p><a class="knopf knopf-sekundaer" href="#/training">${esc(t('zur_liste'))}</a></div>`;
    return;
  }
  if (!sitzung || sitzung.einheitId !== einheitId) {
    sitzung = { einheitId, index: 0, fertig: false, kompetenzQuoteVorher: kompetenzQuote(daten) };
  }
  if (sitzung.fertig) renderAbschluss(el, daten, einheit);
  else renderDurchlauf(el, daten, einheit, referenzen);
}
