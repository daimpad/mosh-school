// Onboarding-Diagnostik (Spez. 7): Stufe obligatorisch, Herkunft und Ziel
// überspringbar. Verhaltensnahe Anker statt abstrakter Etiketten (Anhang A).
// Alles hier Erhobene ist revidierbar — dieselben Angaben stehen im Profil.

import { markiereAbsolviert } from '../aktionen.js';
import { deltaFuer, niedrigsteStufe } from '../daten.js';
import { bausteinAbsolviert } from '../fortschritt.js';
import { label, t } from '../i18n.js';
import { esc, zeigeMeilenstein } from '../oberflaeche.js';
import { schliesseOnboardingAb, setzeDiagnose } from '../zustand.js';
import { gewaehlteZiele, zielwahlHtml } from './zielwahl.js';

let assistent = null;

function frisch() {
  return { schritt: 0, stufe: null, trainer: false, herkunft: null, ziel: null };
}

// Kandidaten fürs optionale Überspringen (6.5): kein Delta für die Herkunft
// nötig und noch nicht absolviert — die Person bestätigt selbst.
function skipKandidaten(daten, stufe, herkunft) {
  if (!herkunft) return [];
  return daten.bausteine.filter(
    (b) => niedrigsteStufe(daten, b) === stufe && !deltaFuer(daten, b.id, herkunft) && !bausteinAbsolviert(b)
  );
}

function schrittfolge(daten) {
  const schritte = ['stufe', 'trainer', 'herkunft', 'ziel'];
  if (assistent.herkunft && skipKandidaten(daten, assistent.stufe, assistent.herkunft).length > 0) {
    schritte.push('vormarkieren');
  }
  return schritte;
}

function stufenOptionenHtml(aktiv) {
  return ['beginner', 'fortgeschritten', 'experte']
    .map(
      (stufe) => `
      <label class="option-karte">
        <input type="radio" name="ob-stufe" value="${stufe}" ${aktiv === stufe ? 'checked' : ''}>
        <span class="option-inhalt">
          <strong>${esc(label('kompetenzstufe', stufe))}</strong>
          <span class="leise">${esc(t(`anker_${stufe}`))}</span>
        </span>
      </label>`
    )
    .join('');
}

function schrittInhalt(daten, name) {
  if (name === 'stufe') {
    return { frage: t('frage_stufe'), html: stufenOptionenHtml(assistent.stufe), weiterAktiv: assistent.stufe !== null, ueberspringbar: false };
  }
  if (name === 'trainer') {
    const html = `
      <label class="option-karte">
        <input type="radio" name="ob-trainer" value="ja" ${assistent.trainer ? 'checked' : ''}>
        <span class="option-inhalt"><strong>${esc(t('trainer_ja'))}</strong><span class="leise">${esc(t('anker_trainer'))}</span></span>
      </label>
      <label class="option-karte">
        <input type="radio" name="ob-trainer" value="nein" ${assistent.trainer ? '' : 'checked'}>
        <span class="option-inhalt"><strong>${esc(t('trainer_nein'))}</strong></span>
      </label>`;
    return { frage: t('frage_trainer'), html, weiterAktiv: true, ueberspringbar: false };
  }
  if (name === 'herkunft') {
    const optionen = daten.herkuenfte
      .map(
        (kuerzel) => `
        <label class="option-karte">
          <input type="radio" name="ob-herkunft" value="${esc(kuerzel)}" ${assistent.herkunft === kuerzel ? 'checked' : ''}>
          <span class="option-inhalt"><strong>${esc(label('transfer_herkunft', kuerzel))}</strong></span>
        </label>`
      )
      .join('');
    const keine = `
      <label class="option-karte">
        <input type="radio" name="ob-herkunft" value="" ${assistent.herkunft === null ? 'checked' : ''}>
        <span class="option-inhalt"><strong>${esc(t('herkunft_keine'))}</strong></span>
      </label>`;
    return {
      frage: t('frage_herkunft'),
      html: `<p class="leise">${esc(t('herkunft_hinweis'))}</p>${optionen}${keine}`,
      weiterAktiv: true,
      ueberspringbar: true,
    };
  }
  if (name === 'ziel') {
    return {
      frage: t('frage_ziel'),
      html: `<p class="leise">${esc(t('ziel_hinweis'))}</p>${zielwahlHtml(daten, assistent.ziel, { mitVermittlungszielen: assistent.trainer })}`,
      weiterAktiv: true,
      ueberspringbar: true,
    };
  }
  // vormarkieren
  const kandidaten = skipKandidaten(daten, assistent.stufe, assistent.herkunft);
  const liste = kandidaten
    .map(
      (b) => `
      <label class="option-karte">
        <input type="checkbox" name="ob-vormarkieren" value="${esc(b.id)}">
        <span class="option-inhalt"><strong>${esc(label('baustein', b.id))}</strong></span>
      </label>`
    )
    .join('');
  return {
    frage: t('vormarkieren_titel'),
    html: `<p class="leise">${esc(t('vormarkieren_text'))}</p>${liste}<p class="leise">${esc(t('vormarkieren_leer'))}</p>`,
    weiterAktiv: true,
    ueberspringbar: false,
  };
}

