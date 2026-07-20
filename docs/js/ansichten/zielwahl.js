// Gemeinsame Zielwahl (Onboarding, Profil, Individualpfad): Mehrfachauswahl
// über Spielziel-Faktoren — bei Trainer-Perspektive zusätzlich Vermittlungsziele.
// Primärordnung der Vokabulare bleibt sichtbar: Faktoren gruppiert nach Bereich.

import { label, t } from '../i18n.js';
import { esc } from '../oberflaeche.js';
import { zielEintraege } from '../pfade.js';

function bereichsGruppen(vokabular, dimension, bereichGruppe, faktorGruppe, aktiveFaktoren) {
  return Object.entries(vokabular || {})
    .filter(([bereich]) => !bereich.startsWith('_'))
    .map(([bereich, faktoren]) => {
      const optionen = faktoren
        .map((faktor) => {
          const gewaehlt = aktiveFaktoren.has(`${dimension}::${faktor}`) ? 'checked' : '';
          return `
            <label class="option-zeile">
              <input type="checkbox" name="zielwahl" value="${esc(dimension)}::${esc(faktor)}" ${gewaehlt}>
              <span>${esc(label(faktorGruppe, faktor))}</span>
            </label>`;
        })
        .join('');
      return `
        <fieldset class="ziel-bereich">
          <legend>${esc(label(bereichGruppe, bereich))}</legend>
          ${optionen}
        </fieldset>`;
    })
    .join('');
}

export function zielwahlHtml(daten, aktuellesZiel, { mitVermittlungszielen = false } = {}) {
  const aktiv = new Set(zielEintraege(aktuellesZiel).map((e) => `${e.dimension}::${e.faktor}`));
  let html = `
    <div class="zielwahl">
      <h3 class="ziel-dimension">${esc(t('spielziele_gruppe'))}</h3>
      ${bereichsGruppen(daten.vokabulare.spielziele, 'spielziele', 'spielziel_bereich', 'spielziel_faktor', aktiv)}`;
  if (mitVermittlungszielen) {
    html += `
      <h3 class="ziel-dimension">${esc(t('vermittlungsziele_gruppe'))}</h3>
      ${bereichsGruppen(daten.vokabulare.vermittlungsziele, 'vermittlungsziele', 'vermittlungsziel_bereich', 'vermittlungsziel_faktor', aktiv)}`;
  }
  return `${html}</div>`;
}

// Liste gewählter Ziele: [{dimension, faktor}, …] oder null bei leerer Auswahl.
export function gewaehlteZiele(container) {
  const eintraege = [...container.querySelectorAll('input[name="zielwahl"]:checked')].map((eingabe) => {
    const [dimension, faktor] = eingabe.value.split('::');
    return { dimension, faktor };
  });
  return eintraege.length > 0 ? eintraege : null;
}

// Sichtbare Beschriftungen der gewählten Ziele (für Heim, Profil, Pfadkopf).
export function zielLabels(ziel) {
  return zielEintraege(ziel).map((eintrag) =>
    label(eintrag.dimension === 'vermittlungsziele' ? 'vermittlungsziel_faktor' : 'spielziel_faktor', eintrag.faktor)
  );
}