function liesSchrittWerte(el, name) {
  if (name === 'stufe') {
    assistent.stufe = el.querySelector('input[name="ob-stufe"]:checked')?.value ?? assistent.stufe;
  } else if (name === 'trainer') {
    assistent.trainer = el.querySelector('input[name="ob-trainer"]:checked')?.value === 'ja';
  } else if (name === 'herkunft') {
    const wert = el.querySelector('input[name="ob-herkunft"]:checked')?.value;
    assistent.herkunft = wert ? wert : null;
  } else if (name === 'ziel') {
    assistent.ziel = gewaehlteZiele(el);
  }
}

function schliesseAb(el, daten, mitVormarkierung) {
  setzeDiagnose({
    stufe: assistent.stufe,
    trainer: assistent.trainer,
    herkunft: assistent.herkunft,
    ziel: assistent.ziel,
  });
  let meilenstein = null;
  if (mitVormarkierung) {
    for (const eingabe of el.querySelectorAll('input[name="ob-vormarkieren"]:checked')) {
      const baustein = daten.bausteinVonId.get(eingabe.value);
      if (!baustein) continue;
      const ergebnis = markiereAbsolviert(daten, 'kompetenz', baustein);
      meilenstein = ergebnis.meilenstein ?? meilenstein;
    }
  }
  schliesseOnboardingAb();
  assistent = null;
  location.hash = '#/';
  if (meilenstein) zeigeMeilenstein(meilenstein);
}

export function renderOnboarding(el, daten) {
  if (!assistent) assistent = frisch();
  const schritte = schrittfolge(daten);
  const name = schritte[assistent.schritt];
  const inhalt = schrittInhalt(daten, name);
  const istLetzter = assistent.schritt === schritte.length - 1;

  el.innerHTML = `
    <section class="onboarding">
      ${assistent.schritt === 0 ? `<p class="onboarding-willkommen">${esc(t('onboarding_titel'))}</p><p class="leise">${esc(t('onboarding_intro'))}</p>` : ''}
      <p class="leise onboarding-schritt">${esc(t('onboarding_schritt', { a: assistent.schritt + 1, b: schritte.length }))}</p>
      <h1>${esc(inhalt.frage)}</h1>
      <form id="ob-form">${inhalt.html}</form>
      <div class="knopf-zeile">
        ${assistent.schritt > 0 ? `<button class="knopf knopf-sekundaer" id="ob-zurueck">${esc(t('zurueck'))}</button>` : ''}
        ${inhalt.ueberspringbar ? `<button class="knopf knopf-leise" id="ob-ueberspringen">${esc(t('ueberspringen'))}</button>` : ''}
        <button class="knopf knopf-primaer" id="ob-weiter" ${inhalt.weiterAktiv ? '' : 'disabled'}>${esc(istLetzter ? t('fertig') : t('weiter'))}</button>
      </div>
      ${assistent.schritt === 0 ? `<div class="knopf-zeile ob-direkt-zeile"><button class="knopf knopf-leise" id="ob-direkt">${esc(t('ohne_angaben'))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>` : ''}
    </section>`;

  const form = el.querySelector('#ob-form');
  const weiter = el.querySelector('#ob-weiter');
  form.addEventListener('submit', (ereignis) => ereignis.preventDefault());
  form.addEventListener('change', () => {
    liesSchrittWerte(el, name);
    if (name === 'stufe') weiter.disabled = assistent.stufe === null;
  });

  weiter.addEventListener('click', () => {
    liesSchrittWerte(el, name);
    if (name === 'stufe' && !assistent.stufe) return;
    if (istLetzter) {
      schliesseAb(el, daten, name === 'vormarkieren');
      return;
    }
    assistent.schritt += 1;
    renderOnboarding(el, daten);
  });

  el.querySelector('#ob-zurueck')?.addEventListener('click', () => {
    assistent.schritt -= 1;
    renderOnboarding(el, daten);
  });

  // Freier Zugang ohne Wizard: alle Kapitel bleiben zugänglich (Zwei-Ebenen-
  // Logik 4.4) — die Stufe ist nur für den geführten Pfad konstitutiv und
  // lässt sich jederzeit im Profil oder über die Einladung im Heim nachholen.
  el.querySelector('#ob-direkt')?.addEventListener('click', () => {
    setzeDiagnose({ stufe: null, trainer: false, herkunft: null, ziel: null });
    schliesseOnboardingAb();
    assistent = null;
    location.hash = '#/pfad/themen';
  });

  // Überspringen setzt den Default: keine Herkunft (kein Modifikator), kein Ziel.
  el.querySelector('#ob-ueberspringen')?.addEventListener('click', () => {
    if (name === 'herkunft') assistent.herkunft = null;
    if (name === 'ziel') assistent.ziel = null;
    if (istLetzter) {
      schliesseAb(el, daten, false);
      return;
    }
    assistent.schritt += 1;
    renderOnboarding(el, daten);
  });
}
